import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import OpenAI from 'openai'

// OpenAIの初期化 (変更なし)
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// =======================================================
// 👇 修正1: DB書き込み/RPC呼び出し用クライアント (Service Role Key)
// =======================================================
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! 
)

// =======================================================
// 👇 修正2: JWT検証用クライアント (Anon Key) を別途作成
// =======================================================
const supabaseAuth = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! 
)


export async function POST(req: Request) {
  try {
    const { text, nickname } = await req.json()

    // 1. ユーザー認証の確認
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      // フロントエンドがトークンを送ってこなかった場合
      return NextResponse.json({ error: '認証エラー: トークンがありません' }, { status: 401 })
    }
    const token = authHeader.replace('Bearer ', '')
    
    // 👇 修正3: 認証チェックは Anon Key のクライアントで行う
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token)

    if (authError || !user) {
      console.error('認証失敗:', authError?.message)
      return NextResponse.json({ error: '認証失敗: ユーザー情報が無効です' }, { status: 401 })
    }

    const currentUserId = user.id;
    const nowISO = new Date().toISOString();

    // 2. 👇 新しいつぶやきを 'posts' テーブルに個別保存 (DBアクセスは Service Role Key の supabase で行う)
    const { error: postError } = await supabase
        .from('posts') // 👈 個別履歴テーブル
        .insert({ 
            user_id: currentUserId, 
            content: text, 
            nickname: nickname,
            created_at: nowISO 
        });

    if (postError) {
        throw new Error(`投稿履歴の保存失敗: ${postError.message}`);
    }


    // 3. 👇 'posts' テーブルからそのユーザーの全履歴を取得
    const { data: allPosts, error: fetchError } = await supabase
      .from('posts')
      .select('content')
      .eq('user_id', currentUserId)
      .order('created_at', { ascending: true });

    if (fetchError) {
        throw new Error(`履歴の取得失敗: ${fetchError.message}`);
    }

    // 4. 全履歴を結合
    const combinedText = allPosts ? allPosts.map(post => post.content).join('\n') : text;

    // 5. 結合したテキスト全体をベクトル化 (Embedding)
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: combinedText,
    })
    const embedding = embeddingResponse.data[0].embedding

    // 6. 👇 結合された全文とベクトルを 'value_profiles' に Upsert
    const { error: upsertError } = await supabase
      .from('value_profiles') // 👈 相性検索用の結合テーブル
      .upsert({
        user_id: currentUserId,
        nickname: nickname,
        content: combinedText, // 結合したテキストを保存
        embedding: embedding,  // 新しいベクトル
        updated_at: nowISO,
      })

    if (upsertError) {
      throw new Error(`相性プロフィールの更新失敗: ${upsertError.message}`)
    }
    
    // プロフィールテーブルがある場合はそちらのニックネームも更新
    await supabase
      .from('profiles')
      .upsert({ id: currentUserId, nickname: nickname })


    // 7. マッチング処理 (結合後のベクトルを使って検索)
    const { data: matches, error: matchError } = await supabase.rpc('match_values', {
      query_embedding: embedding,
      match_threshold: 0.5,
      match_count: 5,
    })

    if (matchError) {
      console.error('Match error:', matchError)
      return NextResponse.json({ matches: [] })
    }

    const filteredMatches = matches ? matches.filter((m: any) => m.user_id !== currentUserId) : []

    return NextResponse.json({ 
      success: true, 
      matches: filteredMatches,
      savedText: combinedText 
    })

  } catch (error: any) {
    // サーバーのターミナルでエラーを確認できるようにログ出力
    console.error('API処理中のエラー:', error.message) 
    return NextResponse.json({ error: error.message || 'サーバー内部エラー' }, { status: 500 })
  }
}