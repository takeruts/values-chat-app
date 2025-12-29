"use client";
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [nickname, setNickname] = useState('');
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    async function getProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUser(user);
        const { data, error } = await supabase
          .from('value_profiles')
          .select('nickname')
          .eq('id', user.id)
          .single();

        if (data) setNickname(data.nickname);
      }
      setLoading(false);
    }
    getProfile();
  }, []);

  async function updateProfile() {
    setLoading(true);
    const { error } = await supabase.from('value_profiles').upsert({
      id: user.id,
      nickname,
      updated_at: new Date().toISOString(),
    });
    if (error) alert(error.message);
    else alert('プロフィールを更新しました！');
    setLoading(false);
  }

  if (loading) return <div className="min-h-screen bg-gray-900 flex items-center justify-center text-indigo-400">Loading...</div>;

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8 flex flex-col items-center">
      <div className="max-w-md w-full glass p-8 rounded-3xl border border-indigo-500/20">
        <h1 className="text-2xl font-black mb-8 uppercase tracking-tighter text-indigo-400">Account Settings</h1>
        
        <div className="space-y-6">
          <div>
            <label className="text-[10px] font-bold text-gray-500 uppercase block mb-2 ml-1">Email Address</label>
            <input type="text" disabled value={user?.email} className="w-full p-4 rounded-2xl bg-black/40 border border-gray-800 text-gray-500 cursor-not-allowed" />
          </div>

          <div>
            <label className="text-[10px] font-bold text-gray-500 uppercase block mb-2 ml-1">Nickname (Shared across apps)</label>
            <input 
              type="text" 
              value={nickname} 
              onChange={(e) => setNickname(e.target.value)}
              className="w-full p-4 rounded-2xl bg-gray-900 border border-indigo-500/30 text-indigo-100 outline-none focus:border-indigo-500 transition-all"
              placeholder="表示名を入力..."
            />
          </div>

          <button 
            onClick={updateProfile}
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-500 p-4 rounded-2xl font-black transition active:scale-95 disabled:opacity-50"
          >
            {loading ? 'Saving...' : 'プロフィールを保存'}
          </button>
        </div>

        <div className="mt-12 pt-6 border-t border-gray-800">
           <button 
             onClick={() => supabase.auth.signOut().then(() => window.location.href = '/login')}
             className="text-xs font-bold text-red-500/60 hover:text-red-500 uppercase tracking-widest"
           >
             Sign Out
           </button>
        </div>
      </div>
    </div>
  );
}