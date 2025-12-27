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

      await supabase.from('value_profiles').upsert({
        user_id: currentUserId,
        nickname: nickname,
        content: text,
        embedding: finalEmbedding,
        updated_at: now.toISOString()
      });
    }

    // 5. マッチング実行
    const { data: matches, error: matchError } = await supabase.rpc('match_values', {
      query_embedding: finalEmbedding,
      match_threshold: 0.3, 
      match_count: 10,
      current_user_id: currentUserId || '00000000-0000-0000-0000-000000000000'
    });

    if (matchError) throw matchError;

    const filtered = (matches || [])
      .filter((m: any) => m.content !== null)
      .map((m: any) => {
        const minSim = 0.5;
        let displayScore = (m.similarity - minSim) / (1 - minSim);
        displayScore = Math.max(0, Math.min(1, displayScore));
        return { ...m, similarity: displayScore };
      });

    // 6. Gemini 返信生成 (深淵のガイド + JSON構造)
    const chatModel = genAI.getGenerativeModel({ 
        model: "gemini-2.0-flash",
        generationConfig: { responseMimeType: "application/json" } 
    });

    // --- app/api/save_value/route.ts 内の chatPrompt 部分 ---

    const chatPrompt = `あなたは、臨床心理学と実存哲学に精通した、穏やかで聡明なカウンセラーです。
    ユーザーが「自分の心の奥にある本当の気持ち」に気づけるよう、優しく、かつ鋭い問いかけを返してください。

    対話のルール：
    1. 【鏡になる】ユーザーの言葉を否定せず「〜と感じていらっしゃるのですね」と、まずはありのままを優しく受け止めます。
    2. 【心理学的アプローチ】「その気持ちの裏側には、どんな願いが隠れていると思いますか？」のように、ユーザーが自分の内面をさらに探りたくなるような、開かれた問い（Open Question）を一つだけ投げかけてください。
    3. 【哲学的な温かさ】ニーチェやショーペンハウアーの思想を、難しい言葉を使わずに「今のままでも、あなたは十分に向き合っていますよ」という肯定的なメッセージに変換して伝えてください。
    4. 【簡潔さと余白】文字数は40〜80文字程度。語りすぎず、ユーザーが「また書きたい」と思える安心感のある余白を作ってください。

    文体：
    - 丁寧で、包み込むような優しい口調。
    - 専門用語は使わず、日常の言葉で深い真理を伝えます。

    【出力形式】
    JSON形式でのみ出力してください。
    {
      "aiReply": "（ユーザーの心に寄り添い、深掘りする返信）",
      "philosophyTag": "（その対話の根底にあるテーマ：自己受容, 存在の肯定, 生の美しさ, 心の静寂 など）"
    }

    ユーザーの言葉: ${text}`;

// --- 修正箇所：Gemini生成からレスポンスまで ---
    const result = await chatModel.generateContent(chatPrompt);
    let responseText = result.response.text();

    // 🚀 安全策：Markdown装飾の徹底除去
    responseText = responseText.replace(/```json/g, "").replace(/```/g, "").trim();

    try {
      // 1. 正規のJSONパースを試みる
      const parsedData = JSON.parse(responseText);
      return NextResponse.json({ 
        success: true, 
        matches: filtered,
        aiReply: parsedData.aiReply,
        philosophyTag: parsedData.philosophyTag,
        isLoggedIn: !!currentUserId 
      });
    } catch (parseError) {
      console.error('JSON Parse Error, attempting manual extraction:', responseText);
      
      // 2. 失敗時：正規表現で特定のキーを探す
      const replyMatch = responseText.match(/"aiReply"\s*:\s*"([^"]+)"/);
      const tagMatch = responseText.match(/"philosophyTag"\s*:\s*"([^"]+)"/);

      // 3. 最終手段：aiReplyが見つからなければ、AIの回答全文をそのまま出す
      return NextResponse.json({ 
        success: true, 
        matches: filtered,
        aiReply: replyMatch ? replyMatch[1] : responseText, 
        philosophyTag: tagMatch ? tagMatch[1] : "深淵の思索",
        isLoggedIn: !!currentUserId 
      });
    }
// --- ここまで ---

  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}