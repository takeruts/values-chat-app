import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'

type ChatPreview = {
  conversationId: string
  partnerName: string
  lastMessage: string
  lastMessageDate: string | null
  partnerId: string
  similarity: number | null 
}

const AI_USER_ID = '00000000-0000-0000-0000-000000000000';

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

  const { data: conversations } = await supabase
    .from('conversations')
    .select('*')
    .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`)
    .order('created_at', { ascending: false })

  if (!conversations || conversations.length === 0) {
    return (
      <div className="min-h-screen bg-gray-900 text-gray-200 p-8 flex flex-col items-center justify-center">
        <div className="bg-gray-800/50 backdrop-blur-sm p-12 rounded-3xl shadow-2xl text-center border border-gray-700/50 max-w-md w-full">
          <p className="text-gray-400 mb-6 font-medium">まだ会話がありません。</p>
          <Link href="/" className="inline-block bg-indigo-600 text-white px-8 py-3 rounded-xl font-black hover:bg-indigo-500 transition active:scale-95 shadow-lg shadow-indigo-900/20">
            仲間を探しにいく
          </Link>
        </div>
      </div>
    )
  }

  const chatList = await Promise.all(
    conversations.map(async (conv): Promise<ChatPreview> => {
      const partnerId = conv.user_a_id === user.id ? conv.user_b_id : conv.user_a_id
      const { data: profile } = await supabase.from('profiles').select('nickname').eq('id', partnerId).maybeSingle() 
      const partnerName = profile?.nickname || '名無しさん'

      let similarityScore: number | null = null;
      try {
          const { data: similarityData, error: similarityError } = await supabase.rpc('get_similarity_between_users', {
              user_a_id: user.id, user_b_id: partnerId,
          });
          if (!similarityError && similarityData && similarityData.length > 0 && similarityData[0].similarity !== null) {
              similarityScore = parseFloat(String(similarityData[0].similarity));
          }
      } catch (e) { console.error(e); }

      const { data: lastMsg } = await supabase.from('messages').select('content, created_at').eq('conversation_id', conv.id).order('created_at', { ascending: false }).limit(1).maybeSingle()

      return {
        conversationId: conv.id,
        partnerName,
        partnerId,
        lastMessage: lastMsg?.content || '（メッセージはまだありません）',
        lastMessageDate: lastMsg?.created_at || null,
        similarity: similarityScore,
      }
    })
  )

  chatList.sort((a, b) => {
    if (a.partnerId === AI_USER_ID) return -1;
    if (b.partnerId === AI_USER_ID) return 1;
    const dateA = a.lastMessageDate ? new Date(a.lastMessageDate).getTime() : 0;
    const dateB = b.lastMessageDate ? new Date(b.lastMessageDate).getTime() : 0;
    return dateB - dateA;
  })

  return (
    <div className="min-h-screen bg-gray-900 text-gray-200">
      <div className="max-w-2xl mx-auto min-h-screen flex flex-col">

        <header className="bg-gray-800/80 backdrop-blur-md border-b border-gray-700/50 py-4 px-6 flex items-center justify-between sticky top-0 z-50">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-gray-400 hover:text-indigo-400 transition-colors p-1">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </Link>
            <h2 className="font-black text-xl text-indigo-400 tracking-tight">トーク一覧</h2>
          </div>
          <span className="text-[10px] bg-gray-900 px-2 py-1 rounded text-gray-500 font-mono tracking-widest">{chatList.length} CHATS</span>
        </header>

        <main className="p-4 md:p-6 space-y-4">
          {chatList.map((chat: ChatPreview) => {
            const isAI = chat.partnerId === AI_USER_ID;
            return (
              <Link 
                key={chat.conversationId} 
                href={`/chats/${chat.conversationId}`} 
                className={`group block p-5 rounded-2xl border transition-all duration-300 shadow-xl ${
                  isAI 
                    ? 'bg-indigo-900/10 border-indigo-500/30 hover:bg-indigo-900/20' 
                    : 'bg-gray-800/40 border-gray-700/50 hover:bg-gray-800/60 hover:border-gray-600'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-inner transition-transform group-hover:scale-105 ${
                    isAI ? 'bg-indigo-800/50 border border-indigo-400/30' : 'bg-gray-900 border border-gray-700'
                  }`}>
                    <span className={`${isAI ? 'text-2xl' : 'text-xl font-black text-indigo-400 opacity-80'}`}>
                      {isAI ? '✨' : chat.partnerName.slice(0, 1)}
                    </span>
                  </div>
                    
                  <div className="flex-1 min-w-0"> 
                    <div className="flex justify-between items-center mb-1.5"> 
                      <h3 className={`text-base font-black truncate tracking-tight ${isAI ? 'text-indigo-300' : 'text-gray-100'}`}>
                        {chat.partnerName}
                      </h3>
                      
                      {/* 🚨 修正：MatchListと統一した相性度バッジ */}
                      {!isAI && chat.similarity !== null && (
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-indigo-900/30 text-indigo-300 border border-indigo-700/50 uppercase tracking-tighter shadow-sm">
                          相性 {(chat.similarity * 100).toFixed(0)}%
                        </span>
                      )}
                    </div>

                    <div className="flex justify-between items-end">
                      <p className={`text-xs line-clamp-1 flex-1 pr-4 ${isAI ? 'text-indigo-200/40 italic' : 'text-gray-500'}`}>
                        {chat.lastMessage}
                      </p>
                      {chat.lastMessageDate && (
                        <span className="text-[10px] text-gray-600 font-mono shrink-0 italic opacity-60">
                          {new Date(chat.lastMessageDate).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            )
          })}
        </main>
      </div>
    </div>
  )
}