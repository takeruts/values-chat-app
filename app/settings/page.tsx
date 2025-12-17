'use client'

import { useState, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function SettingsPage() {
  const router = useRouter()
  const [nickname, setNickname] = useState('')
  const [aiName, setAiName] = useState('のぞみ')
  const [aiGender, setAiGender] = useState<'female' | 'male'>('female')
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
      
      const { data, error } = await supabase
        .from('profiles')
        .select('nickname, ai_gender, ai_name')
        .eq('id', user.id)
        .single()

      if (data) {
        // 🚨 既存データがある場合のみステートを更新。nullの場合はデフォルト値を維持
        if (data.nickname) setNickname(data.nickname)
        if (data.ai_gender) setAiGender(data.ai_gender as 'female' | 'male')
        if (data.ai_name) setAiName(data.ai_name)
      }
      setLoading(false)
    }
    getProfile()
  }, [router, supabase])

  const handleSave = async () => {
    setSaveLoading(true)
    setMessage('')
    
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('認証エラー')

      // 🚨 upsert処理。カラム名がDBと完全一致している必要があります
      const { error } = await supabase
        .from('profiles')
        .upsert({ 
          id: user.id, 
          nickname: nickname.trim(),
          ai_name: aiName.trim(), // 🚨 DBのカラム名が ai_name であることを確認してください
          ai_gender: aiGender,
          updated_at: new Date().toISOString()
        })

      if (error) throw error

      setMessage('設定を保存しました')
      setTimeout(() => setMessage(''), 3000)
    } catch (error: any) {
      console.error('Save Error:', error)
      alert('保存に失敗しました: ' + error.message)
    } finally {
      setSaveLoading(false)
    }
  }

  if (loading) return <div className="min-h-screen bg-gray-950 flex items-center justify-center"><div className="w-6 h-6 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div></div>

  return (
    <div className="min-h-screen bg-gray-950 text-gray-200 font-sans">
      <header className="bg-gray-900/80 backdrop-blur-md border-b border-gray-700/50 py-4 px-6 sticky top-0 z-50 shadow-xl">
        <div className="max-w-2xl mx-auto flex items-center gap-4">
          <Link href="/" className="text-gray-400 hover:text-indigo-400 transition-colors p-1">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="text-xl font-black text-indigo-400 tracking-tight">設定</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-6 md:p-12 animate-in fade-in slide-in-from-bottom-4 duration-1000">
        <div className="bg-gray-900/40 backdrop-blur-xl p-8 rounded-[2.5rem] border border-gray-800 shadow-2xl space-y-12">
          
          {/* User Section */}
          <section>
            <h2 className="text-[11px] font-black text-indigo-500/70 uppercase tracking-[0.3em] mb-8 ml-1">ユーザー設定</h2>
            <div className="space-y-6">
              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1 block mb-2">ニックネーム</label>
                <input 
                  type="text" 
                  value={nickname} 
                  onChange={(e) => setNickname(e.target.value)} 
                  className="w-full bg-gray-950/50 border border-gray-800 p-5 rounded-2xl outline-none focus:border-indigo-500/50 text-gray-100 transition-all shadow-inner" 
                  placeholder="あなたの名前" 
                />
              </div>
            </div>
          </section>

          {/* AI Section */}
          <section className="pt-10 border-t border-gray-800/50">
            <h2 className="text-[11px] font-black text-indigo-500/70 uppercase tracking-[0.3em] mb-8 ml-1">AI パートナー設定</h2>
            <div className="space-y-8">
              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1 block mb-2">パートナーの名前</label>
                <input 
                  type="text" 
                  value={aiName} 
                  onChange={(e) => setAiName(e.target.value)} 
                  className="w-full bg-gray-950/50 border border-gray-800 p-5 rounded-2xl outline-none focus:border-indigo-500/50 text-gray-100 transition-all shadow-inner" 
                  placeholder="AIの名前" 
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1 block mb-3">性別</label>
                <div className="grid grid-cols-2 gap-4 p-1.5 bg-gray-950/60 rounded-2xl border border-gray-800 shadow-inner">
                  <button 
                    onClick={() => setAiGender('female')} 
                    className={`py-4 rounded-xl text-xs font-black tracking-widest transition-all duration-300 ${aiGender === 'female' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/40' : 'text-gray-500 hover:text-gray-400'}`}
                  >
                    女性
                  </button>
                  <button 
                    onClick={() => setAiGender('male')} 
                    className={`py-4 rounded-xl text-xs font-black tracking-widest transition-all duration-300 ${aiGender === 'male' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/40' : 'text-gray-500 hover:text-gray-400'}`}
                  >
                    男性
                  </button>
                </div>
              </div>
            </div>
          </section>

          <div className="pt-4">
            <button 
              onClick={handleSave} 
              disabled={saveLoading} 
              className="w-full bg-indigo-600 text-white font-black py-5 rounded-2xl hover:bg-indigo-500 transition-all active:scale-[0.98] shadow-xl shadow-indigo-900/20 disabled:opacity-50 tracking-[0.2em] text-sm"
            >
              {saveLoading ? '保存中...' : '保存'}
            </button>
            
            {message && (
              <p className="mt-6 text-center text-xs font-bold text-indigo-300 bg-indigo-950/30 py-4 rounded-2xl border border-indigo-900/40 animate-in fade-in zoom-in duration-300">
                {message}
              </p>
            )}
          </div>
        </div>

        <div className="mt-16 text-center">
          <Link href="/" className="text-[10px] text-gray-600 font-bold uppercase tracking-[0.4em] hover:text-indigo-400 transition-colors">
            — Back to Home —
          </Link>
        </div>
      </main>
    </div>
  )
}