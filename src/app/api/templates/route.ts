import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

// 1. LISTAR TEMPLATES (GET)
export async function GET(request: NextRequest) {
  try {
    const templates = await prisma.template.findMany({
      orderBy: { createdAt: 'desc' }
    })
    return NextResponse.json(templates)
  } catch (error: any) {
    console.error('❌ Erro no GET de /api/templates:', error)
    return NextResponse.json({ error: 'Erro interno do servidor', details: error.message }, { status: 500 })
  }
}

// 2. CRIAR E ENVIAR PARA APROVAÇÃO SIMULADA DA META (POST)
export async function POST(request: NextRequest) {
  try {
    const { name, category, language, body, variables, metaTemplateId } = await request.json()

    if (!name || !category || !language || !body) {
      return NextResponse.json({ error: 'Campos obrigatórios ausentes' }, { status: 400 })
    }

    // Sanitiza o nome do template: a Meta exige letras minúsculas e underscores (ex: "boas_vindas_vip")
    const cleanName = name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')

    let finalMetaTemplateId = metaTemplateId || null
    let initialStatus = metaTemplateId ? 'APPROVED' : 'PENDING'

    // Tenta sincronizar programaticamente com o Content Template Builder da Twilio se as chaves reais estiverem ativas e não foi informado o HX manual
    if (!finalMetaTemplateId) {
      const accountSid = process.env.TWILIO_ACCOUNT_SID
      const authToken = process.env.TWILIO_AUTH_TOKEN
      const isConfigured = 
        accountSid && 
        accountSid !== 'seu_account_sid_aqui' && 
        authToken && 
        authToken !== 'seu_auth_token_aqui'

      if (isConfigured) {
        try {
          console.log(`📡 [Twilio Content API] Cadastrando novo template programático "${cleanName}" na Twilio...`)
          
          // Converte o array de variáveis da Cipriano ["nome", "curso"] para o formato {"1": "nome", "2": "curso"}
          const twilioVariables: Record<string, string> = {}
          const varsArray = variables || []
          varsArray.forEach((vName: string, idx: number) => {
            twilioVariables[String(idx + 1)] = vName
          })

          const twilioResponse = await fetch('https://content.twilio.com/v1/Content', {
            method: 'POST',
            headers: {
              'Authorization': 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              friendly_name: cleanName,
              language: language.split('_')[0], // a Twilio usa ISO de 2 letras (ex: 'pt')
              variables: twilioVariables,
              types: {
                'twilio/text': {
                  body: body
                }
              }
            })
          })

          if (twilioResponse.ok) {
            const twilioData = await twilioResponse.json()
            finalMetaTemplateId = twilioData.sid // O Content SID começará com "HX..."
            initialStatus = 'APPROVED' // Já entra como aprovado
            console.log(`🌟 [Twilio Content API] Template cadastrado com pleno sucesso! SID gerado: ${finalMetaTemplateId}`)
          } else {
            const twilioErr = await twilioResponse.text()
            console.warn('⚠️ [Twilio Content API] Erro ao cadastrar template automaticamente:', twilioErr)
          }
        } catch (twilioErr: any) {
          console.error('⚠️ [Twilio Content API] Falha crítica de conexão:', twilioErr.message)
        }
      }
    }

    // Se ainda estiver nulo (Mock Mode / erro de criacao externa), gera um id simulado para a Meta
    if (!finalMetaTemplateId) {
      finalMetaTemplateId = `meta_tpl_${Math.random().toString(36).substring(2, 10)}`
    }

    // Salva o template com status inicial no banco
    const newTemplate = await prisma.template.create({
      data: {
        name: cleanName,
        category,
        language,
        body,
        variables: variables || [],
        status: initialStatus as any,
        metaTemplateId: finalMetaTemplateId
      }
    })

    console.log(`📝 Template ${cleanName} criado. ID: ${newTemplate.id}, MetaTemplateID/SID: ${finalMetaTemplateId}, Status: ${initialStatus}`)

    // Se estiver em modo simulado PENDING, mantém o temporizador local de contingência
    if (initialStatus === 'PENDING') {
      setTimeout(async () => {
        try {
          await prisma.template.update({
            where: { id: newTemplate.id },
            data: { status: 'APPROVED' }
          })
          console.log(`🌟 SIMULAÇÃO META: Template ${cleanName} foi APROVADO com sucesso!`)
        } catch (err) {
          console.error('Erro na simulação de aprovação de template:', err)
        }
      }, 10000)
    }

    return NextResponse.json(newTemplate)
  } catch (error: any) {
    console.error('❌ Erro no POST de /api/templates:', error)
    
    // Tratamento amigável para nomes duplicados no banco
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Já existe um template cadastrado com este nome.' }, { status: 400 })
    }
    
    return NextResponse.json({ error: 'Erro interno do servidor', details: error.message }, { status: 500 })
  }
}
