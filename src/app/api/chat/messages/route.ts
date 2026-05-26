import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const contactId = searchParams.get('contactId')

    if (!contactId) {
      return NextResponse.json({ error: 'Parâmetro contactId é obrigatório' }, { status: 400 })
    }

    // Retorna todo o histórico de mensagens daquele contato ordenadas cronologicamente
    const messages = await prisma.message.findMany({
      where: { contactId },
      orderBy: { timestamp: 'asc' }
    })

    return NextResponse.json(messages)
  } catch (error: any) {
    console.error('❌ Erro no GET de /api/chat/messages:', error)
    return NextResponse.json({ error: 'Erro interno do servidor', details: error.message }, { status: 500 })
  }
}
