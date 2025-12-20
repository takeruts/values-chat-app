'use client'

import { useState, useMemo, useEffect } from 'react'
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
  const [aiName, setAiName] = useState('のぞみ')
  const AI_USER_ID = '00000000-0000-0000-0000-000000000000'; 

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    if (!currentUserId) return
    const fetchAiSettings = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('ai_name, ai_gender')
        .eq('id', currentUserId)
        .single()
      
      if (data) {
        if (data.ai_name) {
          setAiName(data.ai_name)
        } else if (data.ai_gender === 'male') {
          setAiName('快')
        }
      }
    }
    fetchAiSettings()
  }, [currentUserId, supabase])

  const sortedMatches = useMemo(() => {
    let list = [...(matches || [])];
    if (!list.some(m => m.user_id === AI_USER_ID)) {
      list.push({
        id: -1,
        user_id: AI_USER_ID,
        nickname: aiName,
        content: 'あなたの心に寄り添い、お話をお聞きします。',
        similarity: 1.0, 
      });
    }
    return list.map(m => m.user_id === AI_USER_ID ? { ...m, nickname: aiName } : m)
               .sort((a, b) => (a.user_id === AI_USER_ID ? -1 : b.user_id === AI_USER_ID ? 1 : b.similarity - a.similarity))
               .slice(0, 6);
  }, [matches, aiName]);

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
    <div className="flex flex-col gap-6">
      {sortedMatches.map((match) => {
        const isSelf = currentUserId === match.user_id;
        const isAI = match.user_id === AI_USER_ID;
        
        // 自分自身は表示しない
        if (isSelf) return null;

        return (
          <div 
            key={match.user_id} 
            className={`border rounded-2xl p-6 flex justify-between items-center gap-6 bg-gray-800/50 backdrop-blur-sm shadow-xl transition-colors ${
              isAI ? 'border-indigo-500/30' : 'border-gray-700/50 hover:border-gray-600'
            }`}
          >
            <div className="flex-1 min-w-0 text-left">
              <div className="flex items-center gap-3">
                <h3 className={`text-base font-bold ${isAI ? 'text-indigo-300' : 'text-gray-100'}`}>
                  {match.nickname}
                </h3>
                {isAI ? (
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-indigo-900/50 text-indigo-400 border border-indigo-500/50 uppercase tracking-tighter">
                    AIパートナー
                  </span>
                ) : (
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-indigo-900/30 text-indigo-300 border border-indigo-700/50 uppercase tracking-tighter">
                    共感 {(match.similarity * 100).toFixed(0)}%
                  </span>
                )}
              </div>
              {/* 💡 コメント表示(pタグ)を削除しました */}
            </div>

            <button 
              onClick={() => handleStartChat(match.user_id)} 
              disabled={loadingId !== null} 
              className={`px-8 py-3 rounded-xl text-xs font-black transition-all active:scale-95 min-w-[120px] tracking-widest ${
                loadingId === match.user_id 
                  ? 'bg-gray-700 text-gray-500 cursor-not-allowed' 
                  : isAI 
                    ? 'bg-indigo-600/90 text-indigo-50 hover:bg-indigo-500' 
                    : 'bg-slate-700 text-cyan-100 hover:bg-slate-600 border border-cyan-500/30'
              }`}
            >
              {loadingId === match.user_id ? '...' : isAI ? '相談する' : '話してみる'}
            </button>
          </div>
        )
      })}
    </div>
  )
}