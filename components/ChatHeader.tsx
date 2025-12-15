'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'

type Props = {
  partnerId: string
}

export default function ChatHeader({ partnerId }: Props) {
  const [nickname, setNickname] = useState('')
  const [status, setStatus] = useState<'offline' | 'online'>('offline') // おまけ: 将来的にオンライン判定も可能

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    if (!partnerId) return

    // 1. 初回読み込み：現在の最新ニックネームを取得
    const fetchProfile = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('nickname')
        .eq('id', partnerId)
        .single()

      if (data?.nickname) {
        setNickname(data.nickname)
      }
    }
    fetchProfile()

    // 2. リアルタイム監視：相手がプロフィールを更新したら即座に反映
    const channel = supabase
      .channel(`profile-update-${partnerId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${partnerId}`, // 相手のIDだけを監視
        },
        (payload: any) => {
          // 変更があった場合、新しいニックネームをセット
          if (payload.new && payload.new.nickname) {
            setNickname(payload.new.nickname)
          }
        }
      )
      .subscribe()

    // クリーンアップ（コンポーネントが消えるときに監視を終了）
    return () => {
      supabase.removeChannel(channel)
    }
  }, [partnerId, supabase])

  return (
    <div className="bg-white border-b p-4 flex items-center gap-3 sticky top-0 z-10 shadow-sm">
      {/* アイコン（イニシャルを表示） */}
      <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-lg">
        {nickname ? nickname.slice(0, 1) : '?'}
      </div>
      
      <div>
        <h2 className="font-bold text-gray-800">
          {nickname || '読み込み中...'}
        </h2>
        {/* 必要に応じてステータスなどを表示 */}
        <p className="text-xs text-green-600">
          {/* ここに "オンライン" などの表示を追加可能 */}
        </p>
      </div>
    </div>
  )
}