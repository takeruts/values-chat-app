'use client'

import { useState, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import MatchList from '@/components/MatchList'

export default function Home() {
  const [inputText, setInputText] = useState('')
  const [nickname, setNickname] = useState('') 
  const [matches, setMatches] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [user, setUser] = useState<any>(null)

  const router = useRouter()
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    const getUserAndProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (user) {
        setUser(user)
        const { data: profile } = await supabase
          .from('profiles')
          .select('nickname')
          .eq('id', user.id)
          .single()

        if (profile?.nickname) {
          setNickname(profile.nickname)
        }
      }
    }
    getUserAndProfile()
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

    setLoading(true)
    setMatches([])

    try {
      const res = await fetch('/api/save_value', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: inputText, nickname: nickname }),
      })

      const textResponse = await res.text()
      if (!textResponse || textResponse.startsWith('<')) {
        throw new Error('APIエラー: サーバー設定を確認してください')
      }
      
      const data = JSON.parse(textResponse)

      if (res.ok) {
        setMatches(data.matches)
        setInputText('') // 投稿後に空にする
      } else {
        throw new Error(data.error || '失敗しました')
      }

    } catch (error: any) {
      alert(error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800">
      <header className="bg-white shadow px-4 py-3 flex justify-between items-center sticky top-0 z-50">
        <h1 className="text-lg md:text-xl font-bold text-blue-600 truncate">
          カチピ
        </h1>
        
        <div className="flex items-center gap-3 md:gap-6">
          {user ? (
            <>
              {/* トーク一覧 */}
              <Link href="/chats" className="flex items-center text-gray-600 hover:text-blue-600 transition">
                <span className="text-xl">💬</span>
                <span className="hidden md:inline text-sm font-bold ml-1">トーク</span>
              </Link>

              {/* 設定 */}
              <Link href="/settings" className="flex items-center text-gray-600 hover:text-blue-600 transition">
                <span className="text-xl">⚙️</span>
                <span className="hidden md:inline text-sm font-bold ml-1">設定</span>
              </Link>

              {/* ユーザー名 */}
              <span className="text-sm font-bold text-gray-700 hidden md:inline truncate max-w-[150px]">
                {nickname || user.email}
              </span>

              {/* ログアウト */}
              <button 
                onClick={handleLogout} 
                className="text-red-500 hover:text-red-700 transition flex items-center"
                title="ログアウト"
              >
                <span className="md:hidden text-xl">🚪</span>
                <span className="hidden md:inline text-sm font-bold border border-red-200 px-3 py-1 rounded-full hover:bg-red-50">
                  ログアウト
                </span>
              </button>
            </>
          ) : (
            <Link href="/login" className="text-blue-500 font-bold text-sm">ログイン</Link>
          )}
        </div>
      </header>

      <main className="max-w-3xl mx-auto p-4 md:p-8">
        
        {/* 👇 変更箇所: タイトルを「つぶやく」に変更 */}
        <h2 className="text-xl md:text-2xl font-bold mb-6 text-center text-gray-700">
          今の気持ちをつぶやく
        </h2>
        
        <div className="bg-white p-4 md:p-6 rounded-lg shadow-sm mb-8">
          
          <div className="mb-4">
            <label className="block text-sm font-bold text-gray-700 mb-1">ニックネーム</label>
            <div className="flex items-center justify-between p-3 border rounded bg-gray-100 text-gray-800">
              {nickname ? (
                <span className="font-medium truncate max-w-[200px]">{nickname}</span>
              ) : (
                <span className="text-gray-400 text-sm">（未設定）</span>
              )}
              
              <Link href="/settings" className="text-xs text-blue-600 hover:underline shrink-0 ml-2">
                変更
              </Link>
            </div>
            {!nickname && (
               <p className="text-xs text-red-500 mt-1">※投稿にはニックネーム設定が必要です</p>
            )}
          </div>

          {/* 👇 変更箇所: プレースホルダーを指定の内容に変更 */}
          <textarea
            className="w-full p-4 border rounded-lg shadow-inner h-32 focus:ring-2 focus:ring-blue-400 outline-none text-base"
            placeholder="楽しかったこと、苦しかったこと、好きなこと、嫌いなことを、どんどんつぶやいてください。"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
          />

          <button
            onClick={handleSave}
            disabled={loading || !nickname}
            className="w-full mt-4 bg-blue-600 text-white font-bold py-3 rounded-lg shadow hover:bg-blue-700 transition disabled:bg-gray-400"
          >
            {loading ? 'AIが分析中...' : 'つぶやいて仲間を探す'}
          </button>
        </div>

        <div className="mt-8">
           {matches.length > 0 && (
             <h3 className="text-lg md:text-xl font-bold mb-4 text-gray-700">あなたと波長が合いそうな人</h3>
           )}
           
           <MatchList matches={matches} currentUserId={user?.id} />
           
           {matches.length === 0 && !loading && (
             <p className="text-center text-gray-400 mt-10 text-sm">
               ここにマッチング結果が表示されます
             </p>
           )}
        </div>

      </main>
    </div>
  )
}