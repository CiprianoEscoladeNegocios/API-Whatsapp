import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  let fileUrl: string | null = null
  try {
    const { searchParams } = new URL(request.url)
    fileUrl = searchParams.get('url')

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
      console.warn(`⚠️ [Proxy Download Fallback] Falha ao baixar arquivo remoto. Redirecionando diretamente para a URL do arquivo: ${fileUrl}`)
      return NextResponse.redirect(new URL(fileUrl))
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

    // Se solicitado para exibição/reprodução direta, retorna como inline.
    // Caso contrário (como para downloads dedicados), mantém attachment.
    const inline = searchParams.get('inline') === 'true'
    const contentDisposition = inline 
      ? `inline; filename="${fileName}"` 
      : `attachment; filename="${fileName}"`

    return new NextResponse(blob, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': contentDisposition,
        'Cache-Control': 'no-cache'
      }
    })
  } catch (error: any) {
    console.error('❌ [Proxy Download Error] Erro crítico no download proxy:', error)
    if (fileUrl) {
      console.log(`📡 [Proxy Download Fallback Catch] Redirecionando à URL do arquivo físico original: ${fileUrl}`)
      return NextResponse.redirect(new URL(fileUrl))
    }
    return NextResponse.json({ error: 'Erro interno do servidor', details: error.message }, { status: 500 })
  }
}
