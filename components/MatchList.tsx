'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr' // Supabaseクライアントのインポート

// マッチングデータの型定義
type Match = {
  id: number // DBレコードID。キーには不適。
  content: string
  similarity: number
  nickname: string
  user_id: string // 👈 これがユニークなキーとして最適
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
    
    // ログインチェック
    if (!currentUserId) {
        alert('チャットを開始するにはログインが必要です。');
        router.push('/login');
        return;
    }

    try {
      setLoadingId(targetUserId)
      
      // 認証トークンを取得
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      if (!token) {
          alert('セッション切れです。再ログインしてください。');
          router.push('/login');
          return;
      }

      // 1. APIを呼び出して conversationId を取得
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

      // 2. 取得したIDを使ってチャット画面へ遷移
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
        // 自分自身かどうかの判定
        const isSelf = currentUserId === match.user_id;

        return (
          <div 
            // 🚨 修正箇所: リストキーを match.user_id に変更
            key={match.user_id} 
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