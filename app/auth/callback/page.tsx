'use client'
import { useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'

export default function AuthCallback() {
  const router = useRouter()
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN') {
        // URLパラメータの 'next' を見てリダイレクト先を決定
        const params = new URLSearchParams(window.location.search)
        const next = params.get('next') || '/'
        router.push(next)
      }
    })
    return () => subscription.unsubscribe()
  }, [router, supabase])

  return <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">認証中...</div>
}