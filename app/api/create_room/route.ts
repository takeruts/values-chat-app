import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { GoogleGenerativeAI } from "@google/generative-ai"

// Geminiの初期化
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const chatModel = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

// Service Role Key を使用してサーバー側のSupabaseクライアントを初期化
// ※これにより、RLS(権限)をバイパスして icebreaker を確実に書き込めます
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
    const [id1, id2] = [currentUserId, partnerId].sort() as [string, string]

    const { data: existingConversation, error: fetchError } = await supabase
      .from('conversations')
      .select('id, icebreaker')
      .eq('user_a_id', id1)
      .eq('user_b_id', id2)
      .maybeSingle()

    if (fetchError) {
      throw new Error(`既存会話の検索失敗: ${fetchError.message}`)
    }

    // --- ✨ 3. 既存の会話がある場合の処理（icebreaker補完ロジック追加） ---
    if (existingConversation) {
      // もし既存ルームの icebreaker が空(null)の場合は、ここで生成して更新する
      if (!existingConversation.icebreaker) {
        const generatedIcebreaker = await generateIcebreaker(currentUserId, partnerId);
        
        await supabase
          .from('conversations')
          .update({ icebreaker: generatedIcebreaker })
          .eq('id', existingConversation.id);
          
        return NextResponse.json({ conversationId: existingConversation.id });
      }
      
      return NextResponse.json({ conversationId: existingConversation.id })
    }

    // --- 4. 既存の会話がない場合、新規作成 ---
    const icebreaker = await generateIcebreaker(currentUserId, partnerId);

    const { data: newConversation, error: insertError } = await supabase
      .from('conversations')
      .insert({ 
        user_a_id: id1,
        user_b_id: id2,
        icebreaker: icebreaker
      })
      .select('id')
      .single()

    if (insertError) {
      throw new Error(`新規会話の作成失敗: ${insertError.message}`)
    }

    return NextResponse.json({ conversationId: newConversation.id })

  } catch (error: any) {
    console.error('API Error:', error)
    return NextResponse.json({ error: error.message || 'サーバー内部エラー' }, { status: 500 })
  }
}

// 🕒 アイスブレイク生成用の共通関数
async function generateIcebreaker(userId: string, partnerId: string): Promise<string> {
  const defaultMsg = "新しい繋がりが生まれました。お互いの価値観を深めてみましょう。";
  
  try {
    const { data: profiles } = await supabase
      .from('value_profiles')
      .select('user_id, nickname, content')
      .in('user_id', [userId, partnerId]);

    const me = profiles?.find(p => p.user_id === userId);
    const partner = profiles?.find(p => p.user_id === partnerId);

    if (!me || !partner) return defaultMsg;

    const prompt = `あなたは、ユーザーの心に寄り添う親身なパートナーです。
以下の二人の最近のつぶやきを読んで、彼らの価値観の「共通点」や「共鳴しているポイント」を分析してください。
そして、二人が会話を始めるきっかけになるような温かいメッセージを2〜3行で作成してください。
難しい言葉は使わず、穏やかな言葉遣いでお願いします。

【${me.nickname}さんのつぶやき】: ${me.content}
【${partner.nickname}さんのつぶやき】: ${partner.content}`;

    const result = await chatModel.generateContent(prompt);
    return result.response.text();
  } catch (err) {
    console.error('Gemini generation failed:', err);
    return defaultMsg;
  }
}