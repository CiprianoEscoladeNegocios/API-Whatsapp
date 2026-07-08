'use client'

import React, { useEffect, useState } from 'react'
import { 
  Save, 
  Clock, 
  Settings, 
  MessageSquare, 
  Sparkles, 
  Building2, 
  AlertCircle, 
  Check, 
  Loader2, 
  Calendar,
  Info
} from 'lucide-react'

interface DaySchedule {
  day: number
  enabled: boolean
  start: string
  end: string
  name: string
}

interface SettingsData {
  enabled: boolean
  message: string
  schedule: DaySchedule[]
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<SettingsData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  // Carrega as configurações na inicialização da página
  useEffect(() => {
    async function fetchSettings() {
      try {
        setIsLoading(true)
        const res = await fetch('/api/settings')
        if (res.ok) {
          const data = await res.json()
          setSettings(data)
        } else {
          throw new Error('Falha ao obter configurações da API')
        }
      } catch (err: any) {
        console.error('Erro ao carregar configurações:', err)
        setErrorMessage('Não foi possível carregar as configurações do servidor.')
        setSaveStatus('error')
      } finally {
        setIsLoading(false)
      }
    }

    fetchSettings()
  }, [])

  // Atualiza um dia específico na agenda de horários
  const handleScheduleChange = (dayNum: number, field: keyof DaySchedule, value: any) => {
    if (!settings) return

    const updatedSchedule = settings.schedule.map((item) => {
      if (item.day === dayNum) {
        return { ...item, [field]: value }
      }
      return item
    })

    setSettings({ ...settings, schedule: updatedSchedule })
  }

