// ChatRoom.tsx

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

export default function ChatRoom({ conversationId, currentUserId }: { conversationId: string, currentUserId: string }) {
  
  const [supabase] = useState(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  ))

  if (!conversationId) return <div className="text-red-500 p-4">エラー: 会話IDなし</div>
  
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    // 1. 過去ログ取得
    const fetchMessages = async () => {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
      
      if (data) setMessages(data)
    }
    fetchMessages()

    // 2. リアルタイム購読
    const channel = supabase
      .channel(`chat:${conversationId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`
      }, (payload) => {
        const newMsg = payload.new as Message
        
        setMessages((prev) => {
          if (prev.some(m => m.id === newMsg.id)) return prev
          
          if (newMsg.sender_id !== currentUserId) {
             return [...prev, newMsg]
          }
          return prev
        })
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [conversationId, supabase])

  const sendMessage = async () => {
    const trimmedMessage = newMessage.trim();
    if (!trimmedMessage) return

    const tempId = crypto.randomUUID()
    const nowISO = new Date().toISOString()
    const originalMessage = trimmedMessage;
    setNewMessage(''); 

    // オプティミスティックUI：画面に一時的なメッセージを追加
    const tempMessage: Message = {
      id: tempId,
      conversation_id: conversationId,
      sender_id: currentUserId,
      content: originalMessage,
      created_at: nowISO,
      isSending: true,
      hasError: false
    }

    setMessages((prev) => [...prev, tempMessage])

    try {
      // サーバーへ送信
      const { error } = await supabase
        .from('messages')
        .insert({
            id: tempId, 
            conversation_id: conversationId,
            sender_id: currentUserId,
            content: originalMessage,
            created_at: nowISO
        }) 

      if (error) throw error

      // 送信成功時：isSendingフラグを削除
      setMessages(prev => 
         prev.map(msg => 
            msg.id === tempId ? { ...msg, isSending: false } : msg
         )
      )

    } catch (err) {
      console.error('送信失敗:', err)
      // 送信失敗時：エラーフラグを立てる
      setMessages(prev => 
         prev.map(msg => 
            msg.id === tempId ? { ...msg, hasError: true, isSending: false } : msg
         )
      )
    }
  }

  return (
    <div className="border rounded-lg p-4 w-full max-w-md bg-white flex flex-col h-[500px]">
      {/* メッセージリストのコンテナ: コンパクトな間隔を維持 (space-y-1) */}
      <div className="flex-1 overflow-y-auto mb-2 space-y-1 pr-2">
        {messages.map((msg) => {
          const isMyMessage = msg.sender_id === currentUserId;
          const timeString = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

          // スタイル決定ロジック
          let bubbleClasses = 'bg-gray-100 text-gray-800 rounded-bl-none';
          if (isMyMessage) {
            bubbleClasses = 'bg-blue-500 text-white rounded-br-none';
            if (msg.hasError) {
              bubbleClasses = 'bg-red-500 text-white rounded-br-none opacity-80'; 
            } else if (msg.isSending) {
              bubbleClasses = 'bg-blue-400 text-white rounded-br-none opacity-60'; 
            }
          }

          return (
            <div key={msg.id} className={`flex flex-col max-w-[85%] ${isMyMessage ? 'ml-auto items-end' : 'mr-auto items-start'}`}>
              {/* メッセージバルーン: コンパクトなパディング (px-3 py-1) を維持 */}
              <div className={`px-3 py-1 rounded-2xl text-sm break-words shadow-sm ${bubbleClasses}`}>
                {msg.content}
              </div>
              <span className="text-xs text-gray-400 mt-0.5 px-1 flex items-center gap-1">
                {msg.hasError && <span className="text-red-500 font-bold">⚠️</span>}
                {msg.isSending && <span className="text-blue-500 animate-pulse">...</span>}
                {timeString}
              </span>
            </div>
          )
        })}
        <div ref={messagesEndRef} />
      </div>
      
      <div className="flex items-center gap-2 pt-2 border-t">
        <input 
          type="text" 
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          className="border flex-1 p-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="メッセージを入力..."
          onKeyDown={(e) => { 
                if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                    e.preventDefault(); 
                    sendMessage(); 
                }
            }}
        />
        {/* 🚨 最終安定化修正: h-full/leading-noneを削除し、px-3 py-2で入力欄の高さに合わせる */}
        <button 
            onClick={sendMessage} 
            disabled={!newMessage.trim()} 
            className="bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors font-bold"
        >
            送信
        </button>
      </div>
    </div>
  )
}