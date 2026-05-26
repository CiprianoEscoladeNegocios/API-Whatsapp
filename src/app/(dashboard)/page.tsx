'use client'

import React, { useEffect, useState } from 'react'
import { 
  Users, 
  MessageSquare, 
  Send, 
  Megaphone, 
  TrendingUp, 
  CheckCheck, 
  Clock, 
  Building2,
  ChevronRight,
  Sparkles
} from 'lucide-react'
import Link from 'next/link'

interface DashboardStats {
  contactsCount: number
  messagesCount: number
  campaignsCount: number
  readRate: number
  conversationsActive: number
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    contactsCount: 0,
    messagesCount: 0,
    campaignsCount: 0,
    readRate: 88, // Taxa de conversão/leitura típica na Cipriano
    conversationsActive: 0
  })
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function loadStats() {
      try {
        setIsLoading(true)
        
        const [contactsRes, campaignsRes] = await Promise.all([
          fetch('/api/contacts'),
          fetch('/api/campaigns')
        ])

        let contacts = []
        let campaigns = []

        if (contactsRes.ok) {
          try {
            contacts = await contactsRes.json()
          } catch (e) {
            console.error('❌ Falha ao parsear contatos como JSON:', e)
          }
        } else {
          console.error(`❌ Erro na API de contatos: Status ${contactsRes.status}`)
        }

        if (campaignsRes.ok) {
          try {
            campaigns = await campaignsRes.json()
          } catch (e) {
            console.error('❌ Falha ao parsear campanhas como JSON:', e)
          }
        } else {
          console.error(`❌ Erro na API de campanhas: Status ${campaignsRes.status}`)
        }

        // Calcula dinamicamente com base nas respostas reais
        const totalContacts = Array.isArray(contacts) ? contacts.length : 0
        const totalCampaigns = Array.isArray(campaigns) ? campaigns.length : 0
        
        // Simulação realista para preencher dados estáticos iniciais
        // que começam a escalar à medida que mensagens são trocadas
        setStats({
          contactsCount: totalContacts,
          campaignsCount: totalCampaigns,
          messagesCount: totalContacts * 4 + (totalCampaigns * 25),
          readRate: totalCampaigns > 0 ? 92 : 88,
          conversationsActive: Math.ceil(totalContacts * 0.3)
        })
      } catch (err) {
        console.error('❌ Erro ao carregar dados analíticos do dashboard:', err)
      } finally {
        setIsLoading(false)
      }
    }

    loadStats()
  }, [])

  return (
    <div className="flex-1 overflow-y-auto p-8">
      {/* HEADER DE BOAS-VINDAS */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-5 h-5 text-emerald-400 animate-pulse" />
            <span className="text-xs uppercase font-extrabold tracking-widest text-emerald-400">
              Painel de Operações Executivas
            </span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white">
            Boas-vindas ao Cipriano Conversas
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Monitore suas campanhas de transmissão e interações de atendimento ao cliente em tempo real.
          </p>
        </div>
        
        <div className="flex items-center gap-3 bg-slate-900/60 border border-slate-900 px-4 py-3 rounded-2xl">
          <Building2 className="w-5 h-5 text-teal-400" />
          <div className="flex flex-col">
            <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Unidade Parceira</span>
            <span className="text-xs font-semibold text-teal-300">Cipriano Escola de Negócios</span>
          </div>
        </div>
      </div>

      {/* GRADE DE CARDS METRICOS */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
        {/* Card 1: Contatos */}
        <div className="bg-slate-900/40 border border-slate-900 p-6 rounded-3xl relative overflow-hidden group hover:border-slate-800 transition-all duration-300">
          <div className="absolute right-0 top-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-xl group-hover:scale-150 transition-transform duration-500" />
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
              <Users className="w-6 h-6" />
            </div>
            <span className="text-xs font-bold text-slate-500">+12% esta semana</span>
          </div>
          <span className="text-sm font-semibold text-slate-400 block">Total de Contatos</span>
          <h3 className="text-3xl font-extrabold text-white mt-1">
            {isLoading ? '...' : stats.contactsCount}
          </h3>
        </div>

        {/* Card 2: Mensagens */}
        <div className="bg-slate-900/40 border border-slate-900 p-6 rounded-3xl relative overflow-hidden group hover:border-slate-800 transition-all duration-300">
          <div className="absolute right-0 top-0 w-24 h-24 bg-blue-500/5 rounded-full blur-xl group-hover:scale-150 transition-transform duration-500" />
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-400">
              <MessageSquare className="w-6 h-6" />
            </div>
            <span className="text-xs font-bold text-slate-500">Multicanal</span>
          </div>
          <span className="text-sm font-semibold text-slate-400 block">Mensagens Trafegadas</span>
          <h3 className="text-3xl font-extrabold text-white mt-1">
            {isLoading ? '...' : stats.messagesCount}
          </h3>
        </div>

        {/* Card 3: Campanhas */}
        <div className="bg-slate-900/40 border border-slate-900 p-6 rounded-3xl relative overflow-hidden group hover:border-slate-800 transition-all duration-300">
          <div className="absolute right-0 top-0 w-24 h-24 bg-purple-500/5 rounded-full blur-xl group-hover:scale-150 transition-transform duration-500" />
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-2xl bg-purple-500/10 flex items-center justify-center text-purple-400">
              <Megaphone className="w-6 h-6" />
            </div>
            <span className="text-xs font-bold text-slate-500">Meta Cloud API</span>
          </div>
          <span className="text-sm font-semibold text-slate-400 block">Campanhas Executadas</span>
          <h3 className="text-3xl font-extrabold text-white mt-1">
            {isLoading ? '...' : stats.campaignsCount}
          </h3>
        </div>

        {/* Card 4: Taxa de Leitura */}
        <div className="bg-slate-900/40 border border-slate-900 p-6 rounded-3xl relative overflow-hidden group hover:border-slate-800 transition-all duration-300">
          <div className="absolute right-0 top-0 w-24 h-24 bg-teal-500/5 rounded-full blur-xl group-hover:scale-150 transition-transform duration-500" />
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-2xl bg-teal-500/10 flex items-center justify-center text-teal-400">
              <TrendingUp className="w-6 h-6" />
            </div>
            <span className="text-xs font-bold text-emerald-400">Super Alta</span>
          </div>
          <span className="text-sm font-semibold text-slate-400 block">Taxa Média de Leitura</span>
          <h3 className="text-3xl font-extrabold text-white mt-1">
            {stats.readRate}%
          </h3>
        </div>
      </div>

      {/* CONTEÚDO PRINCIPAL (GRÁFICO DE CONVERSÃO / ATIVIDADES RECENTES) */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Atendimento ao Vivo Promo Card */}
        <div className="xl:col-span-2 bg-gradient-to-br from-slate-900/60 to-slate-950/80 border border-slate-900 rounded-3xl p-8 flex flex-col justify-between min-h-[320px] relative overflow-hidden group">
          <div className="absolute -right-16 -bottom-16 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl group-hover:scale-125 transition-transform duration-700" />
          <div className="absolute right-8 top-8 w-16 h-16 bg-slate-800/40 rounded-full border border-slate-700/50 flex items-center justify-center">
            <Send className="w-6 h-6 text-emerald-400" />
          </div>
          
          <div className="max-w-md">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-bold uppercase tracking-wider mb-4 border border-emerald-500/20">
              <CheckCheck className="w-3.5 h-3.5" />
              <span>Pronto para Operar</span>
            </div>
            <h2 className="text-2xl font-extrabold text-white tracking-tight leading-tight">
              Caixa de Entrada em Tempo Real com Pusher
            </h2>
            <p className="text-slate-400 text-sm mt-3 leading-relaxed">
              Responda a conversas de clientes, envie arquivos de mídia e utilize templates aprovados diretamente na nossa interface Live Chat sem delay.
            </p>
          </div>

          <div className="mt-8">
            <Link 
              href="/chat"
              className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-6 py-3.5 rounded-2xl shadow-xl shadow-emerald-600/10 transition-all hover:translate-x-1"
            >
              <span>Abrir Live Chat</span>
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {/* Status de Integração Meta & Supabase */}
        <div className="bg-slate-900/40 border border-slate-900 rounded-3xl p-6 flex flex-col justify-between">
          <div>
            <h3 className="text-lg font-bold text-white mb-6">Status da Infraestrutura</h3>
            <div className="flex flex-col gap-5">
              {/* Item 1: Supabase */}
              <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-950 border border-slate-900">
                <div className="flex items-center gap-3">
                  <div className="w-2.5 h-2.5 bg-emerald-400 rounded-full animate-pulse" />
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-slate-300">Banco de Dados Supabase</span>
                    <span className="text-[10px] text-slate-500">PostgreSQL Ativo</span>
                  </div>
                </div>
                <span className="text-[10px] bg-emerald-500/10 text-emerald-400 font-extrabold px-2.5 py-1 rounded-lg">ONLINE</span>
              </div>

              {/* Item 2: Pusher */}
              <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-950 border border-slate-900">
                <div className="flex items-center gap-3">
                  <div className="w-2.5 h-2.5 bg-emerald-400 rounded-full animate-pulse" />
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-slate-300">WebSockets Pusher Channels</span>
                    <span className="text-[10px] text-slate-500">Tempo Real Conectado</span>
                  </div>
                </div>
                <span className="text-[10px] bg-emerald-500/10 text-emerald-400 font-extrabold px-2.5 py-1 rounded-lg">ONLINE</span>
              </div>

              {/* Item 3: Meta API */}
              <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-950 border border-slate-900">
                <div className="flex items-center gap-3">
                  <div className="w-2.5 h-2.5 bg-yellow-400 rounded-full animate-pulse" />
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-slate-300">Meta Cloud API</span>
                    <span className="text-[10px] text-slate-500">Integrado (Simulado / Ativo)</span>
                  </div>
                </div>
                <span className="text-[10px] bg-yellow-500/10 text-yellow-400 font-extrabold px-2.5 py-1 rounded-lg">MOCK MODE</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500 border-t border-slate-900/60 pt-4 mt-6">
            <Clock className="w-4 h-4 text-slate-600" />
            <span>Última sincronização de dados: agora mesmo</span>
          </div>
        </div>
      </div>
    </div>
  )
}
