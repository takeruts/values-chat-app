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
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, {
                  ...options,
                  domain: '.tarotai.jp', // 🚀 サブドメイン間で共有可能にする
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
      const session = data.session
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
          domain: '.tarotai.jp', 
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

      // 外部ドメイン（タロットアプリ）へのリダイレクト時にトークンを付与（SSO用）
      const isExternal = redirectUrl.hostname.includes('tarotai.jp') && 
                         redirectUrl.hostname !== new URL(origin).hostname;

      if (isExternal) {
        console.log('7. External Domain Detected. Attaching Tokens...')
        redirectUrl.searchParams.set('access_token', session.access_token)
        redirectUrl.searchParams.set('refresh_token', session.refresh_token)
      }

      return NextResponse.redirect(redirectUrl.toString())
    }
    
    if (error) {
      console.error('🚨 Auth Exchange Error:', error.message)
      return NextResponse.redirect(
        `${origin}/auth/auth-error?message=${encodeURIComponent(error.message)}`
      )
    }
  }

  // codeがない場合（直接アクセスなど）
  return NextResponse.redirect(`${origin}/auth/auth-error?message=no_code_present`)
}