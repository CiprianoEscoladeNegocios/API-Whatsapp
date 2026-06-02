import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { pusherServer } from '@/lib/pusher'

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
      
      // Converte o FormData em objeto para fins de debug e logs
      const rawPayload: Record<string, string> = {}
      formData.forEach((value, key) => {
        rawPayload[key] = value.toString()
      })
      console.log('📩 [Twilio Webhook] Payload recebido:', JSON.stringify(rawPayload, null, 2))

      const messageSid = formData.get('MessageSid') as string
      const smsStatus = (formData.get('SmsStatus') || formData.get('MessageStatus')) as string
      const bodyText = formData.get('Body') as string
      const rawFrom = formData.get('From') as string // Ex: whatsapp:+5511999999999
      
      if (!messageSid) {
        return NextResponse.json({ error: 'Parâmetro MessageSid ausente' }, { status: 400 })
      }

      // A.1) PROCESSAMENTO DE ATUALIZAÇÃO DE STATUS (Callbacks do Twilio)
      // Status possíveis no callback do Twilio: sent, delivered, read, failed, undelivered
      if (smsStatus && smsStatus !== 'received' && !bodyText) {
        let dbStatus: 'SENT' | 'DELIVERED' | 'READ' | 'FAILED' = 'SENT'
        
        if (smsStatus === 'delivered') dbStatus = 'DELIVERED'
        if (smsStatus === 'read') dbStatus = 'READ'
        if (smsStatus === 'failed' || smsStatus === 'undelivered') dbStatus = 'FAILED'

        // Busca a mensagem no banco utilizando o messageSid
        const existingMessage = await prisma.message.findUnique({
          where: { metaMessageId: messageSid },
          include: { contact: true }
        })

        if (existingMessage) {
          const updatedMessage = await prisma.message.update({
            where: { metaMessageId: messageSid },
            data: { status: dbStatus }
          })

          console.log(`🔄 [Twilio Webhook] Status da mensagem ${messageSid} atualizado para ${dbStatus}`)

          // Notifica o frontend via Pusher em tempo real (blindado contra falhas)
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
            console.warn('⚠️ [Pusher Warning] Falha ao enviar atualização de status via Pusher:', err.message)
          }
        } else {
          console.warn(`⚠️ [Twilio Webhook] Mensagem com MessageSid ${messageSid} não encontrada no banco.`)
        }

        // Retorna TwiML XML de sucesso vazio para o Twilio (evita o erro 12300 de Content-Type!)
        return new NextResponse('<Response></Response>', {
          headers: { 'Content-Type': 'text/xml' },
          status: 200
        })
      }

      // A.2) PROCESSAMENTO DE MENSAGENS RECEBIDAS (Mensagens de entrada dos clientes)
      // Processa se houver corpo de texto OU se houver arquivos de mídia anexados
      const numMedia = parseInt(formData.get('NumMedia') as string || '0', 10)
      const hasMedia = numMedia > 0

      if ((bodyText || hasMedia) && rawFrom) {
        // Limpa o número do cliente (remove "whatsapp:" e remove caracteres não numéricos)
        // Desta forma, mantemos o padrão limpo do banco (ex: 5511999999999)
        const customerPhone = rawFrom.replace('whatsapp:', '').replace(/\D/g, '')
        const customerName = (formData.get('ProfileName') as string) || 'Cliente WhatsApp'

        try {
          console.log(`⏳ [Twilio Webhook] Gravando mensagens inbound de +${customerPhone} no banco de dados...`)
          
          // Upsert do Contato no banco de dados para garantir que ele exista
          const contact = await prisma.contact.upsert({
            where: { phone: customerPhone },
            update: { name: customerName },
            create: {
              phone: customerPhone,
              name: customerName,
              tags: ['Novo Cliente']
            }
          })

          const createdMessages: any[] = []

          // 1. Se houver texto (legenda ou mensagem livre), salva a mensagem de texto
          if (bodyText) {
            const textMessage = await prisma.message.create({
              data: {
                metaMessageId: messageSid,
                contactId: contact.id,
                direction: 'INBOUND',
                type: 'TEXT',
                content: bodyText,
                status: 'READ' // Entra direto como lida
              }
            })
            createdMessages.push(textMessage)
            console.log(`📩 [Twilio Webhook] Nova mensagem inbound de texto salva com sucesso! Contato: ${contact.name}, Conteúdo: ${bodyText}`)
          }

          // 2. Se houver arquivos de mídia, salva cada um deles individualmente
          if (hasMedia) {
            for (let i = 0; i < numMedia; i++) {
              const mediaUrl = formData.get(`MediaUrl${i}`) as string
              const mediaContentType = formData.get(`MediaContentType${i}`) as string || ''

              if (mediaUrl) {
                // Classifica o tipo de mídia
                let mediaType: 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT' = 'DOCUMENT'
                if (mediaContentType.startsWith('image/')) {
                  mediaType = 'IMAGE'
                } else if (mediaContentType.startsWith('video/')) {
                  mediaType = 'VIDEO'
                } else if (mediaContentType.startsWith('audio/') || mediaContentType.startsWith('voice/')) {
                  mediaType = 'AUDIO'
                }

                // Define um metaMessageId único para evitar colisão se já salvamos a de texto ou outras mídias
                const uniqueMetaMessageId = createdMessages.length === 0 
                  ? messageSid 
                  : `${messageSid}_media_${i}`

                const mediaMessage = await prisma.message.create({
                  data: {
                    metaMessageId: uniqueMetaMessageId,
                    contactId: contact.id,
                    direction: 'INBOUND',
                    type: mediaType,
                    content: mediaUrl,
                    status: 'READ'
                  }
                })
                createdMessages.push(mediaMessage)
                console.log(`📩 [Twilio Webhook] Novo anexo inbound do tipo ${mediaType} salvo com sucesso! Contato: ${contact.name}, URL: ${mediaUrl}`)
              }
            }
          }

          console.log(`📩 [Twilio Webhook] Gravou ${createdMessages.length} mensagens inbound para ${contact.name}!`)

          // 3. Notifica via Pusher (blindado contra falhas) para cada mensagem criada
          try {
            for (const msg of createdMessages) {
              // Notifica o chat individual via Pusher
              await pusherServer.trigger(`chat-${contact.id}`, 'new-message', {
                id: msg.id,
                metaMessageId: msg.metaMessageId,
                direction: msg.direction,
                type: msg.type,
                content: msg.content,
                status: msg.status,
                timestamp: msg.timestamp,
                contactId: msg.contactId
              })
            }

            // Atualiza a lista lateral com a última mensagem (seja de texto ou de mídia)
            if (createdMessages.length > 0) {
              const lastMsg = createdMessages[createdMessages.length - 1]
              await pusherServer.trigger('chats-sidebar', 'sidebar-update', {
                contactId: contact.id,
                lastMessage: {
                  content: lastMsg.type !== 'TEXT' ? `[${lastMsg.type}]` : lastMsg.content,
                  timestamp: lastMsg.timestamp,
                  direction: lastMsg.direction
                },
                contactName: contact.name,
                contactPhone: contact.phone
              })
            }
          } catch (pusherErr: any) {
            console.warn('⚠️ [Pusher Warning] Falha ao enviar mensagens inbound via Pusher (Twilio):', pusherErr.message)
          }
        } catch (error: any) {
          console.error('❌ [Twilio Webhook Error] Erro crítico ao gravar dados no banco:', error.message)
        }

        // Retorna TwiML XML de sucesso vazio para o Twilio (evita o erro 12300 de Content-Type!)
        return new NextResponse('<Response></Response>', {
          headers: { 'Content-Type': 'text/xml' },
          status: 200
        })
      }

      // Retorna TwiML XML de sucesso vazio para o Twilio (evita o erro 12300 de Content-Type!)
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
      if (messageType === 'text') {
        content = rawMessage.text?.body || ''
      } else {
        content = `[Mídia do tipo: ${messageType}]`
      }

      const contact = await prisma.contact.upsert({
        where: { phone: customerPhone },
        update: { name: customerName },
        create: {
          phone: customerPhone,
          name: customerName,
          tags: ['Novo Cliente']
        }
      })

      const newMessage = await prisma.message.create({
        data: {
          metaMessageId,
          contactId: contact.id,
          direction: 'INBOUND',
          type: 'TEXT',
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
            content: newMessage.content,
            timestamp: newMessage.timestamp,
            direction: newMessage.direction
          },
          contactName: contact.name,
          contactPhone: contact.phone
        })
      } catch (pusherErr: any) {
        console.warn('⚠️ [Pusher Warning] Falha ao enviar mensagens inbound via Pusher (Meta):', pusherErr.message)
      }

      return NextResponse.json({ success: true, provider: 'meta', event: 'message-received' })
    }

    return NextResponse.json({ success: true, message: 'Evento desconhecido no JSON' })
  } catch (error: any) {
    console.error('❌ Erro crítico no Webhook POST:', error)
    return NextResponse.json({ error: 'Erro interno do servidor', details: error.message }, { status: 500 })
  }
}
