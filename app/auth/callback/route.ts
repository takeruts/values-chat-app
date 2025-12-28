import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  console.log('--- [Auth Callback] Start ---')
  
  if (code) {
    const cookieStore = await cookies()
    const anonymousId = cookieStore.get('anonymous_id')?.value

    console.log('1. Anonymous ID from Cookie:', anonymousId)
    console.log('2. Auth Code:', code ? 'Present' : 'Missing')

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              )
            } catch {
              // Server Componentからのリダイレクト時は無視される
            }
          },
        },
      }
    )

    // 1. 認証コードをセッションに交換
    // 重要: exchangeCodeForSession は data.session を返します
    const { data: { user, session }, error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error && user && session) {
      console.log('3. Login Success: ', user.id)

      // 🚀 2. 未ログイン時の投稿をログインユーザーに紐付ける
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

          const latestPost = updatedPosts.sort((a, b) => 
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
        } else {
          console.warn('⚠️ No posts found with this anonymous_id.')
        }

        cookieStore.set('anonymous_id', '', { maxAge: 0 })
      }

      console.log('--- [Auth Callback] End: Success Redirect ---')

      // ✨ ✨ ✨ [トークン受け渡しロジックの追加] ✨ ✨ ✨
      // リダイレクト先 URL オブジェクトを作成
      // next がフルパス (https://...) か、相対パス (/) かを考慮して生成
      const redirectUrl = new URL(next.startsWith('http') ? next : `${origin}${next}`)

      // リダイレクト先が tarotai.jp などの外部ドメイン連携の場合、トークンを付与
      if (redirectUrl.hostname.includes('tarotai.jp')) {
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

  console.error('🚨 [Auth Callback] No code found in URL')
  return NextResponse.redirect(`${origin}/auth/auth-error?message=no_code_present`)
}