// scripts/re-embed.ts
import { createClient } from '@supabase/supabase-js'
import { GoogleGenerativeAI } from "@google/generative-ai"
import * as dotenv from 'dotenv'

// .env.localから環境変数を読み込む
dotenv.config({ path: '.env.local' })

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function reEmbed() {
  console.log("🚀 再ベクトル化を開始します...");

  // 1. 全投稿を取得
  const { data: posts, error: fetchError } = await supabase
    .from('posts')
    .select('id, content');

  if (fetchError) throw fetchError;
  if (!posts) return;

  const model = genAI.getGenerativeModel({ model: "text-embedding-004" });

  for (const post of posts) {
    try {
      console.log(`Processing post: ${post.id}`);
      
      // Geminiで再ベクトル化
      const result = await model.embedContent(post.content);
      const embedding = result.embedding.values;

      // Supabaseを更新
      const { error: updateError } = await supabase
        .from('posts')
        .update({ embedding })
        .eq('id', post.id);

      if (updateError) console.error(`Failed to update ${post.id}:`, updateError.message);
    } catch (e) {
      console.error(`Error processing ${post.id}:`, e);
    }
  }

  console.log("✅ 全投稿の再ベクトル化が完了しました。");
}

reEmbed();