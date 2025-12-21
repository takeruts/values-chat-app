import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { GoogleGenerativeAI, TaskType } from "@google/generative-ai"

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// Service Roleを使用（サーバーサイド用）
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  try {
    const { text, nickname, anonymousId } = await req.json()

    // 1. 認証チェック
    const authHeader = req.headers.get('Authorization')
    const token = authHeader?.replace('Bearer ', '')
    let currentUserId = null

    if (token) {
      const { data: { user } } = await supabase.auth.getUser(token)
      currentUserId = user?.id
    }

    const now = new Date()

    // 2. Embedding (ベクトル化)
    const embeddingModel = genAI.getGenerativeModel({ model: "text-embedding-004" });
    const embRes = await embeddingModel.embedContent({
      content: { role: "user", parts: [{ text: text }] },
      taskType: TaskType.RETRIEVAL_DOCUMENT, 
    });
    const newEmbedding = embRes.embedding.values;

    // 3. 投稿を保存
    const { data: postData, error: postError } = await supabase.from('posts').insert({
      user_id: currentUserId,
      anonymous_id: currentUserId ? null : anonymousId,
      content: text,
      nickname: nickname,
      embedding: newEmbedding,
      created_at: now.toISOString()
    }).select()

    if (postError) throw postError;

    // 4. 時間減衰ロジック & プロフィール更新
    let finalEmbedding = newEmbedding;
    if (currentUserId) {
      // 過去の投稿をすべて取得して現在の価値観を計算
      const { data: allPosts } = await supabase
        .from('posts')
        .select('embedding, created_at')
        .eq('user_id', currentUserId)
        .not('embedding', 'is', null);

      if (allPosts && allPosts.length > 0) {
        const HALF_LIFE_DAYS = 30;
        const LAMBDA = Math.log(2) / HALF_LIFE_DAYS;
        let weightedSum = new Array(newEmbedding.length).fill(0);
        let totalWeight = 0;
        const nowMs = now.getTime();

        allPosts.forEach(p => {
          const diffDays = (nowMs - new Date(p.created_at).getTime()) / (1000 * 86400);
          const weight = Math.exp(-LAMBDA * diffDays);
          let embArray = typeof p.embedding === 'string' ? JSON.parse(p.embedding) : p.embedding;
          if (embArray && embArray.length === newEmbedding.length) {
            embArray.forEach((v: number, i: number) => { weightedSum[i] += v * weight });
            totalWeight += weight;
          }
        });

        if (totalWeight > 0) {
          finalEmbedding = weightedSum.map(v => v / totalWeight);
          const magnitude = Math.sqrt(finalEmbedding.reduce((acc, v) => acc + v * v, 0));
          finalEmbedding = finalEmbedding.map(v => v / (magnitude || 1));
        }
      }

      // プロフィール（現在の価値観）を更新
      await supabase.from('value_profiles').upsert({
        user_id: currentUserId,
        nickname: nickname,
        content: text,
        embedding: finalEmbedding,
        updated_at: now.toISOString()
      });
    }

    // 5. マッチング実行 (RPC呼び出し)
    // 🚨 修正：match_threshold を 0.3 くらいに下げると見つかりやすくなります
    const { data: matches, error: matchError } = await supabase.rpc('match_values', {
      query_embedding: finalEmbedding,
      match_threshold: 0.3, 
      match_count: 10,
      current_user_id: currentUserId || '00000000-0000-0000-0000-000000000000'
    });

    if (matchError) throw matchError;

    // スコアの計算とフィルタリング
    const filtered = (matches || [])
      .filter((m: any) => m.content !== null)
      .map((m: any) => {
        const minSim = 0.5; // スコア表示の基準を少し緩める
        let displayScore = (m.similarity - minSim) / (1 - minSim);
        displayScore = Math.max(0, Math.min(1, displayScore));
        return { ...m, similarity: displayScore };
      });

    // 6. Gemini 返信生成
    const chatModel = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const chatPrompt = `あなたはAIカウンセラーです。ユーザーの心に寄り添い、優しく受け止めてください。
    2〜3行で簡潔に、穏やかな言葉遣いで話してください。
    ユーザー: ${text}`;
    
    const result = await chatModel.generateContent(chatPrompt);
    const aiReply = result.response.text();

    return NextResponse.json({ 
      success: true, 
      matches: filtered, // ここにマッチング結果を入れる
      aiReply,
      isLoggedIn: !!currentUserId 
    });

  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}