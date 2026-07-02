'use client'

import React, { useEffect, useState } from 'react'
import { 
  Megaphone, 
  Plus, 
  X, 
  Sparkles, 
  AlertCircle, 
  Check, 
  TrendingUp, 
  Users,
  CheckCheck,
  Send,
  Loader2
} from 'lucide-react'

interface Campaign {
  id: string
  name: string
  templateName: string
  status: 'DRAFT' | 'SCHEDULED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'PAUSED' | 'CANCELED'
  createdAt: string
  targetTags: string[]
  stats: {
    total: number
    sent: number
    delivered: number
    read: number
    failed: number
  }
}

interface Template {
  id: string
  name: string
  status: string
  body: string
}

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [templates, setTemplates] = useState<Template[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Estados para Modal de Criação
  const [isNewModalOpen, setIsNewModalOpen] = useState(false)
  const [name, setName] = useState('')
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [tagStr, setTagStr] = useState('')
  const [isLaunching, setIsLaunching] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const loadCampaigns = async () => {
    try {
      const res = await fetch('/api/campaigns')
      if (res.ok) {
        const data = await res.json()
        setCampaigns(data)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  const loadTemplates = async () => {
    try {
      const res = await fetch('/api/templates')
      if (res.ok) {
        const data = await res.json()
        // Filtra apenas templates APPROVED conforme regras da Meta API
        const approvedTemplates = data.filter((t: any) => t.status === 'APPROVED')
        setTemplates(approvedTemplates)
        if (approvedTemplates.length > 0) {
          setSelectedTemplateId(approvedTemplates[0].id)
        }
      }
    } catch (err) {
      console.error(err)
    }
  }

  useEffect(() => {
    loadCampaigns()
    loadTemplates()

    // Polling a cada 5 segundos para atualizar as barras de progresso das campanhas ativas
    const interval = setInterval(() => {
      loadCampaigns()
    }, 5000)

    return () => clearInterval(interval)
  }, [])

  const handleLaunchCampaign = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name || !selectedTemplateId || !tagStr || isLaunching) return

    setIsLaunching(true)
    setErrorMsg('')

    const targetTags = tagStr.split(',').map(t => t.trim()).filter(Boolean)

    try {
      const res = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          templateId: selectedTemplateId,
          targetTags
        })
      })

      if (res.ok) {
        setName('')
        setTagStr('')
        setIsNewModalOpen(false)
        loadCampaigns()
      } else {
        const errData = await res.json()
        setErrorMsg(errData.error || 'Erro ao lançar campanha.')
      }
    } catch (err: any) {
      console.error(err)
      setErrorMsg(err.message || 'Erro de conexão.')
    } finally {
      setIsLaunching(false)
    }
  }

  const handleUpdateCampaignStatus = async (campaignId: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/campaigns/${campaignId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      })

      if (res.ok) {
        loadCampaigns()
      } else {
        const errData = await res.json()
        alert(errData.error || 'Erro ao atualizar status da campanha.')
      }
    } catch (err) {
      console.error(err)
      alert('Erro de conexão ao atualizar status.')
    }
  }

  // Helper para renderizar status e cores das campanhas
  const renderCampaignStatus = (status: string) => {
    if (status === 'COMPLETED') {
      return (
        <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded-xl font-bold">
          CONCLUÍDA
        </span>
      )
    }
    if (status === 'RUNNING') {
      return (
        <span className="inline-flex items-center gap-1.5 text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2.5 py-1 rounded-xl font-bold">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          <span>ENVIANDO MENSAGENS</span>
        </span>
      )
    }
    if (status === 'PAUSED') {
      return (
        <span className="text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2.5 py-1 rounded-xl font-bold">
          PAUSADA
        </span>
      )
    }
    if (status === 'CANCELED') {
      return (
        <span className="text-[10px] bg-rose-500/10 text-rose-400 border border-rose-500/20 px-2.5 py-1 rounded-xl font-bold">
          CANCELADA
        </span>
      )
    }
    if (status === 'FAILED') {
      return (
        <span className="text-[10px] bg-red-500/10 text-red-400 border border-red-500/20 px-2.5 py-1 rounded-xl font-bold">
          FALHOU
        </span>
      )
    }
    return (
      <span className="text-[10px] bg-slate-800 text-slate-400 px-2.5 py-1 rounded-xl font-bold">
        RASCUNHO
      </span>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-8 select-none">
      {/* HEADER PRINCIPAL */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-2">
            <Megaphone className="w-8 h-8 text-emerald-400" />
            <span>Campanhas de Disparo</span>
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Realize disparos em massa agendados ou imediatos de mensagens altamente convertidas via WhatsApp API.
          </p>
        </div>

        <button
          onClick={() => {
            loadTemplates() // Atualiza templates ao abrir
            setIsNewModalOpen(true)
          }}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-5 py-3 rounded-2xl shadow-xl shadow-emerald-600/10 transition-all self-start md:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Criar Campanha</span>
        </button>
      </div>

      {/* LISTAGEM DE CAMPANHAS COM METRICAS DE PROGRESSO */}
      {isLoading && campaigns.length === 0 ? (
        <div className="p-12 text-center text-slate-500 bg-slate-900/10 border border-slate-900/60 rounded-3xl">
          <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <span>Carregando campanhas comerciais...</span>
        </div>
      ) : campaigns.length === 0 ? (
        <div className="p-12 text-center text-slate-600 bg-slate-900/10 border border-slate-900/60 rounded-3xl">
          Nenhuma campanha disparada ainda. Crie sua primeira campanha segmentando leads por Tags!
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {campaigns.map((camp) => {
            // Calcula porcentagens de progresso reais
            const total = camp.stats.total || 1
            const sentPercent = Math.round((camp.stats.sent / total) * 100)
            const readPercent = Math.round((camp.stats.read / total) * 100)
            const deliveredPercent = Math.round((camp.stats.delivered / total) * 100)

            return (
              <div 
                key={camp.id}
                className="bg-slate-900/40 border border-slate-900 rounded-3xl p-6 hover:border-slate-800 transition-all"
              >
                {/* Cabeçalho do Card */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-900/60 mb-6">
                  <div>
                    <h3 className="text-base font-bold text-slate-200">{camp.name}</h3>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      <span className="text-[10px] text-slate-500 font-semibold">
                        Template: <strong className="text-emerald-400">{camp.templateName}</strong>
                      </span>
                      <span className="text-slate-700 text-xs select-none">•</span>
                      <span className="text-[10px] text-slate-500 font-semibold flex items-center gap-1">
                        Filtro: {camp.targetTags.map((t, idx) => (
                          <span key={idx} className="bg-slate-950 px-1.5 py-0.5 rounded border border-slate-900 text-slate-400">{t}</span>
                        ))}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {/* Botões de Ação para Controle de Disparo */}
                    {(camp.status === 'RUNNING' || camp.status === 'PAUSED' || camp.status === 'DRAFT') && (
                      <div className="flex gap-2">
                        {camp.status === 'RUNNING' && (
                          <button
                            onClick={() => handleUpdateCampaignStatus(camp.id, 'PAUSED')}
                            className="bg-amber-600/10 hover:bg-amber-600/30 text-amber-400 border border-amber-500/20 text-[10px] font-bold px-3 py-1.5 rounded-xl transition-all"
                          >
                            Pausar
                          </button>
                        )}
                        {(camp.status === 'PAUSED' || camp.status === 'DRAFT') && (
                          <button
                            onClick={() => handleUpdateCampaignStatus(camp.id, 'RUNNING')}
                            className="bg-emerald-600/10 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold px-3 py-1.5 rounded-xl transition-all"
                          >
                            Iniciar
                          </button>
                        )}
                        {(camp.status === 'RUNNING' || camp.status === 'PAUSED') && (
                          <button
                            onClick={() => handleUpdateCampaignStatus(camp.id, 'CANCELED')}
                            className="bg-rose-600/10 hover:bg-rose-600/30 text-rose-400 border border-rose-500/20 text-[10px] font-bold px-3 py-1.5 rounded-xl transition-all"
                          >
                            Cancelar
                          </button>
                        )}
                      </div>
                    )}
                    {renderCampaignStatus(camp.status)}
                  </div>
                </div>

                {/* Grid de Estatísticas e Progresso */}
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                  {/* Bloco 1: Progresso Visual */}
                  <div className="xl:col-span-2 flex flex-col gap-4 justify-center">
                    <div>
                      <div className="flex justify-between text-xs font-semibold mb-2">
                        <span className="text-slate-400">Progresso de Leitura dos Clientes</span>
                        <span className="text-emerald-400">{readPercent}% concluído</span>
                      </div>
                      
                      {/* Barra de Progresso Harmoniosa */}
                      <div className="w-full h-3 bg-slate-950 rounded-full overflow-hidden border border-slate-900 flex">
                        <div 
                          className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-1000"
                          style={{ width: `${readPercent}%` }}
                        />
                        <div 
                          className="h-full bg-blue-500/60 transition-all duration-1000"
                          style={{ width: `${deliveredPercent - readPercent}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-6 text-[10px] text-slate-500 select-none">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-emerald-500" />
                        <span>Mensagens Lidas: {camp.stats.read}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-blue-500" />
                        <span>Entregues no Celular: {camp.stats.delivered}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-slate-600" />
                        <span>Disparadas (Sent): {camp.stats.sent}</span>
                      </div>
                    </div>
                  </div>

                  {/* Bloco 2: Cards Rápidos */}
                  <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-2 gap-4">
                    {/* Alvos */}
                    <div className="bg-slate-950 border border-slate-900/60 rounded-2xl p-4 flex flex-col justify-between">
                      <div className="flex items-center justify-between text-slate-500">
                        <Users className="w-4 h-4" />
                        <span className="text-[10px] font-bold">ALVOS</span>
                      </div>
                      <h4 className="text-xl font-extrabold text-slate-200 mt-2">{camp.stats.total}</h4>
                    </div>

                    {/* Lidas */}
                    <div className="bg-slate-950 border border-slate-900/60 rounded-2xl p-4 flex flex-col justify-between">
                      <div className="flex items-center justify-between text-emerald-500">
                        <CheckCheck className="w-4 h-4" />
                        <span className="text-[10px] font-bold">LIDAS</span>
                      </div>
                      <h4 className="text-xl font-extrabold text-emerald-400 mt-2">{camp.stats.read}</h4>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* MODAL: CRIAR CAMPANHA */}
      {isNewModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-slate-950 border border-slate-900 w-full max-w-lg rounded-3xl p-6 relative">
            <button 
              onClick={() => setIsNewModalOpen(false)}
              className="absolute right-4 top-4 text-slate-500 hover:text-slate-300 transition-colors p-1.5 hover:bg-slate-900 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-xl font-bold text-white flex items-center gap-2 mb-2">
              <Megaphone className="w-5 h-5 text-emerald-400 animate-bounce" />
              <span>Lançar Campanha de Disparo</span>
            </h3>
            <p className="text-xs text-slate-400 mb-6">
              Selecione as segmentações de leads por Tags e selecione o Template homologado pela Meta para disparar em lote em tempo real.
            </p>

            <form onSubmit={handleLaunchCampaign} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-slate-400 font-bold uppercase tracking-wider">Nome Comercial da Campanha</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Campanha Promocional Alunos Maio"
                  className="bg-slate-900/60 border border-slate-900 focus:border-emerald-600 text-sm px-4 py-3 rounded-xl text-slate-100 focus:outline-none transition-all"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-slate-400 font-bold uppercase tracking-wider">Selecionar Template Aprovado</label>
                {templates.length === 0 ? (
                  <div className="text-xs text-yellow-500 bg-yellow-500/5 border border-yellow-500/20 p-3.5 rounded-xl flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>Nenhum template APROVADO pela Meta foi encontrado. Crie um template e aguarde 10 segundos para aprovação.</span>
                  </div>
                ) : (
                  <select
                    className="bg-slate-900/60 border border-slate-900 focus:border-emerald-600 text-sm px-3.5 py-3 rounded-xl text-slate-100 focus:outline-none transition-all"
                    value={selectedTemplateId}
                    onChange={(e) => setSelectedTemplateId(e.target.value)}
                  >
                    {templates.map((tpl) => (
                      <option key={tpl.id} value={tpl.id}>
                        {tpl.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-slate-400 font-bold uppercase tracking-wider">Mapeamento de Destinatários por Tags</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Alunos, VIP"
                  className="bg-slate-900/60 border border-slate-900 focus:border-emerald-600 text-sm px-4 py-3 rounded-xl text-slate-100 focus:outline-none transition-all"
                  value={tagStr}
                  onChange={(e) => setTagStr(e.target.value)}
                />
                <span className="text-[10px] text-slate-500">Apenas contatos que possuem pelo menos uma das tags inseridas receberão o disparo.</span>
              </div>

              {errorMsg && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-red-950/40 border border-red-500/20 text-xs text-red-400">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Botões de Ação */}
              <div className="flex justify-end gap-3 mt-4 border-t border-slate-900/60 pt-4">
                <button
                  type="button"
                  onClick={() => setIsNewModalOpen(false)}
                  className="bg-slate-900 hover:bg-slate-800 text-slate-300 font-semibold px-5 py-3 rounded-xl transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isLaunching || templates.length === 0}
                  className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:hover:bg-emerald-600 text-white font-semibold px-5 py-3 rounded-xl shadow-lg hover:shadow-emerald-600/10 transition-all flex items-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  <span>{isLaunching ? 'Lançando...' : 'Lançar Disparos'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
