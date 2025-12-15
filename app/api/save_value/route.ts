import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function POST(req: Request) {
  try {
    // 👇 変更点1: 画面から nickname も受け取る
    const { text, nickname } = await req.json()
    
    const cookieStore = await cookies()

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
          set(name: string, value: string, options: CookieOptions) {
            cookieStore.set({ name, value, ...options })
          },
          remove(name: string, options: CookieOptions) {
            cookieStore.set({ name, value: '', ...options })
          },
        },
      }
    )

    // ログインユーザーの確認
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized: ログインしてください' }, { status: 401 })
    }

    // 1. ベクトル化
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
    })
    const embedding = embeddingResponse.data[0].embedding

    // 2. 保存
    // ⚠️重要: nicknameカラムがテーブルに存在することを確認してください
    const { error: insertError } = await supabase
      .from('values_cards')
      .insert({ 
        content: text, 
        embedding: embedding,
        user_id: user.id,
        nickname: nickname // 👈 変更点2: ニックネーム保存
      })
    
    if (insertError) throw insertError

    // 3. マッチング
    // ステップ1のSQLを実行した後であれば、エラーは解消されます
    const { data: matches, error: searchError } = await supabase
      .rpc('match_values', {
        query_embedding: embedding,
        match_threshold: 0.0, 
        match_count: 10
      })

    if (searchError) throw searchError

    // 重複・自分除外ロジック
    const seenContents = new Set()
    
    // matchesの型定義（必要であれば）
    type MatchItem = {
      id: number;
      content: string;
      similarity: number;
      nickname: string;
      user_id: string;
    }

    const uniqueMatches = (matches as MatchItem[]).filter((match) => {
      // ロジック改善: 類似度0.99ではなく、user_idで明確に自分を除外
      if (match.user_id === user.id) return false
      
      if (seenContents.has(match.content)) return false
      seenContents.add(match.content)
      return true
    })

    return NextResponse.json({ success: true, matches: uniqueMatches })

  } catch (error: any) {
    console.error('Error:', error)
    // エラー詳細を返す（デバッグ用）
    return NextResponse.json(
      { error: error.message || 'Internal Server Error', details: error }, 
      { status: 500 }
    )
  }
}