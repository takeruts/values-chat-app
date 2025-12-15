'use client'

import { useState, useEffect, useRef } from 'react'
import { createBrowserClient } from '@supabase/ssr'

type Message = {
  id: string
  content: string
  sender_id: string
  conversation_id: string
  created_at: string
  // 👇 追加: 送信失敗時のUI制御用 (オプティミスティックUI用)
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
          // リアルタイムメッセージのIDと、オプティミスティックUIで使ったtempIdを比較し、
          // もし一致する一時的なメッセージがあれば置き換える。
          // ただし、今のコードではIDを自分で決めているため、重複防止だけでOK。
          if (prev.some(m => m.id === newMsg.id)) return prev
          
          // 自分のメッセージはオプティミスティックに表示済みなので、相手のメッセージのみ追加する
          if (newMsg.sender_id !== currentUserId) {
             return [...prev, newMsg]
          }
          return prev // 自分のメッセージはオプティミスティック表示を信用する
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
    setNewMessage(''); // まず入力欄をクリア

    // オプティミスティックUI：画面に一時的なメッセージを追加 (isSendingフラグ付き)
    const tempMessage: Message = {
      id: tempId,
      conversation_id: conversationId,
      sender_id: currentUserId,
      content: originalMessage,
      created_at: nowISO,
      isSending: true, // 送信中フラグ
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

      // 送信成功時：isSendingフラグを削除 (画面上は見た目を変えずに確定)
      setMessages(prev => 
         prev.map(msg => 
            msg.id === tempId ? { ...msg, isSending: false } : msg
         )
      )

    } catch (err) {
      console.error('送信失敗:', err)
      // 送信失敗時：エラーフラグを立てて、入力内容を復元する
      setMessages(prev => 
         prev.map(msg => 
            msg.id === tempId ? { ...msg, hasError: true, isSending: false } : msg
         )
      )
      // setNewMessage(originalMessage); // 必要であれば入力内容を復元
    }
  }

  return (
    <div className="border rounded-lg p-4 w-full max-w-md bg-white flex flex-col h-[500px]">
      <div className="flex-1 overflow-y-auto mb-4 space-y-4 pr-2">
        {messages.map((msg) => {
          const isMyMessage = msg.sender_id === currentUserId;
          const timeString = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

          // スタイル決定ロジック
          let bubbleClasses = 'bg-gray-100 text-gray-800 rounded-bl-none';
          if (isMyMessage) {
            bubbleClasses = 'bg-blue-500 text-white rounded-br-none';
            if (msg.hasError) {
              bubbleClasses = 'bg-red-500 text-white rounded-br-none opacity-80'; // エラー時
            } else if (msg.isSending) {
              bubbleClasses = 'bg-blue-400 text-white rounded-br-none opacity-60'; // 送信中
            }
          }

          return (
            <div key={msg.id} className={`flex flex-col max-w-[85%] ${isMyMessage ? 'ml-auto items-end' : 'mr-auto items-start'}`}>
              <div className={`p-3 rounded-2xl text-sm break-words shadow-sm ${bubbleClasses}`}>
                {msg.content}
              </div>
              {/* 👇 タイムスタンプの横にエラー/送信中ステータス表示 */}
              <span className="text-[10px] text-gray-400 mt-1 px-1 flex items-center gap-1">
                {msg.hasError && <span className="text-red-500 font-bold">⚠️</span>}
                {msg.isSending && <span className="text-blue-500 animate-pulse">...</span>}
                {timeString}
              </span>
            </div>
          )
        })}
        <div ref={messagesEndRef} />
      </div>
      
      <div className="flex gap-2 pt-2 border-t">
        <input 
          type="text" 
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          className="border flex-1 p-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="メッセージを入力..."
          onKeyDown={(e) => { 
                if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                    e.preventDefault(); // Enterで改行されないようにする
                    sendMessage(); 
                }
            }}
        />
        <button 
            onClick={sendMessage} 
            disabled={!newMessage.trim()} 
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors font-bold"
        >
            送信
        </button>
      </div>
    </div>
  )
}