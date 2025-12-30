'use client'

import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Suspense } from 'react'

function AuthErrorContent() {
  const searchParams = useSearchParams()
  const message = searchParams.get('message')

  return (
    <div className="max-w-md w-full bg-gray-800 p-8 rounded-3xl border border-red-900/30 text-center">
      <h1 className="text-2xl font-black text-red-400 mb-4 uppercase">Auth Error</h1>
      <p className="text-gray-400 text-sm mb-6 leading-relaxed">
        {message || '認証中にエラーが発生しました。再度お試しください。'}
      </p>
      <Link 
        href="/login" 
        className="inline-block bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 px-8 rounded-xl transition"
      >
        ログイン画面に戻る
      </Link>
    </div>
  )
}

export default function AuthErrorPage() {
  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <Suspense fallback={<div className="text-red-400 animate-pulse uppercase font-black">Loading...</div>}>
        <AuthErrorContent />
      </Suspense>
    </div>
  )
}