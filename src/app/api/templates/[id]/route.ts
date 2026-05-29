import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

interface RouteParams {
  params: {
    id: string
  }
}

// 1. ATUALIZAR / EDITAR TEMPLATE (PATCH)
// Permite alterar o conteúdo do template ou atualizar o seu status (ex: para simular aprovação da Meta)
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = params
    const bodyData = await request.json()
    const { name, category, language, body, variables, status } = bodyData

    // Busca se o template existe
    const existingTemplate = await prisma.template.findUnique({
      where: { id }
    })

    if (!existingTemplate) {
      return NextResponse.json({ error: 'Template não encontrado.' }, { status: 404 })
    }

    // Prepara dados para atualização dinâmica
    const updateData: any = {}
    if (name !== undefined) {
      updateData.name = name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
    }
    if (category !== undefined) updateData.category = category
    if (language !== undefined) updateData.language = language
    if (body !== undefined) updateData.body = body
    if (variables !== undefined) updateData.variables = variables
    if (status !== undefined) updateData.status = status

    const updatedTemplate = await prisma.template.update({
      where: { id },
      data: updateData
    })

    console.log(`📝 Template ${updatedTemplate.name} atualizado com sucesso. Status: ${updatedTemplate.status}`)
    return NextResponse.json(updatedTemplate)
  } catch (error: any) {
    console.error('❌ Erro no PATCH de /api/templates/[id]:', error)
    
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Já existe um template cadastrado com este nome.' }, { status: 400 })
    }

    return NextResponse.json({ error: 'Erro interno do servidor', details: error.message }, { status: 500 })
  }
}

// 2. EXCLUIR TEMPLATE (DELETE)
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = params

    // Busca se o template existe
    const existingTemplate = await prisma.template.findUnique({
      where: { id }
    })

    if (!existingTemplate) {
      return NextResponse.json({ error: 'Template não encontrado.' }, { status: 404 })
    }

    await prisma.template.delete({
      where: { id }
    })

    console.log(`🗑️ Template ${existingTemplate.name} excluído do banco de dados com sucesso.`)
    return NextResponse.json({ success: true, message: 'Template excluído com sucesso.' })
  } catch (error: any) {
    console.error('❌ Erro no DELETE de /api/templates/[id]:', error)
    return NextResponse.json({ error: 'Erro interno do servidor', details: error.message }, { status: 500 })
  }
}
