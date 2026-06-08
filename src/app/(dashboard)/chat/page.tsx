'use client'

import React, { useEffect, useState, useRef } from 'react'
import { 
  Search, 
  Send, 
  User, 
  Phone, 
  Tag, 
  Check, 
  CheckCheck, 
  Building2,
  AlertCircle,
  Menu,
  MoreVertical,
  Paperclip,
  Smile,
  FileText,
  CornerUpRight,
  Loader2,
  X,
  Sparkles,
  Download,
  Mic,
  Trash2
} from 'lucide-react'
import { usePusher } from '@/hooks/usePusher'

interface Message {
  id: string
  metaMessageId: string | null
  direction: 'INBOUND' | 'OUTBOUND'
  type: string
  content: string
  status: 'SENT' | 'DELIVERED' | 'READ' | 'FAILED'
  timestamp: string
  replyTo?: {
    id: string
    content: string
    type: string
    direction: 'INBOUND' | 'OUTBOUND'
  } | null
  reaction?: string | null
}

interface Contact {
  id: string
  name: string
  phone: string
  tags: string[]
  lastMessage: {
    content: string
    timestamp: string
    direction: 'INBOUND' | 'OUTBOUND'
    status: string
    type?: string
    reaction?: string | null
  } | null
}

// SINTETIZADOR BIFÔNICO PREMIUM DE ÁUDIO (Web Audio API)
// Desenvolvido sob as diretrizes de excelência tecnológica da Cipriano Escola de Negócios.
const playNotificationSound = () => {
  if (typeof window === 'undefined') return
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext
    if (!AudioContext) return
    const ctx = new AudioContext()
    
    // Nota 1 (C5 - 523.25 Hz)
    const osc1 = ctx.createOscillator()
    const gain1 = ctx.createGain()
    osc1.type = 'sine'
    osc1.frequency.setValueAtTime(523.25, ctx.currentTime)
    gain1.gain.setValueAtTime(0.06, ctx.currentTime)
    gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15)
    osc1.connect(gain1)
    gain1.connect(ctx.destination)
    
    osc1.start()
    osc1.stop(ctx.currentTime + 0.15)
    
    // Nota 2 (E5 - 659.25 Hz, com pequeno delay harmônico)
    const osc2 = ctx.createOscillator()
    const gain2 = ctx.createGain()
    osc2.type = 'sine'
    osc2.frequency.setValueAtTime(659.25, ctx.currentTime + 0.08)
    gain2.gain.setValueAtTime(0.06, ctx.currentTime + 0.08)
    gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3)
    osc2.connect(gain2)
    gain2.connect(ctx.destination)
    
    osc2.start(ctx.currentTime + 0.08)
    osc2.stop(ctx.currentTime + 0.3)
  } catch (err) {
    console.warn('⚠️ Web Audio API: Falha ao tocar áudio de notificação comercial:', err)
  }
}

