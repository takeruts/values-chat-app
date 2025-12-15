import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'

// 表示用の型定義
type ChatPreview = {
  conversationId: string
  partnerName: string
  lastMessage: string
  lastMessageDate: string | null
  partnerId: string
  similarity: number | null 
}

export default async function ChatsListPage() {
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

  // 1. 自分が参加している会話ルームを取得
  const { data: conversations } = await supabase
    .from('conversations')
    .select('*')
    .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`)
    .order('created_at', { ascending: false })

  if (!conversations || conversations.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <h1 className="text-xl font-bold mb-4">トーク一覧</h1>
        <div className="bg-white p-8 rounded-lg shadow text-center">
          <p className="text-gray-500 mb-4">まだ会話がありません。</p>
          <Link href="/" className="text-blue-600 hover:underline">
            トップページでマッチングする
          </Link>
        </div>
      </div>
    )
  }

  // 2. 各会話について「相手の名前」「最後のメッセージ」「相性度」を取得
  const chatList = await Promise.all(
    conversations.map(async (conv): Promise<ChatPreview> => {
      // 相手のIDを特定
      const partnerId = conv.user_a_id === user.id ? conv.user_b_id : conv.user_a_id

      // A. 相手のニックネーム取得
      const { data: profile } = await supabase
        .from('profiles') 
        .select('nickname')
        .eq('id', partnerId)
        .maybeSingle() 
      
      const partnerName = profile?.nickname || '名無しさん'

      // 🚨 相性度を取得するための RPC 呼び出しを復元
      let similarityScore: number | null = null;
      try {
          const { data: similarityData, error: similarityError } = await supabase.rpc('get_similarity_between_users', {
              user_a_id: user.id, user_b_id: partnerId,
          });

          if (!similarityError && similarityData && similarityData.length > 0 && similarityData[0].similarity !== null) {
              similarityScore = parseFloat(String(similarityData[0].similarity));
          }
      } catch (e) {
          console.error("相性度の取得に失敗しました:", e);
      }

      // B. 最後のメッセージ取得
      const { data: lastMsg } = await supabase
        .from('messages')
        .select('content, created_at')
        .eq('conversation_id', conv.id)
        .order('created_at', { ascending: false }) // 新しい順
        .limit(1)
        .maybeSingle()

      return {
        conversationId: conv.id,
        partnerName,
        partnerId,
        lastMessage: lastMsg?.content || '（メッセージはまだありません）',
        lastMessageDate: lastMsg?.created_at || null,
        similarity: similarityScore, // 👈 復元
      }
    })
  )

  // 3. メッセージが新しい順に並べ替え
  chatList.sort((a, b) => {
    if (!a.lastMessageDate) return 1
    if (!b.lastMessageDate) return -1
    return new Date(b.lastMessageDate).getTime() - new Date(a.lastMessageDate).getTime()
  })

  // ------------------------------------------------
  // 表示部分 (UI)
  // ------------------------------------------------
  return (
    <div className="min-h-screen bg-gray-50 max-w-2xl mx-auto border-x min-h-[100dvh]">
      {/* ヘッダー */}
      <header className="bg-white p-4 shadow-sm sticky top-0 z-10 flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-800">トーク一覧</h1>
        <Link href="/" className="text-sm text-blue-600">トップへ戻る</Link>
      </header>

      {/* リスト表示 */}
      <div className="divide-y divide-gray-200 bg-white">
        {chatList.map((chat: ChatPreview) => (
          <Link 
            key={chat.conversationId} 
            href={`/chats/${chat.conversationId}`} 
            className="block hover:bg-gray-50 transition-colors"
          >
            {/* py-0 を維持し、height: 42px をインラインで強制 */}
            <div 
              className="flex items-center gap-4 py-0 px-4"
              style={{ height: '42px' }} 
            >
              
              {/* アイコン w-10 h-10 に維持 */}
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                <span className="text-blue-600 font-bold text-lg leading-none">{chat.partnerName.slice(0, 1)}</span>
              </div>{/* */}

              {/* テキストコンテナは JSX 記述を詰め、gap-px を維持 */}
              <div className="flex-1 min-w-0 flex flex-col gap-px"> 
                <div className="flex justify-between items-center"><div className="flex items-center gap-2"><div className="text-base font-bold text-gray-900 truncate m-0 p-0 leading-none">{chat.partnerName}</div>{chat.similarity !== null && (<span className="text-xs text-green-700 font-bold bg-green-100 px-1 py-0 rounded-full shrink-0 whitespace-nowrap leading-none">相性 {(chat.similarity * 100).toFixed(0)}%</span>)}</div>{chat.lastMessageDate && (<span className="text-xs text-gray-400 shrink-0">{new Date(chat.lastMessageDate).toLocaleDateString()}</span>)}</div><div className="flex items-center gap-2 mt-0 min-w-0"><p className="text-sm text-gray-500 truncate flex-1 m-0 leading-none">{chat.lastMessage}</p></div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}