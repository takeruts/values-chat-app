'use client'

import { useState, useEffect } from 'react' // 👈 useEffect を追加
import { createBrowserClient } from '@supabase/ssr'
import { useRouter, useSearchParams } from 'next/navigation' // 👈 useSearchParams を追加
import Link from 'next/link'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  
  const router = useRouter()
  const searchParams = useSearchParams() // 👈 URLパラメータを取得
  
  // URLから redirect_to パラメータを取得（例: ?redirect_to=https://...）
  const redirectTo = searchParams.get('redirect_to')

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setMessage(`エラー: ${error.message}`)
      setLoading(false)
    } else {
      // 👈 【修正ポイント】リダイレクト先があればそこへ、なければトップへ
      if (redirectTo) {
        window.location.href = redirectTo
      } else {
        router.push('/')
        router.refresh()
      }
    }
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    // 新規登録時も、メール認証後の戻り先を調整したい場合はここに redirectTo を含めることができます
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${location.origin}/auth/callback${redirectTo ? `?next=${encodeURIComponent(redirectTo)}` : ''}`,
      },
    })

    if (error) {
      setMessage(`エラー: ${error.message}`)
    } else {
      setMessage('確認メールを送信しました。メール内のリンクをクリックして登録を完了してください。')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gray-900 text-gray-200 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-gray-800 p-8 rounded-3xl shadow-2xl border border-gray-700">
        
        {/* 👈 【追加】リダイレクト中の表示 */}
        {redirectTo && (
          <div className="mb-4 p-2 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-center">
            <p className="text-[10px] text-indigo-300 tracking-widest uppercase font-bold">
              ログイン後、元のサービスに戻ります
            </p>
          </div>
        )}

        <div className="text-center mb-8">
          <Link href="/">
            <h1 className="text-3xl font-black text-indigo-400 mb-2 tracking-tighter cursor-pointer">カチピ</h1>
          </Link>
          <p className="text-gray-400 text-sm">あなたの価値観を守るための入り口</p>
        </div>

        <form className="space-y-6">
          <div>
            <label className="text-[10px] font-bold text-gray-500 uppercase block mb-2 tracking-widest">Email Address</label>
            <input
              type="email"
              className="w-full p-4 rounded-2xl bg-gray-900 text-gray-200 border border-gray-700 focus:border-indigo-500 outline-none transition-all shadow-inner"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="example@mail.com"
              required
            />
          </div>

          <div>
            <label className="text-[10px] font-bold text-gray-500 uppercase block mb-2 tracking-widest">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                className="w-full p-4 pr-14 rounded-2xl bg-gray-900 text-gray-200 border border-gray-700 focus:border-indigo-500 outline-none transition-all shadow-inner font-mono"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-indigo-400 transition-colors p-1"
              >
                {showPassword ? (
                  <span className="text-[10px] font-black border border-indigo-500/50 px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400">HIDE</span>
                ) : (
                  <span className="text-[10px] font-black border border-gray-700 px-1.5 py-0.5 rounded bg-gray-800 text-gray-400">SHOW</span>
                )}
              </button>
            </div>
          </div>

          {message && (
            <div className={`p-4 rounded-xl text-xs font-bold ${message.includes('エラー') ? 'bg-red-950/30 text-red-400 border border-red-900/50' : 'bg-emerald-950/30 text-emerald-400 border border-emerald-900/50'}`}>
              {message}
            </div>
          )}

          <div className="flex flex-col gap-3 pt-4">
            <button
              onClick={handleSignIn}
              type="submit" // 👈 エンターキーで送信可能に
              disabled={loading}
              className="w-full bg-indigo-600 text-white font-black h-14 rounded-2xl shadow-lg hover:bg-indigo-500 transition active:scale-95 disabled:bg-gray-700"
            >
              {loading ? '処理中...' : 'ログイン'}
            </button>
            <button
              onClick={handleSignUp}
              type="button"
              disabled={loading}
              className="w-full bg-transparent text-gray-400 font-bold h-14 rounded-2xl border border-gray-700 hover:bg-gray-700/30 transition active:scale-95 disabled:opacity-50"
            >
              新規アカウント作成
            </button>
          </div>
        </form>

        <div className="mt-8 text-center">
          <Link href="/" className="text-xs text-gray-500 hover:text-indigo-400 transition">
            ← トップページへ戻る
          </Link>
        </div>
      </div>
    </div>
  )
}