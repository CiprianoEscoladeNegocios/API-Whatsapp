import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * API de Moderação de Administradores (/api/groups/[id]/members/admin)
 * Cipriano Escola de Negócios
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { memberId, isAdmin } = await request.json()

    if (!memberId) {
      return NextResponse.json({ error: 'memberId é obrigatório' }, { status: 400 })
    }

    // Atualiza o privilégio de admin do membro
    const member = await prisma.virtualGroupMember.update({
      where: {
        id: memberId,
        groupId: params.id
      },
      data: {
        isAdmin: !!isAdmin
      }
    })

    return NextResponse.json(member)
  } catch (error: any) {
    console.error(`❌ [API POST Group Admin MOD ${params.id} Error]:`, error)
    return NextResponse.json({ error: 'Erro ao gerenciar moderação de administrador', details: error.message }, { status: 500 })
  }
}
