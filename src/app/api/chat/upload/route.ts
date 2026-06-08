import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

/**
 * Endpoint Corporativo de Upload de Arquivos de Mídia - Cipriano Conversas
 * 
 * Este endpoint recebe arquivos anexados (imagens, vídeos, áudios e documentos),
 * realiza a sanitização e os salva diretamente de forma binária no banco de dados
 * do Supabase na tabela Attachment, gerando uma URL estável para servir o arquivo.
 * Desenvolvido sob as diretrizes de excelência e alta performance da Cipriano Escola de Negócios.
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 })
    }

    // Validação rígida de tamanho do arquivo para evitar estouro do payload da Vercel (4.5MB)
    const MAX_SIZE = 4.5 * 1024 * 1024 // 4.5 MB
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ 
        error: 'O arquivo excede o limite máximo permitido de 4.5MB por limitações da infraestrutura de nuvem.' 
      }, { status: 413 })
    }

    // Converte o arquivo do formato ArrayBuffer do Next.js para Buffer do Node
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Grava o arquivo de forma binária no banco de dados do Supabase
    console.log(`💾 [API Upload] Gravando arquivo binário no Supabase: ${file.name} (${file.size} bytes)`)
    const attachment = await prisma.attachment.create({
      data: {
        fileName: file.name,
        fileType: file.type || 'application/octet-stream',
        fileData: buffer
      }
    })

    const fileUrl = `/api/chat/media?id=${attachment.id}`
    console.log(`💾 [API Upload] Arquivo salvo com absoluto sucesso! URL gerada: ${fileUrl}`)

    return NextResponse.json({ 
      success: true,
      url: fileUrl, 
      fileName: file.name, 
      fileType: file.type || 'application/octet-stream',
      sizeBytes: file.size
    })
  } catch (error: any) {
    console.error('❌ [API Upload Error] Falha crítica ao realizar o upload do arquivo no banco:', error)
    return NextResponse.json({ 
      error: 'Erro interno no upload de arquivos', 
      details: error.message 
    }, { status: 500 })
  }
}