export default function ChatPage() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [activeContact, setActiveContact] = useState<Contact | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [newMessageText, setNewMessageText] = useState('')
  const [isLoadingContacts, setIsLoadingContacts] = useState(true)
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)
  const [isSending, setIsSending] = useState(false)
  
  // Novos estados para recursos premium de alta performance
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [forwardModalOpen, setForwardModalOpen] = useState(false)
  const [messageToForward, setMessageToForward] = useState<Message | null>(null)
  const [forwardSearchTerm, setForwardSearchTerm] = useState('')
  const [selectedContacts, setSelectedContacts] = useState<string[]>([])
  const [isForwarding, setIsForwarding] = useState(false)

  // Estados para disparo individual de templates Meta aprovados
  const [showTemplateModal, setShowTemplateModal] = useState(false)
  const [approvedTemplates, setApprovedTemplates] = useState<any[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<any | null>(null)
  const [templateVariables, setTemplateVariables] = useState<string[]>([])
  const [templateSearchTerm, setTemplateSearchTerm] = useState('')
  const [isSendingTemplate, setIsSendingTemplate] = useState(false)

  // Recursos premium de respostas e reações
  const [replyingToMessage, setReplyingToMessage] = useState<Message | null>(null)

  // Estados para Gravação de Áudio de Voz (Cipriano Conversas)
  const [isRecording, setIsRecording] = useState(false)
  const [recordingDuration, setRecordingDuration] = useState(0)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const recordingIntervalRef = useRef<any>(null)
  const audioStreamRef = useRef<MediaStream | null>(null)

  const handleReactToMessage = async (messageId: string, emoji: string | null) => {
    // Atualização otimista local imediata
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === messageId ? { ...msg, reaction: emoji } : msg
      )
    )

    // Atualiza otimista a reação da última mensagem na barra lateral se for o caso!
    setContacts((prevContacts) =>
      prevContacts.map((c) => {
        if (c.id === activeContact?.id && c.lastMessage) {
          const lastLocalMsg = messages[messages.length - 1]
          if (lastLocalMsg && lastLocalMsg.id === messageId) {
            return {
              ...c,
              lastMessage: {
                ...c.lastMessage,
                reaction: emoji
              }
            }
          }
        }
        return c
      })
    )

    try {
      const res = await fetch('/api/chat/react', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId, reaction: emoji })
      })

      if (!res.ok) throw new Error('Falha ao reagir à mensagem')
    } catch (err) {
      console.error('Erro ao salvar reação:', err)
    }
  }

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const notifiedMessageIds = useRef<Set<string>>(new Set())

  // Emojis mais comuns do WhatsApp corporativo
  const emojis = ['😀', '😂', '😍', '👍', '🙏', '🚀', '🔥', '👏', '🎉', '💡', '🏆', '💼', '📈', '💬', '📱', '✅', '❌', '⚠️']

  // 1. CARREGAMENTO INICIAL DE CONTATOS
  useEffect(() => {
    async function fetchContacts() {
      try {
        setIsLoadingContacts(true)
        const res = await fetch('/api/contacts?withMessages=true')
        if (res.ok) {
          const data = await res.json()
          setContacts(data)
        }
      } catch (err) {
        console.error('Erro ao buscar contatos para o chat:', err)
      } finally {
        setIsLoadingContacts(false)
      }
    }
    fetchContacts()
  }, [])

  // 1.B CARREGAMENTO DE TEMPLATES APROVADOS DA META
  useEffect(() => {
    async function fetchTemplates() {
      try {
        const res = await fetch('/api/templates')
        if (res.ok) {
          const data = await res.json()
          // Filtra apenas templates APPROVED pela Meta
          setApprovedTemplates(data.filter((tpl: any) => tpl.status === 'APPROVED'))
        }
      } catch (err) {
        console.error('Erro ao buscar templates aprovados:', err)
      }
    }
    fetchTemplates()
  }, [])

  // 2. CARREGAMENTO DE HISTÓRICO DE MENSAGENS AO SELECIONAR UM CONTATO
  useEffect(() => {
    if (!activeContact) return
    const contactId = activeContact.id

    async function fetchMessages() {
      try {
        setIsLoadingMessages(true)
        const res = await fetch(`/api/chat/messages?contactId=${contactId}`)
        if (res.ok) {
          const data = await res.json()
          setMessages(data)
        }
      } catch (err) {
        console.error('Erro ao buscar mensagens do contato:', err)
      } finally {
        setIsLoadingMessages(false)
      }
    }
    
    fetchMessages()
  }, [activeContact])

  // 3. ROLAGEM AUTOMÁTICA DE TELA DO CHAT
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // 4. ESCUTA EM TEMPO REAL GLOBAL: ATUALIZAÇÕES DA SIDEBAR DE CONTATOS
  usePusher({
    channelName: 'chats-sidebar',
    eventName: 'sidebar-update',
    callback: (data: { contactId: string; lastMessage: any; contactName: string; contactPhone: string }) => {
      setContacts((prevContacts) => {
        const contactExists = prevContacts.some((c) => c.id === data.contactId)
        
        if (contactExists) {
          const updated = prevContacts.map((c) => {
            if (c.id === data.contactId) {
              return { ...c, lastMessage: data.lastMessage }
            }
            return c
          })
          return [...updated].sort((a, b) => {
            const timeA = a.lastMessage ? new Date(a.lastMessage.timestamp).getTime() : 0
            const timeB = b.lastMessage ? new Date(b.lastMessage.timestamp).getTime() : 0
            return timeB - timeA
          })
        } else {
          const newContact: Contact = {
            id: data.contactId,
            name: data.contactName,
            phone: data.contactPhone,
            tags: ['Novo Cliente'],
            lastMessage: data.lastMessage
          }
          return [newContact, ...prevContacts]
        }
      })
    }
  })

  // 5. ESCUTA EM TEMPO REAL INDIVIDUAL: NOVAS MENSAGENS NA CONVERSA ATIVA
  usePusher({
    channelName: activeContact ? `chat-${activeContact.id}` : 'dummy-channel',
    eventName: 'new-message',
    callback: (newMessage: Message) => {
      setMessages((prevMessages) => {
        if (prevMessages.some(m => m.id === newMessage.id || (m.metaMessageId && m.metaMessageId === newMessage.metaMessageId))) {
          return prevMessages
        }

        // Toca notificação sonora de mensagem recebida (INBOUND)
        if (newMessage.direction === 'INBOUND' && !notifiedMessageIds.current.has(newMessage.id)) {
          notifiedMessageIds.current.add(newMessage.id)
          playNotificationSound()
        }

        return [...prevMessages, newMessage]
      })
    }
  })

  // 6. ESCUTA EM TEMPO REAL INDIVIDUAL: ALTERAÇÕES DE STATUS DE MENSAGEM
  usePusher({
    channelName: activeContact ? `chat-${activeContact.id}` : 'dummy-channel',
    eventName: 'message-status-updated',
    callback: (data: { messageId: string; status: 'SENT' | 'DELIVERED' | 'READ' | 'FAILED' }) => {
      setMessages((prevMessages) => 
        prevMessages.map((msg) => 
          msg.id === data.messageId ? { ...msg, status: data.status } : msg
        )
      )
    }
  })

  // 6.C ESCUTA EM TEMPO REAL INDIVIDUAL: REAÇÕES ATUALIZADAS
  usePusher({
    channelName: activeContact ? `chat-${activeContact.id}` : 'dummy-channel',
    eventName: 'message-reaction-updated',
    callback: (data: { messageId: string; reaction: string | null }) => {
      setMessages((prevMessages) => {
        const updated = prevMessages.map((msg) => 
          msg.id === data.messageId ? { ...msg, reaction: data.reaction } : msg
        )
        const lastMsg = updated[updated.length - 1]
        if (lastMsg && lastMsg.id === data.messageId) {
          setContacts((prevContacts) =>
            prevContacts.map((c) =>
              c.id === activeContact?.id && c.lastMessage
                ? {
                    ...c,
                    lastMessage: {
                      ...c.lastMessage,
                      reaction: data.reaction
                    }
                  }
                : c
            )
          )
        }
        return updated
      })
    }
  })

  // 6.B POLLING INTELIGENTE DE BACKUP (Contingência para chaves inválidas do Pusher)
  // Roda a cada 4 segundos apenas na conversa ativa
  useEffect(() => {
    if (!activeContact) return
    const contactId = activeContact.id

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/chat/messages?contactId=${contactId}`)
        if (res.ok) {
          const data = await res.json()
          
          setMessages((prevMessages) => {
            const hasChanges = data.some((newMsg: any) => {
              const existing = prevMessages.find(m => m.id === newMsg.id || (m.metaMessageId && m.metaMessageId === newMsg.metaMessageId))
              return !existing || existing.status !== newMsg.status
            })

            if (!hasChanges) return prevMessages

            const merged = [...prevMessages]
            data.forEach((newMsg: any) => {
              const idx = merged.findIndex(m => m.id === newMsg.id || (m.metaMessageId && m.metaMessageId === newMsg.metaMessageId) || (m.id.startsWith('temp_') && m.content === newMsg.content))
              if (idx !== -1) {
                merged[idx] = newMsg
              } else {
                merged.push(newMsg)
                
                if (newMsg.direction === 'INBOUND' && !notifiedMessageIds.current.has(newMsg.id)) {
                  notifiedMessageIds.current.add(newMsg.id)
                  playNotificationSound()
                }
              }
            })
            return merged.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
          })
        }
      } catch (err) {
        console.warn('Erro silencioso no backup polling de mensagens:', err)
      }
    }, 4000)

    return () => clearInterval(interval)
  }, [activeContact])

  // Roda a cada 8 segundos para manter a barra lateral atualizada
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/contacts?withMessages=true')
        if (res.ok) {
          const data = await res.json()
          setContacts((prevContacts) => {
            const isDifferent = JSON.stringify(prevContacts.map(c => ({ id: c.id, last: c.lastMessage }))) !==
                                JSON.stringify(data.map((c: any) => ({ id: c.id, last: c.lastMessage })))
            
            if (!isDifferent) return prevContacts
            return data
          })
        }
      } catch (err) {
        console.warn('Erro silencioso no backup polling de contatos:', err)
      }
    }, 8000)

    return () => clearInterval(interval)
  }, [])

  // Limpeza de recursos de áudio ao desmontar
  useEffect(() => {
    return () => {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current)
      }
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach((track) => track.stop())
      }
    }
  }, [])

  // 7. ENVIO DE MENSAGEM (OUTBOUND)
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeContact || !newMessageText.trim() || isSending) return

    const messageContent = newMessageText.trim()
    const activeReply = replyingToMessage
    setNewMessageText('')
    setReplyingToMessage(null)
    setIsSending(true)
    setShowEmojiPicker(false)

    // Criação da mensagem otimista temporária (UI Instantânea)
    const tempId = `temp_${Date.now()}`
    const tempMessage: Message = {
      id: tempId,
      metaMessageId: null,
      direction: 'OUTBOUND',
      type: 'TEXT',
      content: messageContent,
      status: 'SENT',
      timestamp: new Date().toISOString(),
      replyTo: activeReply
    }

    // Adiciona instantaneamente no estado local para feedback imediato
    setMessages((prev) => [...prev, tempMessage])

    // Atualiza otimista a barra lateral local de contatos para remover a cor pendente na hora
    setContacts((prev) =>
      prev.map((c) =>
        c.id === activeContact.id
          ? {
              ...c,
              lastMessage: {
                content: messageContent,
                timestamp: new Date().toISOString(),
                direction: 'OUTBOUND',
                type: 'TEXT',
                status: 'SENT',
                reaction: null
              }
            }
          : c
      )
    )

    try {
      const res = await fetch('/api/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactId: activeContact.id,
          content: messageContent,
          type: 'TEXT',
          replyToId: activeReply?.id || null
        })
      })

      if (!res.ok) {
        throw new Error('Falha ao enviar mensagem pela API')
      }

      const realMessage = await res.json()
      
      // Atualiza a mensagem temporária com a mensagem real gravada no banco
      setMessages((prev) => 
        prev.map((msg) => msg.id === tempId ? realMessage : msg)
      )

      // Sincroniza a barra lateral local com os dados finais reais
      setContacts((prev) =>
        prev.map((c) =>
          c.id === activeContact.id
            ? {
                ...c,
                lastMessage: {
                  content: realMessage.content,
                  timestamp: realMessage.timestamp,
                  direction: realMessage.direction,
                  type: realMessage.type,
                  status: realMessage.status,
                  reaction: realMessage.reaction || null
                }
              }
            : c
        )
      )
    } catch (err) {
      console.error('Erro de envio de mensagem no frontend:', err)
      // Remove a mensagem otimista em caso de falha real
      setMessages((prev) => prev.filter((msg) => msg.id !== tempId))
      alert('Não foi possível enviar a mensagem. Verifique a conexão.')
    } finally {
      setIsSending(false)
    }
  }

  // 8. ATIVAÇÃO E TRATAMENTO DE UPLOAD DE ARQUIVOS (ANEXOS)
  const handleAttachClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !activeContact) return

    // Limitação de 4.5MB devido à restrição do payload de requisições da Vercel
    const MAX_SIZE = 4.5 * 1024 * 1024
    if (file.size > MAX_SIZE) {
      alert('O tamanho do arquivo excede o limite máximo permitido de 4.5MB. Por favor, selecione um arquivo menor para garantir o envio correto pelo WhatsApp corporativo.')
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    setIsUploading(true)
    const formData = new FormData()
    formData.append('file', file)

    try {
      // 1. Faz upload para a nossa nova API local
      const res = await fetch('/api/chat/upload', {
        method: 'POST',
        body: formData
      })

      if (!res.ok) throw new Error('Falha no upload do arquivo físico')

      const uploadData = await res.json()

      // 2. Classifica a tipagem de mídia de acordo com o arquivo
      let messageType = 'DOCUMENT'
      if (file.type.startsWith('image/')) messageType = 'IMAGE'
      else if (file.type.startsWith('video/')) messageType = 'VIDEO'
      else if (file.type.startsWith('audio/')) messageType = 'AUDIO'

      // 3. Dispara o envio do anexo como mensagem comercial de mídia
      const sendRes = await fetch('/api/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactId: activeContact.id,
          content: uploadData.url,
          type: messageType
        })
      })

      if (!sendRes.ok) throw new Error('Falha ao enviar o anexo para o chat')

      const realMediaMsg = await sendRes.json()

      // Atualiza a barra lateral local de contatos para remover a cor pendente na hora
      setContacts((prev) =>
        prev.map((c) =>
          c.id === activeContact.id
            ? {
                ...c,
                lastMessage: {
                  content: realMediaMsg.content,
                  timestamp: realMediaMsg.timestamp,
                  direction: realMediaMsg.direction,
                  type: realMediaMsg.type,
                  status: realMediaMsg.status,
                  reaction: null
                }
              }
            : c
        )
      )

    } catch (err) {
      console.error('Erro no fluxo de anexo de mídias:', err)
      alert('Erro ao enviar o anexo. Certifique-se de que o arquivo atende às especificações.')
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  // 8.B FLUXO DE GRAVAÇÃO DE ÁUDIO (MICROFONE) - Cipriano Conversas
  const startRecording = async () => {
    try {
      // Solicita permissão de acesso ao microfone
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      audioStreamRef.current = stream
      audioChunksRef.current = []

      // Inicializa o MediaRecorder (com fallback robusto)
      const options = { mimeType: 'audio/webm' }
      let recorder: MediaRecorder
      try {
        recorder = new MediaRecorder(stream, options)
      } catch (e) {
        recorder = new MediaRecorder(stream)
      }

      mediaRecorderRef.current = recorder

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      recorder.onstop = async () => {
        // O WhatsApp exige que o tipo de áudio seja audio/ogg (com codec opus) para mensagens de voz.
        // Disfarçamos o stream de áudio (que é gravado em Opus) no container OGG.
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/ogg' })
        
        // Evita uploads de arquivos corrompidos ou cliques acidentais vazios
        if (audioBlob.size < 1000) {
          console.warn('Gravação de áudio descartada por ser excessivamente curta.')
          return
        }

        setIsUploading(true)

        try {
          const audioFile = new File([audioBlob], `gravacao_audio_${Date.now()}.ogg`, {
            type: 'audio/ogg'
          })

          const formData = new FormData()
          formData.append('file', audioFile)

          // 1. Faz upload para a nossa rota do banco
          const res = await fetch('/api/chat/upload', {
            method: 'POST',
            body: formData
          })

          if (!res.ok) throw new Error('Falha no upload do áudio físico')
          const uploadData = await res.json()

          // 2. Envia a gravação como mensagem comercial de tipo AUDIO
          const sendRes = await fetch('/api/chat/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contactId: activeContact?.id,
              content: uploadData.url,
              type: 'AUDIO'
            })
          })

          if (!sendRes.ok) throw new Error('Falha ao enviar áudio no chat')
          const realAudioMsg = await sendRes.json()

          // Adiciona a mensagem localmente no chat ativo para exibição
          setMessages((prev) => [...prev, realAudioMsg])

          // Atualiza o estado lateral do contato para mostrar [Áudio] como última mensagem
          setContacts((prev) =>
            prev.map((c) =>
              c.id === activeContact?.id
                ? {
                    ...c,
                    lastMessage: {
                      content: '🎤 [Áudio gravado]',
                      timestamp: realAudioMsg.timestamp,
                      direction: realAudioMsg.direction,
                      type: 'AUDIO',
                      status: realAudioMsg.status,
                      reaction: null
                    }
                  }
                : c
            )
          )
        } catch (err: any) {
          console.error('Erro ao enviar áudio gravado do microfone:', err)
          alert('Erro ao enviar o áudio gravado. Verifique as configurações de rede ou tente novamente.')
        } finally {
          setIsUploading(false)
        }
      }

      recorder.start(200) // Coleta bytes a cada 200ms
      setIsRecording(true)
      setRecordingDuration(0)

      recordingIntervalRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1)
      }, 1000)

    } catch (err: any) {
      console.error('Erro ao acessar o microfone do dispositivo:', err)
      alert('Não foi possível acessar o microfone. Certifique-se de que a permissão foi concedida nas configurações do seu navegador.')
    }
  }

  const stopRecording = (shouldSend: boolean) => {
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current)
      recordingIntervalRef.current = null
    }

    const recorder = mediaRecorderRef.current
    if (recorder && recorder.state !== 'inactive') {
      if (!shouldSend) {
        // Remove listener onstop para abortar o upload
        recorder.onstop = () => {
          console.log('Gravação de áudio cancelada e descartada.')
        }
      }
      recorder.stop()
    }

    // Desliga fisicamente o microfone para preservar privacidade do operador
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach((track) => track.stop())
      audioStreamRef.current = null
    }

    setIsRecording(false)
    setRecordingDuration(0)
  }

  const formatDuration = (sec: number) => {
    const minutes = Math.floor(sec / 60)
    const seconds = sec % 60
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  }

  // 9. FUNÇÃO PARA ACRESCENTAR EMOJIS NO INPUT
  const handleEmojiSelect = (emoji: string) => {
    setNewMessageText((prev) => prev + emoji)
  }

  // 10. FLUXO DE REENCAMINHAMENTO DE MENSAGENS (FORWARD)
  const handleOpenForward = (msg: Message) => {
    setMessageToForward(msg)
    setSelectedContacts([])
    setForwardSearchTerm('')
    setForwardModalOpen(true)
  }

  const handleCloseForward = () => {
    setForwardModalOpen(false)
    setMessageToForward(null)
  }

  const handleToggleContactSelection = (contactId: string) => {
    setSelectedContacts((prev) => 
      prev.includes(contactId) 
        ? prev.filter(id => id !== contactId) 
        : [...prev, contactId]
    )
  }

  const handleForwardSubmit = async () => {
    if (!messageToForward || selectedContacts.length === 0 || isForwarding) return

    setIsForwarding(true)
    try {
      const res = await fetch('/api/chat/forward', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId: messageToForward.id,
          targetContactIds: selectedContacts
        })
      })

      if (!res.ok) throw new Error('Erro ao encaminhar mensagens no servidor')

      console.log('✅ Mensagens reencaminhadas com absoluto sucesso!')
      handleCloseForward()
    } catch (err) {
      console.error('Erro de encaminhamento no frontend:', err)
      alert('Não foi possível encaminhar a mensagem. Tente novamente.')
    } finally {
      setIsForwarding(false)
    }
  }

  // Filtragem de contatos na barra lateral de conversas
  const filteredContacts = contacts.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.phone.includes(searchTerm)
  )

  // Renderiza checks de status da mensagem com tooltips detalhados (Read Receipts)
  const renderMessageStatus = (status: string) => {
    if (status === 'SENT') return <span className="cursor-help" title="Enviado dos nossos servidores"><Check className="w-3.5 h-3.5 text-slate-400" /></span>
    if (status === 'DELIVERED') return <span className="cursor-help" title="Entregue no celular do cliente"><CheckCheck className="w-3.5 h-3.5 text-slate-400" /></span>
    if (status === 'READ') return <span className="cursor-help" title="Lido pelo cliente"><CheckCheck className="w-3.5 h-3.5 text-emerald-400" /></span>
    if (status === 'FAILED') return <span className="cursor-help" title="Falha no envio (verifique número/saldo)"><AlertCircle className="w-3.5 h-3.5 text-red-500" /></span>
    return null
  }

  // Renderização dinâmica do conteúdo do balão de mensagens (Mídias & Textos)
  const renderMessageContent = (message: Message) => {
    // Função auxiliar para resolver a fonte física de mídias privadas via proxy local
    const getMediaSrc = (url: string) => {
      if (url.includes('api.twilio.com')) {
        return `/api/chat/download?url=${encodeURIComponent(url)}&inline=true`
      }
      if (url.startsWith('/api/chat/media')) {
        return `${url}&inline=true`
      }
      return url
    }

    if (message.type === 'IMAGE') {
      const mediaSrc = getMediaSrc(message.content)
      return (
        <div className="max-w-xs overflow-hidden rounded-xl border border-slate-800 bg-slate-950 select-none mt-1 relative group/media">
          <img 
            src={mediaSrc} 
            alt="Anexo de Imagem" 
            className="w-full h-auto cursor-pointer hover:scale-[1.02] active:scale-100 transition-all duration-200" 
            onClick={() => window.open(mediaSrc, '_blank')}
          />
          {/* Botão de Download Dedicado */}
          <a
            href={`/api/chat/download?url=${encodeURIComponent(message.content)}`}
            download
            title="Baixar Imagem"
            className="absolute top-2 right-2 p-1.5 rounded-lg bg-slate-950/80 border border-slate-800 text-slate-400 hover:text-emerald-400 hover:border-emerald-500/20 active:scale-95 transition-all opacity-0 group-hover/media:opacity-100 shadow-lg z-10"
          >
            <Download className="w-3.5 h-3.5" />
          </a>
        </div>
      )
    }
    if (message.type === 'VIDEO') {
      const mediaSrc = getMediaSrc(message.content)
      return (
        <div className="max-w-xs overflow-hidden rounded-xl border border-slate-800 bg-slate-950 mt-1 relative group/media">
          <video src={mediaSrc} controls className="w-full max-h-64 rounded-xl" />
          {/* Botão de Download Dedicado */}
          <a
            href={`/api/chat/download?url=${encodeURIComponent(message.content)}`}
            download
            title="Baixar Vídeo"
            className="absolute top-2 right-2 p-1.5 rounded-lg bg-slate-950/80 border border-slate-800 text-slate-400 hover:text-emerald-400 hover:border-emerald-500/20 active:scale-95 transition-all opacity-0 group-hover/media:opacity-100 shadow-lg z-10"
          >
            <Download className="w-3.5 h-3.5" />
          </a>
        </div>
      )
    }
    if (message.type === 'AUDIO') {
      const mediaSrc = getMediaSrc(message.content)
      return (
        <div className="py-1 mt-1 max-w-xs flex items-center gap-2 group/media">
          <audio src={mediaSrc} controls className="flex-1 min-w-[200px] h-11 border border-slate-800 rounded-xl" />
          {/* Botão de Download Dedicado */}
          <a
            href={`/api/chat/download?url=${encodeURIComponent(message.content)}`}
            download
            title="Baixar Áudio"
            className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-emerald-400 hover:border-emerald-500/20 active:scale-95 transition-all shadow-lg shrink-0"
          >
            <Download className="w-4 h-4" />
          </a>
        </div>
      )
    }
    if (message.type === 'DOCUMENT') {
      const fileName = message.content.split('/').pop() || 'documento.pdf'
      return (
        <div className="flex items-center gap-2 mt-1 max-w-xs group/media">
          <a 
            href={message.content} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="flex-1 flex items-center gap-3 p-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-emerald-500/20 text-emerald-400 hover:text-emerald-300 transition-colors min-w-0"
          >
            <FileText className="w-7 h-7 text-slate-400 shrink-0" />
            <div className="flex flex-col text-left min-w-0">
              <span className="text-xs font-bold text-slate-200 truncate">{fileName}</span>
              <span className="text-[9px] text-slate-500">Clique para visualizar arquivo</span>
            </div>
          </a>
          {/* Botão de Download Dedicado */}
          <a
            href={`/api/chat/download?url=${encodeURIComponent(message.content)}`}
            download
            title="Baixar Documento"
            className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-emerald-400 hover:border-emerald-500/20 active:scale-95 transition-all shadow-lg shrink-0"
          >
            <Download className="w-4 h-4" />
          </a>
        </div>
      )
    }
    return <p className="whitespace-pre-line">{message.content}</p>
  }

  return (
    <div className="flex-1 flex overflow-hidden bg-slate-950 select-none">
      {/* BARRA LATERAL: LISTA DE CONVERSAS */}
      <div className="w-96 border-r border-slate-900 flex flex-col bg-slate-950/40 select-none">
        {/* Cabeçalho de Busca */}
        <div className="p-4 border-b border-slate-900 bg-slate-950/60">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Buscar contatos ou telefones..."
              className="w-full bg-slate-900/60 border border-slate-900 focus:border-emerald-600 text-sm pl-10 pr-4 py-2.5 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Lista de Contatos com Scroll */}
        <div className="flex-1 overflow-y-auto">
          {isLoadingContacts ? (
            <div className="p-8 text-center text-sm text-slate-500 flex flex-col items-center gap-3">
              <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              <span>Carregando conversas ativas...</span>
            </div>
          ) : filteredContacts.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-600">
              Nenhum contato encontrado
            </div>
          ) : (
            filteredContacts.map((contact) => {
              const isSelected = activeContact?.id === contact.id
              const isPending = contact.lastMessage && 
                                contact.lastMessage.direction === 'INBOUND' && 
                                !contact.lastMessage.reaction
              const firstLetter = contact.name.substring(0, 1).toUpperCase()
              const lastMsgTime = contact.lastMessage 
                ? new Date(contact.lastMessage.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                : ''

              return (
                <div
                  key={contact.id}
                  onClick={() => setActiveContact(contact)}
                  className={`flex items-center gap-3.5 p-4 cursor-pointer border-b border-slate-900/60 transition-all ${
                    isSelected 
                      ? 'bg-slate-900/80 border-l-4 border-l-emerald-500' 
                      : isPending
                        ? 'bg-emerald-950/15 border-l-4 border-l-amber-500/80 hover:bg-emerald-900/20'
                        : 'hover:bg-slate-900/40'
                  }`}
                >
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600/30 to-teal-500/30 border border-emerald-500/20 flex items-center justify-center font-extrabold text-emerald-400 shrink-0">
                    {firstLetter}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <h4 className={`text-sm truncate ${
                        isPending && !isSelected 
                          ? 'text-emerald-300 font-extrabold' 
                          : 'font-semibold text-slate-200'
                      }`}>
                        {contact.name}
                      </h4>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[10px] text-slate-500 font-medium">
                          {lastMsgTime}
                        </span>
                        {isPending && (
                          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0" title="Aguardando resposta do operador" />
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs text-slate-500 truncate flex-1">
                        {contact.lastMessage 
                          ? `${contact.lastMessage.direction === 'OUTBOUND' ? 'Você: ' : ''}${contact.lastMessage.type && contact.lastMessage.type !== 'TEXT' ? `[${contact.lastMessage.type}]` : contact.lastMessage.content}` 
                          : 'Sem mensagens'}
                      </p>
                      {contact.lastMessage?.direction === 'OUTBOUND' && (
                        <div className="shrink-0">
                          {renderMessageStatus(contact.lastMessage.status)}
                        </div>
                      )}
                    </div>
                    
                    {/* Tags */}
                    {contact.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {contact.tags.slice(0, 2).map((tag, idx) => (
                          <span 
                            key={idx} 
                            className="text-[9px] bg-slate-900 text-slate-400 border border-slate-800 font-bold px-1.5 py-0.5 rounded-md"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* JANELA DE CONVERSA DO CHAT */}
      <div className="flex-1 flex flex-col bg-slate-950 select-none">
        {activeContact ? (
          <>
            {/* Cabeçalho do Chat */}
            <div className="p-4 border-b border-slate-900 bg-slate-950/60 flex items-center justify-between">
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-emerald-600/30 to-teal-500/30 border border-emerald-500/20 flex items-center justify-center font-extrabold text-emerald-400">
                  {activeContact.name.substring(0, 1).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-200">
                    {activeContact.name}
                  </h3>
                  <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                    <Phone className="w-3 h-3" />
                    <span>+{activeContact.phone}</span>
                  </div>
                </div>
              </div>

              {/* Ações e Tags do Contato Ativo */}
              <div className="flex items-center gap-3">
                <div className="hidden md:flex gap-1.5">
                  {activeContact.tags.map((tag, idx) => (
                    <span 
                      key={idx}
                      className="inline-flex items-center gap-1 text-[10px] bg-emerald-950/60 text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded-xl font-bold"
                    >
                      <Tag className="w-2.5 h-2.5" />
                      <span>{tag}</span>
                    </span>
                  ))}
                </div>
                
                <button className="text-slate-500 hover:text-slate-300 transition-colors p-2 hover:bg-slate-900/50 rounded-lg">
                  <MoreVertical className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Balões de Mensagem (Área de Scroll) */}
            <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4 bg-slate-950/80 relative">
              {isLoadingMessages ? (
                <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center text-sm text-slate-500 flex-col gap-2">
                  <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                  <span>Carregando histórico...</span>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-slate-600 gap-3">
                  <AlertCircle className="w-8 h-8 text-slate-700" />
                  <div>
                    <p className="text-sm font-semibold">Nenhuma mensagem trocada</p>
                    <p className="text-xs mt-1 max-w-[240px]">Envie uma mensagem ou mídia para iniciar o atendimento.</p>
                  </div>
                </div>
              ) : (
                messages.map((message) => {
                  const isOutbound = message.direction === 'OUTBOUND'
                  const date = new Date(message.timestamp)
                  const timeStr = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

                   return (
                    <div
                      key={message.id}
                      id={`msg-${message.id}`}
                      className={`flex flex-col max-w-[70%] relative group/msg mb-2 ${
                        isOutbound ? 'self-end items-end' : 'self-start items-start'
                      }`}
                    >
                      {/* Controles Flutuantes da Mensagem (Hover) */}
                      <div
                        className={`absolute top-1/2 -translate-y-1/2 opacity-0 group-hover/msg:opacity-100 transition-all duration-200 flex items-center gap-1.5 shrink-0 z-20 ${
                          isOutbound ? '-left-36' : '-right-36'
                        }`}
                      >
                        {/* Seletor rápido de Reação 👍 */}
                        <button
                          type="button"
                          onClick={() => handleReactToMessage(message.id, message.reaction === '👍' ? null : '👍')}
                          title="Dar Joinha 👍"
                          className="p-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-amber-400 hover:border-amber-500/20 active:scale-95 shadow-md transition-all"
                        >
                          👍
                        </button>
                        {/* Seletor rápido de Reação ❤️ */}
                        <button
                          type="button"
                          onClick={() => handleReactToMessage(message.id, message.reaction === '❤️' ? null : '❤️')}
                          title="Amar ❤️"
                          className="p-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-rose-500 hover:border-rose-500/20 active:scale-95 shadow-md transition-all"
                        >
                          ❤️
                        </button>
                        {/* Botão de Responder */}
                        <button
                          type="button"
                          onClick={() => setReplyingToMessage(message)}
                          title="Responder"
                          className="p-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-emerald-400 hover:border-emerald-500/20 active:scale-95 shadow-md transition-all"
                        >
                          <CornerUpRight className="w-3.5 h-3.5 transform -scale-x-100" />
                        </button>
                        {/* Botão de Encaminhar */}
                        <button
                          type="button"
                          onClick={() => handleOpenForward(message)}
                          title="Encaminhar"
                          className="p-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-emerald-400 hover:border-emerald-500/20 active:scale-95 shadow-md transition-all"
                        >
                          <CornerUpRight className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Balão de Fala */}
                      <div
                        className={`px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-lg relative ${
                          isOutbound
                            ? 'bg-emerald-600 text-white rounded-tr-none'
                            : 'bg-slate-900/90 text-slate-200 rounded-tl-none border border-slate-900'
                        }`}
                      >
                        {/* Citação da Mensagem Respondida (Reply Quote) */}
                        {message.replyTo && (
                          <div
                            onClick={() => {
                              const target = document.getElementById(`msg-${message.replyTo!.id}`)
                              target?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                            }}
                            className={`p-2.5 mb-2 rounded-xl text-xs border-l-4 cursor-pointer truncate max-w-xs transition-all hover:bg-opacity-20 select-none ${
                              isOutbound
                                ? 'bg-black/20 border-emerald-300 text-emerald-100'
                                : 'bg-slate-950/80 border-emerald-500 text-slate-400 hover:bg-slate-950'
                            }`}
                          >
                            <div className="font-bold text-[10px] uppercase mb-0.5">
                              {message.replyTo.direction === 'OUTBOUND' ? 'Você' : 'Cliente'}
                            </div>
                            <div className="truncate text-[11px]">
                              {message.replyTo.type !== 'TEXT' ? `[Mídia: ${message.replyTo.type}]` : message.replyTo.content}
                            </div>
                          </div>
                        )}

                        {renderMessageContent(message)}
                        
                        {/* Rodapé Interno do Balão (Hora + Status) */}
                        <div
                          className={`flex items-center gap-1.5 text-[9px] mt-1.5 select-none ${
                            isOutbound ? 'text-emerald-200 justify-end' : 'text-slate-500 justify-start'
                          }`}
                        >
                          <span>{timeStr}</span>
                          {isOutbound && renderMessageStatus(message.status)}
                        </div>

                        {/* Pílula de Reação */}
                        {message.reaction && (
                          <div
                            onClick={() => handleReactToMessage(message.id, null)}
                            title="Remover reação"
                            className={`absolute -bottom-2 px-2 py-0.5 rounded-full text-xs bg-slate-900 border border-slate-800 shadow-md flex items-center justify-center cursor-pointer select-none hover:scale-110 active:scale-95 transition-all duration-100 ${
                              isOutbound ? 'right-4' : 'left-4'
                            }`}
                          >
                            {message.reaction}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
              
              {/* Balão dinâmico de Uploading... */}
              {isUploading && (
                <div className="flex flex-col self-end items-end max-w-[70%]">
                  <div className="px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-lg bg-emerald-600/40 text-emerald-200 rounded-tr-none border border-emerald-500/20 flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                    <span>Enviando arquivo físico...</span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input de Digitação de Mensagem e Controles */}
            <div className="relative">
              {/* Painel de Visualização de Mensagem Respondida (acima do input) */}
              {replyingToMessage && (
                <div className="absolute bottom-full left-0 right-0 z-30 p-3 bg-slate-900 border-t border-slate-800 flex items-center justify-between gap-4 backdrop-blur-md bg-opacity-95 select-none animate-in slide-in-from-bottom-2 duration-100">
                  <div className="flex items-center gap-3 border-l-4 border-emerald-500 pl-3 min-w-0">
                    <div className="flex flex-col min-w-0">
                      <span className="text-[10px] uppercase font-bold text-emerald-400">
                        Respondendo a {replyingToMessage.direction === 'OUTBOUND' ? 'Você' : 'Cliente'}
                      </span>
                      <span className="text-xs text-slate-400 truncate">
                        {replyingToMessage.type !== 'TEXT' ? `[Mídia: ${replyingToMessage.type}]` : replyingToMessage.content}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setReplyingToMessage(null)}
                    className="text-slate-500 hover:text-slate-300 transition-colors p-1.5 hover:bg-slate-800 rounded-lg shrink-0"
                    title="Cancelar resposta"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* POPOVER SELETOR DE EMOJIS */}
              {showEmojiPicker && (
                <div className="absolute bottom-20 left-4 z-40 bg-slate-900 border border-slate-800 p-4 rounded-3xl shadow-2xl flex flex-wrap gap-2 max-w-[280px] backdrop-blur-md bg-slate-900/90">
                  {emojis.map((emoji, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleEmojiSelect(emoji)}
                      className="text-lg hover:scale-125 transition-transform duration-100 p-1"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}

              <form 
                onSubmit={handleSendMessage}
                className="p-4 border-t border-slate-900 bg-slate-950/60 flex items-center gap-3.5"
              >
                {/* Inputs de Upload Ocultos */}
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileChange} 
                  className="hidden" 
                  accept="image/*,video/*,audio/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" 
                />

                {!isRecording && (
                  <>
                    <button 
                      type="button"
                      onClick={handleAttachClick}
                      disabled={isUploading}
                      className="text-slate-500 hover:text-slate-300 disabled:opacity-40 transition-colors p-2 hover:bg-slate-900/50 rounded-xl"
                      title="Anexar arquivos de mídia"
                    >
                      <Paperclip className="w-5 h-5" />
                    </button>

                    <button 
                      type="button"
                      onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                      className={`transition-colors p-2 hover:bg-slate-900/50 rounded-xl ${
                        showEmojiPicker ? 'text-emerald-400' : 'text-slate-500 hover:text-slate-300'
                      }`}
                      title="Selecionar emoji corporativo"
                    >
                      <Smile className="w-5 h-5" />
                    </button>

                    <button 
                      type="button"
                      onClick={() => {
                        setShowTemplateModal(true)
                        setSelectedTemplate(null)
                        setTemplateVariables([])
                      }}
                      disabled={isSending || isUploading}
                      className="text-slate-500 hover:text-emerald-400 transition-colors p-2 hover:bg-slate-900/50 rounded-xl flex items-center justify-center shrink-0"
                      title="Disparar template aprovado pela Meta ⚡"
                    >
                      <Sparkles className="w-5 h-5" />
                    </button>
                  </>
                )}

                {isRecording ? (
                  <div className="flex-1 flex items-center justify-between bg-emerald-950/10 border border-emerald-500/20 px-4 py-2.5 rounded-xl text-emerald-400">
                    <div className="flex items-center gap-3 text-xs sm:text-sm font-bold">
                      <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping shrink-0" />
                      <span>Gravando áudio corporativo...</span>
                      <span className="font-mono bg-emerald-950/60 px-2.5 py-0.5 rounded border border-emerald-500/10 text-xs">
                        {formatDuration(recordingDuration)}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => stopRecording(false)}
                        className="text-red-400 hover:text-red-300 p-2 hover:bg-red-950/20 rounded-lg transition-colors flex items-center gap-1.5 text-xs font-bold"
                        title="Descartar gravação de voz"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span className="hidden sm:inline">Descartar</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => stopRecording(true)}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-colors shadow-lg hover:shadow-emerald-600/10 active:scale-95"
                        title="Enviar gravação"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Enviar</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <input
                      type="text"
                      placeholder="Digite uma mensagem..."
                      className="flex-1 bg-slate-900/60 border border-slate-900 focus:border-emerald-600 text-sm px-4 py-3 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none transition-all"
                      value={newMessageText}
                      onChange={(e) => setNewMessageText(e.target.value)}
                      disabled={isSending || isUploading}
                    />

                    {newMessageText.trim() ? (
                      <button
                        type="submit"
                        disabled={!newMessageText.trim() || isSending || isUploading}
                        className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:hover:bg-emerald-600 disabled:translate-y-0 text-white p-3 rounded-xl shadow-lg hover:shadow-emerald-600/10 hover:-translate-y-0.5 active:translate-y-0 transition-all shrink-0"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={startRecording}
                        disabled={isSending || isUploading}
                        className="bg-slate-900 border border-slate-800 hover:bg-slate-800 text-emerald-400 hover:text-emerald-300 p-3 rounded-xl shadow hover:-translate-y-0.5 active:translate-y-0 transition-all shrink-0 flex items-center justify-center"
                        title="Gravar mensagem de voz"
                      >
                        <Mic className="w-5 h-5" />
                      </button>
                    )}
                  </>
                )}
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 select-none">
            <div className="w-20 h-20 rounded-3xl bg-slate-900/60 border border-slate-900 flex items-center justify-center mb-6">
              <Building2 className="w-10 h-10 text-emerald-400" />
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight">
              Selecione uma conversa para iniciar
            </h2>
            <p className="text-slate-500 text-xs mt-2 max-w-[320px] leading-relaxed">
              Clique em algum contato comercial da barra lateral esquerda para interagir com o cliente em tempo real via WhatsApp Cloud API.
            </p>
          </div>
        )}
      </div>

      {/* MODAL DE ENCAMINHAMENTO DE MENSAGENS */}
      {forwardModalOpen && messageToForward && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-[440px] bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl flex flex-col max-h-[85vh]">
            <h3 className="text-base font-bold text-slate-100 mb-1.5 flex items-center gap-2">
              <CornerUpRight className="w-5 h-5 text-emerald-400" />
              <span>Encaminhar Mensagem</span>
            </h3>
            
            <p className="text-xs text-slate-500 mb-4 truncate pr-4">
              Conteúdo: "{messageToForward.type === 'TEXT' ? messageToForward.content : `[Mídia: ${messageToForward.type}]`}"
            </p>

            {/* Barra de pesquisa de contatos para reencaminhamento */}
            <div className="relative mb-4">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Buscar contatos corporativos..."
                className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-600 text-xs pl-9 pr-4 py-2 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none transition-all"
                value={forwardSearchTerm}
                onChange={(e) => setForwardSearchTerm(e.target.value)}
              />
            </div>

            {/* Lista dos contatos com seleção múltipla */}
            <div className="flex-1 overflow-y-auto mb-5 pr-1 gap-2 flex flex-col min-h-[160px] max-h-[360px]">
              {contacts
                .filter(c => c.name.toLowerCase().includes(forwardSearchTerm.toLowerCase()) || c.phone.includes(forwardSearchTerm))
                .map((contact) => {
                  const isChecked = selectedContacts.includes(contact.id)
                  return (
                    <div 
                      key={contact.id}
                      onClick={() => handleToggleContactSelection(contact.id)}
                      className={`flex items-center justify-between p-3 rounded-2xl border cursor-pointer transition-all ${
                        isChecked 
                          ? 'bg-emerald-950/20 border-emerald-500/20 text-white shadow-md' 
                          : 'bg-slate-950/40 border-slate-950 hover:bg-slate-950/80 hover:border-slate-800 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600/20 to-teal-500/20 border border-emerald-500/10 flex items-center justify-center font-bold text-emerald-400 text-xs">
                          {contact.name.substring(0, 1).toUpperCase()}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs font-bold truncate">{contact.name}</span>
                          <span className="text-[10px] text-slate-500">+{contact.phone}</span>
                        </div>
                      </div>
                      
                      {/* Elemento de Checkbox Visual */}
                      <div className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all ${
                        isChecked 
                          ? 'bg-emerald-600 border-emerald-500 text-white' 
                          : 'border-slate-700 bg-slate-950'
                      }`}>
                        {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                    </div>
                  )
                })}
            </div>

            {/* Controles do Modal */}
            <div className="flex items-center gap-3 mt-auto shrink-0">
              <button
                type="button"
                onClick={handleCloseForward}
                className="flex-1 bg-slate-950 border border-slate-800 hover:bg-slate-950/60 text-slate-400 py-3 rounded-2xl text-xs font-bold transition-all"
              >
                Cancelar
              </button>
              
              <button
                type="button"
                onClick={handleForwardSubmit}
                disabled={selectedContacts.length === 0 || isForwarding}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white py-3 rounded-2xl text-xs font-bold transition-all shadow-lg hover:shadow-emerald-600/10 flex items-center justify-center gap-2"
              >
                {isForwarding ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Encaminhando...</span>
                  </>
                ) : (
                  <span>Encaminhar ({selectedContacts.length})</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE DISPARO DE TEMPLATES META APROVADOS */}
      {showTemplateModal && activeContact && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-[500px] bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl flex flex-col max-h-[85vh] animate-fade-in">
            
            {/* Header */}
            <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3 shrink-0">
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-emerald-400" />
                <span>Disparar Template Meta</span>
              </h3>
              <button 
                type="button"
                onClick={() => setShowTemplateModal(false)}
                className="text-slate-500 hover:text-slate-300 transition-colors p-1 hover:bg-slate-800 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Conteúdo Principal */}
            {!selectedTemplate ? (
              // 1. LISTAGEM DE TEMPLATES
              <div className="flex-1 flex flex-col overflow-hidden min-h-[300px]">
                <p className="text-xs text-slate-400 mb-3">
                  Inicie ou reabra uma conversa ativa com <strong>{activeContact.name}</strong> (+{activeContact.phone}) enviando um template aprovado pela Meta:
                </p>
                
                {/* Busca */}
                <div className="relative mb-3 shrink-0">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Buscar template por nome..."
                    className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-600 text-xs pl-9 pr-4 py-2 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none transition-all"
                    value={templateSearchTerm}
                    onChange={(e) => setTemplateSearchTerm(e.target.value)}
                  />
                </div>

                {/* Lista com scroll */}
                <div className="flex-1 overflow-y-auto pr-1 gap-2 flex flex-col min-h-0">
                  {approvedTemplates.length === 0 ? (
                    <div className="text-center p-8 text-xs text-slate-600">
                      Nenhum template APROVADO encontrado no banco de dados. Cadastre e aprove seus templates na aba "Templates"!
                    </div>
                  ) : approvedTemplates.filter(t => t.name.toLowerCase().includes(templateSearchTerm.toLowerCase())).length === 0 ? (
                    <div className="text-center p-8 text-xs text-slate-600">
                      Nenhum template correspondente à busca.
                    </div>
                  ) : (
                    approvedTemplates
                      .filter(t => t.name.toLowerCase().includes(templateSearchTerm.toLowerCase()))
                      .map((tpl) => (
                        <div
                          key={tpl.id}
                          onClick={() => {
                            setSelectedTemplate(tpl)
                            setTemplateVariables(Array(tpl.variables.length).fill(''))
                          }}
                          className="p-3 bg-slate-950/60 hover:bg-slate-950 border border-slate-950 hover:border-slate-800 rounded-2xl cursor-pointer transition-all flex flex-col gap-2 group"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] bg-emerald-950/60 text-emerald-400 border border-emerald-500/20 font-bold px-2 py-0.5 rounded-lg">
                              {tpl.category}
                            </span>
                            <span className="text-[10px] text-slate-500 font-medium">
                              {tpl.variables.length > 0 ? `${tpl.variables.length} variáveis` : 'Sem variáveis'}
                            </span>
                          </div>
                          <span className="text-xs font-bold text-slate-200 group-hover:text-emerald-400 transition-colors">
                            {tpl.name}
                          </span>
                          <p className="text-[10px] text-slate-500 line-clamp-2 italic font-mono bg-slate-900/60 p-2 rounded-xl border border-slate-900">
                            {tpl.body}
                          </p>
                        </div>
                      ))
                  )}
                </div>
              </div>
            ) : (
              // 2. FORMULÁRIO DE VARIÁVEIS
              <div className="flex-1 flex flex-col overflow-hidden min-h-[300px]">
                <button
                  type="button"
                  onClick={() => setSelectedTemplate(null)}
                  className="text-xs text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1.5 mb-4 self-start"
                >
                  ← Voltar para listagem
                </button>

                <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-4 min-h-0">
                  <div>
                    <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Template Selecionado</h4>
                    <span className="text-sm font-extrabold text-white">{selectedTemplate.name}</span>
                  </div>

                  {/* Inputs das Variáveis se houver */}
                  {selectedTemplate.variables.length > 0 ? (
                    <div className="flex flex-col gap-3">
                      <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Variáveis de Preenchimento</h4>
                      {selectedTemplate.variables.map((vName: string, index: number) => (
                        <div key={index} className="flex flex-col gap-1.5">
                          <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                            {vName.replace(/_/g, ' ')} ({"{{" + (index + 1) + "}}"})
                          </label>
                          <input
                            type="text"
                            required
                            placeholder={index === 0 ? `Ex: ${activeContact.name}` : `Digite o valor para {{${index + 1}}}`}
                            className="bg-slate-950 border border-slate-800 focus:border-emerald-600 text-xs px-3.5 py-2.5 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none transition-all"
                            value={templateVariables[index] || ''}
                            onChange={(e) => {
                              const updated = [...templateVariables]
                              updated[index] = e.target.value
                              setTemplateVariables(updated)
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-3 bg-emerald-950/20 border border-emerald-500/20 rounded-2xl text-xs text-emerald-400 font-medium">
                      Este template não exige variáveis dinâmicas. Você pode enviá-lo diretamente!
                    </div>
                  )}

                  {/* Pré-visualização do Corpo em tempo real */}
                  <div className="flex flex-col gap-1.5 mt-2">
                    <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Pré-visualização do Envio</h4>
                    <div className="bg-slate-950 border border-slate-800/80 p-3.5 rounded-2xl text-xs text-slate-400 font-mono leading-relaxed whitespace-pre-line border-l-4 border-l-emerald-500">
                      {(() => {
                        let previewText = selectedTemplate.body
                        templateVariables.forEach((val, idx) => {
                          const placeholder = val || `{{${idx + 1}}}`
                          previewText = previewText.replace(`{{${idx + 1}}}`, placeholder)
                        })
                        return previewText
                      })()}
                    </div>
                  </div>
                </div>

                {/* Botões do Formulário de Envio */}
                <div className="flex items-center gap-3 mt-4 border-t border-slate-800 pt-4 shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowTemplateModal(false)}
                    className="flex-1 bg-slate-950 border border-slate-800 hover:bg-slate-950/60 text-slate-400 py-3 rounded-2xl text-xs font-bold transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      if (isSendingTemplate) return
                      setIsSendingTemplate(true)
                      try {
                        const res = await fetch('/api/chat/send-template', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            contactId: activeContact.id,
                            templateId: selectedTemplate.id,
                            variables: templateVariables
                          })
                        })

                        if (!res.ok) {
                          const errData = await res.json()
                          throw new Error(errData.error || 'Erro ao enviar template.')
                        }

                        console.log('✅ Template disparado com pleno sucesso no Live Chat!')
                        setShowTemplateModal(false)
                      } catch (err: any) {
                        console.error('Erro ao enviar template no frontend:', err)
                        alert(err.message || 'Não foi possível disparar o template. Verifique as credenciais.')
                      } finally {
                        setIsSendingTemplate(false)
                      }
                    }}
                    disabled={
                      selectedTemplate.variables.some((_: any, idx: number) => !templateVariables[idx]?.trim()) ||
                      isSendingTemplate
                    }
                    className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white py-3 rounded-2xl text-xs font-bold transition-all shadow-lg hover:shadow-emerald-600/10 flex items-center justify-center gap-2"
                  >
                    {isSendingTemplate ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Enviando...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        <span>Enviar Template</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
