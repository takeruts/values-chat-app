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

export default function ChatRoom({ conversationId, currentUserId }: { conversationId: string, currentUserId: string }) {
  
  const [supabase] = useState(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  ))

  // 修正: エラーメッセージのテーマを統一
  if (!conversationId) return <div className="text-red-400 bg-gray-900 p-4">エラー: 会話IDなし</div>
  
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
    <div className="border border-gray-700 rounded-lg p-4 w-full max-w-md bg-gray-800 flex flex-col h-[500px] shadow-2xl">
      {/* メッセージリストのコンテナ: コンパクトな間隔を維持 (space-y-1) */}
      <div className="flex-1 overflow-y-auto mb-2 space-y-1 pr-2">
        {messages.map((msg) => {
          const isMyMessage = msg.sender_id === currentUserId;
          const timeString = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

          // スタイル決定ロジック (ダークテーマ対応)
          let bubbleClasses = 'bg-gray-700 text-gray-200 rounded-bl-none'; // 相手のメッセージ
          if (isMyMessage) {
            bubbleClasses = 'bg-indigo-600 text-white rounded-br-none'; // 自分のメッセージ
            if (msg.hasError) {
              bubbleClasses = 'bg-red-600 text-white rounded-br-none opacity-80'; // エラー時
            } else if (msg.isSending) {
              bubbleClasses = 'bg-indigo-400 text-white rounded-br-none opacity-60'; // 送信中
            }
          }

          return (
            <div key={msg.id} className={`flex flex-col max-w-[85%] ${isMyMessage ? 'ml-auto items-end' : 'mr-auto items-start'}`}>
              {/* メッセージバルーン: コンパクトなパディング (px-3 py-1) を維持 */}
              <div className={`px-3 py-1 rounded-2xl text-sm break-words shadow-sm ${bubbleClasses}`}>
                {msg.content}
              </div>
              {/* タイムスタンプ: 色をダークテーマに */}
              <span className="text-xs text-gray-500 mt-0.5 px-1 flex items-center gap-1">
                {msg.hasError && <span className="text-red-400 font-bold">⚠️</span>}
                {msg.isSending && <span className="text-indigo-400 animate-pulse">...</span>}
                {timeString}
              </span>
            </div>
          )
        })}
        <div ref={messagesEndRef} />
      </div>
      
      {/* 入力エリア */}
      <div className="flex items-center gap-2 pt-2 border-t border-gray-700">
        <input 
          type="text" 
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          className="border border-gray-700 bg-gray-900 text-gray-200 flex-1 p-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-gray-500"
          placeholder="メッセージを入力..."
          onKeyDown={(e) => { 
                if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                    e.preventDefault(); 
                    sendMessage(); 
                }
            }}
        />
        {/* 修正: 送信ボタンをインディゴテーマに */}
        <button 
            onClick={sendMessage} 
            disabled={!newMessage.trim()} 
            className="bg-indigo-600 text-white px-3 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors font-bold"
        >
            送信
        </button>
      </div>
    </div>
  )
}