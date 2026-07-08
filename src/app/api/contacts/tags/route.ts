import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const contacts = await prisma.contact.findMany({
      select: {
        tags: true
      }
    })

    // Coleta todas as tags e remove duplicadas
    const allTags = contacts.flatMap(c => c.tags || [])
    const uniqueTags = Array.from(new Set(allTags)).filter(Boolean)

    return NextResponse.json(uniqueTags)
  } catch (error: any) {
    console.error('❌ Erro no GET de /api/contacts/tags:', error)
    return NextResponse.json({ error: 'Erro interno do servidor', details: error.message }, { status: 500 })
  }
}
