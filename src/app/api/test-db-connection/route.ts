import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET() {
  try {
    // Tenta fazer uma consulta simples de contagem de usuários
    const userCount = await prisma.user.count()
    
    return NextResponse.json({
      success: true,
      message: 'Conexão com o Supabase estabelecida com sucesso na Vercel! 🚀',
      userCount,
      databaseUrlEnvExists: !!process.env.DATABASE_URL,
      // Retorna os primeiros caracteres da URL de forma segura para validar aspas
      databaseUrlPrefix: process.env.DATABASE_URL 
        ? `${process.env.DATABASE_URL.substring(0, 15)}... (Total: ${process.env.DATABASE_URL.length} chars)` 
        : 'NULA'
    })
  } catch (error: any) {
    console.error('❌ Falha crítica ao testar conexão com o banco de dados:', error)
    
    return NextResponse.json({
      success: false,
      message: 'Falha crítica ao conectar com o Supabase na Vercel! ❌',
      errorName: error.name,
      errorMessage: error.message,
      databaseUrlEnvExists: !!process.env.DATABASE_URL,
      databaseUrlPrefix: process.env.DATABASE_URL 
        ? `${process.env.DATABASE_URL.substring(0, 15)}... (Total: ${process.env.DATABASE_URL.length} chars)` 
        : 'NULA',
      // Dica amigável de diagnóstico
      tip: 'Verifique se a variável DATABASE_URL nas configurações da Vercel contém aspas duplas, espaços em branco no final, ou se o IP da Vercel está sendo bloqueado pelo firewall da Supabase.'
    }, { status: 500 })
  }
}
