'use client'

import React, { useEffect, useState } from 'react'
import { 
  FileText, 
  Plus, 
  X, 
  Sparkles, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  XCircle,
  HelpCircle,
  Code,
  Edit2,
  Trash2,
  Zap,
  Loader2
} from 'lucide-react'

interface Template {
  id: string
  metaTemplateId: string | null
  name: string
  category: string
  language: string
  body: string
  status: 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED'
  variables: string[]
  createdAt: string
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Criação de Template
  const [isNewModalOpen, setIsNewModalOpen] = useState(false)
  const [name, setName] = useState('')
  const [category, setCategory] = useState('MARKETING')
  const [language, setLanguage] = useState('pt_BR')
  const [body, setBody] = useState('')
  const [variablesStr, setVariablesStr] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  // Edição de Template
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null)
  const [editName, setEditName] = useState('')
  const [editCategory, setEditCategory] = useState('MARKETING')
  const [editLanguage, setEditLanguage] = useState('pt_BR')
  const [editBody, setEditBody] = useState('')
  const [editVariablesStr, setEditVariablesStr] = useState('')
  const [isUpdating, setIsUpdating] = useState(false)
  const [editErrorMsg, setEditErrorMsg] = useState('')

  const loadTemplates = async () => {
    try {
      setIsLoading(true)
      const res = await fetch('/api/templates')
      if (res.ok) {
        const data = await res.json()
        setTemplates(data)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadTemplates()
    
    // Polling de atualização de 4 segundos para refletir a aprovação simulada da Meta em tempo real
    const interval = setInterval(() => {
      loadTemplates()
    }, 4000)

    return () => clearInterval(interval)
  }, [])

  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name || !body || isSaving) return

    setIsSaving(true)
    setErrorMsg('')

    const variables = variablesStr
      ? variablesStr.split(',').map(v => v.trim()).filter(Boolean)
      : []

    try {
      const res = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          category,
          language,
          body,
          variables
        })
      })

      if (res.ok) {
        setName('')
        setBody('')
        setVariablesStr('')
        setIsNewModalOpen(false)
        loadTemplates()
      } else {
        const errData = await res.json()
        setErrorMsg(errData.error || 'Erro ao criar template.')
      }
    } catch (err: any) {
      console.error(err)
      setErrorMsg(err.message || 'Erro de conexão no servidor.')
    } finally {
      setIsSaving(false)
    }
  }

  // EXCLUIR TEMPLATE DEFINITIVAMENTE
  const handleDeleteTemplate = async (id: string, tplName: string) => {
    if (!window.confirm(`Tem certeza absoluta que deseja excluir o template "${tplName}" da Cipriano Escola de Negócios?`)) return
    try {
      const res = await fetch(`/api/templates/${id}`, {
        method: 'DELETE'
      })
      if (res.ok) {
        loadTemplates()
      } else {
        const errData = await res.json()
        alert(errData.error || 'Erro ao excluir template.')
      }
    } catch (err) {
      console.error('Erro ao excluir template:', err)
      alert('Erro de rede ao tentar excluir template.')
    }
  }

  // SIMULAR APROVAÇÃO IMEDIATA DA META (Forçar status APPROVED)
  const handleForceApprove = async (id: string) => {
    try {
      const res = await fetch(`/api/templates/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'APPROVED' })
      })
      if (res.ok) {
        loadTemplates()
      } else {
        const errData = await res.json()
        alert(errData.error || 'Erro ao simular aprovação.')
      }
    } catch (err) {
      console.error('Erro ao simular aprovação:', err)
    }
  }

  // ABRIR E POPULAR MODAL DE EDIÇÃO
  const handleOpenEditModal = (tpl: Template) => {
    setEditingTemplate(tpl)
    setEditName(tpl.name)
    setEditCategory(tpl.category)
    setEditLanguage(tpl.language)
    setEditBody(tpl.body)
    setEditVariablesStr(tpl.variables.join(', '))
    setEditErrorMsg('')
    setIsEditModalOpen(true)
  }

  // ATUALIZAR TEMPLATE EDITADO (PATCH)
  const handleUpdateTemplate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingTemplate || !editName || !editBody || isUpdating) return

    setIsUpdating(true)
    setEditErrorMsg('')

    const variables = editVariablesStr
      ? editVariablesStr.split(',').map(v => v.trim()).filter(Boolean)
      : []

    try {
      const res = await fetch(`/api/templates/${editingTemplate.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName,
          category: editCategory,
          language: editLanguage,
          body: editBody,
          variables
        })
      })

      if (res.ok) {
        setIsEditModalOpen(false)
        setEditingTemplate(null)
        loadTemplates()
      } else {
        const errData = await res.json()
        setEditErrorMsg(errData.error || 'Erro ao atualizar template.')
      }
    } catch (err: any) {
      console.error(err)
      setEditErrorMsg(err.message || 'Erro de conexão no servidor.')
    } finally {
      setIsUpdating(false)
    }
  }

  // Renderiza status badges de aprovação da Meta
  const renderStatusBadge = (status: string) => {
    if (status === 'APPROVED') {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded-xl font-bold">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>APROVADO</span>
        </span>
      )
    }
    if (status === 'PENDING') {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 px-2.5 py-1 rounded-xl font-bold animate-pulse">
          <Clock className="w-3.5 h-3.5" />
          <span>EM ANÁLISE META</span>
        </span>
      )
    }
    if (status === 'REJECTED') {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] bg-red-500/10 text-red-400 border border-red-500/20 px-2.5 py-1 rounded-xl font-bold">
          <XCircle className="w-3.5 h-3.5" />
          <span>REJEITADO</span>
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1 text-[10px] bg-slate-800 text-slate-400 px-2.5 py-1 rounded-xl font-bold">
        <HelpCircle className="w-3.5 h-3.5" />
        <span>RASCUNHO</span>
      </span>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-8 select-none">
      {/* HEADER PRINCIPAL */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-2">
            <FileText className="w-8 h-8 text-emerald-400" />
            <span>Templates Meta</span>
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Gerencie mensagens homologadas pela Meta para iniciar atendimentos e disparar campanhas ativas.
          </p>
        </div>

        <button
          onClick={() => setIsNewModalOpen(true)}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-5 py-3 rounded-2xl shadow-xl shadow-emerald-600/10 transition-all self-start md:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Novo Template</span>
        </button>
      </div>

      {/* LISTAGEM DE TEMPLATES */}
      {isLoading && templates.length === 0 ? (
        <div className="p-12 text-center text-slate-500 bg-slate-900/10 border border-slate-900/60 rounded-3xl">
          <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <span>Carregando templates homologados...</span>
        </div>
      ) : templates.length === 0 ? (
        <div className="p-12 text-center text-slate-600 bg-slate-900/10 border border-slate-900/60 rounded-3xl">
          Nenhum template cadastrado ainda. Crie o seu primeiro template para iniciar o marketing ativo!
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {templates.map((tpl) => (
            <div 
              key={tpl.id}
              className="bg-slate-900/40 border border-slate-900 hover:border-slate-800 transition-all rounded-3xl p-6 flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-4">
                  <span className="text-[10px] bg-slate-950 text-slate-400 border border-slate-900 font-extrabold px-2.5 py-1 rounded-lg">
                    {tpl.category}
                  </span>
                  {renderStatusBadge(tpl.status)}
                </div>

                <h3 className="text-sm font-bold text-slate-200 truncate mb-3" title={tpl.name}>
                  {tpl.name}
                </h3>

                {/* Caixa de Visualização do Corpo do Template */}
                <div className="bg-slate-950/80 border border-slate-900 p-4 rounded-2xl text-xs text-slate-400 leading-relaxed font-mono whitespace-pre-line min-h-[96px] mb-4">
                  {tpl.body}
                </div>

                {/* Ações Rápidas Premium */}
                <div className="flex items-center justify-between gap-2 mb-4 shrink-0">
                  <div className="flex items-center gap-2">
                    {(tpl.status === 'PENDING' || tpl.status === 'REJECTED') && (
                      <button
                        onClick={() => handleForceApprove(tpl.id)}
                        className="flex items-center gap-1 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 border border-emerald-500/20 px-2.5 py-1.5 rounded-xl text-[10px] font-extrabold transition-all hover:scale-[1.02] active:scale-100 flex-shrink-0"
                        title="Simular aprovação imediata pela Meta"
                      >
                        <Zap className="w-3 h-3 fill-emerald-400" />
                        <span>Simular Aprovação</span>
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 ml-auto">
                    <button
                      onClick={() => handleOpenEditModal(tpl)}
                      className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-950 rounded-xl border border-transparent hover:border-slate-800 transition-all active:scale-95"
                      title="Editar template"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteTemplate(tpl.id, tpl.name)}
                      className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-950/20 rounded-xl border border-transparent hover:border-red-950/30 transition-all active:scale-95"
                      title="Excluir template"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Variáveis e Rodapé */}
              <div className="border-t border-slate-900/60 pt-4 flex items-center justify-between text-[11px] text-slate-500">
                <div className="flex items-center gap-1">
                  <Code className="w-3.5 h-3.5 text-slate-600" />
                  <span>
                    {tpl.variables.length > 0 
                      ? `${tpl.variables.length} variáveis: {${tpl.variables.join(', ')}}`
                      : 'Sem variáveis'}
                  </span>
                </div>
                <span>pt_BR</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL: CRIAR NOVO TEMPLATE */}
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
              <Sparkles className="w-5 h-5 text-emerald-400" />
              <span>Criar Template de Mensagem</span>
            </h3>
            <p className="text-xs text-slate-400 mb-6">
              Templates são mensagens predefinidas e exigidas pela Meta para iniciar fluxos ativos. Nomes devem conter apenas letras minúsculas e underscores.
            </p>

            <form onSubmit={handleCreateTemplate} className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-slate-400 font-bold uppercase tracking-wider">Nome do Template</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: boas_vindas_vip"
                    className="bg-slate-900/60 border border-slate-900 focus:border-emerald-600 text-sm px-4 py-3 rounded-xl text-slate-100 focus:outline-none transition-all"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-slate-400 font-bold uppercase tracking-wider">Categoria</label>
                  <select
                    className="bg-slate-900/60 border border-slate-900 focus:border-emerald-600 text-sm px-3.5 py-3 rounded-xl text-slate-100 focus:outline-none transition-all"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    <option value="MARKETING">MARKETING</option>
                    <option value="UTILITY">UTILITÁRIO (Transacional)</option>
                    <option value="AUTHENTICATION">AUTENTICAÇÃO (OTP)</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-slate-400 font-bold uppercase tracking-wider">Conteúdo do Corpo (Body)</label>
                <textarea
                  required
                  rows={4}
                  placeholder="Ex: Olá {{1}}, confirmamos sua inscrição no treinamento executivo da Cipriano Escola de Negócios! Acesse o portal em {{2}}."
                  className="bg-slate-900/60 border border-slate-900 focus:border-emerald-600 text-sm px-4 py-3 rounded-xl text-slate-100 focus:outline-none transition-all resize-none font-mono"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                />
                <span className="text-[10px] text-slate-500">Dica: Use colchetes duplos com números sequenciais como variáveis, por exemplo: {"{{1}}"}, {"{{2}}"}.</span>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-slate-400 font-bold uppercase tracking-wider">Nomes das Variáveis (Opcional, separadas por vírgula)</label>
                <input
                  type="text"
                  placeholder="Ex: nome_cliente, link_acesso"
                  className="bg-slate-900/60 border border-slate-900 focus:border-emerald-600 text-sm px-4 py-3 rounded-xl text-slate-100 focus:outline-none transition-all"
                  value={variablesStr}
                  onChange={(e) => setVariablesStr(e.target.value)}
                />
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
                  disabled={isSaving}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-5 py-3 rounded-xl shadow-lg hover:shadow-emerald-600/10 transition-all flex items-center gap-2"
                >
                  {isSaving ? 'Enviando...' : 'Enviar para Análise'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDITAR TEMPLATE EXISTENTE */}
      {isEditModalOpen && editingTemplate && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-slate-950 border border-slate-900 w-full max-w-lg rounded-3xl p-6 relative">
            <button 
              onClick={() => {
                setIsEditModalOpen(false)
                setEditingTemplate(null)
              }}
              className="absolute right-4 top-4 text-slate-500 hover:text-slate-300 transition-colors p-1.5 hover:bg-slate-900 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-xl font-bold text-white flex items-center gap-2 mb-2">
              <Edit2 className="w-5 h-5 text-emerald-400" />
              <span>Alterar Template de Mensagem</span>
            </h3>
            <p className="text-xs text-slate-400 mb-6">
              Corrija a sintaxe de variáveis ou altere os textos do template homologado. Lembre-se que nomes editados devem seguir o padrão com letras minúsculas e underscores.
            </p>

            <form onSubmit={handleUpdateTemplate} className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-slate-400 font-bold uppercase tracking-wider">Nome do Template</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: boas_vindas_vip"
                    className="bg-slate-900/60 border border-slate-900 focus:border-emerald-600 text-sm px-4 py-3 rounded-xl text-slate-100 focus:outline-none transition-all"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-slate-400 font-bold uppercase tracking-wider">Categoria</label>
                  <select
                    className="bg-slate-900/60 border border-slate-900 focus:border-emerald-600 text-sm px-3.5 py-3 rounded-xl text-slate-100 focus:outline-none transition-all"
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                  >
                    <option value="MARKETING">MARKETING</option>
                    <option value="UTILITY">UTILITÁRIO (Transacional)</option>
                    <option value="AUTHENTICATION">AUTENTICAÇÃO (OTP)</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-slate-400 font-bold uppercase tracking-wider">Conteúdo do Corpo (Body)</label>
                <textarea
                  required
                  rows={4}
                  placeholder="Ex: Olá {{1}}, confirmamos sua inscrição no treinamento executivo da Cipriano Escola de Negócios! Acesse o portal em {{2}}."
                  className="bg-slate-900/60 border border-slate-900 focus:border-emerald-600 text-sm px-4 py-3 rounded-xl text-slate-100 focus:outline-none transition-all resize-none font-mono"
                  value={editBody}
                  onChange={(e) => setEditBody(e.target.value)}
                />
                <span className="text-[10px] text-slate-500">
                  Dica: Use colchetes duplos literais com números sequenciais como variáveis, por exemplo: {"{{1}}"}, {"{{2}}"}.
                </span>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-slate-400 font-bold uppercase tracking-wider">Nomes das Variáveis (Separadas por vírgula)</label>
                <input
                  type="text"
                  placeholder="Ex: nome_cliente, link_acesso"
                  className="bg-slate-900/60 border border-slate-900 focus:border-emerald-600 text-sm px-4 py-3 rounded-xl text-slate-100 focus:outline-none transition-all"
                  value={editVariablesStr}
                  onChange={(e) => setEditVariablesStr(e.target.value)}
                />
              </div>

              {editErrorMsg && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-red-950/40 border border-red-500/20 text-xs text-red-400">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{editErrorMsg}</span>
                </div>
              )}

              {/* Botões de Ação */}
              <div className="flex justify-end gap-3 mt-4 border-t border-slate-900/60 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditModalOpen(false)
                    setEditingTemplate(null)
                  }}
                  className="bg-slate-900 hover:bg-slate-800 text-slate-300 font-semibold px-5 py-3 rounded-xl transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-5 py-3 rounded-xl shadow-lg hover:shadow-emerald-600/10 transition-all flex items-center gap-2"
                >
                  {isUpdating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Salvando...</span>
                    </>
                  ) : (
                    <span>Salvar Alterações</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
