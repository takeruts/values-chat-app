'use client'

import { useState, Suspense, useMemo } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  
  const router = useRouter()
  const searchParams = useSearchParams()
  
  // URLパラメータから ?redirect_to=... を取得（タロットアプリなどの戻り先）
  const redirectTo = searchParams.get('redirect_to')

  // Supabaseクライアントのメモ化
  const supabase = useMemo(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        storageKey: 'sb-auth-token',
        persistSession: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
      },
      cookieOptions: {
        domain: process.env.NODE_ENV === 'production' ? '.tarotai.jp' : undefined,
        path: '/',
        sameSite: 'lax',
        secure: true,
      },
    }
  ), [])

  /**
   * 🚀 ログイン成功時のリダイレクト処理
   */
  const handleAuthSuccess = () => {
    if (redirectTo && redirectTo.startsWith('/')) {
      // 相対パスの場合は同一ドメイン内でリダイレクト
      router.push(redirectTo)
      router.refresh()
    } else if (redirectTo) {
      try {
        const url = new URL(redirectTo)
        // 厳格なドメイン検証: tarotai.jp または *.tarotai.jp のみ許可
        const isValidDomain = url.hostname === 'tarotai.jp' || url.hostname.endsWith('.tarotai.jp')

        if (isValidDomain) {
          // トークンはCookieで共有されるため、URLパラメータには含めない
          // セキュリティ上、トークンをURLに含めることは避ける
          window.location.href = url.toString()
        } else {
          // 不正なドメインの場合はダッシュボードへ
          router.push('/')
          router.refresh()
        }
      } catch {
        // 無効なURLの場合はダッシュボードへ
        router.push('/')
        router.refresh()
      }
    } else {
      // カチピ自体のダッシュボードへ
      router.push('/')
      router.refresh()
    }
  }

  /**
   * 通常ログイン（メール/パスワード）
   */
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setMessage(`エラー: ${error.message}`)
      setLoading(false)
    } else if (data.session) {
      handleAuthSuccess()
    }
  }

  /**
   * 新規アカウント作成
   */
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    const params = new URLSearchParams(window.location.search);
    const targetRedirect = params.get('redirect_to');

    // メール内リンクの着地点（カチピのcallback経由で元のアプリへ）
    const emailRedirectUrl = targetRedirect 
      ? (targetRedirect.startsWith('/') ? window.location.origin + targetRedirect : targetRedirect)
      : `${window.location.origin}/auth/callback`;

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: emailRedirectUrl,
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
    <div className="max-w-md w-full bg-gray-800 p-8 rounded-3xl shadow-2xl border border-gray-700 font-sans">
      {redirectTo && (
        <div className="mb-6 p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-center">
          <p className="text-[10px] text-indigo-300 tracking-widest uppercase font-black">
            Login to continue to {new URL(redirectTo.startsWith('/') ? window.location.origin : redirectTo).hostname}
          </p>
        </div>
      )}

      <div className="text-center mb-10">
        <Link href="/">
          <h1 className="text-3xl font-black text-indigo-400 mb-2 tracking-tighter cursor-pointer uppercase">Kachipi</h1>
        </Link>
        <p className="text-gray-400 text-xs font-bold uppercase tracking-wider">Identity Central</p>
      </div>

      <form className="space-y-4" onSubmit={handleSignIn}>
        <div>
          <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1.5 ml-1 tracking-widest">Email Address</label>
          <input
            type="email"
            className="w-full p-4 rounded-2xl bg-gray-900 text-gray-200 border border-gray-700 focus:border-indigo-500 outline-none transition-all shadow-inner"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="mail@example.com"
            required
          />
        </div>

        <div>
          <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1.5 ml-1 tracking-widest">Password</label>
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
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500"
            >
              {showPassword ? (
                <span className="text-[10px] font-black border border-indigo-500/50 px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 uppercase">Hide</span>
              ) : (
                <span className="text-[10px] font-black border border-gray-700 px-1.5 py-0.5 rounded bg-gray-800 text-gray-400 uppercase">Show</span>
              )}
            </button>
          </div>
        </div>

        {message && (
          <div className={`p-4 rounded-xl text-xs font-bold leading-relaxed ${message.includes('エラー') ? 'bg-red-950/30 text-red-400 border border-red-900/50' : 'bg-emerald-950/30 text-emerald-400 border border-emerald-900/50'}`}>
            {message}
          </div>
        )}

        <div className="flex flex-col gap-3 pt-6">
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 text-white font-black h-14 rounded-2xl shadow-lg hover:bg-indigo-500 transition active:scale-95 disabled:bg-gray-700"
          >
            {loading ? 'Processing...' : 'ログイン'}
          </button>
          <button
            onClick={handleSignUp}
            type="button"
            disabled={loading}
            className="w-full bg-transparent text-gray-500 font-bold h-12 rounded-2xl border border-gray-700 hover:bg-gray-700/30 transition active:scale-95 disabled:opacity-50 text-xs"
          >
            新規アカウントを作成する
          </button>
        </div>
      </form>

      <div className="mt-8 text-center">
        <Link href="/" className="text-[10px] font-bold text-gray-600 hover:text-indigo-400 transition uppercase tracking-widest">
          ← Back to home
        </Link>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-gray-900 text-gray-200 flex items-center justify-center p-4">
      <Suspense fallback={<div className="text-indigo-400 font-black animate-pulse uppercase tracking-widest">Initialising...</div>}>
        <LoginForm />
      </Suspense>
    </div>
  )
}