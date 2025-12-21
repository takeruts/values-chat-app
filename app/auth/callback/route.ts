import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/reset-password'

  if (code) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          // get, set, remove すべてを確実に定義する
          getAll() { return cookieStore.getAll() },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              )
            } catch {
              // Server Componentから呼ばれた場合のエラーを回避
            }
          },
        },
      }
    )

    // 🚨 ここでエラーが出ている場合、codeが古いか、ドメイン設定が違います
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error) {
      // 成功：ログイン状態でリセット画面へ
      return NextResponse.redirect(`${origin}${next}`)
    }
    
    console.error('Auth Exchange Error:', error.message)
    // エラー詳細をURLに付与してデバッグ
    return NextResponse.redirect(`${origin}/auth/auth-error?message=${encodeURIComponent(error.message)}`)
  }

  return NextResponse.redirect(`${origin}/auth/auth-error?message=no_code_present`)
}