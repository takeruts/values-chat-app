// app/api/create_room/route.ts

import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// Service Role Key を使用してサーバー側のSupabaseクライアントを初期化
// ※環境変数 SUPABASE_SERVICE_ROLE_KEY がVercelに設定されている必要があります。
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! 
)

// 認証チェック用の Anon Key クライアント
const supabaseAuth = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(req: Request) {
  try {
    const { partnerId } = await req.json()
    
    // 1. ユーザー認証: トークンから自分自身（現在のユーザー）のIDを取得
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return NextResponse.json({ error: '認証エラー: トークンがありません' }, { status: 401 })
    }
    const token = authHeader.replace('Bearer ', '')
    
    // Anon Key クライアントで認証を試みる
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token)

    if (authError || !user) {
      console.error('認証失敗:', authError?.message)
      return NextResponse.json({ error: '認証失敗: ユーザーが見つかりません' }, { status: 401 })
    }

    const currentUserId = user.id

    if (currentUserId === partnerId) {
        return NextResponse.json({ error: '自分自身とのチャットルームは作成できません' }, { status: 400 })
    }

    // 2. 既存の会話を検索するためのIDの標準化
    // IDをソートし、小さい方を user_a_id、大きい方を user_b_id として検索・挿入することで重複を防ぐ
    const [id1, id2] = [currentUserId, partnerId].sort() as [string, string]

    const { data: existingConversation, error: fetchError } = await supabase
      .from('conversations')
      .select('id')
      .eq('user_a_id', id1)
      .eq('user_b_id', id2)
      .maybeSingle()

    if (fetchError) {
      throw new Error(`既存会話の検索失敗: ${fetchError.message}`)
    }

    if (existingConversation) {
      // 3. 既存の会話が見つかった場合、そのIDを返す
      return NextResponse.json({ conversationId: existingConversation.id })
    }

    // 4. 既存の会話がない場合、新しい会話を作成
    const { data: newConversation, error: insertError } = await supabase
      .from('conversations')
      .insert({ 
        user_a_id: id1, // 小さいIDをaに
        user_b_id: id2, // 大きいIDをbに
      })
      .select('id')
      .single()

    if (insertError) {
      throw new Error(`新規会話の作成失敗: ${insertError.message}`)
    }

    // 5. 新規作成された会話のIDを返す
    return NextResponse.json({ conversationId: newConversation.id })

  } catch (error: any) {
    console.error('API Error:', error)
    return NextResponse.json({ error: error.message || 'サーバー内部エラー' }, { status: 500 })
  }
}