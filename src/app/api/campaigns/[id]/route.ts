import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { dispatchCampaign } from '@/lib/campaign-dispatcher'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const campaignId = params.id

    if (!campaignId) {
      return NextResponse.json({ error: 'ID da campanha é obrigatório.' }, { status: 400 })
    }

    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: {
        template: true,
        messages: {
          include: {
            contact: true
          },
          orderBy: {
            contact: {
              name: 'asc'
            }
          }
        }
      }
    })

    if (!campaign) {
      return NextResponse.json({ error: 'Campanha não encontrada.' }, { status: 404 })
    }

    const messages = campaign.messages || []
    const total = messages.length
    const sent = messages.filter(m => m.status === 'SENT' && !m.metaMessageId?.startsWith('pending_')).length
    const delivered = messages.filter(m => m.status === 'DELIVERED').length
    const read = messages.filter(m => m.status === 'READ').length
    const failed = messages.filter(m => m.status === 'FAILED').length

    return NextResponse.json({
      id: campaign.id,
      name: campaign.name,
      templateName: campaign.template.name,
      status: campaign.status,
      createdAt: campaign.createdAt,
      targetTags: campaign.targetTags,
      stats: {
        total,
        sent,
        delivered,
        read,
        failed
      },
      messages: messages.map(msg => ({
        id: msg.id,
        status: msg.status,
        timestamp: msg.timestamp,
        content: msg.content,
        contact: {
          id: msg.contact?.id || '',
          name: msg.contact?.name || 'Contato Excluído',
          phone: msg.contact?.phone || ''
        }
      }))
    })
  } catch (error: any) {
    console.error('❌ Erro no GET de /api/campaigns/[id]:', error)
    return NextResponse.json({ error: 'Erro interno do servidor', details: error.message }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const campaignId = params.id
    const { status } = await request.json()

    if (!campaignId || !status) {
      return NextResponse.json({ error: 'ID e status são parâmetros obrigatórios.' }, { status: 400 })
    }

    // Valida se o status é um dos permitidos para ação manual do operador
    const validStatuses = ['RUNNING', 'PAUSED', 'CANCELED']
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Status informado é inválido. Permissões: RUNNING, PAUSED, CANCELED.' }, { status: 400 })
    }

    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId }
    })

    if (!campaign) {
      return NextResponse.json({ error: 'Campanha não encontrada.' }, { status: 404 })
    }

    // Ações baseadas no novo status desejado
    if (status === 'PAUSED') {
      // 1. PAUSAR: Apenas atualiza o status no banco. O processador local e a fila irão parar no próximo envio.
      await prisma.campaign.update({
        where: { id: campaignId },
        data: { status: 'PAUSED' }
      })
      console.log(`⏸️ Campanha "${campaign.name}" (ID: ${campaignId}) foi PAUSADA pelo operador.`)
    } else if (status === 'CANCELED') {
      // 2. CANCELAR: Atualiza o status e marca todas as mensagens ainda pendentes como FAILED
      await prisma.campaign.update({
        where: { id: campaignId },
        data: { status: 'CANCELED' }
      })

      // Busca mensagens pendentes (com metaMessageId iniciando com 'pending_')
      const pendingMessages = await prisma.message.findMany({
        where: {
          campaignId,
          metaMessageId: { startsWith: 'pending_' }
        }
      })

      // Marca todas as remanescentes como FAILED para que não sejam disparadas
      for (const msg of pendingMessages) {
        await prisma.message.update({
          where: { id: msg.id },
          data: {
            metaMessageId: `canceled_${campaignId}_${msg.contactId}_${Date.now()}`,
            status: 'FAILED'
          }
        })
      }

      console.log(`🛑 Campanha "${campaign.name}" (ID: ${campaignId}) foi CANCELADA. ${pendingMessages.length} mensagens canceladas.`)
    } else if (status === 'RUNNING') {
      // 3. RETOMAR (START): Atualiza o status para RUNNING e dispara o dispatcher assíncrono
      await prisma.campaign.update({
        where: { id: campaignId },
        data: { status: 'RUNNING' }
      })

      console.log(`▶️ Campanha "${campaign.name}" (ID: ${campaignId}) foi RETOMADA (RUNNING).`)

      // Dispara o dispatcher para processar as mensagens pendentes
      // Se o QStash não estiver configurado, damos await para garantir a execução síncrona na Vercel
      const qstashConfigured = !!(process.env.QSTASH_TOKEN && process.env.QSTASH_URL)
      if (!qstashConfigured) {
        console.log('⚡ QStash não configurado. Aguardando execução síncrona ao retomar campanha para evitar congelamento na Vercel.')
        await dispatchCampaign(campaignId)
      } else {
        dispatchCampaign(campaignId).catch(err => {
          console.error(`❌ Erro no dispatchCampaign ao retomar campanha ${campaignId}:`, err)
        })
      }
    }

    return NextResponse.json({ success: true, message: `Status da campanha atualizado para ${status}` })
  } catch (error: any) {
    console.error('❌ Erro no PATCH de /api/campaigns/[id]:', error)
    return NextResponse.json({ error: 'Erro interno do servidor', details: error.message }, { status: 500 })
  }
}
