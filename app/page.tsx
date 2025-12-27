'use client'

import { useState, useEffect, useRef } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import MatchList from '@/components/MatchList'

type Post = {
  id: string;
  content: string;
  created_at: string;
}

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

// マインドフルネス・哲学・無常観を込めたプロンプト
const mindfulnessPrompts = [
  "万物は流転します。今、この瞬間にだけ存在する『音』を拾ってみて...",
  "苦悩は生への意志の証です。今、体のどこにその『重み』を感じますか？",
  "夜の深淵をじっと見つめてください。そこに見える『暗闇の色』は何色でしょう。",
  "すべてはやがて消えゆく。だからこそ、今触れている『画面の冷たさ』を大切に観て。",
  "運命を愛せ。今、あなたの喉を通る『空気の乾き』をただ受け止めて。",
  "思考は空を流れる雲。その下にある、揺るがない『地面の固さ』を感じてみて。"
];

export default function Home() {
  const [inputText, setInputText] = useState('')
  const [nickname, setNickname] = useState('') 
  const [aiName, setAiName] = useState('AIカウンセラー')
  const [aiReply, setAiReply] = useState<string | null>(null)
  const [philosophyTag, setPhilosophyTag] = useState<string | null>(null)
  const [matches, setMatches] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [userPosts, setUserPosts] = useState<Post[]>([]) 
  const [postsLoading, setPostsLoading] = useState(true)
  
  const [placeholder, setPlaceholder] = useState('今の気持ちを自由に書き出してください。')

  const replyRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const fetchAllData = async (userId: string) => {
    setPostsLoading(true);
    const { data: profile } = await supabase
      .from('profiles')
      .select('nickname, ai_name')
      .eq('id', userId)
      .single()
    
    if (profile) {
      if (profile.nickname) setNickname(profile.nickname)
      setAiName(profile.ai_name || 'AIカウンセラー')
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
    const randomPrompt = mindfulnessPrompts[Math.floor(Math.random() * mindfulnessPrompts.length)];
    setPlaceholder(randomPrompt);
  }, []);

  useEffect(() => {
    const checkUserAndMerge = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUser(user)
        const anonId = localStorage.getItem('anonymous_id')
        if (anonId && anonId !== "null") {
          const { data: updatedPosts, error: updateError } = await supabase
            .from('posts')
            .update({ user_id: user.id, anonymous_id: null })
            .eq('anonymous_id', String(anonId).trim())
            .select();

          if (!updateError && updatedPosts && updatedPosts.length > 0) {
            const latestPost = updatedPosts.sort((a, b) => 
              new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            )[0];

            const { data: existingVp } = await supabase
              .from('value_profiles')
              .select('nickname')
              .eq('user_id', user.id)
              .single();

            await supabase.from('value_profiles').upsert({
              user_id: user.id,
              nickname: existingVp?.nickname || latestPost.nickname,
              content: latestPost.content,
              embedding: latestPost.embedding,
              updated_at: new Date().toISOString()
            });

            localStorage.removeItem('anonymous_id');
            document.cookie = "anonymous_id=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;";
          }
        }
        await fetchAllData(user.id);
      } else {
        setPostsLoading(false);
        setNickname(prev => prev || 'ゲスト')
      }
    }
    checkUserAndMerge();
  }, [supabase]);

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setUser(null)
    router.push('/login')
  }

  const handleSave = async () => {
    if (!nickname || !inputText.trim()) return;
    setLoading(true)
    setAiReply(null)
    setPhilosophyTag(null)
    const currentInputText = inputText;
    setInputText('');

    try {
      let anonId = localStorage.getItem('anonymous_id')
      if (!anonId) {
        anonId = crypto.randomUUID()
        localStorage.setItem('anonymous_id', anonId)
      }
      
      const isLocal = window.location.hostname === 'localhost';
      document.cookie = `anonymous_id=${anonId}; path=/; max-age=3600; SameSite=Lax${isLocal ? '' : '; Secure'}`

      const { data: sessionData } = await supabase.auth.getSession(); 
      const token = sessionData.session?.access_token;
      
      const res = await fetch('/api/save_value', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}) 
        },
        body: JSON.stringify({ 
          text: currentInputText, 
          nickname: nickname,
          anonymousId: anonId 
        }),
      })

      const data = await res.json()
      if (res.ok) {
        setMatches(data.matches || [])
        // 🚀 救済策: 万が一 aiReply がなくてもフォールバック
        setAiReply(data.aiReply || "深淵は静寂の中にあります。")
        setPhilosophyTag(data.philosophyTag || "深淵の思索")
        if (user) await fetchAllData(user.id);
        setTimeout(() => replyRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100)
      }
    } catch (error: any) {
      alert(error.message)
      setInputText(currentInputText);
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 text-gray-200 font-sans tracking-wider">
      <header className="bg-gray-800/50 backdrop-blur-md shadow-lg sticky top-0 z-50 border-b border-gray-700/50">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/"><h1 className="text-lg font-bold text-indigo-400 tracking-[0.2em] uppercase">カチピ</h1></Link>
          <div className="flex items-center gap-5 shrink-0">
            {user ? (
              <>
                <Link href="/chats" className="text-xl hover:opacity-70 transition-opacity">💬</Link>
                <Link href="/settings" className="text-xl hover:opacity-70 transition-opacity">⚙️</Link>
                <button onClick={handleLogout} className="text-red-400 text-[9px] font-black border border-red-900/40 px-2 py-0.5 rounded bg-red-950/20 uppercase tracking-widest hover:bg-red-950/40 transition-all">退出</button>
              </>
            ) : (
              <Link href="/login" className="text-indigo-400 font-bold text-[10px] bg-indigo-950/30 px-4 py-2 rounded-full border border-indigo-500/30 hover:bg-indigo-900/40 transition-all uppercase tracking-widest">ログイン / 新規登録</Link>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto p-4 md:p-8">
        <div className="text-center mb-12 animate-in fade-in duration-1000">
          <h2 className="text-xl md:text-2xl font-bold text-indigo-200/80 tracking-widest">眠れない夜はつぶやいて</h2>
          <p className="text-gray-500 text-[10px] mt-4 italic tracking-[0.4em] uppercase opacity-50 font-light">価値観ピープル（カチピ）を探しましょう</p>
        </div>
        
        <div className="bg-gray-800/40 p-5 md:p-8 rounded-3xl shadow-2xl border border-gray-700/50 backdrop-blur-sm transition-all duration-700 focus-within:border-indigo-500/30">
          <div className="mb-6">
            <label className="text-[9px] font-bold text-gray-600 uppercase block mb-3 tracking-[0.3em]">Identity</label>
            <div className="p-4 border rounded-2xl bg-gray-900/50 text-gray-200 border-gray-800 flex justify-between items-center shadow-inner focus-within:border-indigo-500/40 transition-all">
              <span className="font-bold w-full text-sm">
                {user ? nickname : (
                  <input type="text" className="bg-transparent outline-none text-indigo-300 w-full placeholder-gray-700 font-medium" value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="あなたの名前" />
                )}
              </span>
              {user && <Link href="/settings" className="text-[9px] text-indigo-400 font-black px-3 py-1 bg-indigo-950/30 rounded-lg border border-indigo-900/50 hover:bg-indigo-900/50 transition-all uppercase tracking-widest">Edit</Link>}
            </div>
          </div>

          <textarea 
            className="w-full p-6 border rounded-3xl h-48 bg-gray-900/50 text-gray-200 border-gray-800 focus:border-indigo-500/40 transition-all resize-none shadow-inner outline-none text-lg leading-relaxed placeholder-gray-700 italic font-light" 
            placeholder={placeholder} 
            value={inputText} 
            onChange={(e) => setInputText(e.target.value)} 
          />
          <button onClick={handleSave} disabled={loading || !nickname} className="w-full mt-8 bg-indigo-600/80 text-white font-black h-16 rounded-2xl shadow-xl hover:bg-indigo-500 transition active:scale-[0.98] disabled:bg-gray-800 text-[11px] tracking-[0.5em] uppercase overflow-hidden relative group">
            <span className="relative z-10 flex items-center justify-center gap-3">
              {loading ? (
                <>
                  <span className="w-1.5 h-1.5 bg-white rounded-full animate-ping"></span>
                  <span>AIパートナーが反応中...</span>
                </>
              ) : 'つぶやいて価値ピを探す'}
            </span>
          </button>
        </div>

        <div ref={replyRef}>
          {aiReply && (
            <div className="mt-12 animate-in fade-in slide-in-from-bottom-6 zoom-in-95 duration-1000">
              <div className="bg-indigo-950/20 border-l border-indigo-500/30 p-8 md:p-10 rounded-r-3xl backdrop-blur-md relative overflow-hidden group shadow-2xl">
                {philosophyTag && (
                  <div className="absolute top-6 right-8 opacity-40 group-hover:opacity-100 transition-opacity duration-700">
                    <span className="text-[8px] font-black text-indigo-400 uppercase tracking-[0.5em] border-b border-indigo-500/30 pb-1">
                      {philosophyTag}
                    </span>
                  </div>
                )}
                <h3 className="text-[9px] font-black text-indigo-500/40 uppercase tracking-[0.4em] mb-6">{aiName}</h3>
                <p className="text-lg md:text-xl text-indigo-100/90 font-light leading-relaxed tracking-wider italic whitespace-pre-wrap">
                  <TypewriterText text={aiReply} />
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="h-20"></div>
        <div className="mt-4">
          <h3 className="text-[10px] font-black mb-10 text-indigo-400/40 flex items-center gap-6 uppercase tracking-[0.5em]">
            <span>Resonating Souls</span>
            <span className="h-px flex-1 bg-gradient-to-r from-indigo-500/20 to-transparent"></span>
          </h3>
          <MatchList matches={matches} currentUserId={user?.id} />
        </div>
        
        {user && (
          <div className="pb-32 mt-20">
            <h3 className="text-[9px] font-black mb-10 text-gray-600 flex justify-between items-center uppercase tracking-[0.4em]">
              <span>Reflection History</span>
              <span className="font-mono opacity-30">{userPosts.length} Fragments</span>
            </h3>
            <div className="grid gap-8">
              {postsLoading ? <p className="text-center text-gray-700 py-10 tracking-[0.3em] text-[10px] uppercase animate-pulse">読み込んでいます...</p> : 
                userPosts.length > 0 ? userPosts.map((post) => (
                  <div key={post.id} className="bg-gray-800/10 p-8 rounded-3xl border border-gray-800/30 hover:bg-gray-800/30 hover:border-indigo-900/30 transition-all duration-700 group">
                    <p className="text-gray-400 group-hover:text-gray-200 text-sm leading-relaxed whitespace-pre-wrap transition-colors font-light italic">
                      {post.content}
                    </p>
                    <p className="text-[8px] text-gray-700 mt-6 text-right font-mono tracking-[0.3em] uppercase italic opacity-40">
                      {new Date(post.created_at).toLocaleString('ja-JP', { dateStyle: 'short', timeStyle: 'short' })}
                    </p>
                  </div>
                )) : <p className="text-center text-gray-700 py-10 text-[9px] tracking-[0.4em] uppercase">まだ、何も残されていません。</p>
              }
            </div>
          </div>
        )}
      </main>
    </div>
  )
}