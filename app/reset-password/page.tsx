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
    const initSession = async () => {
      // 1. まず現在のセッションを確認
      const { data: { session } } = await supabase.auth.getSession()
      
      if (session) {
        setMessage('パスワードを入力してください')
        return
      }

      // 2. セッションがない場合、URLのハッシュからトークンを抽出して手動でセット
      const hash = window.location.hash
      if (hash && hash.includes('access_token')) {
        const params = new URLSearchParams(hash.substring(1))
        const accessToken = params.get('access_token')
        const refreshToken = params.get('refresh_token')

        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          })
          if (!error) {
            setMessage('認証に成功しました。パスワードを入力してください')
            return
          }
        }
      }
      
      setMessage('エラー: 認証セッションが見つかりません。最新のメールのリンクをクリックしてください。')
    }

    initSession()
  }, [supabase])

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    
    // パスワード更新実行
    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      setMessage(`エラー: ${error.message}`)
    } else {
      setMessage('成功！パスワードを更新しました。ログイン画面へ移動します...')
      await supabase.auth.signOut()
      setTimeout(() => router.push('/login'), 2000)
    }
    setLoading(false)
  }

  // 以下、レンダリング部分は同じ（省略可）
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 text-black p-4">
      <form onSubmit={handlePasswordReset} className="p-8 bg-white border rounded shadow-md w-full max-w-md">
        <h1 className="text-xl font-bold mb-6 text-center text-gray-800">新しいパスワードの設定</h1>
        <p className="mb-4 text-sm text-center text-gray-600">{message}</p>
        
        <input
          type="password"
          placeholder="6文字以上のパスワード"
          className="w-full p-2 border border-gray-300 rounded mb-4 focus:ring-2 focus:ring-blue-500 outline-none"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
        />
        
        <button
          type="submit"
          disabled={loading || message.includes('エラー')}
          className="w-full bg-blue-600 text-white p-2 rounded hover:bg-blue-700 disabled:bg-gray-300 transition"
        >
          {loading ? '更新中...' : 'パスワードを更新する'}
        </button>
      </form>
    </div>
  )
}