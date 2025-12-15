'use client'

import { useState, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'
// 👇 追加: マッチングリストコンポーネントをインポート
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
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) setUser(user)
    }
    getUser()
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setUser(null)
    router.push('/login')
    router.refresh()
  }

  const handleSave = async () => {
    if (!inputText || !nickname) {
      alert('ニックネームと文章を入力してください')
      return
    }

    setLoading(true)
    setMatches([])

    try {
      // APIのエンドポイント名は実際のファイル名に合わせてください (例: /api/values など)
      // ここでは元のコードのまま /api/save_value としています
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
      <header className="bg-white shadow p-4 flex justify-between items-center">
        <h1 className="text-xl font-bold text-blue-600">My Values App</h1>
        <div className="flex items-center gap-4">
          {user ? (
            <>
            {/* 👇 追加: チャット一覧へのリンク */}
            <a href="/chats" className="text-sm font-bold text-gray-600 hover:text-blue-600">
           💬 トーク一覧
            </a>
              <span className="text-sm text-gray-600">{user.email}</span>
              <button onClick={handleLogout} className="text-sm text-red-500 hover:underline">ログアウト</button>
            </>
          ) : (
            <a href="/login" className="text-blue-500">ログイン</a>
          )}
        </div>
      </header>

      <main className="max-w-3xl mx-auto p-8">
        <h2 className="text-2xl font-bold mb-6 text-center">あなたの価値観を登録</h2>
        
        <div className="bg-white p-6 rounded-lg shadow-sm mb-8">
          <div className="mb-4">
            <label className="block text-sm font-bold text-gray-700 mb-1">ニックネーム</label>
            <input 
              type="text" 
              className="w-full p-2 border rounded shadow-sm focus:ring-2 focus:ring-blue-400 outline-none"
              placeholder="例：タケシ"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
            />
          </div>

          <textarea
            className="w-full p-4 border rounded-lg shadow-inner h-32 focus:ring-2 focus:ring-blue-400 outline-none"
            placeholder="例：都会の喧騒よりも、自然の中でゆっくり本を読む時間が好きです..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
          />

          <button
            onClick={handleSave}
            disabled={loading}
            className="w-full mt-4 bg-blue-600 text-white font-bold py-3 rounded-lg shadow hover:bg-blue-700 transition disabled:bg-gray-400"
          >
            {loading ? 'AIが分析中...' : '保存して似ている人を探す'}
          </button>
        </div>

        {/* 👇 修正箇所: 手動マップをやめてコンポーネントを使用 */}
        <div className="mt-8">
           {matches.length > 0 && (
             <h3 className="text-xl font-bold mb-4 text-gray-700">あなたと価値観が近い人</h3>
           )}
           
           {/* ここに「話す」ボタン機能が含まれています */}
           <MatchList matches={matches} currentUserId={user?.id} />
           
           {matches.length === 0 && !loading && (
             <p className="text-center text-gray-400 mt-10">
               ここにマッチング結果が表示されます
             </p>
           )}
        </div>

      </main>
    </div>
  )
}