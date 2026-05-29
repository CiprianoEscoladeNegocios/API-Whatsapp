import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const accountSid = process.env.TWILIO_ACCOUNT_SID
    const authToken = process.env.TWILIO_AUTH_TOKEN

    if (!accountSid || !authToken) {
      return NextResponse.json({
        success: false,
        error: 'Credenciais da Twilio não configuradas no ambiente (env)',
        environment: {
          TWILIO_ACCOUNT_SID_DEFINED: !!accountSid,
          TWILIO_AUTH_TOKEN_DEFINED: !!authToken
        }
      }, { status: 400 })
    }

    const authHeader = 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64')

    console.log(`📡 [Twilio Diagnostic] Testando conexão com a Twilio Content API...`)

    // Tentamos obter a lista de templates oficiais e suas aprovações
    const response = await fetch('https://content.twilio.com/v2/ContentAndApprovals', {
      method: 'GET',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`❌ [Twilio Diagnostic] Erro retornado pela Twilio:`, errorText)
      return NextResponse.json({
        success: false,
        error: 'A Twilio rejeitou a requisição',
        statusCode: response.status,
        details: errorText,
        environment: {
          TWILIO_ACCOUNT_SID_DEFINED: true,
          TWILIO_AUTH_TOKEN_DEFINED: true,
          ACCOUNT_SID_PREFIX: accountSid.substring(0, 6) + '...'
        }
      }, { status: response.status })
    }

    const data = await response.json()
    console.log(`🌟 [Twilio Diagnostic] Conexão estabelecida com sucesso! Encontrados ${data.contents?.length || 0} templates.`)

    return NextResponse.json({
      success: true,
      message: 'Conexão com a Twilio Content API estabelecida com absoluto sucesso!',
      accountSidPrefix: accountSid.substring(0, 6) + '...',
      templatesCount: data.contents?.length || 0,
      templatesList: data.contents?.map((item: any) => ({
        friendlyName: item.friendly_name,
        sid: item.sid,
        language: item.language,
        whatsappStatus: item.approvals?.whatsapp?.status || 'N/A'
      })) || []
    })
  } catch (error: any) {
    console.error('❌ [Twilio Diagnostic] Falha crítica de conexão:', error)
    return NextResponse.json({
      success: false,
      error: 'Falha crítica de conexão com a API da Twilio',
      details: error.message
    }, { status: 500 })
  }
}
