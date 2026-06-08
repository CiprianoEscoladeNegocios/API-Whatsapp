import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { TwilioWhatsAppService } from '@/lib/twilio-api'
import { pusherServer } from '@/lib/pusher'

export async function POST(request: NextRequest) {
  try {
    const { contactId, content, type = 'TEXT', replyToId } = await request.json()

    if (!contactId || !content) {
      return NextResponse.json({ error: 'Parâmetros inválidos' }, { status: 400 })
    }

    // 1. Busca o contato no banco de dados para recuperar o telefone
    const contact = await prisma.contact.findUnique({
      where: { id: contactId }
    })

    if (!contact) {
      return NextResponse.json({ error: 'Contato não encontrado' }, { status: 404 })
    }

    // 2. Faz o disparo via API do Twilio WhatsApp (ou simulação caso mock)
    let responseTwilio;
    if (type && type !== 'TEXT') {
      // Converte a URL de mídia relativa para uma URL absoluta pública para que o Twilio possa acessá-la
      let absoluteMediaUrl = content
      if (content.startsWith('/')) {
        const host = request.headers.get('host') || 'localhost:3000'
        const protocol = host.includes('localhost') || host.includes('127.0.0.1') ? 'http' : 'https'
        absoluteMediaUrl = `${protocol}://${host}${content}`
      }
      
      console.log(`📤 Enviando mídia comercial do tipo ${type}. URL pública do arquivo: ${absoluteMediaUrl}`)
      
      responseTwilio = await TwilioWhatsAppService.sendMediaMessage({
        to: contact.phone,
        mediaUrl: absoluteMediaUrl,
        body: undefined // Sem texto extra para enviar o arquivo limpo
      })
    } else {
      responseTwilio = await TwilioWhatsAppService.sendTextMessage({
        to: contact.phone,
        text: content
      })
    }

    // Extrai o ID da mensagem retornado pelo Twilio (Message SID)
    const metaMessageId = responseTwilio.messages?.[0]?.id || `mock_${Date.now()}`
    
    // Se estiver em Mock Mode, simularemos o ciclo de vida completo no console
    const isMock = !!responseTwilio.mock

    // 3. Salva a mensagem OUTBOUND no banco de dados
    const newMessage = await prisma.message.create({
      data: {
        metaMessageId,
        contactId: contact.id,
        direction: 'OUTBOUND',
        type: type as any,
        content,
        status: isMock ? 'DELIVERED' : 'SENT', // Em mock pulamos direto para entregue para simular dinamismo
        replyToId: replyToId || null,
      },
      include: {
        replyTo: {
          select: {
            id: true,
            content: true,
            type: true,
            direction: true
          }
        }
      }
    })

    console.log(`📤 Mensagem Outbound salva com sucesso! ID: ${newMessage.id}, MetaMessageID: ${metaMessageId}`)

    // 4. Dispara evento via Pusher no canal individual daquela conversa
    // Envolvido em try/catch para garantir robustez mesmo com chaves simuladas (Mock Mode Pusher)
    try {
      await pusherServer.trigger(`chat-${contact.id}`, 'new-message', {
        id: newMessage.id,
        metaMessageId: newMessage.metaMessageId,
        direction: newMessage.direction,
        type: newMessage.type,
        content: newMessage.content,
        status: newMessage.status,
        timestamp: newMessage.timestamp,
        contactId: newMessage.contactId,
        replyTo: newMessage.replyTo
      })

      // 5. Dispara evento via Pusher na lista lateral para atualizar o balão "última mensagem"
      await pusherServer.trigger('chats-sidebar', 'sidebar-update', {
        contactId: contact.id,
        lastMessage: {
          content: newMessage.content,
          timestamp: newMessage.timestamp,
          direction: newMessage.direction,
          type: newMessage.type
        },
        contactName: contact.name,
        contactPhone: contact.phone
      })
    } catch (pusherError: any) {
      console.warn('⚠️ [Pusher Warning] Falha ao enviar evento via Pusher. Continuando execução normal. Detalhes:', pusherError.message)
    }

    // SIMULAÇÃO DO CLIENTE RESPONDENDO EM MOCK MODE (Excelente para o onboarding da Cipriano!)
    if (isMock) {
      // Simula uma resposta automática do cliente 2 segundos depois no banco
      setTimeout(async () => {
        try {
          const autoReplyContent = `Olá! Sou o assistente virtual da Cipriano Escola de Negócios. Recebi sua mensagem: "${content}". Como posso te ajudar na sua carreira executiva hoje? 🚀`
          const replyMetaId = `mock_reply_${Date.now()}`
          
          const dbReply = await prisma.message.create({
            data: {
              metaMessageId: replyMetaId,
              contactId: contact.id,
              direction: 'INBOUND',
              type: 'TEXT',
              content: autoReplyContent,
              status: 'READ'
            }
          })

          // Notifica via Pusher a resposta simulada! Envolvido em try/catch por robustez.
          try {
            await pusherServer.trigger(`chat-${contact.id}`, 'new-message', {
              id: dbReply.id,
              metaMessageId: dbReply.metaMessageId,
              direction: dbReply.direction,
              type: dbReply.type,
              content: dbReply.content,
              status: dbReply.status,
              timestamp: dbReply.timestamp,
              contactId: dbReply.contactId
            })

            await pusherServer.trigger('chats-sidebar', 'sidebar-update', {
              contactId: contact.id,
              lastMessage: {
                content: dbReply.content,
                timestamp: dbReply.timestamp,
                direction: dbReply.direction
              },
              contactName: contact.name,
              contactPhone: dbReply.contactId // ou contact.phone
            })
          } catch (pusherErr: any) {
            console.warn('⚠️ [Pusher Warning] Falha ao enviar auto-resposta simulada via Pusher. Detalhes:', pusherErr.message)
          }
          
          console.log('🤖 Auto-resposta simulada ativada via Mock Mode com sucesso!')
        } catch (err) {
          console.error('Erro na auto-resposta do mock:', err)
        }
      }, 2000)
    }

    return NextResponse.json(newMessage)
  } catch (error: any) {
    console.error('❌ Erro no endpoint /api/chat/send:', error)
    return NextResponse.json({ error: 'Erro interno do servidor', details: error.message }, { status: 500 })
  }
}
