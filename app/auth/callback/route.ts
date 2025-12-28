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
  
  if (code) {
    const cookieStore = await cookies()
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
                cookieStore.set(name, value, options)
              )
            } catch {
              // Server Componentからのリダイレクト時はセットできないが、
              // exchangeCodeForSession自体は動作します
            }
          },
        },
      }
    )

    // 🚀 1. 認証コードをセッションに交換
    // Googleログイン時などはここでのセッション取得が必須です
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error && data.user && data.session) {
      const user = data.user
      const session = data.session
      console.log('3. Login Success: ', user.id)

      // 🚀 2. 未ログイン時の投稿をログインユーザーに紐付ける (データ移行処理)
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
        }
        // 移行が終わったら anonymous_id クッキーを消去
        cookieStore.set('anonymous_id', '', { maxAge: 0 })
      }

      console.log('--- [Auth Callback] End: Success Redirect Logic ---')

      // 🚀 3. トークン受け渡しロジック
      // nextが "https://tarotai.jp" のようなフルURLかチェック
      let redirectUrl: URL
      try {
        redirectUrl = new URL(next.startsWith('http') ? next : `${origin}${next}`)
      } catch (e) {
        redirectUrl = new URL(`${origin}/`)
      }

      // 外部ドメイン（タロットアプリ）へのリダイレクトの場合
      if (redirectUrl.hostname.includes('tarotai.jp')) {
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