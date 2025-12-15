import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import ChatRoom from '@/components/ChatRoom' 
import ChatHeader from '@/components/ChatHeader'

// Next.js 15対応の型定義 (Promiseとして渡されることを許容)
type PageProps = {
  params: Promise<any> 
}

export default async function ChatPage(props: PageProps) {
  // 1. params を待機 & ID取得ロジック
  const params = await props.params; 
  
  // ID取得: フォルダ名 [conversationId] に対応するプロパティ名を使用
  let conversationId = params.conversationId; 
    
    // 補足的なID取得ロジック (paramsの形式が揺れる場合に備えて残す)
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
  
  // 自分のIDを確保
  const currentUserId = user.id;

  // IDがない場合のエラー処理
  if (!conversationId) {
    return <div className="p-8 text-red-500">エラー: 会話IDが見つかりません</div>
  }
  
  const finalConversationId = conversationId;

  // ---------------------------------------------------------
  // 相手のIDを特定
  // ---------------------------------------------------------
  
  // A. 会話の参加者を取得
  const { data: conv } = await supabase
    .from('conversations')
    .select('user_a_id, user_b_id')
    .eq('id', finalConversationId)
    .single();

  let partnerId = null;

  if (conv) {
    // B. 自分じゃない方のID（相手のID）を特定
    partnerId = conv.user_a_id === user.id ? conv.user_b_id : conv.user_a_id;
  }
  
  // ---------------------------------------------------------

  return (
    <div className="container mx-auto max-w-2xl min-h-screen bg-gray-50 flex flex-col">
      
      {/* ChatHeader */}
      {partnerId ? (<ChatHeader partnerId={partnerId} currentUserId={currentUserId} />) : (
        <div className="bg-white p-4 border-b"><h1 className="font-bold">チャット</h1></div>
      )}{/* */}

      {/* メインのチャットエリア (ID表示 div を削除) */}
      <div className="flex-1 overflow-hidden flex flex-col p-4">
        {/* 🚨 削除: Room IDの表示 div を完全に削除しました */}

        <ChatRoom 
          conversationId={finalConversationId} 
          currentUserId={user.id} 
        />
      </div>
    </div>
  )
}