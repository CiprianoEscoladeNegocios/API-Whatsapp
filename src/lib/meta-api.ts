/**
 * Service para integração direta com a API Oficial do WhatsApp Cloud (Meta)
 * Desenvolvido sob as diretrizes de excelência em engenharia da Cipriano Escola de Negócios.
 */

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

export class MetaWhatsAppService {
  private static getCredentials() {
    const accessToken = process.env.META_WA_ACCESS_TOKEN
    const phoneNumberId = process.env.META_WA_PHONE_NUMBER_ID
    
    // Verifica se as credenciais estão preenchidas no .env
    const isConfigured = 
      accessToken && 
      accessToken !== 'seu_access_token_aqui' && 
      phoneNumberId && 
      phoneNumberId !== 'seu_phone_number_id_aqui'

    return {
      accessToken,
      phoneNumberId,
      isConfigured: !!isConfigured
    }
  }

  /**
   * Envia uma mensagem de texto simples
   */
  static async sendTextMessage({ to, text }: SendTextMessageParams) {
    const { accessToken, phoneNumberId, isConfigured } = this.getCredentials()

    // FORMATO DO NÚMERO: A Meta exige número completo (DDI + DDD + Telefone) sem caractere "+"
    const cleanPhone = to.replace(/\D/g, '')

    if (!isConfigured) {
      console.warn('⚠️ CREDENCIAIS DA META NÃO CONFIGURADAS. Simulando envio de mensagem local (Mock Mode)...')
      return {
        mock: true,
        messages: [
          {
            id: `wamid.HBgM${Math.random().toString(36).substring(2, 18).toUpperCase()}`
          }
        ]
      }
    }

    try {
      const url = `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: cleanPhone,
          type: 'text',
          text: {
            preview_url: false,
            body: text
          }
        })
      })

      const data = await response.json()

      if (!response.ok) {
        console.error('❌ Erro retornado pela API da Meta:', data)
        throw new Error(data.error?.message || 'Falha ao enviar mensagem via Meta API')
      }

      console.log('✅ Mensagem enviada com sucesso pela Meta:', data)
      return data
    } catch (error) {
      console.error('❌ Erro crítico no transporte para Meta API:', error)
      throw error
    }
  }

  /**
   * Envia uma mensagem baseada em Template Aprovado (Essencial para iniciar conversas com clientes frios)
   */
  static async sendTemplateMessage({ to, templateName, languageCode = 'pt_BR', components = [] }: SendTemplateMessageParams) {
    const { accessToken, phoneNumberId, isConfigured } = this.getCredentials()
    const cleanPhone = to.replace(/\D/g, '')

    if (!isConfigured) {
      console.warn('⚠️ CREDENCIAIS DA META NÃO CONFIGURADAS. Simulando envio de Template local...')
      return {
        mock: true,
        messages: [
          {
            id: `wamid.HBgM${Math.random().toString(36).substring(2, 18).toUpperCase()}`
          }
        ]
      }
    }

    try {
      const url = `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: cleanPhone,
          type: 'template',
          template: {
            name: templateName,
            language: {
              code: languageCode
            },
            components: components // Variáveis e parâmetros dinâmicos
          }
        })
      })

      const data = await response.json()

      if (!response.ok) {
        console.error('❌ Erro no envio de Template pela API da Meta:', data)
        throw new Error(data.error?.message || 'Falha ao enviar Template via Meta API')
      }

      console.log('✅ Template enviado com sucesso pela Meta:', data)
      return data
    } catch (error) {
      console.error('❌ Erro crítico no envio do Template:', error)
      throw error
    }
  }
}
