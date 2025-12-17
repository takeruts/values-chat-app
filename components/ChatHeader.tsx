// components/ChatHeader.tsx

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
    <div className="bg-gray-800 border-b border-gray-700 py-2 px-4 flex items-center gap-3 sticky top-0 z-10 shadow-xl">
        {/* 戻るボタン */}
        <Link href="/chats" className="text-gray-400 hover:text-indigo-400 shrink-0">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </Link>
        
        {/* ニックネーム、相性度、ステータスを保持するコンテナ */}
        <div className="flex flex-col flex-1"> 
            
            {/* 1行目: ニックネームと相性度 (横並び) */}
            {/* 修正: JSXのコードを一行に詰めて空白ノードの発生を防ぐ */}
            <div className="flex items-center gap-2 overflow-hidden">
                <h2 className="font-bold text-indigo-300 leading-none truncate flex-1">{nickname || '読み込み中...'}</h2>{similarity !== null && (<span className="text-xs text-green-300 font-bold bg-green-900 px-1 py-0 rounded-full shrink-0 whitespace-nowrap leading-none border border-green-500/50">相性 {(similarity * 100).toFixed(0)}%</span>)}
            </div>
                
            {/* 2行目: ステータス行 */}
            <p className="text-xs text-gray-500 leading-none">
              {status === 'online' ? 'オンライン' : '最終アクティブ'}
            </p>
        </div>
    </div>
  )
}