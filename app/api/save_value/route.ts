import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { GoogleGenerativeAI } from "@google/generative-ai"

// Geminiの初期化
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
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

    // 2. Embedding (ベクトル化)
    const embeddingModel = genAI.getGenerativeModel({ model: "text-embedding-004" });
    const embRes = await embeddingModel.embedContent(text);
    const newEmbedding = embRes.embedding.values;

    // 3. 投稿を保存
    await supabase.from('posts').insert({
      user_id: currentUserId,
      content: text,
      nickname: nickname,
      embedding: newEmbedding,
      created_at: now.toISOString()
    })

    // 4. 時間減衰ロジック
    const { data: allPosts } = await supabase
      .from('posts')
      .select('embedding, created_at')
      .eq('user_id', currentUserId)
      .not('embedding', 'is', null)

    let finalEmbedding = newEmbedding
    if (allPosts && allPosts.length > 0) {
      const HALF_LIFE_DAYS = 30
      const LAMBDA = Math.log(2) / HALF_LIFE_DAYS
      let weightedSum = new Array(newEmbedding.length).fill(0)
      let totalWeight = 0
      const nowMs = now.getTime()

      allPosts.forEach(p => {
        const diffDays = (nowMs - new Date(p.created_at).getTime()) / (1000 * 86400)
        const weight = Math.exp(-LAMBDA * diffDays)
        let embArray = typeof p.embedding === 'string' ? JSON.parse(p.embedding) : p.embedding

        if (embArray && embArray.length === newEmbedding.length) {
          embArray.forEach((v: number, i: number) => { weightedSum[i] += v * weight })
          totalWeight += weight
        }
      });

      if (totalWeight > 0) {
        finalEmbedding = weightedSum.map(v => v / totalWeight)
        const magnitude = Math.sqrt(finalEmbedding.reduce((acc, v) => acc + v * v, 0))
        finalEmbedding = finalEmbedding.map(v => v / (magnitude || 1))
      }
    }

    // 5. プロフィール更新
    await supabase.from('value_profiles').upsert({
      user_id: currentUserId,
      nickname: nickname,
      content: text,
      embedding: finalEmbedding,
      updated_at: now.toISOString()
    })

    // 6. マッチング実行 (SQL側で created_at を返すようにしたので直接取得可能)
    const { data: matches, error: matchError } = await supabase.rpc('match_values', {
      query_embedding: finalEmbedding,
      match_threshold: 0.1,
      match_count: 5
    })

    if (matchError) throw matchError

    // 自分自身とAIを除外（created_at は既に matches の中に含まれています）
    const filtered = (matches || []).filter((m: any) => 
      m.user_id !== currentUserId && m.user_id !== '00000000-0000-0000-0000-000000000000'
    )

    // 7. Gemini 返信生成
    const chatModel = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const chatPrompt = `あなたは、ユーザーの心に寄り添う親身なパートナーです。難しい理論や哲学用語は一切使わず、ユーザーの今の気持ちやつぶやきを温かく受け止めてください。ユーザーの感情に深く共感し、自分自身の本当の気持ちに気づけるよう、優しく一歩踏み込んだ質問を1つだけ投げかけてください。2〜3行で簡潔に、穏やかな言葉遣いで話してください。

ユーザーのつぶやき: ${text}`;

    const result = await chatModel.generateContent(chatPrompt);
    const aiReply = result.response.text();

    return NextResponse.json({ success: true, matches: filtered, aiReply })

  } catch (error: any) {
    console.error('API Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}