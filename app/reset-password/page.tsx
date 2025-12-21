'use client'

import { useState, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'

export default function ResetPasswordPage() {
  const [newPassword, setNewPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const router = useRouter()
  
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // 🚨 セッションチェック
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      // メールリンク経由で正しく認可されていない場合はトップへ戻す
      if (!session) {
        setErrorMsg('認証セッションが無効、または期限切れです。再度リセットメールをリクエストしてください。')
      }
    }
    checkSession()
  }, [supabase])

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')
    setErrorMsg('')

    try {
      // Supabase Auth の機能を使ってパスワードを更新
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      })

      if (error) {
        setErrorMsg('更新に失敗しました: ' + error.message)
      } else {
        setMessage('パスワードを正常に更新しました。まもなくトップページへ移動します。')
        
        // 🚨 確実にセッションを更新してからリダイレクト
        setTimeout(async () => {
          await supabase.auth.signOut() // 一旦ログアウトさせて再ログインを促すか、そのままログインさせるかは運用次第
          router.push('/login')
          router.refresh()
        }, 3000)
      }
    } catch (err) {
      setErrorMsg('予期せぬエラーが発生しました。')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-200 flex flex-col items-center justify-center p-6 font-sans">
      
      {/* ロゴエリア */}
      <div className="text-center mb-10 animate-in fade-in zoom-in duration-700">
        <h1 className="text-4xl font-black text-indigo-400 tracking-tighter mb-2">カチピ</h1>
        <p className="text-[10px] text-gray-500 uppercase tracking-[0.3em] font-bold opacity-70">
          Security & Privacy
        </p>
      </div>

      {/* カードエリア */}
      <div className="bg-gray-900/40 backdrop-blur-xl p-8 md:p-12 rounded-[2.5rem] border border-gray-800 shadow-2xl w-full max-w-sm">
        <h2 className="text-lg font-bold mb-8 text-center text-gray-100 italic">新しいパスワードの設定</h2>
        
        <form onSubmit={handleUpdatePassword} className="space-y-6">
          <p className="text-[11px] text-gray-500 leading-relaxed text-center px-2">
            安全のため、以前とは異なる<br />6文字以上のパスワードを入力してください。
          </p>

          <div>
            <label className="text-[10px] font-black text-gray-600 uppercase tracking-widest ml-1 block mb-2">New Password</label>
            <input 
              type="password" 
              value={newPassword} 
              onChange={(e) => setNewPassword(e.target.value)} 
              className="w-full bg-gray-950/50 border border-gray-800 p-5 rounded-2xl outline-none focus:border-indigo-500/50 text-gray-100 transition-all shadow-inner" 
              placeholder="••••••••"
              required
              minLength={6}
            />
          </div>

          <button 
            type="submit" 
            disabled={loading || newPassword.length < 6 || !!errorMsg && !message}
            className="w-full bg-indigo-600 text-white font-black h-16 rounded-2xl shadow-xl shadow-indigo-900/20 hover:bg-indigo-500 transition-all active:scale-[0.98] disabled:bg-gray-800 disabled:text-gray-600 tracking-[0.2em] text-sm"
          >
            {loading ? '更新中...' : 'パスワードを更新'}
          </button>
        </form>

        {/* 成功メッセージ */}
        {message && (
          <div className="mt-8 p-5 rounded-2xl bg-indigo-950/30 text-indigo-300 border border-indigo-900/40 text-xs font-bold text-center leading-relaxed animate-in fade-in slide-in-from-top-2">
            {message}
          </div>
        )}

        {/* エラーメッセージ */}
        {errorMsg && (
          <div className="mt-8 p-5 rounded-2xl bg-red-950/30 text-red-400 border border-red-900/40 text-xs font-bold text-center leading-relaxed animate-in fade-in slide-in-from-top-2">
            {errorMsg}
          </div>
        )}
      </div>

      <footer className="mt-12 text-center">
        <p className="text-[10px] text-gray-700 font-medium tracking-widest uppercase italic">
          &copy; 2025 Kachipi. Night Security.
        </p>
      </footer>
    </div>
  )
}