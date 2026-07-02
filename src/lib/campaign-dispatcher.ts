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
    console.log(`📡 dispatchCampaign: agendando ${pendingMessages.length} mensagens pendentes no Upstash QStash...`)
    
    const batchMessages = pendingMessages.map(msg => ({
      destination: `${currentDomain}/api/campaigns/process-queue`,
      body: JSON.stringify({ messageId: msg.id }),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${qstashToken}`
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

      console.log('✅ dispatchCampaign: todos os disparos pendentes agendados no QStash.')
    } catch (qstashErr) {
      console.error('❌ Falha crítica ao publicar no QStash. Fazendo fallback para processamento local...', qstashErr)
      startLocalBatchProcess(campaign.id, contacts, template, pendingMessages)
    }
  } else {
    console.log('⚠️ dispatchCampaign: QStash não configurado. Executando processamento local (IIFE)...')
    startLocalBatchProcess(campaign.id, contacts, template, pendingMessages)
  }
}

/**
 * Processamento local em chunks com delay e isolamento de try/catch por contato
 */
function startLocalBatchProcess(campaignId: string, contacts: any[], template: any, messages: any[]) {
  ;(async () => {
    let successCount = 0
    let failCount = 0

    const messageMap = new Map(messages.map(m => [m.contactId, m]))
    const batches = chunkArray(contacts, 5) // Lotes de 5 contatos por vez

    for (const batch of batches) {
      // Verifica o status da campanha antes de processar o lote atual
      const currentCampaign = await prisma.campaign.findUnique({
        where: { id: campaignId },
        select: { status: true }
      })

      if (!currentCampaign || currentCampaign.status === 'PAUSED' || currentCampaign.status === 'CANCELED') {
        console.log(`⏸️/🛑 Processamento local interrompido para a campanha ${campaignId}. Status atual: ${currentCampaign?.status}`)
        return
      }

      const results = await Promise.allSettled(
        batch.map(async (contact) => {
          const dbMsg = messageMap.get(contact.id)
          if (!dbMsg) return

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
              where: { id: dbMsg.id },
              data: {
                metaMessageId,
                status: isMock ? 'DELIVERED' : 'SENT'
              }
            })

            return true
          } catch (err) {
            console.error(`❌ Falha no disparo individual para ${contact.name} (${contact.phone}):`, err)
            
            await prisma.message.update({
              where: { id: dbMsg.id },
              data: { status: 'FAILED' }
            })

            throw err
          }
        })
      )

      results.forEach(res => {
        if (res.status === 'fulfilled' && res.value) {
          successCount++
        } else {
          failCount++
        }
      })

      await delay(1500) // Delay de 1.5s entre os lotes
    }

    // Só atualiza para concluído/falho se a campanha ainda estiver executando (RUNNING)
    const checkCamp = await prisma.campaign.findUnique({
      where: { id: campaignId },
      select: { status: true }
    })

    if (checkCamp && checkCamp.status === 'RUNNING') {
      // Se teve pelo menos um sucesso no total de mensagens disparadas
      const allMsgs = await prisma.message.findMany({
        where: { campaignId }
      })
      const successTotal = allMsgs.filter(m => m.status === 'SENT' || m.status === 'DELIVERED').length
      const finalStatus = successTotal > 0 ? 'COMPLETED' : 'FAILED'

      await prisma.campaign.update({
        where: { id: campaignId },
        data: { status: finalStatus }
      })

      console.log(`🏁 Campanha ${campaignId} concluída via processador local! Status Final: ${finalStatus}`)
    }
  })()
}
