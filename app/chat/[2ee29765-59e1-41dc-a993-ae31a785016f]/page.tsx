import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import ChatRoom from '@/components/ChatRoom' 

// Next.js 15対応の型定義
type PageProps = {
  params: Promise<any> 
}

export default async function ChatPage(props: PageProps) {
  // 1. params を待機 & ID取得ロジック
  const params = await props.params;
  
  // ID取得 (どのような形式で来ても対応できるように)
  let conversationId = params.conversationId || params.conversationid || params.id;
  if (!conversationId) {
    const keys = Object.keys(params);
    if (keys.length > 0) conversationId = params[keys[0]] || keys[0];
  }
  if (Array.isArray(conversationId)) conversationId = conversationId[0];

  // Supabaseクライアント作成
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (name) => cookieStore.get(name)?.value } }
  )

  // ログインユーザー確認
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  // IDがない場合のエラー処理
  if (!conversationId) {
    return <div className="p-8 text-red-500">エラー: 会話IDが見つかりません</div>
  }

  // ---------------------------------------------------------
  // 👇 【ここを修正】相手の名前を取得するロジック
  // ---------------------------------------------------------
  let chatTitle = 'チャットルーム'; // デフォルトタイトル

  // A. まず、この会話の参加者を取得
  const { data: conv } = await supabase
    .from('conversations')
    .select('user_a_id, user_b_id')
    .eq('id', conversationId)
    .single();

  if (conv) {
    // B. 自分じゃない方のID（相手のID）を特定
    // user_a_id が自分なら user_b_id が相手、逆なら user_a_id が相手
    const partnerId = conv.user_a_id === user.id ? conv.user_b_id : conv.user_a_id;

    // 修正箇所：C. 相手のニックネームを取得
    const { data: profile } = await supabase
      .from('values_cards') 
      .select('nickname')
      .eq('user_id', partnerId)
      .neq('nickname', null) // 👈 nicknameが空じゃないものを探す
      .order('created_at', { ascending: false }) // 👈 最新のデータを優先する（created_atカラムがある前提）
      .limit(1)
      .maybeSingle(); 

    // 取得した名前を使うか、なければ「名無し」にする
    const partnerName = profile?.nickname || '名無し';
    
    chatTitle = `${partnerName} さんとのチャット`;


    if (profile?.nickname) {
      chatTitle = `${profile.nickname} さんとのチャット`;
    }
  }
  // ---------------------------------------------------------


  return (
    <div className="container mx-auto p-4 max-w-2xl min-h-screen bg-gray-50">
      <div className="mb-4 flex flex-col">
        <a href="/" className="text-sm text-blue-500 hover:underline">← 戻る</a>
        
        {/* タイトルを表示 */}
        <h1 className="text-xl font-bold">{chatTitle}</h1>
        
        <span className="text-xs text-gray-400 font-mono">Room ID: {conversationId}</span>
      </div>

      <ChatRoom 
        conversationId={conversationId} 
        currentUserId={user.id} 
      />
    </div>
  )
}