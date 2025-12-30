'use client'

import { useState, Suspense } from 'react'
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

  // Supabaseクライアントの初期化
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        storageKey: 'sb-auth-token',
        persistSession: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
      },
      // 🚀 重要: サブドメイン間（www.kachi ↔ www.tarotai）で認証を共有するための設定
      cookieOptions: {
        domain: '.tarotai.jp', // 先頭のドットにより全サブドメインでクッキーを共有
        path: '/',
        sameSite: 'lax',
        secure: true,
      },
    }
  )

  /**
   * 🚀 一元化されたリダイレクト処理 (ログイン成功時)
   * セッション情報をURLパラメータに付与して、各アプリのレシーバーへ渡す
   */
  const handleAuthSuccess = (session: any) => {
    if (redirectTo && (redirectTo.includes('tarotai.jp') || redirectTo.startsWith('/'))) {
      const url = new URL(redirectTo.startsWith('/') ? window.location.origin + redirectTo : redirectTo)
      
      // トークンをパラメータに付与（各アプリのuseEffectがこれを拾ってsetSessionする）
      url.searchParams.set('access_token', session.access_token)
      url.searchParams.set('refresh_token', session.refresh_token)
      
      window.location.href = url.toString()
    } else {
      // リダイレクト先がない場合はカチピのマイページ等へ
      router.push('/')
      router.refresh()
    }
  }

  /**
   * Googleログイン処理
   */
  const handleGoogleLogin = async () => {
    setLoading(true)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        // 🚀 ここがポイント！
        // 1. redirectTo には、カチピの callback route を指定します。
        // 2. さらに next パラメータとして、最終的な戻り先（タロットアプリなど）を渡します。
        redirectTo: `${window.location.origin}/auth/callback${redirectTo ? `?next=${encodeURIComponent(redirectTo)}` : ''}`,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    })
    if (error) {
      setMessage(`エラー: ${error.message}`)
      setLoading(false)
    }
  }

  /**
   * 通常ログイン処理
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
      handleAuthSuccess(data.session)
    }
  }

  /**
   * 🚀 新規アカウント作成
   * メール内の「確認リンク」の飛ばし先を、リクエスト元のアプリに合わせる
   */
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    // 現在のURLから redirect_to を再取得（確実に最新の値を参照するため）
    const params = new URLSearchParams(window.location.search);
    const targetRedirect = params.get('redirect_to');

    // メールのリンクをクリックした後の着地点を決定
    const emailRedirectUrl = targetRedirect 
      ? (targetRedirect.startsWith('/') ? window.location.origin + targetRedirect : targetRedirect)
      : `${window.location.origin}/auth/callback`;

    console.log("🔥 Requesting SignUp with redirect:", emailRedirectUrl);

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // この設定により、Supabaseから送られるメール内のリンク先が動的に変わる
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
      {/* どこから転送されてきたかを表示（UX向上） */}
      {redirectTo && (
        <div className="mb-6 p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-center">
          <p className="text-[10px] text-indigo-300 tracking-widest uppercase font-black">
            Login to continue to {new URL(redirectTo.startsWith('/') ? window.location.origin : redirectTo).hostname}
          </p>
        </div>
      )}

      <div className="text-center mb-8">
        <Link href="/">
          <h1 className="text-3xl font-black text-indigo-400 mb-2 tracking-tighter cursor-pointer uppercase">Kachipi</h1>
        </Link>
        <p className="text-gray-400 text-xs font-bold uppercase tracking-wider">Identity Central</p>
      </div>

      <button
        onClick={handleGoogleLogin}
        disabled={loading}
        className="w-full flex items-center justify-center gap-3 bg-white text-gray-900 font-bold h-14 rounded-2xl mb-6 hover:bg-gray-100 transition active:scale-95 disabled:opacity-50"
      >
        <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
        Googleでログイン
      </button>

      <div className="relative mb-6">
        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-700"></div></div>
        <div className="relative flex justify-center text-[10px] uppercase"><span className="bg-gray-800 px-4 text-gray-500 font-bold">Or use email</span></div>
      </div>

      <form className="space-y-4" onSubmit={handleSignIn}>
        <div>
          <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1.5 ml-1 tracking-widest">Email</label>
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

        <div className="flex flex-col gap-3 pt-4">
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
            新規アカウント作成
          </button>
        </div>
      </form>

      <div className="mt-8 text-center">
        <Link href="/" className="text-[10px] font-bold text-gray-600 hover:text-indigo-400 transition uppercase tracking-widest">
          ← Back to kachipi home
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