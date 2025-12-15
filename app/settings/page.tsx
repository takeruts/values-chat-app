'use client'

import { useState, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'

export default function SettingsPage() {
  const router = useRouter()
  const [nickname, setNickname] = useState('')
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    const getProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      // 現在のプロフィールを取得
      const { data, error } = await supabase
        .from('profiles')
        .select('nickname')
        .eq('id', user.id)
        .single()

      if (data) {
        setNickname(data.nickname || '')
      }
      setLoading(false)
    }
    getProfile()
  }, [router, supabase])

  const handleSave = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // upsert: データがあれば更新、なければ新規作成
    const { error } = await supabase
      .from('profiles')
      .upsert({ 
        id: user.id, 
        nickname: nickname,
        created_at: new Date().toISOString()
      })

    if (error) {
      alert('保存に失敗しました')
    } else {
      setMessage('保存しました！')
      setTimeout(() => setMessage(''), 3000)
    }
  }

  if (loading) return <div className="p-4">読み込み中...</div>

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-md mx-auto bg-white p-6 rounded shadow">
        <h1 className="text-2xl font-bold mb-4">プロフィール設定</h1>
        
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2">
            ニックネーム
          </label>
          <input
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            placeholder="表示名を入力"
          />
        </div>

        <button
          onClick={handleSave}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline w-full"
        >
          保存する
        </button>

        {message && (
          <p className="mt-4 text-green-600 text-center font-bold">{message}</p>
        )}

        <div className="mt-6 text-center">
          <a href="/" className="text-sm text-gray-500 hover:underline">
            トップページに戻る
          </a>
        </div>
      </div>
    </div>
  )
}