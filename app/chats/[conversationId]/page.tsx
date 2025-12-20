import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import ChatRoom from '@/components/ChatRoom' 
import ChatHeader from '@/components/ChatHeader'
import { GoogleGenerativeAI } from "@google/generative-ai"

type PageProps = {
  params: Promise<{ conversationId: string }> 
}

export default async function ChatPage({ params }: PageProps) {
  const resolvedParams = await params;
  const conversationId = resolvedParams.conversationId;

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (name) => cookieStore.get(name)?.value } }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }
  
  const currentUserId = user.id;

  if (!conversationId) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-950 text-red-400 font-bold italic">
        Error: Conversation ID not found.
      </div>
    )
  }

  // 1. 会話情報を取得
  let { data: conv } = await supabase
    .from('conversations')
    .select('user_a_id, user_b_id, icebreaker')
    .eq('id', conversationId)
    .single();

  const partnerId = conv 
    ? (conv.user_a_id === currentUserId ? conv.user_b_id : conv.user_a_id)
    : null;

  // ✨ 💡 既存ルーム対応：icebreaker が空の場合、その場で生成して保存する
  if (conv && !conv.icebreaker && partnerId) {
    try {
      // 二人のプロフィールを取得
      const { data: profiles } = await supabase
        .from('value_profiles')
        .select('user_id, nickname, content')
        .in('user_id', [currentUserId, partnerId]);

      const me = profiles?.find(p => p.user_id === currentUserId);
      const partner = profiles?.find(p => p.user_id === partnerId);

      if (me && partner) {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
        const chatModel = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

        const prompt = `あなたは、ユーザーの心に寄り添う親身なパートナーです。
以下の二人の最近のつぶやきを読んで、彼らの価値観の「共通点」を分析してください。
そして、二人が会話を始めるきっかけになるような温かいメッセージを2〜3行で作成してください。

【${me.nickname}さんのつぶやき】: ${me.content}
【${partner.nickname}さんのつぶやき】: ${partner.content}`;

        const result = await chatModel.generateContent(prompt);
        const generatedIcebreaker = result.response.text();

        // データベースを更新（次回から生成をスキップするため）
        await supabase
          .from('conversations')
          .update({ icebreaker: generatedIcebreaker })
          .eq('id', conversationId);

        // 今回の表示用変数も更新
        conv.icebreaker = generatedIcebreaker;
      }
    } catch (e) {
      console.error("Icebreaker background generation failed:", e);
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-200">
      <div className="mx-auto max-w-2xl min-h-screen flex flex-col border-x border-gray-800/60 bg-gray-900 shadow-[0_0_50px_rgba(0,0,0,0.5)]">
      
        {/* ヘッダーセクション */}
        {partnerId ? (
          <ChatHeader 
            partnerId={partnerId} 
            currentUserId={currentUserId} 
          />
        ) : (
          <header className="bg-gray-800/50 backdrop-blur-md p-4 border-b border-gray-800 h-16 flex items-center justify-center">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse"></div>
              <span className="text-xs font-bold text-gray-500 tracking-widest uppercase italic">Connecting...</span>
            </div>
          </header>
        )}

        {/* チャットエリア */}
        <main className="flex-1 flex flex-col overflow-hidden relative">
          {partnerId ? (
            <div className="flex-1 flex flex-col overflow-y-auto px-4 pt-6">
              
              {/* ✨ Gemini Insight (アイスブレイク表示エリア) */}
              {conv?.icebreaker && (
                <div className="mb-8 p-6 rounded-2xl bg-indigo-950/40 border border-indigo-500/30 backdrop-blur-md shadow-2xl animate-in fade-in slide-in-from-top-4 duration-1000">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="px-1.5 py-0.5 rounded bg-indigo-500 text-[9px] font-black text-white uppercase tracking-tighter">
                      Gemini Insight
                    </div>
                    <span className="text-[10px] text-indigo-300 font-bold tracking-widest uppercase opacity-80">
                      Resonance Points
                    </span>
                  </div>
                  <p className="text-xs md:text-sm text-indigo-50 leading-relaxed italic font-medium">
                    {conv.icebreaker}
                  </p>
                </div>
              )}

              {/* メッセージ本体 */}
              <ChatRoom 
                conversationId={conversationId} 
                currentUserId={currentUserId} 
                partnerId={partnerId} 
              />
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center space-y-4">
               <div className="w-8 h-8 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
               <p className="text-[10px] text-gray-600 font-mono tracking-widest uppercase">Initializing Room</p>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}