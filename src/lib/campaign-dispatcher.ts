import prisma from '@/lib/prisma'
import { TwilioWhatsAppService } from '@/lib/twilio-api'
import { chunkArray, delay } from '@/lib/batch-utils'

/**
 * Centraliza o envio das mensagens pendentes de uma campanha.
 * Suporta o agendamento em lote no QStash ou o fallback local em chunks.
 */
export async function dispatchCampaign(campaignId: string) {
  // Busca a campanha e seu template associado
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: { template: true }
  })

  if (!campaign) {
    throw new Error('Campanha não encontrada')
  }

  // Busca APENAS as mensagens da campanha que continuam pendentes (metaMessageId iniciando com 'pending_')
  const pendingMessages = await prisma.message.findMany({
    where: {
      campaignId: campaign.id,
      metaMessageId: { startsWith: 'pending_' }
    },
    include: {
      contact: true
    }
  })

  if (pendingMessages.length === 0) {
    console.log(`ℹ️ dispatchCampaign: Nenhuma mensagem pendente encontrada para a campanha ${campaignId}.`)
    return
  }

  const template = campaign.template
  const contacts = pendingMessages.map(m => m.contact)

  // Configuração do Upstash QStash
  const qstashToken = process.env.QSTASH_TOKEN
  const qstashUrl = process.env.QSTASH_URL
  const currentDomain = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  if (qstashToken && qstashUrl) {
    console.log(`📡 dispatchCampaign: agendando ${pendingMessages.length} mensagens pendentes no Upstash QStash com rate-limiting...`)
    
    // Adicionamos 'Upstash-Delay' incremental para aplicar espaçamento de 1 segundo (rate limit de 1 msg/s)
    const batchMessages = pendingMessages.map((msg, idx) => ({
      destination: `${currentDomain}/api/campaigns/process-queue`,
      body: JSON.stringify({ messageId: msg.id }),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${qstashToken}`,
        'Upstash-Delay': `${idx * 1}s`
      }
    }))

    try {
      const qstashBatchResponse = await fetch(`${qstashUrl}/v2/batch`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${qstashToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(batchMessages)
      })

      if (!qstashBatchResponse.ok) {
        throw new Error(`Falha ao registrar lote no QStash: ${await qstashBatchResponse.text()}`)
      }

      console.log('✅ dispatchCampaign: todos os disparos pendentes agendados no QStash com controle de vazão.')
    } catch (qstashErr) {
      console.error('❌ Falha crítica ao publicar no QStash. Fazendo fallback para processamento local...', qstashErr)
      startLocalBatchProcess(campaign.id, contacts, template, pendingMessages)
    }
  } else {
    console.log('⚠️ dispatchCampaign: QStash não configurado. Executando processamento local sequencial com delay de 1s (IIFE)...')
    startLocalBatchProcess(campaign.id, contacts, template, pendingMessages)
  }
}

/**
 * Processamento local sequencial com controle de vazão estrito (rate limit de 1 msg/s)
 * e tratamento de retries local
 */
function startLocalBatchProcess(campaignId: string, contacts: any[], template: any, messages: any[]) {
  ;(async () => {
    let successCount = 0
    let failCount = 0

    const messageMap = new Map(messages.map(m => [m.contactId, m]))

    for (const contact of contacts) {
      // Verifica o status da campanha antes de processar cada contato
      const currentCampaign = await prisma.campaign.findUnique({
        where: { id: campaignId },
        select: { status: true }
      })

      if (!currentCampaign || currentCampaign.status === 'PAUSED' || currentCampaign.status === 'CANCELED') {
        console.log(`⏸️/🛑 Processamento local interrompido para a campanha ${campaignId}. Status atual: ${currentCampaign?.status}`)
        return
      }

      const dbMsg = messageMap.get(contact.id)
      if (!dbMsg) continue

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

        // Executa o disparo com suporte a retry com backoff exponencial se houver falhas temporárias
        const { retryWithBackoff } = await import('./twilio-webhook-processor')
        const resTwilio = await retryWithBackoff(async () => {
          return await TwilioWhatsAppService.sendTemplateMessage({
            to: contact.phone,
            templateName: template.name,
            languageCode: template.language,
            components
          })
        }, 3, 1000)

        const metaMessageId = resTwilio.messages?.[0]?.id || `tpl_msg_${Math.random().toString(36).substring(2, 12)}`
        const isMock = !!resTwilio.mock

        await prisma.message.update({
          where: { id: dbMsg.id },
          data: {
            metaMessageId,
            status: isMock ? 'DELIVERED' : 'SENT'
          }
        })

        successCount++
      } catch (err) {
        console.error(`❌ Falha definitiva no disparo individual para ${contact.name} (${contact.phone}) após retries:`, err)
        
        await prisma.message.update({
          where: { id: dbMsg.id },
          data: { status: 'FAILED' }
        })

        failCount++
      }

      // Delay estrito de 1.0s para respeitar a taxa limite (rate limiting de 1 msg/s)
      await delay(1000)
    }

    // Só atualiza para concluído/falho se a campanha ainda estiver executando (RUNNING)
    const checkCamp = await prisma.campaign.findUnique({
      where: { id: campaignId },
      select: { status: true }
    })

    if (checkCamp && checkCamp.status === 'RUNNING') {
      const allMsgs = await prisma.message.findMany({
        where: { campaignId }
      })
      const successTotal = allMsgs.filter(m => m.status === 'SENT' || m.status === 'DELIVERED' || m.status === 'READ').length
      const finalStatus = successTotal > 0 ? 'COMPLETED' : 'FAILED'

      await prisma.campaign.update({
        where: { id: campaignId },
        data: { status: finalStatus }
      })

      console.log(`🏁 Campanha ${campaignId} concluída via processador local! Status Final: ${finalStatus}`)
    }
  })()
}
