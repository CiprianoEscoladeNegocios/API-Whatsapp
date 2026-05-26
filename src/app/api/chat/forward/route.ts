import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { TwilioWhatsAppService } from '@/lib/twilio-api'
import { pusherServer } from '@/lib/pusher'

/**
 * Endpoint Corporativo de Encaminhamento de Mensagens - Cipriano Conversas
 * 
 * Este endpoint recebe o ID de uma mensagem de origem e uma lista de IDs de contatos,
 * duplica a mensagem no banco de dados e dispara as mensagens reais de texto ou mídia
 * para cada contato via Twilio WhatsApp API, propagando atualizações em tempo real via Pusher.
 * Desenvolvido sob as diretrizes de excelência em vendas e atendimento da Cipriano Escola de Negócios.
 */
export async function POST(request: NextRequest) {
  try {
    const { messageId, targetContactIds } = await request.json()

    if (!messageId || !targetContactIds || !Array.isArray(targetContactIds) || targetContactIds.length === 0) {
      return NextResponse.json({ error: 'Parâmetros inválidos ou contatos vazios' }, { status: 400 })
    }

    // 1. Busca a mensagem original no banco de dados
    const originalMessage = await prisma.message.findUnique({
      where: { id: messageId },
      include: { contact: true }
    })

    if (!originalMessage) {
      return NextResponse.json({ error: 'Mensagem original não encontrada' }, { status: 404 })
    }

    const forwardedMessages = []

    // 2. Processa o encaminhamento para cada contato selecionado
    for (const contactId of targetContactIds) {
      const contact = await prisma.contact.findUnique({
        where: { id: contactId }
      })

      if (!contact) continue

      // Realiza o disparo via Twilio WhatsApp
      const responseTwilio = await TwilioWhatsAppService.sendTextMessage({
        to: contact.phone,
        text: originalMessage.content
      })

      const metaMessageId = responseTwilio.messages?.[0]?.id || `forward_mock_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
      const isMock = !!responseTwilio.mock

      // Cria a nova mensagem OUTBOUND no banco de dados para o contato de destino
      const newForwardedMessage = await prisma.message.create({
        data: {
          metaMessageId,
          contactId: contact.id,
          direction: 'OUTBOUND',
          type: originalMessage.type, // Mantém o tipo original (TEXT, IMAGE, etc.)
          content: originalMessage.content,
          status: isMock ? 'DELIVERED' : 'SENT'
        }
      })

      forwardedMessages.push(newForwardedMessage)

      // Notifica via Pusher em tempo real para a conversa individual do contato destino
      try {
        await pusherServer.trigger(`chat-${contact.id}`, 'new-message', {
          id: newForwardedMessage.id,
          metaMessageId: newForwardedMessage.metaMessageId,
          direction: newForwardedMessage.direction,
          type: newForwardedMessage.type,
          content: newForwardedMessage.content,
          status: newForwardedMessage.status,
          timestamp: newForwardedMessage.timestamp,
          contactId: newForwardedMessage.contactId
        })

        // Atualiza a barra lateral para colocar o contato de destino no topo
        await pusherServer.trigger('chats-sidebar', 'sidebar-update', {
          contactId: contact.id,
          lastMessage: {
            content: newForwardedMessage.content,
            timestamp: newForwardedMessage.timestamp,
            direction: newForwardedMessage.direction,
            type: newForwardedMessage.type
          },
          contactName: contact.name,
          contactPhone: contact.phone
        })
      } catch (pusherErr: any) {
        console.warn(`⚠️ [Pusher Warning] Falha ao disparar evento de encaminhamento para contato ${contact.name}:`, pusherErr.message)
      }
    }

    console.log(`🔄 [API Forward] Mensagem ${messageId} encaminhada com sucesso para ${forwardedMessages.length} contatos!`)
    return NextResponse.json({ success: true, count: forwardedMessages.length, data: forwardedMessages })
  } catch (error: any) {
    console.error('❌ [API Forward Error] Erro crítico ao encaminhar mensagem:', error)
    return NextResponse.json({ error: 'Erro interno ao encaminhar mensagem', details: error.message }, { status: 500 })
  }
}
