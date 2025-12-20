'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr' 

type Match = {
  //id: number
  content: string
  similarity: number
  nickname: string
  user_id: string
  created_at?: string 
}

const getRelativeTime = (dateString?: string) => {
  if (!dateString) return '';
  const now = new Date();
  const target = new Date(dateString);
  const diffInMs = now.getTime() - target.getTime();
  const diffInMinutes = Math.floor(diffInMs / (1000 * 60));

  if (diffInMinutes < 1) return '今さっき';
  if (diffInMinutes < 60) return `${diffInMinutes}分前`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}時間前`;
  return `${Math.floor(diffInHours / 24)}日前`;
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

  const filteredMatches = useMemo(() => {
    return (matches || [])
      .filter(m => m.user_id !== AI_USER_ID && m.user_id !== currentUserId)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 6);
  }, [matches, currentUserId]);

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

  if (filteredMatches.length === 0) {
    return (
      <div className="text-center py-10 border border-dashed border-gray-800 rounded-2xl">
        <p className="text-gray-600 text-[10px] font-black uppercase tracking-[0.3em]">No resonance found</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {filteredMatches.map((match) => (
        <div 
          key={match.user_id} 
          className="border border-gray-700/50 rounded-2xl p-6 flex justify-between items-center gap-6 bg-gray-800/50 backdrop-blur-sm shadow-xl hover:border-gray-600 transition-colors"
        >
          <div className="flex-1 min-w-0 text-left">
            <div className="flex items-center gap-3 mb-1.5">
              <h3 className="text-base font-bold text-gray-100">{match.nickname}</h3>
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-indigo-900/30 text-indigo-300 border border-indigo-700/50 uppercase tracking-tighter">
                共感 {(match.similarity * 100).toFixed(0)}%
              </span>
            </div>
            
            <div className="flex items-center gap-1.5 opacity-50">
              <span className="text-[10px] text-gray-400 font-medium tracking-tight">
                {getRelativeTime(match.created_at)}につぶやきました
              </span>
            </div>
          </div>

          <button 
            onClick={() => handleStartChat(match.user_id)} 
            disabled={loadingId !== null} 
            className={`px-8 py-3 rounded-xl text-xs font-black transition-all active:scale-95 min-w-[120px] tracking-widest ${
              loadingId === match.user_id 
                ? 'bg-gray-700 text-gray-500 cursor-not-allowed' 
                : 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-lg shadow-indigo-900/20'
            }`}
          >
            {loadingId === match.user_id ? '...' : '話してみる'}
          </button>
        </div>
      ))}
    </div>
  )
}