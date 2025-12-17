'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr' 

type Match = {
  id: number
  content: string
  similarity: number
  nickname: string
  user_id: string
}

export default function MatchList({ 
  matches, 
  currentUserId 
}: { 
  matches: Match[], 
  currentUserId?: string 
}) {
  const router = useRouter()
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const AI_USER_ID = '00000000-0000-0000-0000-000000000000'; 

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const sortedMatches = useMemo(() => {
    let list = [...(matches || [])];
    if (!list.some(m => m.user_id === AI_USER_ID)) {
      list.push({
        id: -1,
        user_id: AI_USER_ID,
        nickname: 'のぞみ (AI)',
        content: 'あなたの心に寄り添い、お話をお聞きします。',
        similarity: 1.0, 
      });
    }
    return list.sort((a, b) => (a.user_id === AI_USER_ID ? -1 : b.user_id === AI_USER_ID ? 1 : b.similarity - a.similarity));
  }, [matches]);

  const handleStartChat = async (targetUserId: string) => {
    if (loadingId || !currentUserId) return
    setLoadingId(targetUserId)
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const res = await fetch('/api/create_room', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          'Authorization': `Bearer ${sessionData.session?.access_token}` 
        },
        body: JSON.stringify({ partnerId: targetUserId }),
      })
      const apiData = await res.json()
      router.push(`/chats/${apiData.conversationId}`)
    } catch (e) { 
      alert('エラーが発生しました') 
    } finally { 
      setLoadingId(null) 
    }
  }

  return (
    <div className="flex flex-col gap-10">
      {sortedMatches.map((match) => {
        const isSelf = currentUserId === match.user_id;
        const isAI = match.user_id === AI_USER_ID;
        return (
          <div 
            key={match.user_id} 
            className={`border rounded-2xl p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-gray-800/50 backdrop-blur-sm shadow-xl transition-colors ${
              isAI ? 'border-indigo-500/30' : 'border-gray-700/50 hover:border-gray-600'
            }`}
          >
            <div className="flex-1 min-w-0 text-left">
              <div className="flex items-center gap-3 mb-2">
                <h3 className={`text-base font-bold ${isAI ? 'text-indigo-300' : 'text-gray-100'}`}>
                  {isAI ? 'のぞみ (AI)' : (match.nickname || '名無しさん')}
                </h3>
                {!isAI && (
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-indigo-900/30 text-indigo-300 border border-indigo-700/50 uppercase tracking-tighter">
                    相性 {(match.similarity * 100).toFixed(0)}%
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400 line-clamp-2 leading-relaxed">
                {match.content || 'よろしくお願いします。'}
              </p>
            </div>

            {!isSelf && (
              <button 
                onClick={() => handleStartChat(match.user_id)} 
                disabled={loadingId !== null} 
                className={`px-10 py-3.5 rounded-xl text-xs font-black transition-all active:scale-95 min-w-[140px] tracking-widest ${
                  loadingId === match.user_id 
                    ? 'bg-gray-700 text-gray-500 cursor-not-allowed' 
                    : isAI 
                      ? 'bg-indigo-600/90 text-indigo-50 hover:bg-indigo-500 shadow-lg shadow-indigo-900/20' 
                      /* 🚨 修正：夜らしい「深い青緑」と「繊細なボーダー」の配色に変更 */
                      : 'bg-slate-700 text-cyan-100 hover:bg-slate-600 border border-cyan-500/30 shadow-lg shadow-black/40'
                }`}
              >
                {loadingId === match.user_id ? '...' : isAI ? '相談する' : '話してみる'}
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}