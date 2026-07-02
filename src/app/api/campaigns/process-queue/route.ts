import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { TwilioWhatsAppService } from '@/lib/twilio-api'

export async function POST(request: NextRequest) {
  try {
    const { messageId } = await request.json()

    if (!messageId) {
      return NextResponse.json({ error: 'Parâmetro messageId obrigatório ausente.' }, { status: 400 })
    }

    const message = await prisma.message.findUnique({
      where: { id: messageId },
      include: {
        contact: true,
        campaign: {
          include: {
            template: true
          }
        }
      }
    })

    if (!message) {
      return NextResponse.json({ error: 'Mensagem não encontrada.' }, { status: 404 })
    }

    if (!message.campaign || !message.campaign.template) {
      return NextResponse.json({ error: 'Campanha ou template associados não encontrados.' }, { status: 404 })
    }

    const { contact, campaign } = message
    const { template } = campaign

    // 1. Se a campanha estiver pausada, mantemos a mensagem como pendente no banco e retornamos 200 OK para liberar o QStash
    if (campaign.status === 'PAUSED') {
      console.log(`⏸️ Disparo via fila suspenso para o contato ${contact.phone} porque a campanha "${campaign.name}" está PAUSADA.`)
      return NextResponse.json({ success: true, paused: true, message: 'Campanha pausada. Disparo suspenso temporariamente.' })
    }

    // 2. Se a campanha ou a mensagem foi cancelada, cancelamos o disparo e garantimos que o status no banco é FAILED
    if (campaign.status === 'CANCELED' || message.metaMessageId?.startsWith('canceled_')) {
      console.log(`🛑 Disparo via fila cancelado para o contato ${contact.phone} porque a campanha "${campaign.name}" está CANCELADA.`)
      
      if (!message.metaMessageId?.startsWith('canceled_') || message.status !== 'FAILED') {
        await prisma.message.update({
          where: { id: message.id },
          data: {
            metaMessageId: `canceled_${campaign.id}_${contact.id}_${Date.now()}`,
            status: 'FAILED'
          }
        })
        await checkAndCompleteCampaign(campaign.id)
      }
      return NextResponse.json({ success: true, canceled: true, message: 'Campanha cancelada. Disparo ignorado.' })
    }

    try {
      const components = [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: contact.name },
            { type: 'text', text: 'ciprianoescola.com.br' }
          ]
        }
      ]

      const resTwilio = await TwilioWhatsAppService.sendTemplateMessage({
        to: contact.phone,
        templateName: template.name,
        languageCode: template.language,
        components
      })

      const metaMessageId = resTwilio.messages?.[0]?.id || `tpl_msg_${Math.random().toString(36).substring(2, 12)}`
      const isMock = !!resTwilio.mock

      await prisma.message.update({
        where: { id: message.id },
        data: {
          metaMessageId,
          status: isMock ? 'DELIVERED' : 'SENT'
        }
      })

      await checkAndCompleteCampaign(campaign.id)

      return NextResponse.json({ success: true, message: `Disparo efetuado com sucesso para ${contact.phone}` })
    } catch (err: any) {
      console.error(`❌ Falha no disparo via fila para ${contact.name} (${contact.phone}):`, err)

      await prisma.message.update({
        where: { id: message.id },
        data: {
          status: 'FAILED'
        }
      })

      await checkAndCompleteCampaign(campaign.id)

      // Identifica erros temporários que habilitam retry automático no QStash
      const isTemporaryError = 
        err.message?.includes('429') || 
        err.message?.includes('timeout') || 
        err.message?.includes('500')
      
      if (isTemporaryError) {
        return NextResponse.json({ error: 'Erro temporário de envio. Agendando retry no QStash.', details: err.message }, { status: 500 })
      }

      // Retorna 200 OK para erros definitivos (ex: 400 Bad Request, número inválido) para evitar retries desnecessários
      return NextResponse.json({ success: false, error: err.message || 'Erro no disparo da Meta API' })
    }
  } catch (error: any) {
    console.error('❌ Erro no processamento de fila:', error)
    return NextResponse.json({ error: 'Erro interno do servidor', details: error.message }, { status: 500 })
  }
}

async function checkAndCompleteCampaign(campaignId: string) {
  const messages = await prisma.message.findMany({
    where: { campaignId }
  })

  // Se não existem mais mensagens com ID temporário pendente
  const pendingCount = messages.filter(m => m.metaMessageId?.startsWith('pending_')).length

  if (pendingCount === 0) {
    const successCount = messages.filter(m => m.status === 'SENT' || m.status === 'DELIVERED' || m.status === 'READ').length
    const finalStatus = successCount > 0 ? 'COMPLETED' : 'FAILED'

    await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: finalStatus }
    })

    console.log(`🏁 Campanha ${campaignId} concluída via fila assíncrona! Status Final: ${finalStatus}`)
  }
}
