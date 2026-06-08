import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * Endpoint de Mídias - Cipriano Conversas
 * 
 * Recupera um anexo armazenado de forma binária no banco de dados do Supabase
 * e o serve com o Content-Type correto e cabeçalhos inline por padrão.
 * Desenvolvido sob as diretrizes de excelência e conformidade da Cipriano Escola de Negócios.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const download = searchParams.get('download') === 'true'

    if (!id) {
      return NextResponse.json({ error: 'ID do anexo é obrigatório' }, { status: 400 })
    }

    console.log(`📡 [API Media] Buscando anexo no banco de dados para ID: ${id}`)

    const attachment = await prisma.attachment.findUnique({
      where: { id }
    })

    if (!attachment) {
      console.warn(`⚠️ [API Media] Anexo não encontrado no banco de dados: ${id}`)
      return NextResponse.json({ error: 'Arquivo não encontrado' }, { status: 404 })
    }

    // O fileData no Prisma com tipo Bytes é retornado como um Buffer do Node.js
    const buffer = attachment.fileData

    const contentDisposition = download
      ? `attachment; filename="${attachment.fileName}"`
      : `inline; filename="${attachment.fileName}"`

    // Retorna o arquivo com os cabeçalhos apropriados
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': attachment.fileType,
        'Content-Disposition': contentDisposition,
        // Cachear arquivos estáticos imutáveis por um ano
        'Cache-Control': 'public, max-age=31536000, immutable'
      }
    })
  } catch (error: any) {
    console.error('❌ [API Media Error] Erro crítico ao servir arquivo do banco de dados:', error)
    return NextResponse.json({ 
      error: 'Erro interno ao servir arquivo', 
      details: error.message 
    }, { status: 500 })
  }
}
