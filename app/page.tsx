// app/page.tsx

'use client'

import { useState, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import MatchList from '@/components/MatchList'

// 投稿データの型定義
type Post = {
  id: string;
  content: string;
  created_at: string;
}

export default function Home() {
  const [inputText, setInputText] = useState('')
  const [nickname, setNickname] = useState('') 
  const [matches, setMatches] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [user, setUser] = useState<any>(null)
  
  // ユーザーの過去の投稿を保持する State
  const [userPosts, setUserPosts] = useState<Post[]>([]) 
  // 投稿履歴のロード状態
  const [postsLoading, setPostsLoading] = useState(true)

  const router = useRouter()
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  /**
   * ユーザー情報と投稿履歴を取得するコア関数
   */
  const fetchUserAndPosts = async (userId: string) => {
    setPostsLoading(true);
    
    // ニックネームの取得
    const { data: profile } = await supabase
        .from('profiles')
        .select('nickname')
        .eq('id', userId)
        .single()

    if (profile?.nickname) {
        setNickname(profile.nickname)
    }
    
    // ユーザーの過去の投稿を取得 (最新順)
    const { data: postsData, error: postsError } = await supabase
        .from('posts')
        .select('id, content, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

    if (postsError) {
        console.error('Failed to fetch user posts:', postsError);
    } else if (postsData) {
        setUserPosts(postsData);
    }
    
    setPostsLoading(false);
  }

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (user) {
        setUser(user)
        await fetchUserAndPosts(user.id);
      } else {
        setPostsLoading(false);
      }
    }
    checkUser();
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setUser(null)
    router.push('/login')
    router.refresh()
  }

  const handleSave = async () => {
    if (!nickname) {
      alert('ニックネームが設定されていません。\n右上の「⚙️」からニックネームを登録してください。')
      return
    }
    if (!inputText) {
      alert('つぶやきを入力してください')
      return
    }
    
    // ログインチェック
    if (!user || !user.id) {
        alert('ログインが必要です。ログインページに移動します。')
        router.push('/login')
        return
    }
    
    setLoading(true)
    setMatches([])

    const currentInputText = inputText; // 投稿テキストを保持
    setInputText(''); // 投稿直後に入力欄をクリア

    try {
      const { data: sessionData } = await supabase.auth.getSession(); 
      const token = sessionData.session?.access_token;
      
      if (!token) {
        alert('セッショントークンが見つかりません。再ログインしてください。');
        router.push('/login')
        return
      }
      
      const res = await fetch('/api/save_value', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ text: currentInputText, nickname: nickname }), // 保持したテキストを使用
      })

      const textResponse = await res.text()
      if (!textResponse || textResponse.startsWith('<')) {
        throw new Error('APIエラー: サーバー設定を確認してください')
      }
      
      const data = JSON.parse(textResponse)

      if (res.ok) {
        setMatches(data.matches)
        
        // 👇 修正: 投稿成功後、履歴を再取得して正確に更新
        await fetchUserAndPosts(user.id); 

      } else {
        throw new Error(data.error || '失敗しました')
      }

    } catch (error: any) {
      // エラー時は入力中のテキストを戻さない（再送信を防ぐため）
      alert(error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 text-gray-200">
      
      {/* ヘッダー: 完全に単一行に圧縮し、縦長表示の原因となる空白ノードを排除 */}
      <header className="bg-gray-800 shadow-lg px-4 py-3 flex items-center justify-between sticky top-0 z-50 border-b border-gray-700 flex-nowrap">
        <div className="flex-1 min-w-0 pr-4">
          <h1 className="text-lg md:text-xl font-bold text-indigo-400 truncate leading-tight">カチピ (夜モード)</h1>
        </div>
        <div className="flex items-center gap-3 md:gap-6 shrink-0">
          {user ? (<>
              <Link href="/chats" className="flex items-center text-gray-400 hover:text-indigo-400 transition"><span className="text-xl">💬</span><span className="hidden md:inline text-sm font-bold ml-1">トーク</span></Link>
              <Link href="/settings" className="flex items-center text-gray-400 hover:text-indigo-400 transition"><span className="text-xl">⚙️</span><span className="hidden md:inline text-sm font-bold ml-1">設定</span></Link>
              <span className="text-sm font-bold text-gray-300 hidden md:inline truncate max-w-[150px]">{nickname || user.email}</span>
              <button onClick={handleLogout} className="text-red-400 hover:text-red-500 transition flex items-center" title="ログアウト"><span className="md:hidden text-xl">🚪</span><span className="hidden md:inline text-sm font-bold border border-red-400 px-3 py-1 rounded-full hover:bg-gray-700">ログアウト</span></button>
          </>) : (<Link href="/login" className="text-indigo-400 font-bold text-sm">ログイン</Link>)}
        </div>
      </header>

      <main className="max-w-3xl mx-auto p-4 md:p-8">
        
        {/* タイトル: 優しい青紫 */}
        <h2 className="text-xl md:text-2xl font-bold mb-6 text-center text-indigo-300">
          眠れない夜のつぶやき
        </h2>
        
        {/* 投稿ボックス: ダークコンテナ */}
        <div className="bg-gray-800 p-4 md:p-6 rounded-lg shadow-xl mb-8 border border-gray-700">
          
          <div className="mb-4">
            <label className="block text-sm font-bold text-gray-300 mb-1">ニックネーム</label>
            {/* ニックネーム表示: 濃い背景 */}
            <div className="flex items-center justify-between p-3 border rounded-lg bg-gray-900 text-gray-200 border-gray-700">
              {nickname ? (
                <span className="font-medium truncate max-w-[200px]">{nickname}</span>
              ) : (
                <span className="text-gray-500 text-sm">（未設定）</span>
              )}
              
              <Link href="/settings" className="text-xs text-indigo-400 hover:underline shrink-0 ml-2">
                変更
              </Link>
            </div>
            {!nickname && (
               <p className="text-xs text-red-400 mt-1">※投稿にはニックネーム設定が必要です</p>
            )}
          </div>

          {/* テキストエリア: ダークテーマ用 */}
          <textarea
            className="w-full p-4 border rounded-lg shadow-inner h-32 focus:ring-2 focus:ring-indigo-400 outline-none text-base bg-gray-900 text-gray-200 border-gray-700 placeholder-gray-500"
            placeholder="誰にも言えない気持ちや、頭の中にあることを静かに書き出してください。"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
          />

          {/* ボタン: 落ち着いた青紫 */}
          <button
            onClick={handleSave}
            disabled={loading || !nickname}
            className="w-full mt-4 bg-indigo-500 text-white font-bold py-3 rounded-lg shadow-md hover:bg-indigo-600 transition disabled:bg-gray-600"
          >
            {loading ? 'AIが分析中...' : 'つぶやいて仲間を探す'}
          </button>
        </div>

        {/* マッチング結果表示セクション */}
        <div className="mt-8">
            {matches.length > 0 && (
              <h3 className="text-lg md:text-xl font-bold mb-4 text-indigo-300">価値観の近いピープル（カチピ）</h3>
            )}
            
            <MatchList matches={matches} currentUserId={user?.id} />
            
            {matches.length === 0 && !loading && (
              <p className="text-center text-gray-500 mt-10 text-sm">
                ここにマッチング結果が表示されます
              </p>
            )}
        </div>
        
        {/* 区切り線: 濃い線 */}
        <hr className="my-10 border-gray-700" />
        
        {/* 過去の投稿履歴セクション */}
        <div className="mt-10">
          <h3 className="text-xl font-bold mb-4 text-indigo-300">つぶやきの履歴 ({userPosts.length}件)</h3>
          
          {postsLoading ? (
            <p className="text-center text-gray-500">履歴を読み込み中...</p>
          ) : userPosts.length === 0 ? (
            <p className="text-center text-gray-500 mt-5 text-sm">まだ投稿がありません。静かに、つぶやいてみましょう。</p>
          ) : (
            <div className="space-y-4">
              {userPosts.map((post) => (
                <div key={post.id} className="bg-gray-800 p-4 rounded-lg shadow-md border border-gray-700">
                  <p className="text-gray-300 whitespace-pre-wrap">{post.content}</p>
                  <p className="text-xs text-gray-600 mt-2 text-right">
                    {new Date(post.created_at).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
        
      </main>
    </div>
 )
}