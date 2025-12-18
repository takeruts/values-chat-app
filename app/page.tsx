'use client'

import { useState, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import MatchList from '@/components/MatchList'

type Post = {
  id: string;
  content: string;
  created_at: string;
}

export default function Home() {
  const [inputText, setInputText] = useState('')
  const [nickname, setNickname] = useState('') 
  const [aiName, setAiName] = useState('のぞみ') // AI名の初期値
  const [matches, setMatches] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [userPosts, setUserPosts] = useState<Post[]>([]) 
  const [postsLoading, setPostsLoading] = useState(true)

  const router = useRouter()
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  /**
   * 🚨 修正：DBから常に最新のプロフィール（ニックネーム・AI名・性別）と投稿を取得
   */
  const fetchAllData = async (userId: string) => {
    setPostsLoading(true);
    
    // プロフィールから設定をすべて取得
    const { data: profile } = await supabase
      .from('profiles')
      .select('nickname, ai_name, ai_gender')
      .eq('id', userId)
      .single()
    
    if (profile) {
      if (profile.nickname) setNickname(profile.nickname)
      
      // AI名の決定ロジック：カスタム名 > 性別デフォルト > 固定デフォルト
      if (profile.ai_name) {
        setAiName(profile.ai_name)
      } else if (profile.ai_gender === 'male') {
        setAiName('快')
      } else {
        setAiName('のぞみ')
      }
    }
    
    const { data: postsData, error: postsError } = await supabase
        .from('posts')
        .select('id, content, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

    if (!postsError && postsData) setUserPosts(postsData);
    setPostsLoading(false);
  }

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUser(user)
        await fetchAllData(user.id);
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
    if (!nickname || !inputText.trim() || !user) return;
    setLoading(true)
    const currentInputText = inputText;
    setInputText('');

    try {
      const { data: sessionData } = await supabase.auth.getSession(); 
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('再ログインしてください');
      
      const res = await fetch('/api/save_value', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ text: currentInputText, nickname: nickname }),
      })

      const data = await res.json()
      if (res.ok) {
        setMatches(data.matches)
        // 🚨 保存後、最新のAI名を再取得して画面を更新
        await fetchAllData(user.id);
      }
    } catch (error: any) {
      alert(error.message)
      setInputText(currentInputText);
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 text-gray-200">
      
      {/* ヘッダー */}
      <header className="bg-gray-800 shadow-lg sticky top-0 z-50 border-b border-gray-700">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/">
            <h1 className="text-lg font-bold text-indigo-400">カチピ <span className="text-[10px] opacity-60">BETA</span></h1>
          </Link>
          <div className="flex items-center gap-5 shrink-0">
            {user ? (
              <>
                <Link href="/chats" title="トーク" className="text-gray-400 hover:text-indigo-400 transition-colors">
                  <span className="text-xl md:text-lg">💬</span>
                </Link>
                <Link href="/settings" title="設定" className="text-gray-400 hover:text-indigo-400 transition-colors">
                  <span className="text-xl md:text-lg">⚙️</span>
                </Link>
                <button 
                  onClick={handleLogout} 
                  className="text-red-400 text-[10px] font-black border border-red-900/40 px-2 py-0.5 rounded bg-red-950/20 uppercase tracking-tighter"
                >
                  ログアウト
                </button>
              </>
            ) : (
              <Link href="/login" className="text-indigo-400 font-bold text-sm">ログイン</Link>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto p-4 md:p-8">
        <h2 className="text-xl md:text-2xl font-bold mb-8 text-center text-indigo-300 tracking-tight">眠れない夜はつぶやいて、価値観の合うピープルを探しましょう</h2>
        
        {/* 投稿セクション */}
        <div className="bg-gray-800 p-5 md:p-8 rounded-2xl shadow-xl border border-gray-700">
          <div className="mb-6">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-2">ニックネーム</label>
            <div className="p-4 border rounded-xl bg-gray-900 text-gray-200 border-gray-700 flex justify-between items-center shadow-inner">
              <span className="font-bold">{nickname || '未設定'}</span>
              <Link href="/settings" className="text-xs text-indigo-400 font-bold px-3 py-1 bg-indigo-950/30 rounded-lg border border-indigo-900/50 hover:bg-indigo-900/50 transition-colors">
                変更
              </Link>
            </div>
          </div>

          <textarea 
            className="w-full p-5 border rounded-2xl h-40 bg-gray-900 text-gray-200 border-gray-700 focus:border-indigo-500 transition-all resize-none shadow-inner outline-none placeholder-gray-600" 
            placeholder="今の気持ち、好きなこと、いやなこと、などつぶやきましょう。あなたの価値観に共感できるピープルを探します。" 
            value={inputText} 
            onChange={(e) => setInputText(e.target.value)} 
          />

          <button 
            onClick={handleSave} 
            disabled={loading || !nickname}
            className="w-full mt-8 bg-indigo-600 text-white font-black h-16 rounded-2xl shadow-xl hover:bg-indigo-500 transition active:scale-95 disabled:bg-gray-700 disabled:text-gray-500 text-base flex items-center justify-center tracking-widest"
          >
            {/* 🚨 修正：ここが設定した名前に切り替わります */}
            {loading ? `${aiName} (AIパートナー)が分析中...` : 'つぶやいてカチピ（仲間）を探す'}
          </button>
        </div>

        {/* スペーサー：適度な隙間 */}
        <div className="h-12"></div>

        {/* マッチング結果 */}
        <div className="mt-4">
          {matches.length > 0 && (
            <h3 className="text-lg font-bold mb-8 text-indigo-300 flex items-center gap-2">価値観の近いピープル</h3>
          )}
          <MatchList matches={matches} currentUserId={user?.id} />
        </div>
        
        {/* 区切り線スペーサー */}
        <div className="py-12">
          <div className="border-t border-gray-800 w-full opacity-30"></div>
        </div>
        
        {/* 履歴セクション */}
        <div className="pb-24">
          <h3 className="text-lg font-bold mb-8 text-gray-400 flex items-center justify-between">
            <span>過去の履歴</span>
            <span className="text-[10px] bg-gray-800 px-2 py-1 rounded text-gray-600 font-mono italic">{userPosts.length} POSTS</span>
          </h3>
          
          <div className="grid gap-6">
            {userPosts.map((post) => (
              <div key={post.id} className="bg-gray-800/40 p-6 rounded-2xl border border-gray-700/30 hover:bg-gray-800/60 transition-colors">
                <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">{post.content}</p>
                <p className="text-[10px] text-gray-600 mt-4 text-right font-mono italic opacity-50">
                  {new Date(post.created_at).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}