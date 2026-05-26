import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { TwilioWhatsAppService } from '@/lib/twilio-api'

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

// 2. DISPARAR UMA NOVA CAMPANHA (POST)
export async function POST(request: NextRequest) {
  try {
    const { name, templateId, targetTags } = await request.json()

    if (!name || !templateId || !targetTags || !Array.isArray(targetTags)) {
      return NextResponse.json({ error: 'Parâmetros obrigatórios ausentes ou inválidos.' }, { status: 400 })
    }

    // A) Valida o template no banco
    const template = await prisma.template.findUnique({
      where: { id: templateId }
    })

    if (!template) {
      return NextResponse.json({ error: 'Template não encontrado.' }, { status: 404 })
    }

    if (template.status !== 'APPROVED') {
      return NextResponse.json({ error: 'O template selecionado ainda não foi APROVADO pela Meta.' }, { status: 400 })
    }

    // B) Busca os contatos segmentados pelas tags informadas
    const contacts = await prisma.contact.findMany({
      where: {
        tags: {
          hasSome: targetTags // Busca contatos que possuem pelo menos uma das tags selecionadas
        }
      }
    })

    if (contacts.length === 0) {
      return NextResponse.json({ error: 'Nenhum contato encontrado com as tags especificadas.' }, { status: 400 })
    }

    // C) Cria o registro da campanha no status RUNNING
    const campaign = await prisma.campaign.create({
      data: {
        name,
        templateId,
        targetTags,
        status: 'RUNNING'
      }
    })

    console.log(`🚀 Motor de disparos iniciado para a campanha: ${name}. Alvos: ${contacts.length} contatos.`)

    // D) PROCESSAMENTO ASSÍNCRONO DOS DISPAROS (Fire-and-forget para não segurar a rota HTTP)
    // Usamos uma IIFE assíncrona para rodar os disparos em segundo plano
    ;(async () => {
      let successCount = 0
      let failCount = 0

      for (const contact of contacts) {
        try {
          // Substitui a primeira variável pelo nome do contato no template: {{1}} -> contact.name
          // O resto das variáveis preenchemos com links promocionais corporativos da Cipriano Escola de Negócios!
          const components = [
            {
              type: 'body',
              parameters: [
                {
                  type: 'text',
                  text: contact.name
                },
                {
                  type: 'text',
                  text: 'ciprianoescola.com.br' // URL promocional fixa
                }
              ]
            }
          ]

          // Faz a requisição de envio do template para o Twilio
          const resTwilio = await TwilioWhatsAppService.sendTemplateMessage({
            to: contact.phone,
            templateName: template.name,
            languageCode: template.language,
            components
          })

          const metaMessageId = resTwilio.messages?.[0]?.id || `tpl_msg_${Math.random().toString(36).substring(2, 12)}`
          const isMock = !!resTwilio.mock

          // Salva a mensagem gerada e atrela à campanha
          await prisma.message.create({
            data: {
              metaMessageId,
              contactId: contact.id,
              campaignId: campaign.id,
              direction: 'OUTBOUND',
              type: 'TEMPLATE',
              content: template.body.replace('{{1}}', contact.name).replace('{{2}}', 'ciprianoescola.com.br'),
              status: isMock ? 'DELIVERED' : 'SENT'
            }
          })

          successCount++
          
          // Pequeno delay entre mensagens (Rate limiting da Meta)
          await new Promise(resolve => setTimeout(resolve, 300))
        } catch (err) {
          console.error(`❌ Falha no disparo individual para ${contact.name} (${contact.phone}):`, err)
          failCount++
        }
      }

      // E) Atualiza o status final da campanha com base nos disparos
      const finalStatus = successCount > 0 ? 'COMPLETED' : 'FAILED'
      await prisma.campaign.update({
        where: { id: campaign.id },
        data: { status: finalStatus }
      })

      console.log(`🏁 Campanha ${name} concluída! Sucessos: ${successCount}, Falhas: ${failCount}. Status Final: ${finalStatus}`)
    })()

    return NextResponse.json({
      success: true,
      message: 'Campanha iniciada com sucesso. Os disparos estão sendo processados em lote.',
      campaignId: campaign.id,
      targetCount: contacts.length
    })
  } catch (error: any) {
    console.error('❌ Erro no POST de /api/campaigns:', error)
    return NextResponse.json({ error: 'Erro interno do servidor', details: error.message }, { status: 500 })
  }
}
