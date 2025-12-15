import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import ChatRoom from '@/components/ChatRoom' 
// 👇 追加: 作成したヘッダーコンポーネントをインポート
import ChatHeader from '@/components/ChatHeader'

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
  // 👇 修正: 相手のIDだけ特定し、表示はコンポーネントに任せる
  // ---------------------------------------------------------
  
  // A. 会話の参加者を取得
  const { data: conv } = await supabase
    .from('conversations')
    .select('user_a_id, user_b_id')
    .eq('id', conversationId)
    .single();

  let partnerId = null;

  if (conv) {
    // B. 自分じゃない方のID（相手のID）を特定
    partnerId = conv.user_a_id === user.id ? conv.user_b_id : conv.user_a_id;
  }
  
  // ※サーバー側でのニックネーム取得ロジックは削除しました。
  //   (ChatHeaderコンポーネントがリアルタイムに行うため)

  // ---------------------------------------------------------

  return (
    <div className="container mx-auto max-w-2xl min-h-screen bg-gray-50 flex flex-col">
      
      {/* 👇 修正: ヘッダー部分を ChatHeader に置き換え */}
      {partnerId ? (
         <ChatHeader partnerId={partnerId} />
      ) : (
        // 万が一 IDが取れなかった場合のフォールバック
        <div className="bg-white p-4 border-b">
           <h1 className="font-bold">チャット</h1>
        </div>
      )}

      {/* メインのチャットエリア */}
      <div className="flex-1 overflow-hidden flex flex-col p-4">
        {/* Room IDの表示はデバッグ用に小さく残すか、不要なら削除でもOK */}
        <div className="mb-2 text-right">
             <span className="text-xs text-gray-300 font-mono">ID: {conversationId}</span>
        </div>

        <ChatRoom 
          conversationId={conversationId} 
          currentUserId={user.id} 
        />
      </div>
      
      {/* 戻るリンクを下に配置するか、ChatHeader内に組み込むのもアリですが、
          一旦元のレイアウトを尊重して上部にあったものをヘッダーコンポーネントへ委譲しました。
          もし「一覧へ戻る」ボタンが必要なら、ChatHeader内に追加するのがUX的に綺麗です。 */}
      <div className="p-2 text-center">
        <a href="/" className="text-sm text-blue-500 hover:underline">← 一覧に戻る</a>
      </div>
    </div>
  )
}