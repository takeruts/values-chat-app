// components/MatchList.tsx 
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr' 

// マッチングデータの型定義
type Match = {
  id: number
  content: string
  similarity: number
  nickname: string
  user_id: string
}

// Propsの型定義
type MatchListProps = {
  matches: Match[]
  currentUserId?: string
}

export default function MatchList({ matches, currentUserId }: MatchListProps) {
  const router = useRouter()
  const [loadingId, setLoadingId] = useState<string | null>(null)

  // クライアントサイドのSupabaseインスタンスを作成
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const handleStartChat = async (targetUserId: string) => {
    if (loadingId) return
    
    if (!currentUserId) {
        alert('チャットを開始するにはログインが必要です。');
        router.push('/login');
        return;
    }

    try {
      setLoadingId(targetUserId)
      
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      if (!token) {
          alert('セッション切れです。再ログインしてください。');
          router.push('/login');
          return;
      }

      const res = await fetch('/api/create_room', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ partnerId: targetUserId }),
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || '会話ルームの作成に失敗しました')
      }

      const apiData = await res.json()
      const conversationId = apiData.conversationId

      router.push(`/chats/${conversationId}`)

    } catch (error: any) {
      console.error('Error starting chat:', error)
      alert(error.message || 'エラーが発生しました。もう一度お試しください。')
    } finally {
      setLoadingId(null)
    }
  }

  return (
    <div className="space-y-4">
      {matches.length === 0 && (
        <p className="text-gray-500 text-center">マッチする相手が見つかりませんでした。</p>
      )}

      {matches.map((match) => {
        const isSelf = currentUserId === match.user_id;

        return (
          <div 
            key={match.user_id} 
            className="border rounded-lg p-4 bg-white shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
          >{/* 🚨 修正: 最外層 div 開始タグ直後の空白を排除 */}
            {/* 左側：相手の情報 */}
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2">
                {/* ニックネームと相性度を一行で表示 */}
                <h3 className="text-lg font-bold text-gray-800 inline-block whitespace-nowrap">{match.nickname || '名無しさん'}</h3>{isSelf && <span className="text-xs text-blue-500 ml-2">(あなた)</span>}<span className="text-xs text-green-700 font-bold bg-green-100 px-2 py-0.5 rounded-full whitespace-nowrap">相性 {(match.similarity * 100).toFixed(0)}%</span>
              </div>{/* */}
            </div>{/* 🚨 修正: Flexアイテム間の閉じタグ直後にコメントを挿入 */}

            {/* 右側：アクションボタン */}
            {!isSelf && (
              <button
                onClick={() => handleStartChat(match.user_id)}
                disabled={loadingId !== null}
                className={`px-6 py-2 rounded-full text-white font-medium transition-all shrink-0 ${loadingId === match.user_id 
                    ? 'bg-gray-400 cursor-wait' 
                    : 'bg-blue-600 hover:bg-blue-700 shadow-md hover:shadow-lg'
                  }`}
              >{loadingId === match.user_id ? '準備中...' : '話してみたい'}</button>
            )}{/* 🚨 修正: 最後の要素の後にコメントを挿入し、改行を吸収 */}
          </div>
        )
      })}
    </div>
  )
}