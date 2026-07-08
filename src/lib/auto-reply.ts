/**
 * Service para processamento de resposta automática fora do horário de atendimento.
 * Desenvolvido sob as diretrizes de excelência da Cipriano Escola de Negócios.
 */

import prisma from './prisma'
import { TwilioWhatsAppService } from './twilio-api'
import { MetaWhatsAppService } from './meta-api'
import { pusherServer } from './pusher'

interface DaySchedule {
  day: number;
  enabled: boolean;
  start: string;
  end: string;
  name: string;
}

// Configurações padrão de fallback (expediente de segunda a sexta das 09:00 às 18:00)
const DEFAULT_SCHEDULE: DaySchedule[] = [
  { day: 0, enabled: false, start: '09:00', end: '18:00', name: 'Domingo' },
  { day: 1, enabled: true, start: '09:00', end: '18:00', name: 'Segunda-feira' },
  { day: 2, enabled: true, start: '09:00', end: '18:00', name: 'Terça-feira' },
  { day: 3, enabled: true, start: '09:00', end: '18:00', name: 'Quarta-feira' },
  { day: 4, enabled: true, start: '09:00', end: '18:00', name: 'Quinta-feira' },
  { day: 5, enabled: true, start: '09:00', end: '18:00', name: 'Sexta-feira' },
  { day: 6, enabled: false, start: '09:00', end: '18:00', name: 'Sábado' },
]

const DEFAULT_MESSAGE = 
  "Olá! Agradecemos o seu contato com a Cipriano Escola de Negócios. 🎓\n\n" +
  "No momento, nossa equipe está fora do horário de atendimento. Nosso expediente corporativo ocorre de segunda a sexta-feira, das 09:00 às 18:00.\n\n" +
  "Que tal aproveitar para conhecer nossos programas de MBA e cursos executivos de excelência em nosso site? Acesse: https://ciprianoescoladenegocios.com.br 🚀\n\n" +
  "Assim que nossa equipe iniciar as atividades, retornaremos sua mensagem com toda a atenção. Até breve!"

/**
 * Retorna as configurações do sistema carregando do banco ou utilizando fallbacks.
 */
export async function getSystemSettings() {
  try {
    const settings = await prisma.systemSetting.findMany()
    
    const enabledSetting = settings.find(s => s.key === 'out_of_hours_enabled')
    const messageSetting = settings.find(s => s.key === 'out_of_hours_message')
    const scheduleSetting = settings.find(s => s.key === 'out_of_hours_schedule')

    const enabled = enabledSetting ? enabledSetting.value === 'true' : true
    const message = messageSetting ? messageSetting.value : DEFAULT_MESSAGE
    
    let schedule = DEFAULT_SCHEDULE
    if (scheduleSetting) {
      try {
        schedule = JSON.parse(scheduleSetting.value)
      } catch (err) {
        console.error('❌ Erro ao parsear agenda de horários do banco:', err)
      }
    }

    return { enabled, message, schedule }
  } catch (error) {
    console.error('❌ Erro ao buscar configurações do banco, usando fallback:', error)
    return {
      enabled: true,
      message: DEFAULT_MESSAGE,
      schedule: DEFAULT_SCHEDULE
    }
  }
}

/**
 * Verifica se a data atual (ou fornecida) está fora do horário de atendimento da empresa.
 */
export function isOutOfHours(date: Date, schedule: DaySchedule[]): boolean {
  // Converte para o fuso horário de Brasília (America/Sao_Paulo)
  const tzString = date.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' })
  const brDate = new Date(tzString)

  const day = brDate.getDay() // 0 = Domingo, 1 = Segunda, etc.
  const hours = brDate.getHours()
  const minutes = brDate.getMinutes()

  const dayConfig = schedule.find(s => s.day === day)
  
  // Se não houver configuração ou o dia estiver desativado, considera fora do expediente
  if (!dayConfig || !dayConfig.enabled) {
    return true
  }

  // Faz parsing de hh:mm
  const [startHour, startMin] = dayConfig.start.split(':').map(Number)
  const [endHour, endMin] = dayConfig.end.split(':').map(Number)

  const currentMinutes = hours * 60 + minutes
  const startMinutes = startHour * 60 + startMin
  const endMinutes = endHour * 60 + endMin

  return currentMinutes < startMinutes || currentMinutes > endMinutes
}

