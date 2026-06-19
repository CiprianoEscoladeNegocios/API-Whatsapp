'use client'

import React, { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Building2, Send, ShieldAlert, ArrowLeft, Loader2, Sparkles, MessageSquare } from 'lucide-react'
import { usePusher } from '@/hooks/usePusher'

interface GroupMessage {
  id: string
  groupId: string
  senderId: string
  senderName: string
  senderType: 'CONTACT' | 'OPERATOR' | 'SYSTEM'
  type: string
  content: string
  timestamp: string
}

export default function GroupChatPage() {
  const params = useParams()
  const router = useRouter()
  const groupId = params.id as string

  const [group, setGroup] = useState<any>(null)
  const [messages, setMessages] = useState<GroupMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [newMessageText, setNewMessageText] = useState('')
  const [sending, setSending] = useState(false)
  const [currentUser, setCurrentUser] = useState<any>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)

  // 1. Carrega dados do grupo e valida usuário local
  useEffect(() => {
    // Busca informações de autenticação rápida do localStorage
    const savedUser = localStorage.getItem(`group_user_${groupId}`)
    if (!savedUser) {
      // Redireciona para o fluxo de convite se o usuário ainda não ingressou oficialmente
      console.warn('⚠️ Usuário não autenticado localmente para este grupo. Redirecionando...')
      // Como não temos o token de convite no path, buscaremos os dados do grupo
      return
    }
    setCurrentUser(JSON.parse(savedUser))
  }, [groupId])

  useEffect(() => {
    async function loadData() {
      try {
        // Busca os detalhes do grupo
        const groupRes = await fetch(`/api/groups/${groupId}`)
        if (!groupRes.ok) throw new Error('Grupo não encontrado')
        const groupData = await groupRes.json()
        setGroup(groupData)

        // Se o usuário não estiver logado no localStorage e for operador/usuário do painel, 
        // mas estiver acessando a página, precisamos garantir que ele se identifique.
        // Se o operador está visualizando do painel, nós geraremos um ID para ele
        const savedUser = localStorage.getItem(`group_user_${groupId}`)
        if (!savedUser) {
          // Fallback para caso seja um visitante. O redirecionamento será tratado se necessário.
          // Para evitar loops, se o grupo existe, permitimos a leitura, mas bloqueamos envio sem dados.
          const res = await fetch('/api/auth/session')
          const session = await res.json()
          if (session?.user) {
            const opUser = {
              senderId: session.user.id || 'operator',
              senderName: session.user.name || 'Operador',
              senderType: 'OPERATOR'
            }
            setCurrentUser(opUser)
            localStorage.setItem(`group_user_${groupId}`, JSON.stringify(opUser))
          } else {
            // Se não for operador logado, exige que passe pelo convite
            if (groupData.inviteToken) {
              router.push(`/invite/${groupData.inviteToken}`)
              return
            }
          }
        }

        // Busca o histórico de mensagens
        const msgRes = await fetch(`/api/groups/${groupId}/messages`)
        if (msgRes.ok) {
          const msgData = await msgRes.json()
          setMessages(msgData)
        }
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    if (groupId) loadData()
  }, [groupId, router])

  // 2. Rolagem automática do chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // 3. Escuta Pusher para novas mensagens em tempo real no grupo
  usePusher({
    channelName: `group-chat-${groupId}`,
    eventName: 'new-group-message',
    callback: (message: GroupMessage) => {
      setMessages((prev) => {
        // Evita duplicados
        if (prev.some((m) => m.id === message.id)) return prev
        return [...prev, message]
      })
    }
  })

  // 4. Envio de Mensagem
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessageText.trim() || !currentUser || sending) return

    const content = newMessageText.trim()
    setNewMessageText('')
    setSending(true)

    try {
      const res = await fetch(`/api/groups/${groupId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderId: currentUser.senderId,
          senderName: currentUser.senderName,
          senderType: currentUser.senderType,
          content
        })
      })

      if (!res.ok) {
        const errData = await res.json()
        alert(errData.error || 'Não foi possível enviar a mensagem no grupo.')
      }
    } catch (err) {
      console.error(err)
      alert('Erro de conexão ao enviar mensagem.')
    } finally {
      setSending(false)
    }
  }

  // 5. Polling inteligente de backup para mensagens a cada 3 segundos
  useEffect(() => {
    if (!groupId) return
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/groups/${groupId}/messages`)
        if (res.ok) {
          const data = await res.json()
          setMessages((prev) => {
            if (JSON.stringify(prev) === JSON.stringify(data)) return prev
            return data
          })
        }
      } catch (err) {
        console.warn('Erro silencioso no backup polling de mensagens do grupo:', err)
      }
    }, 3000)
    return () => clearInterval(interval)
  }, [groupId])

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-100 p-6 select-none">
        <div className="w-12 h-12 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4" />
        <span className="text-sm text-slate-400 font-semibold tracking-wider uppercase animate-pulse">
          Carregando sala de chat...
        </span>
      </div>
    )
  }

  if (!group) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-100 p-6">
        <div className="w-20 h-20 rounded-3xl bg-red-950/20 border border-red-500/20 flex items-center justify-center mb-6">
          <Building2 className="w-10 h-10 text-red-500" />
        </div>
        <h2 className="text-xl font-bold text-white tracking-tight">Sala Indisponível</h2>
        <p className="text-slate-500 text-xs mt-2 max-w-[320px] text-center leading-relaxed">
          O grupo virtual solicitado não foi localizado ou você não possui credenciais ativas para acessá-lo.
        </p>
      </div>
    )
  }

  // Verifica se o remetente atual é admin
  const isUserAdmin = group.members?.some((m: any) => 
    (currentUser?.senderType === 'OPERATOR' && m.userId === currentUser?.senderId && m.isAdmin) ||
    (currentUser?.senderType === 'CONTACT' && m.contactId === currentUser?.senderId && m.isAdmin)
  )

  const isRestricted = group.onlyAdminsCanMessage && !isUserAdmin

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col text-slate-100 relative overflow-hidden select-none">
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-emerald-500/5 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-teal-500/5 rounded-full blur-[100px] pointer-events-none" />

      {/* Header do Grupo */}
      <header className="px-6 py-4 border-b border-slate-900 bg-slate-950/80 backdrop-blur-md flex items-center justify-between shrink-0 z-10">
        <div className="flex items-center gap-3.5">
          {group.avatarUrl ? (
            <img 
              src={group.avatarUrl} 
              alt={group.name} 
              className="w-10 h-10 rounded-xl border border-slate-800 object-cover shadow-md" 
            />
          ) : (
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600/30 to-teal-500/30 border border-emerald-500/20 flex items-center justify-center font-extrabold text-emerald-400 text-sm">
              {group.name.substring(0, 1).toUpperCase()}
            </div>
          )}
          <div>
            <h1 className="text-sm font-bold text-white flex items-center gap-1.5">
              <span>{group.name}</span>
              {group.onlyAdminsCanMessage && (
                <span className="text-[9px] bg-slate-900 text-slate-500 border border-slate-800 font-bold px-1.5 py-0.5 rounded" title="Moderação de Admin Ativa">
                  Moderado
                </span>
              )}
            </h1>
            <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mt-0.5">
              Cipriano Salas de Chat
            </p>
          </div>
        </div>

        {currentUser?.senderType === 'OPERATOR' && (
          <button
            onClick={() => router.push('/groups')}
            className="text-slate-500 hover:text-slate-300 transition-colors p-2 hover:bg-slate-900/50 rounded-xl flex items-center gap-1.5 text-xs font-bold"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Voltar ao Painel</span>
          </button>
        )}
      </header>

      {/* Balões de Mensagem (Área de Scroll) */}
      <main className="flex-1 overflow-y-auto p-6 flex flex-col gap-3.5 bg-slate-950/40 relative">
        {messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-slate-600 gap-3">
            <MessageSquare className="w-8 h-8 text-slate-800" />
            <div>
              <p className="text-sm font-semibold">Grupo virtual inicializado</p>
              <p className="text-xs mt-1 max-w-[240px]">Envie uma mensagem para iniciar o debate com os participantes!</p>
            </div>
          </div>
        ) : (
          messages.map((message) => {
            const isSystem = message.senderType === 'SYSTEM'
            if (isSystem) {
              return (
                <div key={message.id} className="self-center bg-slate-900/60 border border-slate-800 px-3 py-1.5 rounded-xl text-[10px] font-bold text-slate-500 tracking-wide shadow-sm">
                  {message.content}
                </div>
              )
            }

            const isOwn = message.senderId === currentUser?.senderId
            const date = new Date(message.timestamp)
            const timeStr = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

            // Encontra se o remetente é admin
            const isSenderAdmin = group.members?.find((m: any) => 
              (message.senderType === 'OPERATOR' && m.userId === message.senderId) ||
              (message.senderType === 'CONTACT' && m.contactId === message.senderId)
            )?.isAdmin

            return (
              <div
                key={message.id}
                className={`flex flex-col max-w-[70%] ${
                  isOwn ? 'self-end items-end' : 'self-start items-start'
                }`}
              >
                {/* Nome do Remetente */}
                <span className="text-[10px] text-slate-500 font-bold mb-1 px-1 flex items-center gap-1.5">
                  <span>{message.senderName}</span>
                  {isSenderAdmin && (
                    <span className="text-[8px] bg-emerald-950 text-emerald-400 border border-emerald-500/10 font-bold px-1 rounded-sm uppercase">
                      Admin
                    </span>
                  )}
                </span>

                {/* Balão de Fala */}
                <div
                  className={`px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-lg relative ${
                    isOwn
                      ? 'bg-emerald-600 text-white rounded-tr-none'
                      : 'bg-slate-900 text-slate-200 rounded-tl-none border border-slate-900'
                  }`}
                >
                  <p className="whitespace-pre-line">{message.content}</p>
                  
                  {/* Hora */}
                  <div
                    className={`text-[9px] mt-1.5 select-none text-right ${
                      isOwn ? 'text-emerald-200' : 'text-slate-500'
                    }`}
                  >
                    {timeStr}
                  </div>
                </div>
              </div>
            )
          })
        )}
      </main>

      {/* Rodapé de Envio */}
      <footer className="p-4 border-t border-slate-900 bg-slate-950/80 backdrop-blur-md shrink-0">
        {isRestricted ? (
          <div className="flex items-center gap-2.5 bg-slate-900 border border-slate-800 p-3.5 rounded-xl text-slate-500 select-none">
            <ShieldAlert className="w-5 h-5 text-amber-500/80 shrink-0" />
            <span className="text-xs font-bold">
              Moderação ativa: Somente administradores deste grupo virtual possuem permissão para enviar mensagens.
            </span>
          </div>
        ) : (
          <form onSubmit={handleSend} className="flex items-center gap-3">
            <input
              type="text"
              placeholder="Escreva sua mensagem no grupo..."
              className="flex-1 bg-slate-900 border border-slate-900 focus:border-emerald-600 text-xs px-4 py-3.5 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none transition-all"
              value={newMessageText}
              onChange={(e) => setNewMessageText(e.target.value)}
              disabled={sending || !currentUser}
            />
            <button
              type="submit"
              disabled={!newMessageText.trim() || sending || !currentUser}
              className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white p-3.5 rounded-xl shadow-lg hover:shadow-emerald-600/10 transition-all shrink-0 active:scale-[0.96]"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        )}
      </footer>
    </div>
  )
}
