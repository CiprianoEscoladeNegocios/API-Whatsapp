import type { Metadata } from 'next'
import { Outfit } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'

const outfit = Outfit({ 
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
  variable: '--font-sans'
})

export const metadata: Metadata = {
  title: 'Cipriano Conversas | Plataforma SaaS WhatsApp API',
  description: 'Gerencie atendimentos em tempo real, crie listas de transmissão segmentadas e automatize o marketing via WhatsApp Cloud API Oficial da Meta. Criado pela Cipriano Escola de Negócios.',
  keywords: 'whatsapp api, marketing whatsapp, multiatendimento, rd conversas, blip, cipriano escola de negocios',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR" className={`${outfit.variable} dark`}>
      <head>
        <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🚀</text></svg>" />
      </head>
      <body className="font-sans antialiased bg-slate-950 text-slate-100 min-h-screen">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}

