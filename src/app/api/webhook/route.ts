import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { pusherServer } from '@/lib/pusher'
import { findContactByPhone } from '@/lib/phone'
import { checkAndSendOutOfHoursReply } from '@/lib/auto-reply'

// 1. VALIDAÇÃO DO WEBHOOK (GET)
// A Meta exige verificação via hub.challenge. 
// O Twilio não exige essa verificação no GET, mas mantemos o suporte para ping ou legado da Meta.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  const verifyToken = process.env.META_WA_VERIFY_TOKEN || 'cipriano_secret_token_123'

  if (mode === 'subscribe' && token === verifyToken) {
    console.log('✅ Webhook verificado com sucesso pela Meta/Legado!')
    return new NextResponse(challenge, { status: 200 })
  }

  // Resposta amigável de status para o Twilio ou navegador
  return NextResponse.json({
    status: 'online',
    service: 'Cipriano WhatsApp Webhook API',
    engine: 'Twilio & Meta Multi-Provider Enabled'
  })
}

// 2. RECEBIMENTO DE EVENTOS (POST)
// Processa mensagens de entrada e status de entrega de ambos os provedores (Twilio & Meta/Mock).
export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || ''

    // ==========================================
    // FLUXO A: PROVEDOR TWILIO (Form URL Encoded)
    // ==========================================
    if (contentType.includes('application/x-www-form-urlencoded')) {
      const formData = await request.formData()
      
      // Converte o FormData em um Record de strings para envio/validação
      const rawPayload: Record<string, string> = {}
      formData.forEach((value, key) => {
        rawPayload[key] = value.toString()
      })

      console.log('📩 [Twilio Webhook] Recebida chamada. MessageSid:', rawPayload['MessageSid'] || 'Desconhecido')

      // Opcional: Validação de Assinatura do Twilio
      const shouldValidate = process.env.TWILIO_VALIDATE_SIGNATURE === 'true'
      if (shouldValidate) {
        const signature = request.headers.get('X-Twilio-Signature') || ''
        const url = request.url
        const authToken = process.env.TWILIO_AUTH_TOKEN || ''
        
        const { validateTwilioSignature } = await import('@/lib/twilio-webhook-processor')
        const isValid = validateTwilioSignature(authToken, signature, url, rawPayload)
        
        if (!isValid) {
          console.error('❌ [Twilio Webhook] Assinatura inválida detectada no webhook.')
          return new NextResponse('Assinatura inválida', { status: 401 })
        }
      }

      // Envia para processamento em background (fila)
      const qstashToken = process.env.QSTASH_TOKEN
      const qstashUrl = process.env.QSTASH_URL
      const currentDomain = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

      if (qstashToken && qstashUrl) {
        // Enfileira usando o Upstash QStash
        console.log(`📡 [Twilio Webhook] Enfileirando MessageSid ${rawPayload['MessageSid']} no Upstash QStash...`)
        fetch(`${qstashUrl}/v1/publish/${currentDomain}/api/webhook/process-twilio`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${qstashToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(rawPayload)
        }).catch(err => {
          console.error('❌ [Twilio Webhook] Erro ao enfileirar no QStash:', err)
        })
      } else {
        // Fallback local: Executa em background de forma assíncrona (Promise sem await)
        console.log(`⏳ [Twilio Webhook] Sem QStash. Processando MessageSid ${rawPayload['MessageSid']} assincronamente local...`)
        import('@/lib/twilio-webhook-processor').then(({ processTwilioWebhookPayload }) => {
          processTwilioWebhookPayload(rawPayload).catch(err => {
            console.error('❌ [Twilio Webhook] Erro no processamento assíncrono local:', err)
          })
        })
      }

      // Retorna TwiML XML de sucesso vazio de forma IMEDIATA (evita o erro 11200 e o 12300 do Twilio!)
      return new NextResponse('<Response></Response>', {
        headers: { 'Content-Type': 'text/xml' },
        status: 200
      })
    }

    // ==========================================
    // FLUXO B: PROVEDOR META / MOCK (JSON)
    // ==========================================
    const body = await request.json()
    console.log('📩 [Meta/Mock Webhook] Payload recebido:', JSON.stringify(body, null, 2))

    if (!body.object || body.object !== 'whatsapp_business_account') {
      return NextResponse.json({ error: 'Objeto inválido no payload JSON' }, { status: 400 })
    }

    const entry = body.entry?.[0]
    const change = entry?.changes?.[0]
    const value = change?.value

    if (!value) {
      return NextResponse.json({ success: true, provider: 'meta', message: 'Payload vazio ignorado' })
    }

    // B.1) PROCESSAMENTO DE ATUALIZAÇÕES DE STATUS (Meta)
    if (value.statuses && value.statuses.length > 0) {
      const statusUpdate = value.statuses[0]
      const metaMessageId = statusUpdate.id
      const statusMeta = statusUpdate.status // 'sent', 'delivered', 'read', 'failed'
      
      let dbStatus: 'SENT' | 'DELIVERED' | 'READ' | 'FAILED' = 'SENT'
      if (statusMeta === 'delivered') dbStatus = 'DELIVERED'
      if (statusMeta === 'read') dbStatus = 'READ'
      if (statusMeta === 'failed') dbStatus = 'FAILED'

      const existingMessage = await prisma.message.findUnique({
        where: { metaMessageId },
        include: { contact: true }
      })

      if (existingMessage) {
        const updatedMessage = await prisma.message.update({
          where: { metaMessageId },
          data: { status: dbStatus }
        })

        console.log(`🔄 [Meta Webhook] Status da mensagem ${metaMessageId} atualizado para ${dbStatus}`)

        try {
          await pusherServer.trigger(
            `chat-${existingMessage.contactId}`,
            'message-status-updated',
            {
              messageId: updatedMessage.id,
              metaMessageId: updatedMessage.metaMessageId,
              status: updatedMessage.status,
            }
          )
        } catch (err: any) {
          console.warn('⚠️ [Pusher Warning] Falha ao enviar atualização de status via Pusher (Meta):', err.message)
        }
      }

      return NextResponse.json({ success: true, provider: 'meta', event: 'status-update' })
    }

    // B.2) PROCESSAMENTO DE MENSAGENS RECEBIDAS (Meta)
    if (value.messages && value.messages.length > 0) {
      const contactInfo = value.contacts?.[0]
      const rawMessage = value.messages[0]

      const customerPhone = rawMessage.from
      const customerName = contactInfo?.profile?.name || 'Cliente WhatsApp'
      const metaMessageId = rawMessage.id
      const messageType = rawMessage.type

      let content = ''
      let dbMessageType: 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT' | 'AUDIO' = 'TEXT'

      if (messageType === 'text') {
        content = rawMessage.text?.body || ''
      } else if (messageType === 'contacts') {
        const metaContact = rawMessage.contacts?.[0]
        if (metaContact) {
          const formattedName = metaContact.name?.formatted_name || 
                                [metaContact.name?.first_name, metaContact.name?.last_name].filter(Boolean).join(' ') || 
                                'Contato Compartilhado'
          const metaPhone = metaContact.phones?.[0]?.phone || ''
          
          const vcardString = [
            'BEGIN:VCARD',
            'VERSION:3.0',
            `FN:${formattedName}`,
            `TEL;TYPE=CELL:${metaPhone}`,
            'END:VCARD'
          ].join('\n')

          const attachment = await prisma.attachment.create({
            data: {
              fileName: `contato_${formattedName.replace(/\s+/g, '_')}.vcf`,
              fileType: 'text/vcard',
              fileData: Buffer.from(vcardString, 'utf-8')
            }
          })

          content = `/api/chat/media?id=${attachment.id}&name=contato_${encodeURIComponent(formattedName)}.vcf`
          dbMessageType = 'DOCUMENT'
        } else {
          content = '[Contato Compartilhado Vazio]'
        }
      } else {
        content = `[Mídia do tipo: ${messageType}]`
      }

      // Busca o contato considerando a variação do 9º dígito no Brasil
      let contact = await findContactByPhone(customerPhone)

      if (contact) {
        // Evita apagar o nome rico e personalizado definido pelo usuário
        const isGenericName = contact.name === 'Cliente WhatsApp' || contact.name === 'Sem Nome'
        const newNameIsBetter = customerName && customerName !== 'Cliente WhatsApp'

        if (isGenericName && newNameIsBetter) {
          contact = await prisma.contact.update({
            where: { id: contact.id },
            data: { name: customerName }
          })
        }
      } else {
        // Cria se não existir sob nenhuma variação
        contact = await prisma.contact.create({
          data: {
            phone: customerPhone,
            name: customerName,
            tags: ['Novo Cliente']
          }
        })
      }

      const newMessage = await prisma.message.create({
        data: {
          metaMessageId,
          contactId: contact.id,
          direction: 'INBOUND',
          type: dbMessageType,
          content,
          status: 'READ',
          timestamp: new Date(parseInt(rawMessage.timestamp) * 1000)
        }
      })

      try {
        await pusherServer.trigger(`chat-${contact.id}`, 'new-message', {
          id: newMessage.id,
          metaMessageId: newMessage.metaMessageId,
          direction: newMessage.direction,
          type: newMessage.type,
          content: newMessage.content,
          status: newMessage.status,
          timestamp: newMessage.timestamp,
          contactId: newMessage.contactId
        })

        await pusherServer.trigger('chats-sidebar', 'sidebar-update', {
          contactId: contact.id,
          lastMessage: {
            content: newMessage.type !== 'TEXT' ? `[${newMessage.type}]` : newMessage.content,
            timestamp: newMessage.timestamp,
            direction: newMessage.direction
          },
          contactName: contact.name,
          contactPhone: contact.phone
        })
      } catch (pusherErr: any) {
        console.warn('⚠️ [Pusher Warning] Falha ao enviar mensagens inbound via Pusher (Meta):', pusherErr.message)
      }

      // Verifica e envia resposta automática de fora de expediente se aplicável
      try {
        await checkAndSendOutOfHoursReply(contact.id, contact.phone, 'meta')
      } catch (autoReplyErr: any) {
        console.error('❌ [Webhook Auto Reply] Erro ao processar auto-resposta Meta:', autoReplyErr.message)
      }

      return NextResponse.json({ success: true, provider: 'meta', event: 'message-received' })
    }

    return NextResponse.json({ success: true, message: 'Evento desconhecido no JSON' })
  } catch (error: any) {
    console.error('❌ Erro crítico no Webhook POST:', error)
    return NextResponse.json({ error: 'Erro interno do servidor', details: error.message }, { status: 500 })
  }
}
