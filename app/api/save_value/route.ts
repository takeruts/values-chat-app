// app/api/save_value/route.ts

import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

// Service Roleクライアント（書き込み・検索用）
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Anonクライアント（認証用）
const supabaseAuth = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(req: Request) {
  try {
    const { text, nickname } = await req.json()

    // 1. 認証チェック
    const authHeader = req.headers.get('Authorization')
    const token = authHeader?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: '認証エラー' }, { status: 401 })

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token)
    if (authError || !user) return NextResponse.json({ error: '認証失敗' }, { status: 401 })

    const currentUserId = user.id
    const now = new Date()

    // 2. 今回の投稿をベクトル化
    const embRes = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
    })
    
    if (!embRes.data || embRes.data.length === 0) {
      throw new Error('OpenAIからの応答が不正です')
    }
    const newEmbedding = embRes.data[0].embedding

    // 3. 投稿を保存
    const { error: postError } = await supabase.from('posts').insert({
      user_id: currentUserId,
      content: text,
      nickname: nickname,
      embedding: newEmbedding,
      created_at: now.toISOString()
    })
    if (postError) throw new Error(`投稿保存失敗: ${postError.message}`)

    // 4. 過去の投稿を取得して「時間減衰」合成
    const { data: allPosts } = await supabase
      .from('posts')
      .select('embedding, created_at')
      .eq('user_id', currentUserId)
      .not('embedding', 'is', null) // null除外

    let finalEmbedding = newEmbedding
    const HALF_LIFE_DAYS = 30
    const LAMBDA = Math.log(2) / HALF_LIFE_DAYS

    if (allPosts && allPosts.length > 0) {
      let weightedSum = new Array(1536).fill(0)
      let totalWeight = 0
      const nowMs = now.getTime()

      allPosts.forEach(p => {
        const diffDays = (nowMs - new Date(p.created_at).getTime()) / (1000 * 86400)
        const weight = Math.exp(-LAMBDA * diffDays)

        // 💡 修正：文字列(vector型)を配列(number[])に変換
        let embArray: number[] = []
        if (typeof p.embedding === 'string') {
          // "[0.1, 0.2]" 形式を配列にパース
          embArray = JSON.parse(p.embedding)
        } else if (Array.isArray(p.embedding)) {
          embArray = p.embedding
        }

        if (embArray.length === 1536) {
          embArray.forEach((v, i) => {
            weightedSum[i] += v * weight
          })
          totalWeight += weight
        }
      })

      if (totalWeight > 0) {
        // 加重平均をとる
        finalEmbedding = weightedSum.map(v => v / totalWeight)
        // L2正規化（類似度計算のために長さを1に揃える）
        const magnitude = Math.sqrt(finalEmbedding.reduce((acc, v) => acc + v * v, 0))
        finalEmbedding = finalEmbedding.map(v => v / (magnitude || 1))
      }
    }

    // 5. 統合プロフィールの更新
    const { error: upsertError } = await supabase.from('value_profiles').upsert({
      user_id: currentUserId,
      nickname: nickname,
      content: text, // 最新の投稿を代表テキストとする
      embedding: finalEmbedding,
      updated_at: now.toISOString()
    })
    if (upsertError) throw new Error(`プロフィール更新失敗: ${upsertError.message}`)

    // 6. マッチング実行（RPC呼び出し）
    const { data: matches, error: matchError } = await supabase.rpc('match_values', {
      query_embedding: finalEmbedding,
      match_threshold: 0.1, // 誰かが出るように低めに設定
      match_count: 5
    })

    if (matchError) throw new Error(`マッチング検索失敗: ${matchError.message}`)

    const filtered = matches?.filter((m: any) => m.user_id !== currentUserId) || []

    return NextResponse.json({ success: true, matches: filtered })

  } catch (error: any) {
    console.error('API Error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}