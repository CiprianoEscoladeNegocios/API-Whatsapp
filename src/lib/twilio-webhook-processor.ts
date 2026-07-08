import prisma from './prisma'
import { pusherServer } from './pusher'
import { findContactByPhone } from './phone'
import { checkAndSendOutOfHoursReply } from './auto-reply'
import crypto from 'crypto'

/**
 * Valida a assinatura de uma requisição do Twilio de forma nativa.
 */
export function validateTwilioSignature(
  authToken: string,
  signature: string,
  url: string,
  params: Record<string, string>
): boolean {
  // Ordena as chaves alfabeticamente
  const sortedKeys = Object.keys(params).sort()
  
  // Concatena a URL e todos os pares chave-valor
  let data = url
  for (const key of sortedKeys) {
    data += key + params[key]
  }

  // Gera a assinatura esperada com HMAC-SHA1 codificado em base64
  const expectedSignature = crypto
    .createHmac('sha1', authToken)
    .update(Buffer.from(data, 'utf-8'))
    .digest('base64')

  return expectedSignature === signature
}

/**
 * Helper para executar operações assíncronas com política de retries e backoff exponencial.
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  retries = 3,
  delayMs = 1000,
  exponentialFactor = 2
): Promise<T> {
  try {
    return await fn()
  } catch (error) {
    if (retries <= 0) {
      throw error
    }
    console.warn(`⚠️ [Retry Worker] Falha no processamento. Tentando novamente em ${delayMs}ms. Tentativas restantes: ${retries}`)
    await new Promise(resolve => setTimeout(resolve, delayMs))
    return retryWithBackoff(fn, retries - 1, delayMs * exponentialFactor, exponentialFactor)
  }
}

/**
 * Lógica isolada para processar o payload de webhook recebido do Twilio
 */
export async function processTwilioWebhookPayload(rawPayload: Record<string, string>) {
  const messageSid = rawPayload['MessageSid']
  const smsStatus = rawPayload['SmsStatus'] || rawPayload['MessageStatus']
  const bodyText = rawPayload['Body']
  const rawFrom = rawPayload['From']

  if (!messageSid) {
    throw new Error('Parâmetro MessageSid ausente no payload do Twilio.')
  }

  // 1. ATUALIZAÇÃO DE STATUS (Callback do Twilio)
  if (smsStatus && smsStatus !== 'received' && !bodyText) {
    let dbStatus: 'SENT' | 'DELIVERED' | 'READ' | 'FAILED' = 'SENT'
    
    if (smsStatus === 'delivered') dbStatus = 'DELIVERED'
    if (smsStatus === 'read') dbStatus = 'READ'
    if (smsStatus === 'failed' || smsStatus === 'undelivered') dbStatus = 'FAILED'

    await retryWithBackoff(async () => {
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

        console.log(`🔄 [Twilio Processor] Status da mensagem ${messageSid} atualizado para ${dbStatus}`)

        // Notifica o frontend via Pusher em tempo real
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
        console.warn(`⚠️ [Twilio Processor] Mensagem com MessageSid ${messageSid} não encontrada no banco.`)
      }
    })
    return
  }

  // 2. PROCESSAMENTO DE MENSAGENS INBOUND (Mensagens de entrada dos clientes)
  const numMedia = parseInt(rawPayload['NumMedia'] || '0', 10)
  const hasMedia = numMedia > 0

  if ((bodyText || hasMedia) && rawFrom) {
    const customerPhone = rawFrom.replace('whatsapp:', '').replace(/\D/g, '')
    const customerName = rawPayload['ProfileName'] || 'Cliente WhatsApp'

    await retryWithBackoff(async () => {
      console.log(`⏳ [Twilio Processor] Gravando mensagens inbound de +${customerPhone} no banco...`)
      
      let contact = await findContactByPhone(customerPhone)

      if (contact) {
        const isGenericName = contact.name === 'Cliente WhatsApp' || contact.name === 'Sem Nome'
        const newNameIsBetter = customerName && customerName !== 'Cliente WhatsApp'

        if (isGenericName && newNameIsBetter) {
          contact = await prisma.contact.update({
            where: { id: contact.id },
            data: { name: customerName }
          })
        }
      } else {
        contact = await prisma.contact.create({
          data: {
            phone: customerPhone,
            name: customerName,
            tags: ['Novo Cliente']
          }
        })
      }

      const createdMessages: any[] = []

      // 2.1 Texto
      if (bodyText) {
        const textMessage = await prisma.message.create({
          data: {
            metaMessageId: messageSid,
            contactId: contact.id,
            direction: 'INBOUND',
            type: 'TEXT',
            content: bodyText,
            status: 'READ'
          }
        })
        createdMessages.push(textMessage)
      }

      // 2.2 Mídias/Anexos
      if (hasMedia) {
        for (let i = 0; i < numMedia; i++) {
          const mediaUrl = rawPayload[`MediaUrl${i}`]
          const mediaContentType = rawPayload[`MediaContentType${i}`] || ''

          if (mediaUrl) {
            let mediaType: 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT' = 'DOCUMENT'
            if (mediaContentType.startsWith('image/')) {
              mediaType = 'IMAGE'
            } else if (mediaContentType.startsWith('video/')) {
              mediaType = 'VIDEO'
            } else if (mediaContentType.startsWith('audio/') || mediaContentType.startsWith('voice/')) {
              mediaType = 'AUDIO'
            }

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
          }
        }
      }

      console.log(`📩 [Twilio Processor] Gravou ${createdMessages.length} mensagens inbound para ${contact.name}!`)

      // Notifica via Pusher
      try {
        for (const msg of createdMessages) {
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
        console.warn('⚠️ [Pusher Warning] Falha ao notificar Pusher (Twilio Processor):', pusherErr.message)
      }

      // Dispara auto-resposta
      try {
        await checkAndSendOutOfHoursReply(contact.id, contact.phone, 'twilio')
      } catch (autoReplyErr: any) {
        console.error('❌ [Twilio Processor Auto Reply] Erro ao processar auto-resposta:', autoReplyErr.message)
      }
    })
  }
}
