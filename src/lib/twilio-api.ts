/**
 * Service para integração direta com a API do Twilio WhatsApp
 * Desenvolvido sob as diretrizes de excelência e alta performance da Cipriano Escola de Negócios.
 */

import prisma from './prisma'

interface SendTextMessageParams {
  to: string;
  text: string;
}

interface SendTemplateMessageParams {
  to: string;
  templateName: string;
  languageCode: string;
  components?: any[];
}

export class TwilioWhatsAppService {
  private static getCredentials() {
    const accountSid = process.env.TWILIO_ACCOUNT_SID
    const authToken = process.env.TWILIO_AUTH_TOKEN
    const whatsappFrom = process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886'
    
    // Verifica se as credenciais estão preenchidas no .env
    const isConfigured = 
      accountSid && 
      accountSid !== 'seu_account_sid_aqui' && 
      authToken && 
      authToken !== 'seu_auth_token_aqui'

    return {
      accountSid,
      authToken,
      whatsappFrom: whatsappFrom.startsWith('whatsapp:') ? whatsappFrom : `whatsapp:${whatsappFrom}`,
      isConfigured: !!isConfigured
    }
  }

  /**
   * Envia uma mensagem de texto simples pelo Twilio WhatsApp
   */
  static async sendTextMessage({ to, text }: SendTextMessageParams) {
    const { accountSid, authToken, whatsappFrom, isConfigured } = this.getCredentials()

    // O Twilio exige número completo no formato internacional com o sinal de "+" no "To"
    // Exemplo: whatsapp:+5511999999999
    const cleanPhone = to.replace(/\D/g, '')
    const twilioTo = `whatsapp:+${cleanPhone}`

    if (!isConfigured) {
      console.warn('⚠️ CREDENCIAIS DO TWILIO NÃO CONFIGURADAS. Simulando envio de mensagem local (Mock Mode)...')
      return {
        mock: true,
        messages: [
          {
            id: `SM${Math.random().toString(36).substring(2, 18).toUpperCase()}`
          }
        ]
      }
    }

    try {
      const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`
      const authHeader = 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64')

      const bodyParams = new URLSearchParams()
      bodyParams.append('To', twilioTo)
      bodyParams.append('From', whatsappFrom)
      bodyParams.append('Body', text)

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: bodyParams.toString()
      })

      const data = await response.json()

      if (!response.ok) {
        console.error('❌ Erro retornado pela API do Twilio:', data)
        throw new Error(data.message || 'Falha ao enviar mensagem via Twilio API')
      }

      console.log('✅ Mensagem enviada com sucesso pelo Twilio:', data.sid)
      return {
        sid: data.sid,
        messages: [
          {
            id: data.sid
          }
        ]
      }
    } catch (error) {
      console.error('❌ Erro crítico no transporte para Twilio API:', error)
      throw error
    }
  }

  /**
   * Envia uma mensagem baseada em Template aprovado pelo Twilio/WhatsApp
   */
  static async sendTemplateMessage({ to, templateName, languageCode = 'pt_BR', components = [] }: SendTemplateMessageParams) {
    const { accountSid, authToken, whatsappFrom, isConfigured } = this.getCredentials()

    if (!isConfigured) {
      console.warn('⚠️ CREDENCIAIS DO TWILIO NÃO CONFIGURADAS. Simulando envio de Template local (Mock Mode)...')
      return {
        mock: true,
        messages: [
          {
            id: `SM${Math.random().toString(36).substring(2, 18).toUpperCase()}`
          }
        ]
      }
    }

    try {
      // Busca o template no banco de dados para recuperar o corpo original
      const template = await prisma.template.findUnique({
        where: { name: templateName }
      })

      if (!template) {
        throw new Error(`Template com nome "${templateName}" não encontrado no banco de dados.`)
      }

      const cleanPhone = to.replace(/\D/g, '')
      const twilioTo = `whatsapp:+${cleanPhone}`

      // Se o template possuir o ContentSid da Twilio (iniciando com HX)
      if (template.metaTemplateId && template.metaTemplateId.startsWith('HX')) {
        console.log(`📤 Disparando template oficial via Twilio Content API. SID: ${template.metaTemplateId}`)
        
        // Mapeia os parâmetros do body para um JSON de variáveis no formato {"1": "Valor1", "2": "Valor2"}
        const variablesMap: Record<string, string> = {}
        const bodyComponent = components.find((c: any) => c.type === 'body')
        
        if (bodyComponent && bodyComponent.parameters) {
          bodyComponent.parameters.forEach((param: any, index: number) => {
            variablesMap[String(index + 1)] = param.text
          })
        }

        const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`
        const authHeader = 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64')

        const bodyParams = new URLSearchParams()
        bodyParams.append('To', twilioTo)
        bodyParams.append('From', whatsappFrom)
        bodyParams.append('ContentSid', template.metaTemplateId)
        
        if (Object.keys(variablesMap).length > 0) {
          bodyParams.append('ContentVariables', JSON.stringify(variablesMap))
        }

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: bodyParams.toString()
        })

        const data = await response.json()

        if (!response.ok) {
          console.error('❌ Erro retornado pela Twilio Content API:', data)
          throw new Error(data.message || 'Falha ao enviar template via Twilio Content API')
        }

        console.log('✅ Template enviado com sucesso pela Twilio Content API. SID:', data.sid)
        return {
          sid: data.sid,
          messages: [
            {
              id: data.sid
            }
          ]
        }
      }

      // Caso contrário, faz fallback para o envio de texto livre clássico
      let textBody = template.body
      const bodyComponent = components.find((c: any) => c.type === 'body')
      
      if (bodyComponent && bodyComponent.parameters) {
        bodyComponent.parameters.forEach((param: any, index: number) => {
          textBody = textBody.replace(`{{${index + 1}}}`, param.text)
        })
      }

      console.log(`📤 Disparando template interpolado de texto livre (Fallback): "${textBody}"`)
      
      return await this.sendTextMessage({
        to,
        text: textBody
      })
    } catch (error) {
      console.error('❌ Erro crítico no envio do Template via Twilio:', error)
      throw error
    }
  }
}
