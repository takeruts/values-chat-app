'use client'

import { useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [view, setView] = useState<'auth' | 'forgot_password'>('auth')
  const router = useRouter()

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // 🚨 修正：このページでの紐付け（mergeAnonymousData）は行わず、
  // IDを保持したままトップページへ遷移させます。
  // 紐付けは Home (app/page.tsx) の useEffect で一括で行うのが最も安全です。

  const handleSignUp = async () => {
    setLoading(true)
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) {
      setMessage('エラー: ' + error.message)
    } else {
      setMessage('確認メールを送信しました！メールを確認してください。')
      // IDを保持したままトップへ（確認メール経由の場合は callback 経由で Home へ）
    }
    setLoading(false)
  }

  const handleSignIn = async () => {
    setLoading(true)
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setMessage('エラー: ' + error.message)
      setLoading(false)
    } else if (data.user) {
      // 🚀 ログイン成功！IDは消さずにトップページへ移動
      // IDの紐付けと消去は app/page.tsx のロジックが担当します
      router.push('/')
      router.refresh()
    }
  }

  const handleResetPassword = async () => {
    if (!email) {
      setMessage('エラー: メールアドレスを入力してください')
      return
    }
    setLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    })
    if (error) setMessage('エラー: ' + error.message)
    else setMessage('再設定用のリンクをメールで送信しました。')
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-6 text-gray-200 font-sans">
      
      {/* ロゴエリア */}
      <div className="text-center mb-10 animate-in fade-in zoom-in duration-700">
        <h1 className="text-4xl font-black text-indigo-400 tracking-tighter mb-2">カチピ</h1>
        <p className="text-[10px] text-gray-500 uppercase tracking-[0.3em] font-bold opacity-70">
          Deep Night Connection
        </p>
      </div>

      {/* ログインカード */}
      <div className="bg-gray-900/40 backdrop-blur-xl p-8 rounded-[2.5rem] border border-gray-800 shadow-2xl w-full max-w-sm">
        <h2 className="text-lg font-bold mb-8 text-center text-gray-100">
          {view === 'auth' ? '眠れない夜は価値観共有' : 'パスワードの再設定'}
        </h2>
        
        <div className="space-y-4">
          <div>
            <label className="text-[10px] font-bold text-gray-600 uppercase tracking-widest ml-1 block mb-1.5">Email</label>
            <input
              className="w-full bg-gray-950/50 border border-gray-800 p-4 rounded-2xl outline-none focus:border-indigo-500/50 transition-all text-gray-200 placeholder-gray-700"
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          {view === 'auth' && (
            <div>
              <label className="text-[10px] font-bold text-gray-600 uppercase tracking-widest ml-1 block mb-1.5">Password</label>
              <input
                className="w-full bg-gray-950/50 border border-gray-800 p-4 rounded-2xl outline-none focus:border-indigo-500/50 transition-all text-gray-200 placeholder-gray-700"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          )}
        </div>

        <div className="mt-8 space-y-3">
          {view === 'auth' ? (
            <>
              <button
                onClick={handleSignIn}
                disabled={loading}
                className="w-full bg-indigo-600 text-white font-black p-4 rounded-2xl hover:bg-indigo-500 transition-all active:scale-95 shadow-lg shadow-indigo-900/20 disabled:opacity-50"
              >
                {loading ? '...' : 'ログイン'}
              </button>
              
              <button
                onClick={handleSignUp}
                disabled={loading}
                className="w-full bg-gray-800/50 text-indigo-300 font-bold p-4 rounded-2xl border border-indigo-500/20 hover:bg-gray-800 transition-all active:scale-95 disabled:opacity-50 text-sm"
              >
                新しくアカウントを作る
              </button>

              <div className="text-center pt-2">
                <button 
                  onClick={() => { setView('forgot_password'); setMessage(''); }}
                  className="text-[10px] text-gray-600 hover:text-indigo-400 font-bold uppercase tracking-widest transition-colors"
                >
                  パスワードを忘れた場合
                </button>
              </div>
            </>
          ) : (
            <>
              <button
                onClick={handleResetPassword}
                disabled={loading}
                className="w-full bg-indigo-600 text-white font-black p-4 rounded-2xl hover:bg-indigo-500 transition-all active:scale-95 shadow-lg shadow-indigo-900/20 disabled:opacity-50"
              >
                {loading ? '...' : '再設定メールを送信'}
              </button>
              <button
                onClick={() => { setView('auth'); setMessage(''); }}
                className="w-full bg-transparent text-gray-500 font-bold p-2 rounded-2xl hover:text-gray-300 transition-all text-xs"
              >
                ログインに戻る
              </button>
            </>
          )}
        </div>

        {message && (
          <div className={`mt-6 p-4 rounded-xl text-xs text-center leading-relaxed animate-in fade-in zoom-in ${
            message.includes('エラー') ? 'bg-red-950/20 text-red-400 border border-red-900/30' : 'bg-indigo-950/30 text-indigo-300 border border-indigo-900/30'
          }`}>
            {message}
          </div>
        )}
      </div>

      <footer className="mt-12 text-center">
        <p className="text-[10px] text-gray-700 font-medium tracking-widest uppercase italic">
          &copy; 2025 Kachipi. All rights reserved.
        </p>
      </footer>
    </div>
  )
}