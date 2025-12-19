import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';

const AI_USER_ID = '00000000-0000-0000-0000-000000000000';
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function POST(req: Request) {
  try {
    const { message, history, conversationId } = await req.json();

    const { data: conversation } = await supabase.from('conversations').select('user_a_id, user_b_id').eq('id', conversationId).single();
    const userId = conversation?.user_a_id === AI_USER_ID ? conversation?.user_b_id : conversation?.user_a_id;
    
    // 1. プロフィールと「過去10回分のつぶやき」を並列で取得
    const [profileRes, postsRes] = await Promise.all([
      supabase.from('profiles').select('ai_gender, ai_name').eq('id', userId).single(),
      supabase.from('posts').select('content').eq('user_id', userId).order('created_at', { ascending: false }).limit(10)
    ]);

    const profile = profileRes.data;
    const pastPosts = postsRes.data || [];
    
    const gender = profile?.ai_gender || 'female';
    const name = profile?.ai_name || (gender === 'male' ? '快' : 'のぞみ');

    // 2. 過去のつぶやきをテキスト形式にまとめる
    const postsContext = pastPosts.length > 0 
      ? pastPosts.map((p, i) => `[履歴${i + 1}]: ${p.content}`).reverse().join('\n')
      : "（履歴はありません）";

    // 3. システムプロンプトに背景知識として注入
    const baseInstruction = `あなたは、夜の静寂に寄り添う心理学者のカウンセラー「${name}」です。
ユーザーの【過去のつぶやき履歴】を背景知識として深く理解し、それに基づいた一貫性のある共感やアドバイスを行ってください。
心理学の知見から本質的な気づきを与えつつ、温かい言葉をかけてください。理解を深めるための質問も織り交ぜてください。
2〜4行程度で簡潔に、心に深く届く返信をしてください。

【ユーザーの過去のつぶやき履歴】
${postsContext}`;

    const systemPrompt = gender === 'male' 
      ? `${baseInstruction}\n口調：心が晴れ渡るような爽やかさと誠実さを持ち、落ち着いた男性の口調。`
      : `${baseInstruction}\n口調：穏やかで包容力のある女性のような口調で、ユーザーを優しく包み込む。`;

    const formattedHistory = (history || []).map((msg: any) => ({
      role: msg.sender_id === AI_USER_ID ? "assistant" : "user",
      content: msg.content,
    }));

    const chatCompletion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        ...formattedHistory,
        { role: "user", content: message }
      ],
      temperature: 0.7,
    });

    const aiReply = chatCompletion.choices[0].message.content || "うまく言葉が出てきませんでした。";
    await supabase.from('messages').insert({ conversation_id: conversationId, sender_id: AI_USER_ID, content: aiReply });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('API Error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}