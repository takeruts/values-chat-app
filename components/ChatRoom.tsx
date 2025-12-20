'use client'

import { useState, useEffect, useRef } from 'react'
import { createBrowserClient } from '@supabase/ssr'

type Message = {
  id: string
  content: string
  sender_id: string
  created_at: string
  conversation_id: string
}

type Props = {
  conversationId: string
  currentUserId: string
  partnerId: string
}

export default function ChatRoom({ conversationId, currentUserId, partnerId }: Props) {
  const [messages, setMessages] = useState<Message[]>([])
  const [inputText, setInputText] = useState('')
  const [loading, setLoading] = useState(false)
  const [isAiTyping, setIsAiTyping] = useState(false)
  
  // 🚨 スクロール制御用の参照
  const scrollRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const AI_USER_ID = '00000000-0000-0000-0000-000000000000';

  // 🕒 最新のメッセージまでスクロールする関数
  const scrollToBottom = (behavior: "smooth" | "auto" = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior })
  }

  useEffect(() => {
    if (!conversationId) return

    const fetchMessages = async () => {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
      if (data) {
        setMessages(data)
        // 初回読み込み時は即座に一番下へ
        setTimeout(() => scrollToBottom("auto"), 100)
      }
    }
    fetchMessages()

    const channel = supabase
      .channel(`chat:${conversationId}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}` 
      }, (payload) => {
        const newMessage = payload.new as Message
        setMessages((current) => {
          if (current.find(m => m.id === newMessage.id)) return current
          return [...current, newMessage]
        })
        if (newMessage.sender_id === AI_USER_ID) {
          setIsAiTyping(false)
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [conversationId, supabase])

  // 🚨 メッセージ更新時、またはAIがタイピングを始めた時にスクロール
  useEffect(() => {
    scrollToBottom("smooth")
  }, [messages, isAiTyping])

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputText.trim() || loading) return
    
    const textToSend = inputText.trim()
    setInputText('')
    setLoading(true)

    try {
      const { error: sendError } = await supabase.from('messages').insert({
        conversation_id: conversationId,
        sender_id: currentUserId,
        content: textToSend
      })
      if (sendError) throw sendError

      if (partnerId === AI_USER_ID) {
        setIsAiTyping(true)
        const aiRes = await fetch('/api/chat_with_ai', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            conversationId, 
            message: textToSend,
            history: messages.slice(-10) 
          }),
        })
        if (!aiRes.ok) setIsAiTyping(false)
      }
    } catch (err) {
      console.error(err)
      setInputText(textToSend)
    } finally {
      setLoading(false)
    }
  }

  return (
    /* 🚨 flex-col h-full で親要素いっぱいに広げ、overflow-hidden で外側のスクロールを殺す */
    <div className="flex flex-col h-[calc(100vh-160px)] md:h-[calc(100vh-200px)] bg-gray-900 overflow-hidden relative">
      
      {/* 🚨 メッセージエリア：flex-1 overflow-y-auto でここだけスクロールさせる */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 custom-scrollbar pb-10">
        {messages.map((msg) => {
          const isMine = msg.sender_id === currentUserId
          return (
            <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
              <div className={`max-w-[85%] px-4 py-3 rounded-2xl shadow-lg relative ${
                isMine ? 'bg-indigo-600 text-white rounded-tr-none shadow-indigo-900/20' 
                       : 'bg-gray-800 text-gray-100 rounded-tl-none border border-gray-700/50 shadow-black/40'
              }`}>
                <p className="text-sm leading-relaxed whitespace-pre-wrap tracking-wide">{msg.content}</p>
                <span className={`text-[9px] mt-1.5 block opacity-40 font-mono italic ${isMine ? 'text-right' : 'text-left'}`}>
                  {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          )
        })}

        {isAiTyping && (
          <div className="flex justify-start animate-pulse">
            <div className="bg-gray-800/50 text-indigo-300 px-4 py-3 rounded-2xl rounded-tl-none border border-indigo-500/20">
              <div className="flex gap-1 items-center h-5">
                <span className="w-1.5 h-1.5 bg-indigo-500/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                <span className="w-1.5 h-1.5 bg-indigo-500/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                <span className="w-1.5 h-1.5 bg-indigo-500/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
              </div>
            </div>
          </div>
        )}
        
        {/* 🚨 スクロールターゲット：メッセージの最後に追加 */}
        <div ref={messagesEndRef} className="h-4 w-full" />
      </div>

      {/* 🚨 入力フォーム：常に下部に固定される */}
      <div className="p-4 bg-gray-900/80 backdrop-blur-xl border-t border-gray-800/60">
        <form onSubmit={handleSend} className="max-w-2xl mx-auto flex items-end gap-2 bg-gray-800/40 p-2 rounded-2xl border border-gray-700/50 focus-within:border-indigo-500/50 transition-all">
          <textarea
            className="flex-1 bg-transparent border-none text-gray-200 p-2 text-sm focus:ring-0 resize-none outline-none placeholder-gray-600"
            placeholder="メッセージを入力..."
            rows={1}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(e); } }}
          />
          <button type="submit" disabled={!inputText.trim() || loading} className={`w-10 h-10 flex-shrink-0 rounded-xl flex items-center justify-center transition-all ${inputText.trim() ? 'bg-indigo-600' : 'bg-gray-700 opacity-50'}`}>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9-7-9-7V12H3v2h9v5z" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  )
}