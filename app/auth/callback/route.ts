import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  console.log('--- [Auth Callback] Start ---')
  console.log('1. Auth Code:', code ? 'Present' : 'Missing')
  console.log('2. Target Next:', next)
  
  const cookieStore = await cookies() // 🚀 Next.js 16 では await が必要

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
                  domain: '.tarotai.jp', // 🚀 これを追加！全サブドメインで PKCE コードを共有させる
                  path: '/',
                })
              )
            } catch {
              // Server Component からのセットは制限があるが、PKCEフロー自体は継続可能
            }
          },
        },
      }
    )

    // 🚀 1. 認証コードをセッションに交換
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error && data.user && data.session) {
      const user = data.user
      const session = data.session
      console.log('3. Login Success: ', user.id)

      // 🚀 2. データ移行処理 (匿名IDがある場合)
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
          console.log(`5. Successfully merged ${updatedPosts.length} posts.`)

          const latestPost = [...updatedPosts].sort((a, b) => 
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          )[0]

          const { data: existingProfile } = await supabase
            .from('value_profiles')
            .select('nickname')
            .eq('user_id', user.id)
            .single()

          const { error: upsertError } = await supabase.from('value_profiles').upsert({
            user_id: user.id,
            nickname: existingProfile?.nickname || latestPost.nickname,
            content: latestPost.content,
            embedding: latestPost.embedding,
            updated_at: new Date().toISOString()
          })

          if (upsertError) {
            console.error('🚨 Upsert Error in value_profiles:', upsertError.message)
          } else {
            console.log('6. Profile updated successfully.')
          }
        }
        // クッキー消去
        cookieStore.set('anonymous_id', '', { maxAge: 0, domain: '.tarotai.jp', path: '/' })
      }

      console.log('--- [Auth Callback] End: Success Redirect Logic ---')

      // 🚀 3. トークン受け渡し & リダイレクト先決定
      let redirectUrl: URL
      try {
        // nextがフルURL（外部アプリ）か、相対パス（自アプリ）かを判定
        if (next.startsWith('http')) {
          redirectUrl = new URL(next)
        } else {
          redirectUrl = new URL(next, origin)
        }
      } catch (e) {
        redirectUrl = new URL('/', origin)
      }

      // 外部ドメイン（タロットアプリ）へのリダイレクトの場合、SSO用にトークンを付与
      if (redirectUrl.hostname.includes('tarotai.jp') && redirectUrl.hostname !== new URL(origin).hostname) {
        console.log('7. External Domain Detected. Attaching Tokens...')
        redirectUrl.searchParams.set('access_token', session.access_token)
        redirectUrl.searchParams.set('refresh_token', session.refresh_token)
      }

      return NextResponse.redirect(redirectUrl.toString())
    }
    
    if (error) {
      console.error('🚨 Auth Exchange Error:', error.message)
      return NextResponse.redirect(`${origin}/auth/auth-error?message=${encodeURIComponent(error.message)}`)
    }
  }

  // codeがない場合
  console.error('🚨 [Auth Callback] No code found in URL')
  return NextResponse.redirect(`${origin}/auth/auth-error?message=no_code_present`)
}