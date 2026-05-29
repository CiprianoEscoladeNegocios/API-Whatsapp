import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const accountSid = process.env.TWILIO_ACCOUNT_SID
    const authToken = process.env.TWILIO_AUTH_TOKEN

    if (!accountSid || !authToken) {
      return NextResponse.json({
        success: false,
        error: 'Credenciais da Twilio não configuradas no ambiente (env)'
      }, { status: 400 })
    }

    const authHeader = 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64')
    const cleanName = `teste_diag_${Math.random().toString(36).substring(2, 7)}`

    console.log(`📡 [Twilio Create Diagnostic] Tentando criar template "${cleanName}" na Twilio...`)

    const payload = {
      friendly_name: cleanName,
      language: 'pt',
      variables: {
        '1': 'nome_teste'
      },
      types: {
        'twilio/text': {
          body: 'Olá {{1}}! Este é um teste automático de integração da Cipriano Escola de Negócios.'
        }
      }
    }

    const response = await fetch('https://content.twilio.com/v1/Content', {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })

    const responseStatus = response.status
    const isOk = response.ok
    let responseData: any = null

    try {
      responseData = await response.json()
    } catch {
      responseData = await response.text()
    }

    return NextResponse.json({
      success: isOk,
      statusCode: responseStatus,
      friendlyNameAttempted: cleanName,
      payloadSent: payload,
      twilioResponse: responseData
    })
  } catch (error: any) {
    console.error('❌ [Twilio Create Diagnostic] Falha crítica:', error)
    return NextResponse.json({
      success: false,
      error: 'Falha crítica de conexão',
      details: error.message
    }, { status: 500 })
  }
}
