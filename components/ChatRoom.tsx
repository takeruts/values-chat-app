// components/ChatRoom.tsx
'use client'

import { useState, useEffect, useRef } from 'react'
import { createBrowserClient } from '@supabase/ssr'

type Message = {
  id: string
  content: string
  sender_id: string
  conversation_id: string
  created_at: string
  isSending?: boolean 
  hasError?: boolean
}

const AI_USER_ID = '00000000-0000-0000-0000-000000000000';

export default function ChatRoom({ conversationId, currentUserId, partnerId }: { conversationId: string, currentUserId: string, partnerId: string }) {
  // 1. supabaseクライアントをuseMemo的に保持して、依存配列での安定性を確保
  const [supabase] = useState(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  ))

  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [isAiTyping, setIsAiTyping] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => { scrollToBottom() }, [messages, isAiTyping])

  // 2. 依存配列を最小限にし、外部から渡される値を安定化させる
  useEffect(() => {
    if (!conversationId) return;

    const fetchMessages = async () => {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
      if (data) setMessages(data)
    }
    fetchMessages()

    const channel = supabase.channel(`chat:${conversationId}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'messages', 
        filter: `conversation_id=eq.${conversationId}` 
      }, 
      (payload) => {
        const newMsg = payload.new as Message
        
        // 🚨 currentUserId を直接使わず、最新の state や ID判定をここで行う
        // 自分のメッセージ（Optmistic UIで追加済）はスキップ
        if (newMsg.sender_id === currentUserId) return;

        setMessages((prev) => {
          if (prev.some(m => m.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        })

        if (newMsg.sender_id === AI_USER_ID) setIsAiTyping(false);
      }).subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
    // 🚨 currentUserId がレンダリング中に undefined から ID に変わることで
    // 配列のサイズエラーが起きるのを防ぐため、依存関係を整理
  }, [conversationId, supabase, currentUserId])

  const sendMessage = async () => {
    const content = newMessage.trim();
    if (!content || isSending) return;

    setIsSending(true);
    setNewMessage('');

    const tempId = crypto.randomUUID();
    setMessages(prev => [...prev, { 
      id: tempId, 
      conversation_id: conversationId, 
      sender_id: currentUserId, 
      content, 
      created_at: new Date().toISOString(), 
      isSending: true 
    }]);

    try {
      const { error } = await supabase.from('messages').insert({ 
        id: tempId,
        conversation_id: conversationId, 
        sender_id: currentUserId, 
        content 
      });
      if (error) throw error;

      setMessages(prev => prev.map(msg => msg.id === tempId ? { ...msg, isSending: false } : msg));

      if (partnerId === AI_USER_ID) {
        setIsAiTyping(true);
        await fetch('/api/chat_with_ai', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: content,
            conversationId: conversationId,
            history: messages.slice(-5)
          }),
        });
      }
    } catch (err) {
      setIsAiTyping(false);
      setMessages(prev => prev.map(msg => msg.id === tempId ? { ...msg, hasError: true, isSending: false } : msg));
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="flex flex-col h-[550px] w-full max-w-md bg-gray-800 rounded-lg border border-gray-700 shadow-2xl p-4">
      <div className="flex-1 overflow-y-auto mb-4 pr-2 scrollbar-thin scrollbar-thumb-gray-700">
        {messages.map((msg) => {
          const isMe = msg.sender_id === currentUserId;
          const isAi = msg.sender_id === AI_USER_ID;
          return (
            <div key={msg.id} className={`flex flex-col w-full mb-4 ${isMe ? 'items-end' : 'items-start'}`}>
              <div className={`px-4 py-2 rounded-2xl text-sm max-w-[85%] shadow-sm ${
                isMe ? 'bg-indigo-600 text-white rounded-br-none' : 
                isAi ? 'bg-indigo-900/60 text-indigo-100 border border-indigo-500/30 rounded-bl-none' : 
                'bg-gray-700 text-gray-200 rounded-bl-none'
              }`}>
                {msg.content}
              </div>
              {msg.isSending && <span className="text-[10px] text-indigo-400 mt-1 mr-1">...</span>}
            </div>
          )
        })}
        {isAiTyping && (
          <div className="flex flex-col items-start mb-4">
            <div className="text-indigo-400 text-xs animate-pulse ml-2 italic bg-indigo-900/20 px-3 py-1 rounded-full border border-indigo-500/20">
              のぞみが言葉を選んでいます...
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="flex gap-2 border-t border-gray-700 pt-3">
        <input 
          className="flex-1 bg-gray-900 border border-gray-700 rounded-xl px-4 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          value={newMessage} 
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="メッセージを入力..."
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
              e.preventDefault();
              sendMessage();
            }
          }}
        />
        <button 
          onClick={(e) => { e.preventDefault(); sendMessage(); }} 
          disabled={!newMessage.trim() || isSending || isAiTyping} 
          className="bg-indigo-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-lg active:scale-95"
        >
          送信
        </button>
      </div>
    </div>
  )
}