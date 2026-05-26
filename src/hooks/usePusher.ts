import { useEffect, useRef } from 'react'
import { getPusherClient } from '@/lib/pusher'

interface UsePusherProps {
  channelName: string
  eventName: string
  callback: (data: any) => void
}

/**
 * Hook customizado para escutar eventos em tempo real do Pusher de forma estável.
 * Mantém a conexão física do WebSocket aberta sem causar memory leaks ou
 * reconexões desnecessárias durante re-renderizações e digitação na interface.
 * Desenvolvido sob o selo de excelência tecnológica da Cipriano Escola de Negócios.
 */
export function usePusher({ channelName, eventName, callback }: UsePusherProps) {
  // Mantém a versão mais recente do callback em um ref para evitar loops de reconexão do WebSocket
  const savedCallback = useRef(callback)

  useEffect(() => {
    savedCallback.current = callback
  }, [callback])

  useEffect(() => {
    if (typeof window === 'undefined') return

    let pusher: any = null
    let channel: any = null

    // Função wrapper estável que executa a versão mais recente do callback
    const handler = (data: any) => {
      savedCallback.current(data)
    }

    try {
      pusher = getPusherClient()
      channel = pusher.subscribe(channelName)
      
      channel.bind(eventName, handler)
      
      console.log(`📡 Pusher: Inscrito no canal "${channelName}" escutando evento "${eventName}"`)
    } catch (err) {
      console.error('❌ Erro de conexão no cliente do Pusher:', err)
    }

    // Função de limpeza ao desmontar o componente ou mudar de canal
    return () => {
      if (pusher && channel) {
        channel.unbind(eventName, handler)
        pusher.unsubscribe(channelName)
        console.log(`📡 Pusher: Desinscrito do canal "${channelName}"`)
      }
    }
  }, [channelName, eventName]) // Só reconecta fisicamente se o canal ou evento mudar literais
}

