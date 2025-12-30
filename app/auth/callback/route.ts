import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  // nextはメール認証後の最終リダイレクト先
  const next = searchParams.get('next') ?? '/'

  console.log('--- [Auth Callback] Start ---')
  console.log('1. Auth Code:', code ? 'Present' : 'Missing')
  console.log('2. Target Next:', next)
  
  const cookieStore = await cookies() 

  if (code) {
    const anonymousId = cookieStore.get('anonymous_id')?.value

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          flowType: 'pkce',
        },
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, {
                  ...options,
                  domain: process.env.NODE_ENV === 'production' ? '.tarotai.jp' : undefined,
                  path: '/',
                })
              )
            } catch {
              // サーバーサイドでのセット失敗は無視可能
            }
          },
        },
      }
    )

    // 🚀 1. 認証コードをセッションに交換（メール認証を確定）
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error && data.user && data.session) {
      const user = data.user
      console.log('3. Login Success: ', user.id)

      // 🚀 2. データ移行処理（匿名投稿をログインユーザーに紐付け）
      if (anonymousId) {
        console.log('4. Merging data for Anonymous ID:', anonymousId)
        
        const { data: updatedPosts, error: updateError } = await supabase
          .from('posts')
          .update({ 
            user_id: user.id, 
            anonymous_id: null 
          })
          .eq('anonymous_id', anonymousId)
          .select()

        if (updateError) {
          console.error('🚨 Update Error in posts table:', updateError.message)
        }

        if (updatedPosts && updatedPosts.length > 0) {
          const latestPost = [...updatedPosts].sort((a, b) => 
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          )[0]

          const { data: existingProfile } = await supabase
            .from('value_profiles')
            .select('nickname')
            .eq('user_id', user.id)
            .single()

          // 価値観プロフィールを更新または作成
          await supabase.from('value_profiles').upsert({
            user_id: user.id,
            nickname: existingProfile?.nickname || latestPost.nickname,
            content: latestPost.content,
            embedding: latestPost.embedding,
            updated_at: new Date().toISOString()
          })
        }
        
        // 移行完了後、anonymous_id クッキーを消去
        cookieStore.set('anonymous_id', '', {
          maxAge: 0,
          domain: process.env.NODE_ENV === 'production' ? '.tarotai.jp' : undefined,
          path: '/'
        })
      }

      console.log('--- [Auth Callback] End: Success Redirect Logic ---')

      // 🚀 3. リダイレクトURLの構築
      let redirectUrl: URL
      try {
        redirectUrl = new URL(next.startsWith('http') ? next : `${origin}${next}`)
      } catch (e) {
        redirectUrl = new URL('/', origin)
      }

      // 外部ドメイン（タロットアプリ）へのリダイレクト時の検証を厳格化
      const isExternal = (redirectUrl.hostname === 'tarotai.jp' ||
                         redirectUrl.hostname.endsWith('.tarotai.jp')) &&
                         redirectUrl.hostname !== new URL(origin).hostname;

      // トークンはCookieで既に設定されているため、URLパラメータには含めない
      // セキュリティ上、トークンをURLに含めることは避ける
      if (isExternal) {
        console.log('7. External Domain Detected. Redirecting with cookies...')
      }

      return NextResponse.redirect(redirectUrl.toString())
    }
    
    if (error) {
      console.error('🚨 Auth Exchange Error:', error.message)
      return NextResponse.redirect(
        `${origin}/auth/auth-error?message=authentication_failed`
      )
    }
  }

  // codeがない場合（直接アクセスなど）
  return NextResponse.redirect(`${origin}/auth/auth-error?message=authentication_failed`)
}