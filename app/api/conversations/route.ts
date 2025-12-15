import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function POST(req: Request) {
  const { targetUserId } = await req.json()
  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (name) => cookieStore.get(name)?.value } }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 常に user_a < user_b になるようにソートしてID管理を簡単にする
  const [userA, userB] = [user.id, targetUserId].sort()

  // 1. すでに会話ルームがあるか探す
  const { data: existingConv } = await supabase
    .from('conversations')
    .select('id')
    .eq('user_a_id', userA)
    .eq('user_b_id', userB)
    .single()

  if (existingConv) {
    return NextResponse.json({ conversationId: existingConv.id })
  }

  // 2. なければ作る
  const { data: newConv, error } = await supabase
    .from('conversations')
    .insert({ user_a_id: userA, user_b_id: userB })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ conversationId: newConv.id })
}