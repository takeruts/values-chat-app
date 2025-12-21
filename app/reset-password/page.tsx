'use client'

import { createBrowserClient } from '@supabase/ssr'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('認証を確認中...')
  const router = useRouter()

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    const checkSession = async () => {
      // 🚨 すでに auth/callback でログイン処理は終わっているため、セッションがあるか確認するだけ
      const { data: { session }, error } = await supabase.auth.getSession()
      
      if (session) {
        setMessage('新しいパスワードを入力してください')
      } else {
        console.error('Session not found:', error)
        setMessage('エラー: 認証セッションが見つかりません。もう一度メールのリンクをクリックしてください。')
      }
    }

    checkSession()
  }, [supabase])

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('更新中...')
    
    // 🚨 ログイン済みのセッションを使用してパスワードを更新
    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      setMessage(`エラー: ${error.message}`)
    } else {
      setMessage('成功！パスワードを更新しました。ログイン画面へ移動します...')
      // セッションをクリアしてクリーンな状態で再ログインを促す
      await supabase.auth.signOut()
      setTimeout(() => router.push('/login'), 2000)
    }
    setLoading(false)
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 text-black p-4">
      <form onSubmit={handlePasswordReset} className="p-8 bg-white border rounded shadow-md w-full max-w-md">
        <h1 className="text-xl font-bold mb-6 text-center text-gray-800">新しいパスワードの設定</h1>
        
        {/* ステータスメッセージの表示 */}
        <p className={`mb-4 text-sm text-center p-2 rounded ${
          message.includes('エラー') ? 'bg-red-50 text-red-600' : 'text-gray-600'
        }`}>
          {message}
        </p>
        
        <input
          type="password"
          placeholder="6文字以上のパスワード"
          className="w-full p-2 border border-gray-300 rounded mb-4 focus:ring-2 focus:ring-blue-500 outline-none"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          disabled={message.includes('エラー')}
        />
        
        <button
          type="submit"
          disabled={loading || message.includes('エラー') || !password}
          className="w-full bg-blue-600 text-white p-2 rounded hover:bg-blue-700 disabled:bg-gray-300 transition font-bold"
        >
          {loading ? '更新中...' : 'パスワードを更新する'}
        </button>
      </form>
    </div>
  )
}