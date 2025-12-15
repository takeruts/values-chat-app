'use client'

import { useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const router = useRouter()

  // Supabaseクライアント（ブラウザ用）
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // 新規登録ボタン
  const handleSignUp = async () => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
    })
    if (error) setMessage('エラー: ' + error.message)
    else setMessage('確認メールを送信しました！メール内のリンクをクリックしてください。')
  }

  // ログインボタン
  const handleSignIn = async () => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    if (error) {
      setMessage('エラー: ' + error.message)
    } else {
      // ログイン成功したらトップページへ戻る
      router.push('/')
      router.refresh() // 状態を更新
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
      <div className="bg-white p-8 rounded shadow-md w-full max-w-sm">
        <h1 className="text-2xl font-bold mb-6 text-center">ログイン / 登録</h1>
        
        <input
          className="w-full border p-2 mb-4 rounded"
          type="email"
          placeholder="メールアドレス"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          className="w-full border p-2 mb-4 rounded"
          type="password"
          placeholder="パスワード"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <div className="flex gap-2 mb-4">
          <button
            onClick={handleSignIn}
            className="flex-1 bg-blue-600 text-white p-2 rounded hover:bg-blue-700"
          >
            ログイン
          </button>
          <button
            onClick={handleSignUp}
            className="flex-1 bg-green-600 text-white p-2 rounded hover:bg-green-700"
          >
            新規登録
          </button>
        </div>

        {message && <p className="text-red-500 text-sm text-center">{message}</p>}
      </div>
    </div>
  )
}