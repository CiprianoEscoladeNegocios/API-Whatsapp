import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { TwilioWhatsAppService } from '@/lib/twilio-api'
import { chunkArray, delay } from '@/lib/batch-utils'

// 1. LISTAR CAMPANHAS COM ESTATÍSTICAS (GET)
// Retorna a lista de campanhas agregando estatísticas reais de status de entrega de mensagens
export async function GET(request: NextRequest) {
  try {
    const campaigns = await prisma.campaign.findMany({
      include: {
        template: true,
        messages: true
      },
      orderBy: { createdAt: 'desc' }
    })

    // Formata o retorno calculando as métricas dinâmicas com base nas mensagens geradas
    const formattedCampaigns = campaigns.map(camp => {
      const messages = camp.messages || []
      const total = messages.length
      const sent = messages.filter(m => m.status === 'SENT').length
      const delivered = messages.filter(m => m.status === 'DELIVERED').length
      const read = messages.filter(m => m.status === 'READ').length
      const failed = messages.filter(m => m.status === 'FAILED').length

      return {
        id: camp.id,
        name: camp.name,
        templateName: camp.template.name,
        status: camp.status,
        createdAt: camp.createdAt,
        targetTags: camp.targetTags,
        stats: {
          total,
          sent,
          delivered,
          read,
          failed
        }
      }
    })

    return NextResponse.json(formattedCampaigns)
  } catch (error: any) {
    console.error('❌ Erro no GET de /api/campaigns:', error)
    return NextResponse.json({ error: 'Erro interno do servidor', details: error.message }, { status: 500 })
  }
}

// 2. DISPARAR UMA NOVA CAMPANHA (POST) - Refatorado com suporte a Chunking, Throttling e QStash
export async function POST(request: NextRequest) {
  try {
    const { name, templateId, targetTags } = await request.json()

    if (!name || !templateId || !targetTags || !Array.isArray(targetTags)) {
      return NextResponse.json({ error: 'Parâmetros obrigatórios ausentes ou inválidos.' }, { status: 400 })
    }

    const template = await prisma.template.findUnique({
      where: { id: templateId }
    })

    if (!template) {
      return NextResponse.json({ error: 'Template não encontrado.' }, { status: 404 })
    }

    if (template.status !== 'APPROVED') {
      return NextResponse.json({ error: 'O template selecionado ainda não foi APROVADO pela Meta.' }, { status: 400 })
    }

    const contacts = await prisma.contact.findMany({
      where: {
        tags: {
          hasSome: targetTags
        }
      }
    })

    if (contacts.length === 0) {
      return NextResponse.json({ error: 'Nenhum contato encontrado com as tags especificadas.' }, { status: 400 })
    }

    const campaign = await prisma.campaign.create({
      data: {
        name,
        templateId,
        targetTags,
        status: 'RUNNING'
      }
    })

    console.log(`🚀 Motor de disparos iniciado para a campanha: ${name}. Alvos: ${contacts.length} contatos.`)

    // A) PRÉ-CRIAÇÃO DAS MENSAGENS: Garante que o frontend saiba exatamente o total de alvos e renderize o progresso de 0 a 100%
    const messageData = contacts.map(contact => ({
      metaMessageId: `pending_${campaign.id}_${contact.id}_${Date.now()}`,
      contactId: contact.id,
      campaignId: campaign.id,
      direction: 'OUTBOUND' as const,
      type: 'TEMPLATE' as const,
      content: template.body.replace('{{1}}', contact.name).replace('{{2}}', 'ciprianoescola.com.br'),
      status: 'SENT' as const
    }))

    await prisma.message.createMany({
      data: messageData
    })

    // B) ESTRATÉGIA DE ENVIO: Prioriza Upstash QStash se configurado, caso contrário usa o loop local otimizado
    const qstashToken = process.env.QSTASH_TOKEN
    const qstashUrl = process.env.QSTASH_URL
    const currentDomain = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    if (qstashToken && qstashUrl) {
      console.log(`📡 Upstash QStash configurado. Delegando ${contacts.length} disparos para a fila assíncrona...`)
      
      const createdMessages = await prisma.message.findMany({
        where: { campaignId: campaign.id },
        select: { id: true }
      })

      const batchMessages = createdMessages.map(msg => ({
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

        console.log('✅ Todos os disparos agendados no Upstash QStash com sucesso.')
      } catch (qstashErr) {
        console.error('❌ Falha crítica ao publicar no QStash. Fazendo fallback para processamento local...', qstashErr)
        startLocalBatchProcess(campaign.id, contacts, template, createdMessages)
      }
    } else {
      console.log('⚠️ QStash não configurado no .env. Executando processamento local (IIFE)...')
      
      const createdMessages = await prisma.message.findMany({
        where: { campaignId: campaign.id }
      })

      startLocalBatchProcess(campaign.id, contacts, template, createdMessages)
    }

    return NextResponse.json({
      success: true,
      message: 'Campanha iniciada com sucesso. Os disparos estão sendo processados.',
      campaignId: campaign.id,
      targetCount: contacts.length
    })
  } catch (error: any) {
    console.error('❌ Erro no POST de /api/campaigns:', error)
    return NextResponse.json({ error: 'Erro interno do servidor', details: error.message }, { status: 500 })
  }
}

// Processamento local em chunks com delay e isolamento de try/catch por contato
function startLocalBatchProcess(campaignId: string, contacts: any[], template: any, messages: any[]) {
  ;(async () => {
    let successCount = 0
    let failCount = 0

    const messageMap = new Map(messages.map(m => [m.contactId, m]))
    const batches = chunkArray(contacts, 5) // Lotes de 5 contatos por vez

    for (const batch of batches) {
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

      await delay(1500) // Delay de 1.5s entre os lotes para evitar bloqueios da API Meta
    }

    const finalStatus = successCount > 0 ? 'COMPLETED' : 'FAILED'
    await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: finalStatus }
    })

    console.log(`🏁 Campanha ${campaignId} concluída via processador local! Sucessos: ${successCount}, Falhas: ${failCount}. Status Final: ${finalStatus}`)
  })()
}
