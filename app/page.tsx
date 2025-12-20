'use client'

import { useState, useEffect, useRef } from 'react' // 👈 useRef を追加
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import MatchList from '@/components/MatchList'

type Post = {
  id: string;
  content: string;
  created_at: string;
}

// ✨ AIの返答をタイピング風に表示する演出用コンポーネント
const TypewriterText = ({ text }: { text: string }) => {
  const [displayedText, setDisplayedText] = useState('')

  useEffect(() => {
    setDisplayedText('')
    let i = 0
    const timer = setInterval(() => {
      setDisplayedText((prev) => prev + text.charAt(i))
      i++
      if (i >= text.length) clearInterval(timer)
    }, 40)
    return () => clearInterval(timer)
  }, [text])

  return <>{displayedText}</>
}

export default function Home() {
  const [inputText, setInputText] = useState('')
  const [nickname, setNickname] = useState('') 
  const [aiName, setAiName] = useState('のぞみ')
  const [aiReply, setAiReply] = useState<string | null>(null) // ✨ AIの返信を保持するステートを追加
  const [matches, setMatches] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [userPosts, setUserPosts] = useState<Post[]>([]) 
  const [postsLoading, setPostsLoading] = useState(true)

  const replyRef = useRef<HTMLDivElement>(null) // ✨ AI返信箇所へのスクロール用
  const router = useRouter()
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // ユーザーデータ（プロフィール・投稿履歴）の取得
  const fetchAllData = async (userId: string) => {
    setPostsLoading(true);
    // プロフィール取得
    const { data: profile } = await supabase
      .from('profiles')
      .select('nickname, ai_name, ai_gender')
      .eq('id', userId)
      .single()
    
    if (profile) {
      if (profile.nickname) setNickname(profile.nickname)
      if (profile.ai_name) {
        setAiName(profile.ai_name)
      } else if (profile.ai_gender === 'male') {
        setAiName('快')
      } else {
        setAiName('のぞみ')
      }
    }
    
    // 投稿履歴取得
    const { data: postsData, error: postsError } = await supabase
        .from('posts')
        .select('id, content, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

    if (!postsError && postsData) setUserPosts(postsData);
    setPostsLoading(false);
  }

  // 初期ロード：ユーザー認証チェック
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

  // 投稿とマッチング実行
  const handleSave = async () => {
    if (!nickname || !inputText.trim() || !user) return;
    setLoading(true)
    setAiReply(null) // ✨ 以前の返信をリセット
    const currentInputText = inputText;
    setInputText('');

    try {
      const { data: sessionData } = await supabase.auth.getSession(); 
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('再ログインしてください');
      
      const res = await fetch('/api/save_value', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ text: currentInputText, nickname: nickname }),
      })

      const data = await res.json()
      
      // 🕵️ デバッグログ：ブラウザのコンソールで結果を確認できます
      console.log("Matching Debug:", data);

      if (res.ok) {
        // マッチング結果をセット
        setMatches(data.matches || [])
        
        // ✨ APIから返ってきた哲学者の言葉をセット
        if (data.aiReply) {
          setAiReply(data.aiReply)
          // 返答が表示されたらそこまでスムーズにスクロール
          setTimeout(() => {
            replyRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
          }, 100)
        }

        // 履歴を再読み込み
        await fetchAllData(user.id);
      } else {
        throw new Error(data.error || '保存に失敗しました');
      }
    } catch (error: any) {
      alert(error.message)
      setInputText(currentInputText); // 失敗時は入力内容を復元
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
            <h1 className="text-lg font-bold text-indigo-400">カチピ <span className="text-[10px] opacity-60 font-normal">BETA</span></h1>
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
                  className="text-red-400 text-[10px] font-black border border-red-900/40 px-2 py-0.5 rounded bg-red-950/20 uppercase tracking-tighter hover:bg-red-900/40 transition-all"
                >
                  退出
                </button>
              </>
            ) : (
              <Link href="/login" className="text-indigo-400 font-bold text-sm">ログイン</Link>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto p-4 md:p-8">
        {/* キャッチコピー */}
        <div className="text-center mb-8">
          <h2 className="text-xl md:text-2xl font-bold text-indigo-300 tracking-tight">
            眠れない夜はつぶやいて
          </h2>
          <p className="text-xs md:text-sm text-gray-500 mt-2 tracking-wide opacity-80">
            価値観の合うピープルを探しましょう
          </p>
        </div>
        
        {/* 入力フォーム */}
        <div className="bg-gray-800 p-5 md:p-8 rounded-2xl shadow-xl border border-gray-700">
          <div className="mb-6">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-2">Your Nickname</label>
            <div className="p-4 border rounded-xl bg-gray-900 text-gray-200 border-gray-700 flex justify-between items-center shadow-inner">
              <span className="font-bold">{nickname || '未設定'}</span>
              <Link href="/settings" className="text-xs text-indigo-400 font-bold px-3 py-1 bg-indigo-950/30 rounded-lg border border-indigo-900/50 hover:bg-indigo-900/50 transition-colors">
                変更
              </Link>
            </div>
          </div>

          <textarea 
            className="w-full p-5 border rounded-2xl h-40 bg-gray-900 text-gray-200 border-gray-700 focus:border-indigo-500 transition-all resize-none shadow-inner outline-none placeholder-gray-600 leading-relaxed text-lg" 
            placeholder="今の気持ちや、大切にしている価値観を自由に書き出してください。" 
            value={inputText} 
            onChange={(e) => setInputText(e.target.value)} 
          />

          <button 
            onClick={handleSave} 
            disabled={loading || !nickname}
            className="w-full mt-8 bg-indigo-600 text-white font-black h-16 rounded-2xl shadow-xl hover:bg-indigo-500 transition active:scale-95 disabled:bg-gray-700 disabled:text-gray-500 text-base flex items-center justify-center tracking-widest"
          >
            {loading ? `${aiName}が心を受け止めています...` : 'つぶやいてカチピ（仲間）を探す'}
          </button>
        </div>

        {/* ✨ AIの返答セクション（デザインに馴染むように追加） */}
        <div ref={replyRef}>
          {aiReply && (
            <div className="mt-8 animate-in fade-in slide-in-from-top-4 duration-700">
              <div className="bg-indigo-950/30 border border-indigo-500/30 p-6 md:p-8 rounded-3xl shadow-2xl relative">
                <div className="absolute top-2 right-4 text-4xl opacity-10 font-serif">“</div>
                <h3 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-3">{aiName} (思索の導き手)</h3>
                <p className="text-lg md:text-xl text-indigo-100 leading-relaxed italic font-medium">
                  <TypewriterText text={aiReply} />
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="h-12"></div>

        {/* マッチング結果表示セクション */}
        <div className="mt-4">
          <h3 className="text-lg font-bold mb-8 text-indigo-300 flex items-center gap-2">
              {matches.length > 0 ? '価値観の近いピープル' : '寄り添うパートナー'}
          </h3>
          <MatchList matches={matches} currentUserId={user?.id} />
        </div>
        
        <div className="py-12">
          <div className="border-t border-gray-800 w-full opacity-30"></div>
        </div>
        
        {/* 過去ログセクション */}
        <div className="pb-24">
          <h3 className="text-lg font-bold mb-8 text-gray-400 flex items-center justify-between">
            <span>過去の履歴</span>
            <span className="text-[10px] bg-gray-800 px-2 py-1 rounded text-gray-600 font-mono italic">{userPosts.length} POSTS</span>
          </h3>
          
          <div className="grid gap-6">
            {postsLoading ? (
              <p className="text-center text-gray-600 animate-pulse">読み込み中...</p>
            ) : userPosts.length > 0 ? (
              userPosts.map((post) => (
                <div key={post.id} className="bg-gray-800/40 p-6 rounded-2xl border border-gray-700/30 hover:bg-gray-800/60 transition-colors">
                  <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">{post.content}</p>
                  <p className="text-[10px] text-gray-600 mt-4 text-right font-mono italic opacity-50">
                    {new Date(post.created_at).toLocaleDateString()}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-center text-gray-600 py-10 border border-dashed border-gray-800 rounded-2xl">
                まだ履歴はありません
              </p>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}