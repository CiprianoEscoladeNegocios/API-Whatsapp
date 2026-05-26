import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

/**
 * Endpoint Corporativo de Upload de Arquivos de Mídia - Cipriano Conversas
 * 
 * Este endpoint recebe arquivos anexados (imagens, vídeos, áudios e documentos),
 * realiza a sanitização e os salva na pasta estática public/uploads para que fiquem
 * disponíveis publicamente via URL local na aplicação.
 * Desenvolvido sob as diretrizes de excelência e alta performance da Cipriano Escola de Negócios.
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 })
    }

    // Converte o arquivo do formato ArrayBuffer do Next.js para Buffer do Node
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Cria o diretório de destino local public/uploads se ele não existir
    const uploadDir = path.join(process.cwd(), 'public', 'uploads')
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true })
    }

    // Gera um nome único e seguro para o arquivo para evitar colisões
    const fileExt = path.extname(file.name)
    const cleanBaseName = file.name.replace(fileExt, '').replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30)
    const uniqueFileName = `${Date.now()}_${cleanBaseName}${fileExt}`
    const filePath = path.join(uploadDir, uniqueFileName)

    // Grava o arquivo no disco rígido do servidor
    fs.writeFileSync(filePath, buffer)

    const fileUrl = `/uploads/${uniqueFileName}`
    console.log(`💾 [API Upload] Arquivo salvo com absoluto sucesso! URL: ${fileUrl}`)

    return NextResponse.json({ 
      success: true,
      url: fileUrl, 
      fileName: file.name, 
      fileType: file.type,
      sizeBytes: file.size
    })
  } catch (error: any) {
    console.error('❌ [API Upload Error] Falha crítica ao realizar o upload do arquivo:', error)
    return NextResponse.json({ 
      error: 'Erro interno no upload de arquivos', 
      details: error.message 
    }, { status: 500 })
  }
}
