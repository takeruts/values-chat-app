'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

// マッチングデータの型定義
type Match = {
  id: number
  content: string
  similarity: number
  nickname: string
  user_id: string 
}

// 👇 Propsの型定義に currentUserId を追加
type MatchListProps = {
  matches: Match[]
  currentUserId?: string // ログインしていない場合も考慮してオプショナル、または必須にする
}

export default function MatchList({ matches, currentUserId }: MatchListProps) {
  const router = useRouter()
  const [loadingId, setLoadingId] = useState<string | null>(null)

  const handleStartChat = async (targetUserId: string) => {
    if (loadingId) return

    try {
      setLoadingId(targetUserId)

      // 1. APIを呼び出して conversationId を取得
      // ※このAPIの実装が必要です（後述）
      const res = await fetch('/api/conversations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ targetUserId }),
      })

      if (!res.ok) {
        throw new Error('会話ルームの作成に失敗しました')
      }

      const data = await res.json()
      const conversationId = data.conversationId

      // 2. 取得したIDを使ってチャット画面へ遷移
      router.push(`/chats/${conversationId}`)

    } catch (error) {
      console.error('Error starting chat:', error)
      alert('エラーが発生しました。もう一度お試しください。')
      setLoadingId(null)
    }
  }

  return (
    <div className="space-y-4">
      {matches.length === 0 && (
        <p className="text-gray-500 text-center">マッチする相手が見つかりませんでした。</p>
      )}

      {matches.map((match) => {
        // 👇 自分自身かどうかの判定
        const isSelf = currentUserId === match.user_id;

        return (
          <div 
            key={match.id} 
            className="border rounded-lg p-4 bg-white shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
          >
            {/* 左側：相手の情報 */}
            <div className="flex-1">
              <div className="flex items-baseline gap-2">
                <h3 className="text-lg font-bold text-gray-800">
                  {match.nickname || '名無しさん'}
                  {isSelf && <span className="text-xs text-blue-500 ml-2">(あなた)</span>}
                </h3>
                <span className="text-sm text-green-600 font-medium">
                  相性 {(match.similarity * 100).toFixed(0)}%
                </span>
              </div>
              <p className="text-gray-600 mt-1 text-sm bg-gray-50 p-2 rounded">
                {match.content}
              </p>
            </div>

            {/* 右側：アクションボタン */}
            {/* 自分自身でなければボタンを表示 */}
            {!isSelf && (
              <button
                onClick={() => handleStartChat(match.user_id)}
                disabled={loadingId !== null}
                className={`
                  px-6 py-2 rounded-full text-white font-medium transition-all shrink-0
                  ${loadingId === match.user_id 
                    ? 'bg-gray-400 cursor-wait' 
                    : 'bg-blue-600 hover:bg-blue-700 shadow-md hover:shadow-lg'
                  }
                `}
              >
                {loadingId === match.user_id ? '準備中...' : '話してみたい'}
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}