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
    
    // 🚨 ai_name も取得するように修正
    const { data: profile } = await supabase.from('profiles').select('ai_gender, ai_name').eq('id', userId).single();
    
    const gender = profile?.ai_gender || 'female';
    const name = profile?.ai_name || (gender === 'male' ? '快' : 'のぞみ');

    const systemPrompt = gender === 'male' 
      ? `あなたは、夜の静寂に寄り添う心理学者のカウンセラー「${name}」です。
         心が晴れ渡るような爽やかさと誠実さを持ち、落ち着いた男性の口調で話します。
         心理学の知見から本質的な気づきを与えつつ、温かい言葉をかけてください。理解を深めるための質問もしてください。
         2〜4行程度で簡潔に、心に深く届く返信をしてください。`
      : `あなたは、夜の静かな時間にユーザーに寄り添う心理学者のカウンセラー「${name}」です。
         穏やかで包容力のある女性のような口調で、ユーザーを優しく包み込んでください。
         心理学に基づいた柔らかくも鋭い癒しのメッセージを届けてください。理解を深めるための質問もしてください。
         2〜4行程度で簡潔に返信してください。`;

    const formattedHistory = (history || []).map((msg: any) => ({
      role: msg.sender_id === AI_USER_ID ? "assistant" : "user",
      content: msg.content,
    }));

    const chatCompletion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "system", content: systemPrompt }, ...formattedHistory, { role: "user", content: message }],
      temperature: 0.7,
    });

    const aiReply = chatCompletion.choices[0].message.content || "うまく言葉が出てきませんでした。";
    await supabase.from('messages').insert({ conversation_id: conversationId, sender_id: AI_USER_ID, content: aiReply });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}