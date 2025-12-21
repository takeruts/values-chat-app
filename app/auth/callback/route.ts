import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  // nextが指定されていない場合はパスワードリセット画面へ
  const next = searchParams.get('next') ?? '/reset-password'

  if (code) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) { return cookieStore.get(name)?.value },
          set(name: string, value: string, options: any) {
            cookieStore.set({ name, value, ...options })
          },
          remove(name: string, options: any) {
            cookieStore.set({ name, value: '', ...options })
          },
        },
      }
    )

    // 🚨 認証コードをセッションに交換
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error) {
      // 成功したら /reset-password へ
      return NextResponse.redirect(`${origin}${next}`)
    }
    
    // エラー内容をログに出力（デバッグ用）
    console.error('Auth Callback Error:', error.message)
  }

  // 失敗した場合はエラー画面へ（URLにエラー内容を付与するとデバッグしやすい）
  return NextResponse.redirect(`${origin}/auth/auth-error?message=unable_to_exchange_code`)
}