  // Envia as configurações atualizadas para o servidor
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!settings) return

    try {
      setIsSaving(true)
      setSaveStatus('idle')
      setErrorMessage('')

      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings),
      })

      if (res.ok) {
        setSaveStatus('success')
        setTimeout(() => setSaveStatus('idle'), 3000)
      } else {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Erro desconhecido ao salvar')
      }
    } catch (err: any) {
      console.error('Erro ao salvar configurações:', err)
      setErrorMessage(err.message || 'Falha ao salvar as configurações no servidor.')
      setSaveStatus('error')
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-slate-950">
        <Loader2 className="w-10 h-10 text-emerald-500 animate-spin mb-4" />
        <p className="text-slate-400 text-sm font-medium">Carregando painel de configurações...</p>
      </div>
    )
  }

  if (!settings) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-950">
        <div className="bg-red-500/10 border border-red-500/20 rounded-3xl p-6 max-w-md text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-white mb-2">Erro de Carregamento</h3>
          <p className="text-slate-400 text-sm mb-4">{errorMessage || 'Falha ao sincronizar com o banco de dados.'}</p>
          <button 
            onClick={() => window.location.reload()}
            className="px-5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 hover:bg-slate-800 transition-colors text-sm font-semibold"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-8">
      {/* CABEÇALHO */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-5 h-5 text-emerald-400" />
            <span className="text-xs uppercase font-extrabold tracking-widest text-emerald-400">
              Gestão de Atendimento Corporativo
            </span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
            <Settings className="w-8 h-8 text-slate-400" />
            Configurações Globais
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Gerencie o funcionamento automático do canal de WhatsApp e respostas inteligentes fora do expediente.
          </p>
        </div>

        <div className="flex items-center gap-3 bg-slate-900/60 border border-slate-900 px-4 py-3 rounded-2xl">
          <Building2 className="w-5 h-5 text-teal-400" />
          <div className="flex flex-col">
            <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Unidade Executiva</span>
            <span className="text-xs font-semibold text-teal-300">Cipriano Escola de Negócios</span>
          </div>
        </div>
      </div>

      {/* FORMULÁRIO PRINCIPAL */}
      <form onSubmit={handleSave} className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        
        {/* COLUNA ESQUERDA E CENTRAL: CONFIGURAÇÃO DE HORÁRIOS & ATIVAÇÃO */}
        <div className="xl:col-span-2 flex flex-col gap-6">
          
          {/* CARD DE ATIVAÇÃO */}
          <div className="bg-slate-900/40 border border-slate-900 rounded-3xl p-6 relative overflow-hidden group">
            <div className="absolute right-0 top-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-xl" />
            
            <div className="flex items-center justify-between">
              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${
                  settings.enabled 
                    ? 'bg-emerald-500/10 text-emerald-400' 
                    : 'bg-slate-800 text-slate-500'
                }`}>
                  <Clock className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Auto-Resposta de Fora de Expediente</h3>
                  <p className="text-slate-400 text-xs mt-0.5 leading-relaxed max-w-lg">
                    Quando ativo, responde automaticamente com uma mensagem institucional quando contatos enviarem mensagens fora do expediente de atendimento da Cipriano Escola de Negócios.
                  </p>
                </div>
              </div>

              {/* Toggle Switch Premium */}
              <button
                type="button"
                onClick={() => setSettings({ ...settings, enabled: !settings.enabled })}
                className={`w-14 h-8 rounded-full transition-colors relative duration-300 focus:outline-none ${
                  settings.enabled ? 'bg-emerald-600' : 'bg-slate-800'
                }`}
              >
                <div className={`absolute top-1 w-6 h-6 rounded-full bg-white transition-transform duration-300 shadow-md ${
                  settings.enabled ? 'left-7' : 'left-1'
                }`} />
              </button>
            </div>
          </div>

          {/* CARD DE HORÁRIOS DE ATENDIMENTO */}
          <div className="bg-slate-900/40 border border-slate-900 rounded-3xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <Calendar className="w-5 h-5 text-emerald-400" />
              <h3 className="text-lg font-bold text-white">Grade de Horário Comercial</h3>
            </div>

            <div className="flex flex-col gap-4">
              {settings.schedule.map((item) => (
                <div 
                  key={item.day}
                  className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-2xl border transition-all duration-300 ${
                    item.enabled 
                      ? 'bg-slate-950/60 border-slate-900' 
                      : 'bg-slate-950/20 border-slate-900/40 opacity-60'
                  }`}
                >
                  {/* Nome do Dia e Status */}
                  <div className="flex items-center gap-3 mb-3 sm:mb-0">
                    <button
                      type="button"
                      onClick={() => handleScheduleChange(item.day, 'enabled', !item.enabled)}
                      className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${
                        item.enabled 
                          ? 'bg-emerald-600 border-emerald-500 text-white' 
                          : 'border-slate-800 hover:border-slate-700 bg-slate-900'
                      }`}
                    >
                      {item.enabled && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </button>
                    <span className={`text-sm font-semibold transition-colors ${item.enabled ? 'text-white' : 'text-slate-500'}`}>
                      {item.name}
                    </span>
                  </div>

                  {/* Inputs de Horário */}
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500">Início:</span>
                      <input
                        type="time"
                        value={item.start}
                        disabled={!item.enabled}
                        onChange={(e) => handleScheduleChange(item.day, 'start', e.target.value)}
                        className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed w-28"
                      />
                    </div>
                    
                    <span className="text-slate-700 font-medium px-1">—</span>

                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500">Término:</span>
                      <input
                        type="time"
                        value={item.end}
                        disabled={!item.enabled}
                        onChange={(e) => handleScheduleChange(item.day, 'end', e.target.value)}
                        className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed w-28"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 flex items-start gap-2.5 p-3.5 rounded-2xl bg-emerald-500/5 border border-emerald-500/10">
              <Info className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <p className="text-slate-400 text-xs leading-relaxed">
                Os horários utilizam como referência o fuso horário de **Brasília (UTC-3)**. Certifique-se de configurar os horários oficiais corretos da Cipriano Escola de Negócios.
              </p>
            </div>
          </div>
        </div>

        {/* COLUNA DIREITA: MENSAGEM CUSTOMIZADA & BOTÃO DE AÇÃO */}
        <div className="flex flex-col gap-6">
          
          {/* MENSAGEM CUSTOMIZADA */}
          <div className="bg-slate-900/40 border border-slate-900 rounded-3xl p-6 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <MessageSquare className="w-5 h-5 text-emerald-400" />
              <h3 className="text-lg font-bold text-white">Mensagem Customizada</h3>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Conteúdo do Auto-Reply
              </label>
              <textarea
                value={settings.message}
                onChange={(e) => setSettings({ ...settings, message: e.target.value })}
                rows={10}
                className="w-full bg-slate-950 border border-slate-900 rounded-2xl p-4 text-sm text-slate-200 focus:outline-none focus:border-emerald-500 leading-relaxed resize-none font-sans"
                placeholder="Insira a mensagem que será enviada automaticamente..."
              />
              <div className="flex justify-between items-center text-xs text-slate-500 mt-1">
                <span>Contém dados da Cipriano Escola de Negócios</span>
                <span>{settings.message.length} caracteres</span>
              </div>
            </div>

            {/* Simulação Visual do Chat */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-900 flex flex-col gap-2">
              <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">Pré-visualização no Celular</span>
              <div className="bg-emerald-950/40 border border-emerald-900/20 text-emerald-100 text-xs p-3 rounded-2xl rounded-tr-none self-end max-w-full whitespace-pre-wrap leading-relaxed">
                {settings.message}
              </div>
              <span className="text-[9px] text-slate-600 self-end">Agora mesmo • Enviado automaticamente</span>
            </div>
          </div>

          {/* PAINEL DE SALVAR & FEEDBACK */}
          <div className="bg-slate-900/40 border border-slate-900 rounded-3xl p-6 flex flex-col gap-4">
            
            {/* Mensagem de Feedback de Ações */}
            {saveStatus === 'success' && (
              <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs">
                <Check className="w-4 h-4 shrink-0" />
                <span className="font-semibold">Configurações salvas e ativadas com sucesso!</span>
              </div>
            )}

            {saveStatus === 'error' && (
              <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span className="font-semibold">{errorMessage || 'Falha ao salvar as configurações.'}</span>
              </div>
            )}

            {/* Botão de Salvar */}
            <button
              type="submit"
              disabled={isSaving}
              className={`w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-2.5 transition-all text-white ${
                isSaving 
                  ? 'bg-slate-900 border border-slate-800 text-slate-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 shadow-xl shadow-emerald-950/20 hover:scale-[1.01] duration-300'
              }`}
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin text-slate-500" />
                  <span>Sincronizando...</span>
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  <span>Salvar Configurações</span>
                </>
              )}
            </button>
          </div>

        </div>

      </form>
    </div>
  )
}
