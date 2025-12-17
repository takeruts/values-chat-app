import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import ChatRoom from '@/components/ChatRoom' 
import ChatHeader from '@/components/ChatHeader'

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
      <div className="flex items-center justify-center min-h-screen bg-gray-900 text-red-400 font-bold italic">
        Error: Conversation ID not found.
      </div>
    )
  }

  // 会話情報を取得して相手のIDを特定
  const { data: conv } = await supabase
    .from('conversations')
    .select('user_a_id, user_b_id')
    .eq('id', conversationId)
    .single();

  const partnerId = conv 
    ? (conv.user_a_id === currentUserId ? conv.user_b_id : conv.user_a_id)
    : null;

  return (
    <div className="min-h-screen bg-gray-950 text-gray-200">
      {/* 🚨 コンテナ設計：
         max-w-2xl で幅を制限し、border-x でサイドに境界を作ることで、
         情報の密度を高め、夜の集中できる空間を演出します。
      */}
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
            <ChatRoom 
              conversationId={conversationId} 
              currentUserId={currentUserId} 
              partnerId={partnerId} 
            />
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