'use client'

import { createBrowserClient } from '@supabase/ssr'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const router = useRouter()

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // 🚨 ポイント：ページ表示時にURLのハッシュを解析してセッションを作る
  useEffect(() => {
    const setSessionFromHash = async () => {
      // URLに #access_token=... が含まれている場合、Supabase SDKが自動でセッションを確立します
      const { data, error } = await supabase.auth.getSession()
      if (error || !data.session) {
        console.error('Session error:', error)
        setMessage('エラー: 認証セッションが見つかりません。もう一度メールのリンクをクリックしてください。')
      }
    }
    setSessionFromHash()
  }, [supabase])

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    // 🚨 ログインセッションがあることを確認してから更新
    const { error } = await supabase.auth.updateUser({
      password: password
    })

    if (error) {
      if (error.message.includes('session missing')) {
        setMessage('エラー: セッションが切れました。メールから再度開き直してください。')
      } else {
        setMessage(`エラー: ${error.message}`)
      }
    } else {
      setMessage('パスワードを更新しました！ログインページへ移動します...')
      await supabase.auth.signOut()
      setTimeout(() => router.push('/login'), 2000)
    }
    setLoading(false)
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 text-black">
      <form onSubmit={handlePasswordReset} className="p-8 bg-white border rounded shadow-md w-full max-w-md">
        <h1 className="text-xl font-bold mb-6 text-center">新しいパスワードの設定</h1>
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">新しいパスワード</label>
          <input
            type="password"
            placeholder="6文字以上のパスワード"
            className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white p-2 rounded hover:bg-blue-700 transition disabled:bg-gray-400"
        >
          {loading ? '更新中...' : 'パスワードを更新する'}
        </button>
        {message && (
          <p className={`mt-4 text-center text-sm ${message.includes('エラー') ? 'text-red-500' : 'text-green-600'}`}>
            {message}
          </p>
        )}
      </form>
    </div>
  )
}