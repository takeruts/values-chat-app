'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import Link from 'next/link' 

type Props = { partnerId: string; currentUserId: string; }
const AI_USER_ID = '00000000-0000-0000-0000-000000000000';

export default function ChatHeader({ partnerId, currentUserId }: Props) {
  const [nickname, setNickname] = useState('');
  const [aiName, setAiName] = useState('');
  const [similarity, setSimilarity] = useState<number | null>(null); 

  const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  const isAI = partnerId === AI_USER_ID;

  useEffect(() => {
    if (!partnerId || !currentUserId) return
    const fetchData = async () => {
      if (isAI) {
        // 🚨 自分の設定からAIの名前と性別を取得
        const { data } = await supabase.from('profiles').select('ai_gender, ai_name').eq('id', currentUserId).single()
        setAiName(data?.ai_name || (data?.ai_gender === 'male' ? 'かい' : 'のぞみ'))
      } else {
        const { data } = await supabase.from('profiles').select('nickname').eq('id', partnerId).single()
        if (data?.nickname) setNickname(data.nickname);
      }
    }
    fetchData()
  }, [partnerId, currentUserId, supabase, isAI])

  return (
    <div className="bg-gray-800/80 backdrop-blur-md border-b border-gray-700/50 sticky top-0 z-50 w-full shadow-xl">
      <div className="max-w-2xl mx-auto flex items-center gap-4 py-3 px-4 h-16">
        <Link href="/chats" className="text-gray-400 hover:text-indigo-400 shrink-0 transition-colors p-1">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
        </Link>
        <div className="flex flex-col flex-1 overflow-hidden"> 
            <div className="flex items-center gap-2 overflow-hidden">
                <h2 className={`font-black text-base md:text-lg leading-none truncate tracking-tight ${isAI ? 'text-indigo-400' : 'text-gray-100'}`}>
                  {isAI ? `${aiName}` : (nickname || '...')}
                </h2>
                {isAI && <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-indigo-900/30 text-indigo-400 border border-indigo-700/50 uppercase shrink-0">AI パートナー</span>}
            </div>
            <p className="text-[10px] text-gray-500 font-medium leading-none mt-1.5 tracking-wider uppercase opacity-70">いつでもあなたの想いに寄り添います</p>
        </div>
      </div>
    </div>
  )
}