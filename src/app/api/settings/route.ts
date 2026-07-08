import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getSystemSettings } from '@/lib/auto-reply'

export const dynamic = 'force-dynamic'

/**
 * Retorna as configurações atuais do sistema.
 */
export async function GET() {
  try {
    const settings = await getSystemSettings()
    return NextResponse.json(settings)
  } catch (error: any) {
    console.error('❌ Erro no GET de /api/settings:', error)
    return NextResponse.json({ error: 'Erro interno do servidor', details: error.message }, { status: 500 })
  }
}

/**
 * Salva as configurações de horário de atendimento.
 */
export async function POST(request: NextRequest) {
  try {
    const { enabled, message, schedule } = await request.json()

    // Validações básicas
    if (typeof enabled !== 'boolean' || !message || !Array.isArray(schedule)) {
      return NextResponse.json({ error: 'Dados inválidos fornecidos' }, { status: 400 })
    }

    // Salva ou atualiza a chave de ativação da funcionalidade
    await prisma.systemSetting.upsert({
      where: { key: 'out_of_hours_enabled' },
      update: { value: String(enabled) },
      create: { key: 'out_of_hours_enabled', value: String(enabled) }
    })

    // Salva ou atualiza a mensagem automática
    await prisma.systemSetting.upsert({
      where: { key: 'out_of_hours_message' },
      update: { value: message },
      create: { key: 'out_of_hours_message', value: message }
    })

    // Salva ou atualiza a agenda de horários como String JSON
    await prisma.systemSetting.upsert({
      where: { key: 'out_of_hours_schedule' },
      update: { value: JSON.stringify(schedule) },
      create: { key: 'out_of_hours_schedule', value: JSON.stringify(schedule) }
    })

    console.log('✅ Configurações de fora de horário atualizadas com sucesso!')

    return NextResponse.json({ success: true, enabled, message, schedule })
  } catch (error: any) {
    console.error('❌ Erro no POST de /api/settings:', error)
    return NextResponse.json({ error: 'Erro interno do servidor', details: error.message }, { status: 500 })
  }
}
