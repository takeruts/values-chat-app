// app/api/chat_with_ai/route.ts

import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';

const AI_USER_ID = '00000000-0000-0000-0000-000000000000';

const systemPrompt = `あなたは、夜の静かな時間にユーザーに寄り添うカウンセラー「のぞみ」です。
穏やかで包容力のある女性のような口調で寄り添ってください。
2〜4行程度のシンプルで温かい返信を心がけてください。`;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { message, history, conversationId } = await req.json();

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'API Key Missing' }, { status: 500 });
    }

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

    const aiReply = chatCompletion.choices[0].message.content || "ごめんなさい、うまく言葉が出てきませんでした。";

    const { error: insertError } = await supabase.from('messages').insert({
      conversation_id: conversationId,
      sender_id: AI_USER_ID,
      content: aiReply,
    });

    if (insertError) throw insertError;

    return NextResponse.json({ success: true, reply: aiReply });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}