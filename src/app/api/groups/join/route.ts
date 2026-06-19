import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { TwilioWhatsAppService } from '@/lib/twilio-api'
import { pusherServer } from '@/lib/pusher'

export const dynamic = 'force-dynamic'

/**
 * API de Entrada no Grupo via Link de Convite (/api/groups/join)
 * Cipriano Escola de Negócios
 */
export async function POST(request: NextRequest) {
  try {
    const { token, name, phone } = await request.json()

    if (!token || !name || !phone) {
      return NextResponse.json({ error: 'Todos os campos são obrigatórios' }, { status: 400 })
    }

    // 1. Busca o grupo pelo token de convite
    const group = await prisma.virtualGroup.findUnique({
      where: { inviteToken: token }
    })

    if (!group) {
      return NextResponse.json({ error: 'Link de convite inválido ou expirado' }, { status: 404 })
    }

    // 2. Sanitiza o telefone do contato (deixa apenas números)
    const cleanPhone = phone.replace(/\D/g, '')

    // 3. Busca ou cria o contato
    let contact = await prisma.contact.findUnique({
      where: { phone: cleanPhone }
    })

    if (!contact) {
      contact = await prisma.contact.create({
        data: {
          phone: cleanPhone,
          name: name,
          tags: ['Membro Grupo']
        }
      })
    }

    // 4. Verifica se o contato já é membro do grupo
    const existingMember = await prisma.virtualGroupMember.findFirst({
      where: {
        groupId: group.id,
        contactId: contact.id
      }
    })

    if (!existingMember) {
      // Adiciona o contato como membro
      await prisma.virtualGroupMember.create({
        data: {
          groupId: group.id,
          contactId: contact.id,
          isAdmin: false
        }
      })

      // 5. Adiciona mensagem de sistema na sala do grupo
      const systemMsg = await prisma.virtualGroupMessage.create({
        data: {
          groupId: group.id,
          senderId: 'system',
          senderName: 'Sistema',
          senderType: 'SYSTEM',
          content: `🎉 ${contact.name} entrou no grupo virtual.`
        }
      })

      // Dispara Pusher para atualizar o chat
      try {
        await pusherServer.trigger(`group-chat-${group.id}`, 'new-group-message', {
          id: systemMsg.id,
          groupId: systemMsg.groupId,
          senderId: systemMsg.senderId,
          senderName: systemMsg.senderName,
          senderType: systemMsg.senderType,
          type: systemMsg.type,
          content: systemMsg.content,
          timestamp: systemMsg.timestamp
        })
      } catch (pusherError: any) {
        console.warn('⚠️ [Pusher Warning] Falha ao disparar nova mensagem do sistema via Pusher:', pusherError.message)
      }

      // 6. Envia mensagem automática de boas-vindas do WhatsApp via Twilio
      if (group.welcomeMessage) {
        try {
          const twilioRes = await TwilioWhatsAppService.sendTextMessage({
            to: cleanPhone,
            text: group.welcomeMessage
          })

          const metaMessageId = twilioRes.messages?.[0]?.id || `welcome_${Date.now()}`

          // Registra a mensagem enviada de boas-vindas no histórico de mensagens individuais do contato
          await prisma.message.create({
            data: {
              contactId: contact.id,
              direction: 'OUTBOUND',
              type: 'TEXT',
              content: group.welcomeMessage,
              status: twilioRes.mock ? 'DELIVERED' : 'SENT',
              metaMessageId
            }
          })
        } catch (twilioErr: any) {
          console.error('❌ [Twilio Boas-vindas Error]: Falha ao disparar mensagem de boas-vindas no WhatsApp:', twilioErr.message)
        }
      }
    }

    return NextResponse.json({
      success: true,
      groupId: group.id,
      contactId: contact.id,
      contactName: contact.name
    })
  } catch (error: any) {
    console.error('❌ [API Groups Join Error]:', error)
    return NextResponse.json({ error: 'Erro ao ingressar no grupo', details: error.message }, { status: 500 })
  }
}
