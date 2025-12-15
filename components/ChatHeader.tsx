'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import Link from 'next/link' 

type Props = {
  partnerId: string;
  currentUserId: string; 
}

export default function ChatHeader({ partnerId, currentUserId }: Props) {
  const [nickname, setNickname] = useState('');
  const [similarity, setSimilarity] = useState<number | null>(null); 
  const [status, setStatus] = useState<'offline' | 'online'>('offline');

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    if (!partnerId || !currentUserId) return

    const fetchProfile = async () => {
      const { data, error } = await supabase.from('profiles').select('nickname').eq('id', partnerId).single()
      if (error) console.error('Error fetching partner nickname:', error);
      if (data?.nickname) setNickname(data.nickname);
    }
    fetchProfile()

    const channel = supabase.channel(`profile-update-${partnerId}`).on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${partnerId}` },
      (payload: any) => { if (payload.new && payload.new.nickname) setNickname(payload.new.nickname); }
    ).subscribe()

    const fetchSimilarity = async () => {
        try {
            const { data, error } = await supabase.rpc('get_similarity_between_users', { user_a_id: currentUserId, user_b_id: partnerId });
            if (error) throw error;
            if (data && data.length > 0 && data[0].similarity !== null) setSimilarity(parseFloat(String(data[0].similarity)));
            else setSimilarity(null);
        } catch (e) {
            console.error("相性度の取得に失敗しました (Catch Block):", e);
            setSimilarity(null);
        }
    }
    fetchSimilarity();

    return () => { supabase.removeChannel(channel) }
    
  }, [partnerId, currentUserId, supabase])


  return (
    <div className="bg-white border-b p-4 flex items-center gap-3 sticky top-0 z-10 shadow-sm">
        {/* 戻るボタン */}
        <Link href="/chats" className="text-gray-500 hover:text-gray-700 shrink-0"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg></Link>{/* */}
        
        {/* アイコン（イニシャルを表示） */}
        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-lg shrink-0">{nickname ? nickname.slice(0, 1) : '?'}</div>{/* */}
      
        <div className="flex flex-col min-w-0">
            {/* ニックネームと相性度 */}
            <div className="flex items-center gap-2">
                <h2 className="font-bold text-gray-800 truncate leading-none">{nickname || '読み込み中...'}</h2>{similarity !== null && (<span className="text-xs text-green-700 font-bold bg-green-100 px-1 py-0 rounded-full shrink-0 whitespace-nowrap leading-none">相性 {(similarity * 100).toFixed(0)}%</span>)}
            </div>{/* */}

            {/* ステータス行 */}
            <p className="text-xs text-gray-400 leading-none">{status === 'online' ? 'オンライン' : '最終アクティブ'}</p>
        </div>
    </div>
  )
}