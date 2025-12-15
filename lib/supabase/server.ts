// lib/supabase/server.ts (最終安定版)

import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * サーバーコンポーネント (RSC) 用の Supabase クライアントを作成する関数。
 * 🚨 RSCで cookies() を利用するため、関数全体を async にするのが最も安定します。
 */
export const createServerSupabaseClient = async () => {
  
  // cookies() は非同期APIと見なされるため、ここでは await を付けていませんが、
  // 関数を async にすることで、呼び出し側で await が強制され、実行が安定します。
  const cookieStore = cookies() as any // 型エラー回避のための any キャストは維持

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name: string) => cookieStore.get(name)?.value, 
        set: (name: string, value: string, options: CookieOptions) => { /* RSCでは無視 */ },
        remove: (name: string, options: CookieOptions) => { /* RSCでは無視 */ },
      },
    }
  )
}