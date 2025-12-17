'use client'

import { useState, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function SettingsPage() {
  const router = useRouter()
  const [nickname, setNickname] = useState('')
  const [loading, setLoading] = useState(true)
  const [saveLoading, setSaveLoading] = useState(false)
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

      const { data } = await supabase
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
    setSaveLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

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
      setMessage('設定を保存しました')
      setTimeout(() => setMessage(''), 3000)
    }
    setSaveLoading(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-200">
      {/* ヘッダー */}
      <header className="bg-gray-900/80 backdrop-blur-md border-b border-gray-800 py-4 px-6 sticky top-0 z-50 shadow-xl">
        <div className="max-w-2xl mx-auto flex items-center gap-4">
          <Link href="/" className="text-gray-400 hover:text-indigo-400 transition-colors p-1">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="text-xl font-black text-indigo-400 tracking-tight">設定</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-6 md:p-12 animate-in fade-in duration-700">
        <div className="bg-gray-900/40 backdrop-blur-xl p-8 rounded-[2.5rem] border border-gray-800 shadow-2xl">
          
          <div className="mb-10">
            <h2 className="text-lg font-bold text-gray-100 mb-6 flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></span>
              プロフィールの変更
            </h2>
            
            <div className="space-y-6">
              <div>
                <label className="text-[10px] font-bold text-gray-600 uppercase tracking-widest ml-1 block mb-2">
                  Nickname
                </label>
                <input
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  className="w-full bg-gray-950/50 border border-gray-800 p-5 rounded-2xl outline-none focus:border-indigo-500/50 transition-all text-gray-200 placeholder-gray-700 shadow-inner"
                  placeholder="表示名を入力してください"
                />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <button
              onClick={handleSave}
              disabled={saveLoading}
              className="w-full bg-indigo-600 text-white font-black py-4 rounded-2xl hover:bg-indigo-500 transition-all active:scale-95 shadow-lg shadow-indigo-900/20 disabled:opacity-50 tracking-widest"
            >
              {saveLoading ? '保存中...' : '設定を保存する'}
            </button>

            {message && (
              <p className="animate-in fade-in slide-in-from-top-1 text-center text-xs font-bold text-indigo-300 bg-indigo-950/30 py-3 rounded-xl border border-indigo-900/30">
                {message}
              </p>
            )}
          </div>
        </div>

        {/* フッターリンク */}
        <div className="mt-12 text-center">
          <Link href="/" className="text-[10px] text-gray-600 font-bold uppercase tracking-widest hover:text-gray-400 transition-colors">
            Back to Home
          </Link>
        </div>
      </main>
    </div>
  )
}