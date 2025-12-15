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

  // 2. 各会話について「相手の名前」と「最後のメッセージ」を取得
  const chatList = await Promise.all(
    conversations.map(async (conv): Promise<ChatPreview> => {
      // 相手のIDを特定
      const partnerId = conv.user_a_id === user.id ? conv.user_b_id : conv.user_a_id

      // -----------------------------------------------------------------
      // 👇 修正箇所: values_cards から profiles に変更し、最新のニックネームを取得
      // -----------------------------------------------------------------
      // A. 相手のニックネーム取得 (profilesテーブルから最新のデータを取得するのが推奨)
      const { data: profile } = await supabase
        .from('profiles') // 👈 変更: values_cards から profiles へ
        .select('nickname')
        .eq('id', partnerId) // 👈 変更: user_id ではなく profiles の id
        .maybeSingle() 
      
      const partnerName = profile?.nickname || '名無しさん'
      // -----------------------------------------------------------------

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
        {chatList.map((chat) => (
          <Link 
            key={chat.conversationId} 
            // ページ名に合わせて修正: /chat/[conversationId] → /chats/[conversationId] が自然
            href={`/chats/${chat.conversationId}`} 
            className="block hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-4 p-4">
              {/* アイコン（イニシャル表示） */}
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                <span className="text-blue-600 font-bold text-lg">
                  {chat.partnerName.slice(0, 1)}
                </span>
              </div>

              {/* テキスト情報 */}
              <div className="flex-1 min-w-0"> {/* min-w-0 はテキスト省略に必須 */}
                <div className="flex justify-between items-baseline mb-1">
                  <h2 className="text-base font-bold text-gray-900 truncate">
                    {chat.partnerName}
                  </h2>
                  {chat.lastMessageDate && (
                    <span className="text-xs text-gray-400 shrink-0">
                      {new Date(chat.lastMessageDate).toLocaleDateString()}
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500 truncate">
                  {chat.lastMessage}
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}