/**
 * Processa a verificação de horário de expediente e envia auto-resposta se estiver fora de hora.
 */
export async function checkAndSendOutOfHoursReply(
  contactId: string,
  phone: string,
  provider: 'twilio' | 'meta'
) {
  try {
    const settings = await getSystemSettings()

    // 1. Verifica se a funcionalidade está habilitada
    if (!settings.enabled) {
      console.log('ℹ️ [Auto Reply] Resposta automática fora de horário desabilitada globalmente.')
      return
    }

    // 2. Verifica se o horário atual de Brasília está fora do expediente
    const now = new Date()
    const outOfHours = isOutOfHours(now, settings.schedule)

    if (!outOfHours) {
      console.log('ℹ️ [Auto Reply] Dentro do horário de atendimento. Nenhuma ação necessária.')
      return
    }

    console.log(`⏳ [Auto Reply] Contato está fora de horário. Verificando cooldown de auto-resposta para +${phone}...`)

    // 3. Cooldown de segurança (evitar loop/spam nas últimas 12 horas)
    const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000)
    
    // Busca se foi enviada alguma resposta automática nas últimas 12 horas para esse contato.
    // Usamos um prefixo identificador ou procuramos por mensagens outbound recentes com o mesmo conteúdo.
    const recentAutoReply = await prisma.message.findFirst({
      where: {
        contactId,
        direction: 'OUTBOUND',
        metaMessageId: {
          startsWith: 'auto_reply_'
        },
        timestamp: {
          gte: twelveHoursAgo
        }
      }
    })

    if (recentAutoReply) {
      console.log(`ℹ️ [Auto Reply] Cooldown ativo para +${phone}. Resposta enviada há menos de 12 horas. Ignorando disparo.`)
      return
    }

    console.log(`📤 [Auto Reply] Disparando resposta automática para +${phone} via ${provider}...`)

    // 4. Envia a mensagem pelo provedor correto
    let response;
    if (provider === 'twilio') {
      response = await TwilioWhatsAppService.sendTextMessage({
        to: phone,
        text: settings.message
      })
    } else {
      response = await MetaWhatsAppService.sendTextMessage({
        to: phone,
        text: settings.message
      })
    }

    const isMock = !!response.mock
    const metaMessageId = `auto_reply_${response.sid || response.messages?.[0]?.id || Date.now()}`

    // 5. Salva no banco de dados como OUTBOUND
    const autoMessage = await prisma.message.create({
      data: {
        metaMessageId,
        contactId,
        direction: 'OUTBOUND',
        type: 'TEXT',
        content: settings.message,
        status: isMock ? 'DELIVERED' : 'SENT'
      }
    })

    console.log(`✅ [Auto Reply] Resposta automática salva no banco. ID: ${autoMessage.id}`)

    // 6. Notifica o frontend via Pusher
    try {
      await pusherServer.trigger(`chat-${contactId}`, 'new-message', {
        id: autoMessage.id,
        metaMessageId: autoMessage.metaMessageId,
        direction: autoMessage.direction,
        type: autoMessage.type,
        content: autoMessage.content,
        status: autoMessage.status,
        timestamp: autoMessage.timestamp,
        contactId: autoMessage.contactId
      })

      await pusherServer.trigger('chats-sidebar', 'sidebar-update', {
        contactId: contactId,
        lastMessage: {
          content: autoMessage.content,
          timestamp: autoMessage.timestamp,
          direction: autoMessage.direction,
          type: autoMessage.type
        },
        contactName: undefined, // Mantém o nome existente na sidebar
        contactPhone: phone
      })
    } catch (pusherErr: any) {
      console.warn('⚠️ [Auto Reply Pusher Warning] Falha ao notificar Pusher:', pusherErr.message)
    }

  } catch (error: any) {
    console.error('❌ [Auto Reply Error] Falha crítica ao processar auto-resposta:', error.message)
  }
}
