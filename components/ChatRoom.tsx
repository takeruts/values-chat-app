'use client'

import { useState, useEffect, useRef } from 'react'
import { createBrowserClient } from '@supabase/ssr'

// メッセージの型定義
type Message = {
  id: string
  content: string
  sender_id: string
  conversation_id: string
  created_at: string
}

export default function ChatRoom({ conversationId, currentUserId }: { conversationId: string, currentUserId: string }) {
  
  if (!conversationId) {
    return <div className="text-red-500 p-4">エラー: 会話IDが見つかりません</div>
  }
  
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  
  // 自動スクロール用の参照
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // メッセージが更新されるたびに一番下へスクロール
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    // 1. 過去のメッセージを取得
    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
      
      if (error) {
        console.error('メッセージ取得エラー:', error)
      } else if (data) {
        setMessages(data)
      }
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
        setMessages((prev) => [...prev, payload.new as Message])
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [conversationId, supabase])

  const sendMessage = async () => {
    if (!newMessage.trim()) return

    try {
      const { error } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          sender_id: currentUserId,
          content: newMessage
        })

      if (error) {
        console.error('Supabaseエラー詳細:', JSON.stringify(error, null, 2))
        alert(`送信エラー: ${error.message}`)
        return
      }

      setNewMessage('') 

    } catch (err) {
      console.error('予期せぬエラー:', err)
      alert('システムエラーが発生しました')
    }
  }

  return (
    <div className="border rounded-lg p-4 w-full max-w-md bg-white flex flex-col h-[500px]">
      {/* メッセージ表示エリア */}
      <div className="flex-1 overflow-y-auto mb-4 space-y-4 pr-2">
        {messages.map((msg) => {
          const isMyMessage = msg.sender_id === currentUserId;
          
          // 日時のフォーマット (例: 14:30)
          const timeString = new Date(msg.created_at).toLocaleTimeString([], {
            hour: '2-digit', 
            minute: '2-digit'
          });

          return (
            <div 
              key={msg.id} 
              className={`flex flex-col max-w-[85%] ${
                isMyMessage ? 'ml-auto items-end' : 'mr-auto items-start'
              }`}
            >
              {/* 吹き出し */}
              <div 
                className={`p-3 rounded-2xl text-sm break-words shadow-sm ${
                  isMyMessage 
                    ? 'bg-blue-500 text-white rounded-br-none' // 自分: 右下を尖らせる
                    : 'bg-gray-100 text-gray-800 rounded-bl-none' // 相手: 左下を尖らせる
                }`}
              >
                {msg.content}
              </div>

              {/* 時刻表示 */}
              <span className="text-[10px] text-gray-400 mt-1 px-1">
                {timeString}
              </span>
            </div>
          )
        })}
        {/* 自動スクロールのアンカー */}
        <div ref={messagesEndRef} />
      </div>
      
      {/* 入力エリア */}
      <div className="flex gap-2 pt-2 border-t">
        <input 
          type="text" 
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          className="border flex-1 p-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="メッセージを入力..."
          onKeyDown={(e) => {
             if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
               sendMessage();
             }
          }}
        />
        <button 
          onClick={sendMessage}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors font-bold"
          disabled={!newMessage.trim()}
        >
          送信
        </button>
      </div>
    </div>
  )
}