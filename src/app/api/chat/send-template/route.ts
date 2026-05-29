import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { TwilioWhatsAppService } from '@/lib/twilio-api'
import { pusherServer } from '@/lib/pusher'

export async function POST(request: NextRequest) {
  try {
    const { contactId, templateId, variables = [] } = await request.json()

    // 1. Validações básicas de entrada
    if (!contactId || !templateId) {
      return NextResponse.json({ error: 'Os parâmetros contactId e templateId são obrigatórios.' }, { status: 400 })
    }

    if (!Array.isArray(variables)) {
      return NextResponse.json({ error: 'O parâmetro variables deve ser um array de strings.' }, { status: 400 })
    }

    // 2. Busca o contato no banco de dados
    const contact = await prisma.contact.findUnique({
      where: { id: contactId }
    })

    if (!contact) {
      return NextResponse.json({ error: 'Contato não encontrado.' }, { status: 404 })
    }

    // 3. Busca o template no banco de dados
    const template = await prisma.template.findUnique({
      where: { id: templateId }
    })

    if (!template) {
      return NextResponse.json({ error: 'Template não encontrado.' }, { status: 404 })
    }

    // Garante que o template está aprovado para uso comercial
    if (template.status !== 'APPROVED') {
      return NextResponse.json({ 
        error: `O template selecionado ("${template.name}") não pode ser enviado pois está com status ${template.status}. Apenas templates APPROVED pela Meta podem ser disparados.` 
      }, { status: 400 })
    }

    // 4. Monta os componentes estruturados para o Twilio/WhatsApp Cloud API
    const components = [
      {
        type: 'body',
        parameters: variables.map(v => ({
          type: 'text',
          text: String(v)
        }))
      }
    ]

    console.log(`📡 Disparando template individual "${template.name}" para ${contact.name} (${contact.phone}). Variáveis:`, variables)

    // 5. Faz o disparo via serviço de WhatsApp
    const responseTwilio = await TwilioWhatsAppService.sendTemplateMessage({
      to: contact.phone,
      templateName: template.name,
      languageCode: template.language,
      components
    })

    // Extrai informações da mensagem
    const metaMessageId = responseTwilio.messages?.[0]?.id || `tpl_msg_${Math.random().toString(36).substring(2, 12)}`
    const isMock = !!responseTwilio.mock

    // 6. Interpola o corpo do template localmente para salvar o texto final legível no banco de dados
    let interpolatedContent = template.body
    variables.forEach((val, idx) => {
      interpolatedContent = interpolatedContent.replace(`{{${idx + 1}}}`, String(val))
    })

    // 7. Salva a mensagem no histórico (tipo TEMPLATE)
    const newMessage = await prisma.message.create({
      data: {
        metaMessageId,
        contactId: contact.id,
        direction: 'OUTBOUND',
        type: 'TEMPLATE',
        content: interpolatedContent,
        status: isMock ? 'DELIVERED' : 'SENT'
      }
    })

    console.log(`✅ Template individual salvo no histórico com sucesso! ID da Mensagem: ${newMessage.id}`)

    // 8. Disparos em tempo real via Pusher para o operador e para a barra lateral
    try {
      await pusherServer.trigger(`chat-${contact.id}`, 'new-message', {
        id: newMessage.id,
        metaMessageId: newMessage.metaMessageId,
        direction: newMessage.direction,
        type: newMessage.type,
        content: newMessage.content,
        status: newMessage.status,
        timestamp: newMessage.timestamp,
        contactId: newMessage.contactId
      })

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
    } catch (pusherErr: any) {
      console.warn('⚠️ [Pusher Warning] Falha ao disparar eventos em tempo real no envio do template. Detalhes:', pusherErr.message)
    }

    return NextResponse.json(newMessage)
  } catch (error: any) {
    console.error('❌ Erro no POST de /api/chat/send-template:', error)
    return NextResponse.json({ error: 'Erro interno do servidor', details: error.message }, { status: 500 })
  }
}
