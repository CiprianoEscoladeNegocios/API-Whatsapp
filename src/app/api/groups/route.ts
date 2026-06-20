import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * API de Grupos Virtuais - Listagem e Criação
 * Cipriano Escola de Negócios
 */
export async function GET() {
  try {
    const groups = await prisma.virtualGroup.findMany({
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
      },
      orderBy: { createdAt: 'desc' }
    })
    return NextResponse.json(groups)
  } catch (error: any) {
    console.error('❌ [API GET Groups Error]:', error)
    return NextResponse.json({ error: 'Erro ao buscar grupos', details: error.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { name, description, avatarUrl, onlyAdminsCanMessage, welcomeMessage, welcomeTemplateId, operatorId } = await request.json()
    if (!name) {
      return NextResponse.json({ error: 'O nome do grupo é obrigatório' }, { status: 400 })
    }

    // Cria o grupo virtual
    const group = await prisma.virtualGroup.create({
      data: {
        name,
        description,
        avatarUrl: avatarUrl || null,
        onlyAdminsCanMessage: !!onlyAdminsCanMessage,
        welcomeMessage: welcomeMessage || null,
        welcomeTemplateId: welcomeTemplateId || null
      }
    })

    // Adiciona o operador criador como admin se informado
    if (operatorId) {
      await prisma.virtualGroupMember.create({
        data: {
          groupId: group.id,
          userId: operatorId,
          isAdmin: true
        }
      })
    }

    return NextResponse.json(group)
  } catch (error: any) {
    console.error('❌ [API POST Groups Error]:', error)
    return NextResponse.json({ error: 'Erro ao criar grupo', details: error.message }, { status: 500 })
  }
}
