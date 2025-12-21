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

export default function Home() {
  const [inputText, setInputText] = useState('')
  const [nickname, setNickname] = useState('') 
  const [aiName, setAiName] = useState('AIカウンセラー')
  const [aiReply, setAiReply] = useState<string | null>(null)
  const [matches, setMatches] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [userPosts, setUserPosts] = useState<Post[]>([]) 
  const [postsLoading, setPostsLoading] = useState(true)

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

  // 🚀 紐付け追い打ちロジック（最終安定版）
  useEffect(() => {
    const checkUserAndMerge = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUser(user)
        
        const anonId = localStorage.getItem('anonymous_id')
        if (anonId && anonId !== "null") {
          console.log("🚀 Found AnonID. Attempting to link to:", user.id);
          
          // カラム型をTEXTにしたので String(anonId) で確実に一致させます
          const { data: updatedPosts, error: updateError } = await supabase
            .from('posts')
            .update({ 
              user_id: user.id, 
              anonymous_id: null 
            })
            .eq('anonymous_id', String(anonId).trim())
            .select();

          if (!updateError && updatedPosts && updatedPosts.length > 0) {
            console.log(`✅ Success! ${updatedPosts.length} posts linked to user.`);
            
            // 紐付けた最新の投稿をプロフィール（マッチング用）に反映
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

            // 成功したのでクリーンアップ
            localStorage.removeItem('anonymous_id');
            document.cookie = "anonymous_id=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;";
          } else if (updateError) {
            console.error("🚨 DB Merge Error:", updateError.message);
          } else {
            console.warn("⚠️ No matching rows found for ID:", anonId);
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
    // ログアウト時はあえて localStorage は消さず、ゲスト投稿を可能にします
    router.push('/login')
  }

  const handleSave = async () => {
    if (!nickname || !inputText.trim()) return;
    setLoading(true)
    setAiReply(null)
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
        setAiReply(data.aiReply)
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
    <div className="min-h-screen bg-gray-900 text-gray-200 font-sans">
      <header className="bg-gray-800 shadow-lg sticky top-0 z-50 border-b border-gray-700">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/"><h1 className="text-lg font-bold text-indigo-400">カチピ</h1></Link>
          <div className="flex items-center gap-5 shrink-0">
            {user ? (
              <>
                <Link href="/chats" className="text-xl">💬</Link>
                <Link href="/settings" className="text-xl">⚙️</Link>
                <button onClick={handleLogout} className="text-red-400 text-[10px] font-black border border-red-900/40 px-2 py-0.5 rounded bg-red-950/20 uppercase tracking-tighter">退出</button>
              </>
            ) : (
              <Link href="/login" className="text-indigo-400 font-bold text-sm bg-indigo-950/30 px-4 py-1.5 rounded-full border border-indigo-500/30">ログイン / 新規登録</Link>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto p-4 md:p-8">
        <div className="text-center mb-8">
          <h2 className="text-xl md:text-2xl font-bold text-indigo-300">眠れない夜はつぶやいて</h2>
        </div>
        
        <div className="bg-gray-800 p-5 md:p-8 rounded-2xl shadow-xl border border-gray-700">
          <div className="mb-6">
            <label className="text-[10px] font-bold text-gray-500 uppercase block mb-2 tracking-widest">Your Nickname</label>
            <div className="p-4 border rounded-xl bg-gray-900 text-gray-200 border-gray-700 flex justify-between items-center shadow-inner">
              <span className="font-bold w-full">
                {user ? nickname : (
                  <input type="text" className="bg-transparent outline-none text-indigo-300 w-full" value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="ゲスト" />
                )}
              </span>
              {user && <Link href="/settings" className="text-xs text-indigo-400 font-bold px-3 py-1 bg-indigo-950/30 rounded-lg border border-indigo-900/50">変更</Link>}
            </div>
          </div>

          <textarea className="w-full p-5 border rounded-2xl h-40 bg-gray-900 text-gray-200 border-gray-700 focus:border-indigo-500 transition-all resize-none shadow-inner outline-none text-lg leading-relaxed" placeholder="今の気持ちを自由に書き出してください。" value={inputText} onChange={(e) => setInputText(e.target.value)} />
          <button onClick={handleSave} disabled={loading || !nickname} className="w-full mt-8 bg-indigo-600 text-white font-black h-16 rounded-2xl shadow-xl hover:bg-indigo-500 transition active:scale-95 disabled:bg-gray-700 text-base tracking-widest">
            {loading ? `${aiName}が心を受け止めています...` : 'つぶやいてカチピ（仲間）を探す'}
          </button>
        </div>

        <div ref={replyRef}>
          {aiReply && (
            <div className="mt-8 animate-in fade-in slide-in-from-top-4 duration-700">
              <div className="bg-indigo-950/30 border border-indigo-500/30 p-6 md:p-8 rounded-3xl shadow-2xl relative">
                <h3 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-3">{aiName}</h3>
                <p className="text-lg md:text-xl text-indigo-100 italic font-medium leading-relaxed">
                  <TypewriterText text={aiReply} />
                </p>
              </div>
              {!user && (
                <div className="mt-4 text-center">
                  <p className="text-xs text-gray-500 mb-2">この続きを保存して、もっと深く話しませんか？</p>
                  <Link href="/login" className="text-xs font-bold text-indigo-400 hover:underline">👉 登録して対話を続ける</Link>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="h-12"></div>
        <div className="mt-4">
          <h3 className="text-lg font-bold mb-8 text-indigo-300">価値観の近いピープル</h3>
          <MatchList matches={matches} currentUserId={user?.id} />
        </div>
        
        {user && (
          <div className="pb-24 mt-12">
            <h3 className="text-lg font-bold mb-8 text-gray-400 flex justify-between items-center">
              <span>過去の履歴</span>
              <span className="text-[10px] bg-gray-800 px-2 py-1 rounded text-gray-600 font-mono italic">{userPosts.length} POSTS</span>
            </h3>
            <div className="grid gap-6">
              {postsLoading ? <p className="text-center text-gray-600 animate-pulse">読み込み中...</p> : 
                userPosts.length > 0 ? userPosts.map((post) => (
                  <div key={post.id} className="bg-gray-800/40 p-6 rounded-2xl border border-gray-700/30 hover:bg-gray-800/60 transition-colors">
                    <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">{post.content}</p>
                    <p className="text-[10px] text-gray-600 mt-4 text-right font-mono opacity-50">{new Date(post.created_at).toLocaleDateString()}</p>
                  </div>
                )) : <p className="text-center text-gray-600 py-10 border border-dashed border-gray-800 rounded-2xl">まだ履歴はありません</p>
              }
            </div>
          </div>
        )}
      </main>
    </div>
  )
}