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
      // ダークテーマの背景を適用 (左右の余白も含む)
      <div className="min-h-screen bg-gray-900 text-gray-200 p-4">
        <h1 className="text-xl font-bold mb-4 text-indigo-400">トーク一覧</h1>
        {/* カードもダークテーマに */}
        <div className="bg-gray-800 p-8 rounded-lg shadow-lg text-center border border-gray-700">
          <p className="text-gray-400 mb-4">まだ会話がありません。</p>
          <Link href="/" className="text-indigo-400 hover:underline">
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
    // 修正: min-h-screen bg-gray-900 で画面全体を統一
    <div className="min-h-screen bg-gray-900 text-gray-200 min-h-[100dvh]">
      
      {/* メインコンテンツラッパー: max-w-2xl mx-auto で中央寄せし、左右に枠線を表示 */}
      <div className="max-w-2xl mx-auto border-x border-gray-700 min-h-full bg-gray-900">

        {/* ヘッダー: ダークテーマ */}
        <header className="bg-gray-800 p-4 shadow-xl sticky top-0 z-10 flex items-center justify-between border-b border-gray-700">
          <h1 className="text-xl font-bold text-indigo-400">トーク一覧</h1>
          <Link href="/" className="text-sm text-gray-400 hover:text-indigo-400">トップへ戻る</Link>
        </header>

        {/* リスト表示: ダークテーマ */}
        <div className="divide-y divide-gray-700">
          {chatList.map((chat: ChatPreview) => (
            <Link 
              key={chat.conversationId} 
              href={`/chats/${chat.conversationId}`} 
              // ホバー時の色もダークテーマに
              className="block hover:bg-gray-800 transition-colors"
            >
              {/* 修正: 縦パディングを py-1 に減らす */}
              <div className="flex items-start gap-4 py-1 px-4">
                
                {/* アイコン w-10 h-10 に維持, 色をダークテーマに */}
                <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center shrink-0 mt-1">
                  <span className="text-indigo-400 font-bold text-lg leading-none">{chat.partnerName.slice(0, 1)}</span>
                </div>
                  
                {/* テキストコンテナ (Flex Columnで縦に要素を並べる) */}
                <div className="flex-1 min-w-0 flex flex-col gap-1"> 
                    
                    {/* 1行目: 相手の名前と相性度 */}
                  <div className="flex justify-start items-center gap-2"> 
                        {/* 名前 (truncate を削除) */}
                        <div className="text-base font-bold text-gray-200 m-0 p-0 leading-tight flex-shrink-0">{chat.partnerName}</div>
                        {/* 相性度 */}
                        {chat.similarity !== null && (<span className="text-xs text-green-300 font-bold bg-green-900 px-1 py-0 rounded-full shrink-0 whitespace-nowrap leading-tight border border-green-500/50">相性 {(chat.similarity * 100).toFixed(0)}%</span>)}
                    </div>
                    
                    {/* 2行目: 最終メッセージ (複数行を許可) */}
                    <div className="mt-0 min-w-0">
                        {/* truncate を削除し、line-clamp-2 で最大2行表示を維持 */}
                        <p className="text-sm text-gray-400 m-0 leading-snug whitespace-normal line-clamp-2">{chat.lastMessage}</p>
                    </div>

                    {/* 3行目: 日付 (右寄せで独立した行に配置) */}
                    {chat.lastMessageDate && (
                        <div className="w-full text-right">
                            <span className="text-xs text-gray-500 shrink-0 whitespace-nowrap">{new Date(chat.lastMessageDate).toLocaleDateString()}</span>
                        </div>
                    )}

                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}