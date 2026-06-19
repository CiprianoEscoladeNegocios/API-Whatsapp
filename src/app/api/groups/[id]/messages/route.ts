import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { pusherServer } from '@/lib/pusher'

export const dynamic = 'force-dynamic'

/**
 * API de Mensagens de Grupos Virtuais (/api/groups/[id]/messages)
 * Cipriano Escola de Negócios
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const messages = await prisma.virtualGroupMessage.findMany({
      where: { groupId: params.id },
      orderBy: { timestamp: 'asc' }
    })
    return NextResponse.json(messages)
  } catch (error: any) {
    console.error(`❌ [API GET Group Messages ${params.id} Error]:`, error)
    return NextResponse.json({ error: 'Erro ao buscar mensagens do grupo', details: error.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { senderId, senderName, senderType, content, type = 'TEXT' } = await request.json()

    if (!senderId || !senderName || !senderType || !content) {
      return NextResponse.json({ error: 'Parâmetros inválidos' }, { status: 400 })
    }

    // Busca o grupo e os membros
    const group = await prisma.virtualGroup.findUnique({
      where: { id: params.id },
      include: { members: true }
    })

    if (!group) {
      return NextResponse.json({ error: 'Grupo não encontrado' }, { status: 404 })
    }

    // Se o grupo for restrito, somente administradores podem postar
    if (group.onlyAdminsCanMessage) {
      const isSenderAdmin = group.members.some(m => 
        (senderType === 'OPERATOR' && m.userId === senderId && m.isAdmin) ||
        (senderType === 'CONTACT' && m.contactId === senderId && m.isAdmin)
      )

      if (!isSenderAdmin) {
        return NextResponse.json({ 
          error: 'Moderação ativa: Apenas administradores do grupo podem enviar mensagens.' 
        }, { status: 403 })
      }
    }

    // Salva a mensagem no banco
    const groupMessage = await prisma.virtualGroupMessage.create({
      data: {
        groupId: params.id,
        senderId,
        senderName,
        senderType,
        type,
        content
      }
    })

    // Dispara via Pusher em tempo real para os membros que estão na sala
    try {
      await pusherServer.trigger(`group-chat-${params.id}`, 'new-group-message', {
        id: groupMessage.id,
        groupId: groupMessage.groupId,
        senderId: groupMessage.senderId,
        senderName: groupMessage.senderName,
        senderType: groupMessage.senderType,
        type: groupMessage.type,
        content: groupMessage.content,
        timestamp: groupMessage.timestamp
      })
    } catch (pusherError: any) {
      console.warn('⚠️ [Pusher Warning] Falha ao notificar membros do grupo via Pusher:', pusherError.message)
    }

    return NextResponse.json(groupMessage)
  } catch (error: any) {
    console.error(`❌ [API POST Group Messages ${params.id} Error]:`, error)
    return NextResponse.json({ error: 'Erro ao enviar mensagem no grupo', details: error.message }, { status: 500 })
  }
}
