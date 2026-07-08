import { NextRequest, NextResponse } from 'next/server'
import { processTwilioWebhookPayload } from '@/lib/twilio-webhook-processor'

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json()
    
    if (!payload || Object.keys(payload).length === 0) {
      return NextResponse.json({ error: 'Payload vazio' }, { status: 400 })
    }

    console.log(`📡 [Webhook Fila] Iniciando processamento do webhook para MessageSid: ${payload.MessageSid || 'Desconhecido'}`)

    await processTwilioWebhookPayload(payload)

    return NextResponse.json({ success: true, message: 'Processado com sucesso' })
  } catch (error: any) {
    console.error('❌ [Webhook Fila Error] Erro ao processar payload da fila:', error)
    
    // Retornamos 500 para habilitar a política de retry do QStash
    return NextResponse.json({ error: 'Falha no processamento da fila', details: error.message }, { status: 500 })
  }
}
