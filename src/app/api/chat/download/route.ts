import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const fileUrl = searchParams.get('url')

    if (!fileUrl) {
      return NextResponse.json({ error: 'Parâmetro url é obrigatório' }, { status: 400 })
    }

    console.log(`📡 [Proxy Download] Buscando arquivo físico em: ${fileUrl}`)

    const headers: Record<string, string> = {}

    // Se for uma URL do domínio Twilio e tivermos credenciais, fazemos a requisição autenticada
    if (fileUrl.includes('api.twilio.com')) {
      const accountSid = process.env.TWILIO_ACCOUNT_SID
      const authToken = process.env.TWILIO_AUTH_TOKEN
      if (accountSid && authToken && accountSid !== 'seu_account_sid_aqui') {
        const authHeader = 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64')
        headers['Authorization'] = authHeader
      }
    }

    const response = await fetch(fileUrl, {
      method: 'GET',
      headers
    })

    if (!response.ok) {
      console.error(`❌ [Proxy Download] Erro ao buscar arquivo remoto. Status: ${response.status}`)
      return NextResponse.json({ error: 'Não foi possível recuperar o arquivo remoto' }, { status: response.status })
    }

    const contentType = response.headers.get('content-type') || 'application/octet-stream'
    const blob = await response.blob()

    // Extrai o nome do arquivo original da URL ou define um padrão inteligente baseado no content-type
    let fileName = fileUrl.split('/').pop() || 'arquivo'
    // Limpa parâmetros de busca se existirem no nome do arquivo (ex: url?params=123)
    fileName = fileName.split('?')[0]
    
    if (!fileName.includes('.')) {
      const ext = contentType.split('/')[1] || 'bin'
      fileName = `${fileName}.${ext}`
    }

    return new NextResponse(blob, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Cache-Control': 'no-cache'
      }
    })
  } catch (error: any) {
    console.error('❌ [Proxy Download Error] Erro crítico no download proxy:', error)
    return NextResponse.json({ error: 'Erro interno do servidor', details: error.message }, { status: 500 })
  }
}
