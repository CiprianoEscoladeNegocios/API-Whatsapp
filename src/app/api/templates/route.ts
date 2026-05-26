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
    const { name, category, language, body, variables } = await request.json()

    if (!name || !category || !language || !body) {
      return NextResponse.json({ error: 'Campos obrigatórios ausentes' }, { status: 400 })
    }

    // Sanitiza o nome do template: a Meta exige letras minúsculas e underscores (ex: "boas_vindas_vip")
    const cleanName = name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')

    // Salva o template com status inicial PENDING (Simulando o envio para a Meta)
    const newTemplate = await prisma.template.create({
      data: {
        name: cleanName,
        category,
        language,
        body,
        variables: variables || [],
        status: 'PENDING',
        metaTemplateId: `meta_tpl_${Math.random().toString(36).substring(2, 10)}`
      }
    })

    console.log(`📝 Template ${cleanName} criado e enviado para análise da Meta. ID: ${newTemplate.id}`)

    // SIMULAÇÃO DO FLUXO DE APROVAÇÃO DA META
    // Em 10 segundos o template será aprovado automaticamente no banco de dados
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
