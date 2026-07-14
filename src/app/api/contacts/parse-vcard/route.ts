import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { findContactByPhone } from '@/lib/phone'

export const dynamic = 'force-dynamic'

/**
 * Decodifica texto codificado em Quoted-Printable (padrão de caracteres especiais do vCard)
 */
function decodeQuotedPrintable(text: string): string {
  const bytes: number[] = []
  let i = 0
  while (i < text.length) {
    if (text[i] === '=' && i + 2 < text.length && /^[0-9A-F]{2}$/i.test(text.substring(i + 1, i + 3))) {
      bytes.push(parseInt(text.substring(i + 1, i + 3), 16))
      i += 3
    } else {
      bytes.push(text.charCodeAt(i))
      i++
    }
  }
  return Buffer.from(bytes).toString('utf-8')
}

/**
 * Analisa a string do vCard (.vcf) e extrai o nome formatado e o telefone celular.
 */
function parseVcard(vcardText: string): { name: string; phone: string } | null {
  if (!vcardText.includes('BEGIN:VCARD')) {
    return null
  }
  
  let name = ''
  
  // 1. Extração do Nome (FN) com ou sem parâmetros adicionais (ex: FN;CHARSET=UTF-8;ENCODING=QUOTED-PRINTABLE)
  const fnMatch = vcardText.match(/^FN(?:;([^:]*))?:(.*)$/im)
  if (fnMatch && fnMatch[2]) {
    const params = fnMatch[1] || ''
    let value = fnMatch[2].trim()
    if (params.toUpperCase().includes('ENCODING=QUOTED-PRINTABLE')) {
      value = decodeQuotedPrintable(value)
    }
    name = value
  } else {
    // Fallback: Tenta obter pelo campo N (Name) estruturado: Sobrenome;Nome;...
    const nMatch = vcardText.match(/^N(?:;([^:]*))?:([^;]*);([^;]*)/im)
    if (nMatch) {
      const params = nMatch[1] || ''
      let lastName = nMatch[2] ? nMatch[2].trim() : ''
      let firstName = nMatch[3] ? nMatch[3].trim() : ''
      
      if (params.toUpperCase().includes('ENCODING=QUOTED-PRINTABLE')) {
        lastName = decodeQuotedPrintable(lastName)
        firstName = decodeQuotedPrintable(firstName)
      }
      name = `${firstName} ${lastName}`.trim()
    }
  }
  
  if (!name) {
    name = 'Contato Compartilhado'
  }

  // 2. Extração do Telefone (TEL)
  let phone = ''
  const telMatch = vcardText.match(/^TEL(?:;[^:]*)?:(.*)$/im)
  if (telMatch && telMatch[1]) {
    const rawPhone = telMatch[1].trim()
    // Remove "tel:" caso venha formatado como URI
    const cleanedRawPhone = rawPhone.startsWith('tel:') ? rawPhone.substring(4) : rawPhone
    phone = cleanedRawPhone.replace(/\D/g, '') // Remove tudo que não for dígito
    
    // Se for número brasileiro com 10 ou 11 dígitos, adiciona o DDI 55
    if (phone.length === 10 || phone.length === 11) {
      phone = '55' + phone
    }
  }

  return { name, phone }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const messageId = searchParams.get('messageId')

    if (!messageId) {
      return NextResponse.json({ error: 'O parâmetro messageId é obrigatório' }, { status: 400 })
    }

    const message = await prisma.message.findUnique({
      where: { id: messageId }
    })

    if (!message || !message.content || message.type !== 'DOCUMENT') {
      return NextResponse.json({ isVcard: false })
    }

    let vcardText = ''

    // Caso A: Anexo armazenado de forma binária no banco local
    if (message.content.includes('/api/chat/media')) {
      const urlObj = new URL(message.content, 'http://localhost:3000')
      const attachmentId = urlObj.searchParams.get('id')
      if (attachmentId) {
        const attachment = await prisma.attachment.findUnique({
          where: { id: attachmentId }
        })
        if (attachment) {
          vcardText = attachment.fileData.toString('utf-8')
        }
      }
    } 
    // Caso B: URL externa de mídia do Twilio
    else if (message.content.startsWith('http://') || message.content.startsWith('https://')) {
      let fetchOptions: RequestInit = {}
      if (message.content.includes('api.twilio.com')) {
        const accountSid = process.env.TWILIO_ACCOUNT_SID
        const authToken = process.env.TWILIO_AUTH_TOKEN
        if (accountSid && authToken) {
          const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64')
          fetchOptions.headers = {
            'Authorization': `Basic ${auth}`
          }
        }
      }
      const response = await fetch(message.content, fetchOptions)
      if (response.ok) {
        vcardText = await response.text()
      }
    }

    if (!vcardText || !vcardText.includes('BEGIN:VCARD')) {
      return NextResponse.json({ isVcard: false })
    }

    const parsed = parseVcard(vcardText)
    if (!parsed || !parsed.phone) {
      return NextResponse.json({ isVcard: false })
    }

    // Busca na tabela de contatos considerando variação do 9º dígito
    const existingContact = await findContactByPhone(parsed.phone)

    return NextResponse.json({
      isVcard: true,
      name: parsed.name,
      phone: parsed.phone,
      isAlreadyContact: !!existingContact
    })
  } catch (error: any) {
    console.error('❌ [API Parse vCard Error] Falha crítica ao ler ou analisar vcard:', error)
    return NextResponse.json({ 
      error: 'Erro interno ao processar arquivo de contato vCard', 
      details: error.message 
    }, { status: 500 })
  }
}
