import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { dispatchCampaign } from '@/lib/campaign-dispatcher'

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
      const sent = messages.filter(m => m.status === 'SENT' && !m.metaMessageId?.startsWith('pending_')).length
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

export async function POST(request: NextRequest) {
  try {
    const { name, templateId, targetTags, selectedContactIds } = await request.json()

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

    // Busca apenas os contatos selecionados ou, se não informado, todos das tags selecionadas
    let contacts = []
    if (selectedContactIds && selectedContactIds.length > 0) {
      contacts = await prisma.contact.findMany({
        where: {
          id: {
            in: selectedContactIds
          },
          active: true
        }
      })
    } else {
      contacts = await prisma.contact.findMany({
        where: {
          active: true,
          tags: {
            hasSome: targetTags
          }
        }
      })
    }

    if (contacts.length === 0) {
      return NextResponse.json({ error: 'Nenhum contato selecionado ou encontrado para o disparo.' }, { status: 400 })
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

    // B) DESPACHO: O dispatcher assume o controle do envio
    // Se o QStash não estiver configurado, damos await para garantir a execução síncrona na Vercel
    const qstashConfigured = !!(process.env.QSTASH_TOKEN && process.env.QSTASH_URL)
    if (!qstashConfigured) {
      console.log('⚡ QStash não configurado. Aguardando execução síncrona do lote para evitar congelamento na Vercel.')
      await dispatchCampaign(campaign.id)
    } else {
      dispatchCampaign(campaign.id).catch(err => {
        console.error(`❌ Erro crítico no dispatchCampaign assíncrono para a campanha ${campaign.id}:`, err)
      })
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
