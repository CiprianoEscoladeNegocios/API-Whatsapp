import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

// 1. LISTAGEM DE CONTATOS (GET)
// Retorna a lista de contatos ordenados pela data da última mensagem (estilo WhatsApp Web)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const withMessages = searchParams.get('withMessages') === 'true'

    if (!withMessages) {
      // Listagem simples (tabela de contatos)
      const contacts = await prisma.contact.findMany({
        orderBy: { createdAt: 'desc' }
      })
      return NextResponse.json(contacts)
    }

    // Listagem com a última mensagem agregada para a barra lateral do chat
    const contacts = await prisma.contact.findMany({
      include: {
        messages: {
          orderBy: { timestamp: 'desc' },
          take: 1
        }
      }
    })

    // Ordena os contatos de modo que quem enviou a última mensagem mais recente apareça primeiro
    const formattedContacts = contacts.map(contact => {
      const lastMessage = contact.messages[0] || null
      return {
        id: contact.id,
        name: contact.name,
        phone: contact.phone,
        tags: contact.tags,
        createdAt: contact.createdAt,
        lastMessage: lastMessage ? {
          content: lastMessage.content,
          timestamp: lastMessage.timestamp,
          direction: lastMessage.direction,
          status: lastMessage.status,
          type: lastMessage.type,
          reaction: lastMessage.reaction
        } : null
      }
    }).sort((a, b) => {
      const timeA = a.lastMessage ? new Date(a.lastMessage.timestamp).getTime() : 0
      const timeB = b.lastMessage ? new Date(b.lastMessage.timestamp).getTime() : 0
      return timeB - timeA
    })

    return NextResponse.json(formattedContacts)
  } catch (error: any) {
    console.error('❌ Erro no GET de /api/contacts:', error)
    return NextResponse.json({ error: 'Erro interno do servidor', details: error.message }, { status: 500 })
  }
}

// 2. CRIAÇÃO INDIVIDUAL OU IMPORTAÇÃO EM LOTE (POST)
export async function POST(request: NextRequest) {
  try {
    const payload = await request.json()

    // Caso A: Importação em lote (Array de contatos vindo do importador de CSV)
    if (Array.isArray(payload)) {
      const contactsCreated = []
      
      console.log(`📂 Iniciando importação em lote de ${payload.length} contatos...`)

      for (const item of payload) {
        const { name, phone, tags } = item

        if (!name || !phone) continue

        // Sanitiza o telefone
        const cleanPhone = phone.replace(/\D/g, '')
        if (cleanPhone.length < 10) continue // Ignora números inválidos

        const parsedTags = Array.isArray(tags) ? tags : (tags ? String(tags).split(',').map(t => t.trim()) : [])

        // Cria ou atualiza para evitar duplicidade de número de telefone
        const contact = await prisma.contact.upsert({
          where: { phone: cleanPhone },
          update: { name, tags: { set: parsedTags } },
          create: {
            name,
            phone: cleanPhone,
            tags: parsedTags
          }
        })
        contactsCreated.push(contact)
      }

      console.log(`✅ Importação em lote concluída com sucesso! ${contactsCreated.length} contatos sincronizados.`)
      return NextResponse.json({ success: true, count: contactsCreated.length, data: contactsCreated })
    }

    // Caso B: Criação de um único contato pelo formulário
    const { name, phone, tags } = payload

    if (!name || !phone) {
      return NextResponse.json({ error: 'Nome e telefone são obrigatórios' }, { status: 400 })
    }

    const cleanPhone = phone.replace(/\D/g, '')
    if (cleanPhone.length < 10) {
      return NextResponse.json({ error: 'Número de telefone inválido. Deve incluir DDI e DDD.' }, { status: 400 })
    }

    const parsedTags = Array.isArray(tags) ? tags : (tags ? String(tags).split(',').map(t => t.trim()) : [])

    const newContact = await prisma.contact.upsert({
      where: { phone: cleanPhone },
      update: { name, tags: { set: parsedTags } },
      create: {
        name,
        phone: cleanPhone,
        tags: parsedTags
      }
    })

    return NextResponse.json(newContact)
  } catch (error: any) {
    console.error('❌ Erro no POST de /api/contacts:', error)
    return NextResponse.json({ error: 'Erro interno do servidor', details: error.message }, { status: 500 })
  }
}

// 3. ATUALIZAÇÃO / EDIÇÃO DE CONTATO (PUT)
// Permite que operadores editem nome, telefone e tags de um contato comercial ativo
export async function PUT(request: NextRequest) {
  try {
    const payload = await request.json()
    const { id, name, phone, tags } = payload

    if (!id || !name || !phone) {
      return NextResponse.json({ error: 'ID, Nome e Telefone são obrigatórios para edição' }, { status: 400 })
    }

    const cleanPhone = phone.replace(/\D/g, '')
    if (cleanPhone.length < 10) {
      return NextResponse.json({ error: 'Número de telefone inválido. Deve incluir DDI e DDD.' }, { status: 400 })
    }

    const parsedTags = Array.isArray(tags) ? tags : (tags ? String(tags).split(',').map(t => t.trim()) : [])

    // Verifica se o novo número já é usado por outro contato
    const existingWithPhone = await prisma.contact.findFirst({
      where: {
        phone: cleanPhone,
        id: { not: id }
      }
    })

    if (existingWithPhone) {
      return NextResponse.json({ error: 'Este número de telefone já está sendo utilizado por outro contato' }, { status: 400 })
    }

    const updatedContact = await prisma.contact.update({
      where: { id },
      data: {
        name,
        phone: cleanPhone,
        tags: { set: parsedTags }
      }
    })

    console.log(`🔄 [API Contacts] Contato "${name}" (ID: ${id}) atualizado com sucesso! Novo número: ${cleanPhone}`)
    return NextResponse.json(updatedContact)
  } catch (error: any) {
    console.error('❌ Erro no PUT de /api/contacts:', error)
    return NextResponse.json({ error: 'Erro interno do servidor', details: error.message }, { status: 500 })
  }
}
