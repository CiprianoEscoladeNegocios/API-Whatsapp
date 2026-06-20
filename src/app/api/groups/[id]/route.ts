import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * API de Gerenciamento de Grupo Individual (/api/groups/[id])
 * Cipriano Escola de Negócios
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const group = await prisma.virtualGroup.findUnique({
      where: { id: params.id },
      include: {
        welcomeTemplate: true,
        members: {
          include: {
            contact: true,
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true
              }
            }
          }
        }
      }
    })

    if (!group) {
      return NextResponse.json({ error: 'Grupo não encontrado' }, { status: 404 })
    }

    return NextResponse.json(group)
  } catch (error: any) {
    console.error(`❌ [API GET Group ${params.id} Error]:`, error)
    return NextResponse.json({ error: 'Erro ao buscar grupo', details: error.message }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { name, description, avatarUrl, onlyAdminsCanMessage, welcomeMessage, welcomeTemplateId } = await request.json()

    if (!name) {
      return NextResponse.json({ error: 'O nome do grupo é obrigatório' }, { status: 400 })
    }

    const group = await prisma.virtualGroup.update({
      where: { id: params.id },
      data: {
        name,
        description: description || null,
        avatarUrl: avatarUrl || null,
        onlyAdminsCanMessage: !!onlyAdminsCanMessage,
        welcomeMessage: welcomeMessage || null,
        welcomeTemplateId: welcomeTemplateId || null
      }
    })

    return NextResponse.json(group)
  } catch (error: any) {
    console.error(`❌ [API PUT Group ${params.id} Error]:`, error)
    return NextResponse.json({ error: 'Erro ao atualizar grupo', details: error.message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await prisma.virtualGroup.delete({
      where: { id: params.id }
    })
    return NextResponse.json({ success: true, message: 'Grupo excluído com sucesso' })
  } catch (error: any) {
    console.error(`❌ [API DELETE Group ${params.id} Error]:`, error)
    return NextResponse.json({ error: 'Erro ao excluir grupo', details: error.message }, { status: 500 })
  }
}
