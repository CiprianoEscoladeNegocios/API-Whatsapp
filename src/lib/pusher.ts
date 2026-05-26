import PusherServer from 'pusher'
import PusherClient from 'pusher-js'

// Instância para ser usada apenas no lado do SERVIDOR (rotas de API, webhooks)
export const pusherServer = new PusherServer({
  appId: process.env.PUSHER_APP_ID || '',
  key: process.env.PUSHER_KEY || '',
  secret: process.env.PUSHER_SECRET || '',
  cluster: process.env.PUSHER_CLUSTER || 'us2',
  useTLS: true,
})

// Instância para ser usada no lado do CLIENTE (React Components, Hooks)
// Evita recriar a conexão a cada renderização
let pusherClientInstance: PusherClient | null = null

export const getPusherClient = (): PusherClient => {
  if (typeof window === 'undefined') {
    throw new Error('PusherClient só pode ser inicializado no lado do cliente.')
  }

  if (!pusherClientInstance) {
    const key = process.env.NEXT_PUBLIC_PUSHER_KEY || ''
    const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER || 'us2'
    
    pusherClientInstance = new PusherClient(key, {
      cluster,
      forceTLS: true,
    })
  }

  return pusherClientInstance
}
