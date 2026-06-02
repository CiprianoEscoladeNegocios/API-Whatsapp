import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { pusherServer } from '@/lib/pusher'

export async function POST(request: NextRequest) {
  try {
    const { messageId, reaction } = await request.json()

    if (!messageId) {
      return NextResponse.json({ error: 'Parâmetro messageId é obrigatório' }, { status: 400 })
    }

    // 1. Busca a mensagem no banco para verificar existência e recuperar o contactId
    const message = await prisma.message.findUnique({
      where: { id: messageId }
    })

    if (!message) {
      return NextResponse.json({ error: 'Mensagem não encontrada' }, { status: 404 })
    }

    // 2. Atualiza a reação no banco (pode ser um emoji string ou null para remover)
    const updatedMessage = await prisma.message.update({
      where: { id: messageId },
      data: { reaction: reaction || null }
    })

    console.log(`✨ Reação atualizada na mensagem ${messageId}: "${reaction || 'Removida'}"`)

    // 3. Notifica em tempo real via Pusher
    try {
      await pusherServer.trigger(`chat-${message.contactId}`, 'message-reaction-updated', {
        messageId: message.id,
        reaction: updatedMessage.reaction
      })
    } catch (pusherErr: any) {
      console.warn('⚠️ [Pusher Warning] Falha ao enviar evento de reação via Pusher:', pusherErr.message)
    }

    return NextResponse.json(updatedMessage)
  } catch (error: any) {
    console.error('❌ Erro no POST de /api/chat/react:', error)
    return NextResponse.json({ error: 'Erro interno do servidor', details: error.message }, { status: 500 })
  }
}
