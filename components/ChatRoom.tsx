'use client'

import { useState, useEffect, useRef } from 'react'
import { createBrowserClient } from '@supabase/ssr'

type Message = {
  id: string
  content: string
  sender_id: string
  conversation_id: string
  created_at: string
}

export default function ChatRoom({ conversationId, currentUserId }: { conversationId: string, currentUserId: string }) {
  
  // 👇 【修正1】クライアントを一度だけ作成し、再レンダリングでも変わらないようにする
  const [supabase] = useState(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  ))

  if (!conversationId) {
    return <div className="text-red-500 p-4">エラー: 会話IDが見つかりません</div>
  }
  
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
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
      
      if (data) setMessages(data)
    }
    fetchMessages()

    // 2. リアルタイム購読
    console.log('🔌 リアルタイム接続を開始します...')
    
    const channel = supabase
      .channel(`chat:${conversationId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`
      }, (payload) => {
        console.log('📩 新着メッセージ受信:', payload)
        setMessages((prev) => [...prev, payload.new as Message])
      })
      .subscribe((status) => {
        // 👇 【デバッグ】接続状態をログに出す
        console.log('📡 接続ステータス:', status)
      })

    return () => {
      console.log('🔌 切断します')
      supabase.removeChannel(channel)
    }
    // 👇 【重要】依存配列から supabase を外すか、useStateで固定したのでこれでもOK
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
        alert(`送信エラー: ${error.message}`)
        return
      }
      setNewMessage('') 

    } catch (err) {
      console.error(err)
    }
  }

  return (
    <div className="border rounded-lg p-4 w-full max-w-md bg-white flex flex-col h-[500px]">
      <div className="flex-1 overflow-y-auto mb-4 space-y-4 pr-2">
        {messages.map((msg) => {
          const isMyMessage = msg.sender_id === currentUserId;
          const timeString = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

          return (
            <div key={msg.id} className={`flex flex-col max-w-[85%] ${isMyMessage ? 'ml-auto items-end' : 'mr-auto items-start'}`}>
              <div className={`p-3 rounded-2xl text-sm break-words shadow-sm ${isMyMessage ? 'bg-blue-500 text-white rounded-br-none' : 'bg-gray-100 text-gray-800 rounded-bl-none'}`}>
                {msg.content}
              </div>
              <span className="text-[10px] text-gray-400 mt-1 px-1">{timeString}</span>
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
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) sendMessage(); }}
        />
        <button onClick={sendMessage} disabled={!newMessage.trim()} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors font-bold">送信</button>
      </div>
    </div>
  )
}