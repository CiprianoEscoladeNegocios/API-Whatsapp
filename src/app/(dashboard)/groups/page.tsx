'use client'

import React, { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { 
  Building2, Plus, Copy, Check, MessageSquare, Tag, 
  Trash2, Shield, User, Settings, Image as ImageIcon, 
  Loader2, Save, Users, AlertCircle, Sparkles, Globe 
} from 'lucide-react'

export default function GroupsAdminPage() {
  const router = useRouter()
  const { data: session } = useSession()
  const operatorId = session?.user?.id || 'operator'

  const [groups, setGroups] = useState<any[]>([])
  const [selectedGroup, setSelectedGroup] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)

  // Estados de Criação de Grupo
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [welcomeMessage, setWelcomeMessage] = useState('')
  const [onlyAdminsCanMessage, setOnlyAdminsCanMessage] = useState(false)
  const [creating, setCreating] = useState(false)

  // Estados de Edição do Grupo Selecionado
  const [editName, setEditName] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [editWelcome, setEditWelcome] = useState('')
  const [editOnlyAdmins, setEditOnlyAdmins] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)

  const [copiedGroupToken, setCopiedGroupToken] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  // 1. Carregar grupos virtuais
  async function fetchGroups() {
    try {
      const res = await fetch('/api/groups')
      if (res.ok) {
        const data = await res.json()
        setGroups(data)
        if (data.length > 0 && !selectedGroup) {
          selectGroup(data[0])
        } else if (selectedGroup) {
          const updatedSelected = data.find((g: any) => g.id === selectedGroup.id)
          if (updatedSelected) {
            selectGroup(updatedSelected)
          }
        }
      }
    } catch (err) {
      console.error('Erro ao buscar grupos:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchGroups()
  }, [])

  const selectGroup = (group: any) => {
    setSelectedGroup(group)
    setEditName(group.name)
    setEditDesc(group.description || '')
    setEditWelcome(group.welcomeMessage || '')
    setEditOnlyAdmins(group.onlyAdminsCanMessage)
  }

  // 2. Criar novo grupo virtual
  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || creating) return

    setCreating(true)
    try {
      const res = await fetch('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          welcomeMessage: welcomeMessage.trim(),
          onlyAdminsCanMessage,
          operatorId
        })
      })

      if (res.ok) {
        const newGroup = await res.json()
        setName('')
        setDescription('')
        setWelcomeMessage('')
        setOnlyAdminsCanMessage(false)
        setShowCreateModal(false)
        await fetchGroups()
        selectGroup(newGroup)
      } else {
        alert('Falha ao criar o grupo virtual.')
      }
    } catch (err) {
      console.error(err)
      alert('Erro de conexão ao criar grupo.')
    } finally {
      setCreating(false)
    }
  }

  // 3. Atualizar configurações do grupo virtual
  const handleUpdateGroup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedGroup || saving) return

    setSaving(true)
    try {
      const res = await fetch(`/api/groups/${selectedGroup.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName.trim(),
          description: editDesc.trim(),
          welcomeMessage: editWelcome.trim(),
          onlyAdminsCanMessage: editOnlyAdmins,
          avatarUrl: selectedGroup.avatarUrl
        })
      })

      if (res.ok) {
        await fetchGroups()
        alert('Configurações salvas com absoluto sucesso!')
      } else {
        alert('Falha ao atualizar o grupo.')
      }
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  // 4. Deleção do grupo
  const handleDeleteGroup = async (id: string) => {
    if (!confirm('Deseja realmente excluir este grupo virtual? Esta ação removerá todos os históricos e membros.')) return

    try {
      const res = await fetch(`/api/groups/${id}`, {
        method: 'DELETE'
      })
      if (res.ok) {
        setSelectedGroup(null)
        await fetchGroups()
      } else {
        alert('Erro ao excluir o grupo.')
      }
    } catch (err) {
      console.error(err)
    }
  }

  // 5. Moderação de Admin
  const handleToggleMemberAdmin = async (memberId: string, currentIsAdmin: boolean) => {
    if (!selectedGroup) return

    try {
      const res = await fetch(`/api/groups/${selectedGroup.id}/members/admin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId,
          isAdmin: !currentIsAdmin
        })
      })

      if (res.ok) {
        await fetchGroups()
      } else {
        alert('Falha ao alterar privilégios do membro.')
      }
    } catch (err) {
      console.error(err)
    }
  }

  // 6. Upload de Avatar do Grupo
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !selectedGroup) return

    setUploadingAvatar(true)
    const formData = new FormData()
    formData.append('file', file)

    try {
      // 1. Faz upload para a rota de arquivos que já temos
      const uploadRes = await fetch('/api/chat/upload', {
        method: 'POST',
        body: formData
      })

      if (!uploadRes.ok) throw new Error('Falha no upload da imagem')
      const uploadData = await uploadRes.json()

      // 2. Atualiza a URL do avatar do grupo no banco
      const updateRes = await fetch(`/api/groups/${selectedGroup.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName,
          description: editDesc,
          welcomeMessage: editWelcome,
          onlyAdminsCanMessage: editOnlyAdmins,
          avatarUrl: uploadData.url // Nova URL
        })
      })

      if (updateRes.ok) {
        await fetchGroups()
      } else {
        alert('Falha ao vincular imagem ao grupo.')
      }
    } catch (err) {
      console.error(err)
      alert('Erro ao realizar upload do avatar.')
    } finally {
      setUploadingAvatar(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  // 7. Copiar link de convite
  const handleCopyInviteLink = (groupToken: string) => {
    const appUrl = window.location.origin
    const inviteLink = `${appUrl}/invite/${groupToken}`
    navigator.clipboard.writeText(inviteLink)
    setCopiedGroupToken(groupToken)
    setTimeout(() => {
      setCopiedGroupToken(null)
    }, 2000)
  }

  return (
    <div className="flex-1 flex overflow-hidden bg-slate-950 select-none">
      
      {/* 1. SEÇÃO DA ESQUERDA: LISTA DE GRUPOS VIRTUAIS */}
      <div className="w-96 border-r border-slate-900 flex flex-col bg-slate-950/40 shrink-0">
        
        {/* Cabeçalho */}
        <div className="p-4 border-b border-slate-900 bg-slate-950/60 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-emerald-400" />
            <h1 className="text-sm font-bold text-slate-200">Grupos Virtuais</h1>
          </div>
          
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-emerald-600 hover:bg-emerald-500 text-white p-2 rounded-xl text-xs font-bold transition-all shadow-md active:scale-95"
            title="Criar Novo Grupo Virtual"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Lista com scroll */}
        <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
          {loading ? (
            <div className="p-8 text-center text-sm text-slate-500 flex flex-col items-center gap-3">
              <Loader2 className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              <span>Carregando grupos da Cipriano...</span>
            </div>
          ) : groups.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-600 leading-relaxed">
              Nenhum grupo virtual foi criado ainda. Clique no "+" no topo para criar sua primeira sala de comunicação de negócios!
            </div>
          ) : (
            groups.map((group) => {
              const isSelected = selectedGroup?.id === group.id
              return (
                <div
                  key={group.id}
                  onClick={() => selectGroup(group)}
                  className={`flex items-center justify-between p-3.5 rounded-2xl cursor-pointer border transition-all ${
                    isSelected 
                      ? 'bg-slate-900/80 border-emerald-500/20 text-white shadow-md' 
                      : 'bg-slate-950/40 border-slate-950 hover:bg-slate-900/30 hover:border-slate-900 text-slate-400'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {group.avatarUrl ? (
                      <img 
                        src={group.avatarUrl} 
                        alt={group.name} 
                        className="w-10 h-10 rounded-xl object-cover border border-slate-800 shadow-sm shrink-0" 
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600/30 to-teal-500/30 border border-emerald-500/10 flex items-center justify-center font-bold text-emerald-400 text-sm shrink-0">
                        {group.name.substring(0, 1).toUpperCase()}
                      </div>
                    )}
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-bold truncate text-slate-200">{group.name}</span>
                      <span className="text-[10px] text-slate-500 font-semibold tracking-wide uppercase mt-0.5">
                        {group.members.length} {group.members.length === 1 ? 'Membro' : 'Membros'}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDeleteGroup(group.id)
                    }}
                    className="opacity-0 group-hover:opacity-100 hover:opacity-100 p-1.5 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-950/20 transition-all active:scale-95"
                    title="Excluir Grupo"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* 2. SEÇÃO DA DIREITA: CONFIGURAÇÕES E MODERAÇÃO DO GRUPO */}
      <div className="flex-1 flex flex-col bg-slate-950">
        {selectedGroup ? (
          <div className="flex-1 overflow-y-auto p-8 flex flex-col gap-8 max-w-4xl">
            
            {/* Header com Avatar e Nome */}
            <div className="flex items-center justify-between border-b border-slate-900 pb-6 shrink-0">
              <div className="flex items-center gap-5">
                <div className="relative group/avatar">
                  {selectedGroup.avatarUrl ? (
                    <img 
                      src={selectedGroup.avatarUrl} 
                      alt={selectedGroup.name} 
                      className="w-16 h-16 rounded-2xl border border-slate-800 object-cover shadow-lg" 
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-600/30 to-teal-500/30 border border-emerald-500/20 flex items-center justify-center font-extrabold text-emerald-400 text-2xl shadow-lg">
                      {selectedGroup.name.substring(0, 1).toUpperCase()}
                    </div>
                  )}

                  {/* Input do Arquivo do Avatar Oculto */}
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleAvatarUpload}
                    className="hidden"
                    accept="image/*"
                  />
                  
                  {/* Overlay para Upload */}
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingAvatar}
                    className="absolute inset-0 bg-slate-950/70 rounded-2xl flex items-center justify-center text-slate-300 opacity-0 group-hover/avatar:opacity-100 transition-opacity active:scale-95 border border-emerald-500/20"
                    title="Alterar imagem do grupo"
                  >
                    {uploadingAvatar ? (
                      <Loader2 className="w-5 h-5 animate-spin text-emerald-400" />
                    ) : (
                      <ImageIcon className="w-5 h-5" />
                    )}
                  </button>
                </div>

                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <span>{selectedGroup.name}</span>
                    <button
                      onClick={() => handleCopyInviteLink(selectedGroup.inviteToken)}
                      className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-emerald-400 hover:border-emerald-500/20 active:scale-95 transition-all shadow"
                      title="Copiar Link de Convite"
                    >
                      {copiedGroupToken === selectedGroup.inviteToken ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </h2>
                  <p className="text-xs text-slate-500 mt-1 max-w-lg">
                    {selectedGroup.description || 'Sem descrição cadastrada para este grupo.'}
                  </p>
                </div>
              </div>

              {/* Ação de ir para Chat */}
              <button
                onClick={() => router.push(`/group-chat/${selectedGroup.id}`)}
                className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg hover:shadow-emerald-600/10 active:scale-95 transition-all"
              >
                <MessageSquare className="w-4 h-4" />
                <span>Entrar na Sala de Chat</span>
              </button>
            </div>

            {/* Painel de Configurações */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              
              {/* Formulário de Configurações */}
              <form onSubmit={handleUpdateGroup} className="flex flex-col gap-5 bg-slate-900/30 border border-slate-900/60 p-6 rounded-3xl backdrop-blur-xl">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-2">
                  <Settings className="w-4 h-4 text-emerald-400" />
                  <span>Configurações do Grupo</span>
                </h3>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                    Nome do Grupo
                  </label>
                  <input
                    type="text"
                    required
                    className="bg-slate-950 border border-slate-900 focus:border-emerald-600 text-xs px-3.5 py-2.5 rounded-xl text-slate-100 focus:outline-none transition-all"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                    Descrição do Grupo
                  </label>
                  <textarea
                    rows={2}
                    className="bg-slate-950 border border-slate-900 focus:border-emerald-600 text-xs px-3.5 py-2.5 rounded-xl text-slate-100 resize-none focus:outline-none transition-all"
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider flex items-center gap-1.5">
                    <span>Mensagem de Boas-Vindas do WhatsApp</span>
                    <span className="text-[8px] bg-slate-950 border border-slate-800 text-slate-500 px-1 py-0.5 rounded font-mono uppercase">
                      Twilio API
                    </span>
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Olá! Seja bem-vindo ao grupo de mentoria corporativa..."
                    className="bg-slate-950 border border-slate-900 focus:border-emerald-600 text-xs px-3.5 py-2.5 rounded-xl text-slate-100 resize-none focus:outline-none transition-all"
                    value={editWelcome}
                    onChange={(e) => setEditWelcome(e.target.value)}
                  />
                  <span className="text-[9px] text-slate-600 leading-tight">
                    Disparada de forma automatizada no WhatsApp do contato assim que ele ingressar via link de convite.
                  </span>
                </div>

                {/* Alternância de Mensagens Bloqueadas */}
                <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-950/60 border border-slate-900/80 mt-2 select-none">
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-slate-200">Moderação de Envio</span>
                    <span className="text-[9px] text-slate-500 mt-0.5">Apenas administradores podem postar na sala</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={editOnlyAdmins}
                    onChange={(e) => setEditOnlyAdmins(e.target.checked)}
                    className="w-4 h-4 accent-emerald-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={saving}
                  className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white py-3 rounded-xl text-xs font-bold transition-all shadow-lg flex items-center justify-center gap-2 mt-4 active:scale-95"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Salvando...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5" />
                      <span>Salvar Configurações</span>
                    </>
                  )}
                </button>
              </form>

              {/* Lista de Membros do Grupo e Promoção de Admin */}
              <div className="flex flex-col bg-slate-900/30 border border-slate-900/60 p-6 rounded-3xl backdrop-blur-xl">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-emerald-400" />
                    <span>Membros do Grupo ({selectedGroup.members.length})</span>
                  </div>
                </h3>

                {/* Lista */}
                <div className="flex-1 overflow-y-auto max-h-[360px] pr-1 flex flex-col gap-2.5">
                  {selectedGroup.members.length === 0 ? (
                    <div className="text-center py-8 text-xs text-slate-600">
                      Nenhum participante neste grupo virtual ainda. Copie e envie o link de convite!
                    </div>
                  ) : (
                    selectedGroup.members.map((member: any) => {
                      const isOperator = !!member.userId
                      const name = isOperator ? member.user?.name : member.contact?.name
                      const subLabel = isOperator ? 'Operador' : `+${member.contact?.phone}`

                      return (
                        <div 
                          key={member.id}
                          className="flex items-center justify-between p-3 rounded-2xl bg-slate-950/40 border border-slate-950 select-none hover:border-slate-900 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center font-bold text-slate-400 text-xs uppercase border border-slate-800 shrink-0">
                              {name?.substring(0, 1).toUpperCase()}
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="text-xs font-bold truncate text-slate-200">{name}</span>
                              <span className="text-[10px] text-slate-500 font-semibold tracking-wide uppercase mt-0.5">{subLabel}</span>
                            </div>
                          </div>

                          {/* Alternância de Admin do Grupo */}
                          <button
                            onClick={() => handleToggleMemberAdmin(member.id, member.isAdmin)}
                            className={`px-2.5 py-1.5 rounded-lg border font-bold text-[9px] uppercase tracking-wider active:scale-95 transition-all flex items-center gap-1 ${
                              member.isAdmin 
                                ? 'bg-emerald-950/60 border-emerald-500/20 text-emerald-400' 
                                : 'bg-slate-950 border-slate-850 text-slate-500 hover:text-slate-300 hover:border-slate-700'
                            }`}
                            title={member.isAdmin ? 'Remover privilégio de Admin' : 'Tornar Admin do Grupo'}
                          >
                            <Shield className="w-3 h-3" />
                            <span>{member.isAdmin ? 'Admin' : 'Membro'}</span>
                          </button>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>

            </div>

          </div>
        ) : (
          /* Estado Sem Seleção */
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 select-none">
            <div className="w-20 h-20 rounded-3xl bg-slate-900/60 border border-slate-900 flex items-center justify-center mb-6">
              <Building2 className="w-10 h-10 text-emerald-400" />
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight">
              Gerencie seus Grupos Virtuais
            </h2>
            <p className="text-slate-500 text-xs mt-2 max-w-[320px] leading-relaxed">
              Selecione algum grupo virtual da barra lateral esquerda para ajustar suas permissões, gerenciar administradores, customizar avatares ou acessar a sala de debate.
            </p>
          </div>
        )}
      </div>

      {/* 3. MODAL DE CRIAÇÃO DE NOVO GRUPO VIRTUAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-[460px] bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl flex flex-col animate-fade-in select-none">
            
            {/* Header */}
            <div className="flex items-center justify-between mb-5 border-b border-slate-800 pb-3 shrink-0">
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-emerald-400" />
                <span>Criar Grupo Virtual</span>
              </h3>
              <button 
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-slate-500 hover:text-slate-300 transition-colors p-1 hover:bg-slate-800 rounded-lg"
              >
                Criar
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleCreateGroup} className="flex flex-col gap-4">
              
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                  Nome do Grupo
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Turma Financeira Cipriano 2026"
                  className="bg-slate-950 border border-slate-800 focus:border-emerald-600 text-xs px-3.5 py-2.5 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none transition-all"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                  Descrição do Grupo (Opcional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Mentoria e debates sobre carreira executiva..."
                  className="bg-slate-950 border border-slate-800 focus:border-emerald-600 text-xs px-3.5 py-2.5 rounded-xl text-slate-100 resize-none placeholder-slate-600 focus:outline-none transition-all"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider flex items-center gap-1">
                  <span>Mensagem de Boas-Vindas do WhatsApp</span>
                  <span className="text-[8px] bg-slate-950 border border-slate-800 text-slate-500 px-1 py-0.5 rounded font-mono uppercase">
                    Twilio
                  </span>
                </label>
                <textarea
                  rows={2.5}
                  placeholder="Olá! Seja muito bem-vindo ao grupo de mentoria..."
                  className="bg-slate-950 border border-slate-800 focus:border-emerald-600 text-xs px-3.5 py-2.5 rounded-xl text-slate-100 resize-none placeholder-slate-600 focus:outline-none transition-all"
                  value={welcomeMessage}
                  onChange={(e) => setWelcomeMessage(e.target.value)}
                />
                <span className="text-[9px] text-slate-600 leading-tight">
                  Enviada no WhatsApp do contato de forma automatizada ao entrar.
                </span>
              </div>

              {/* Moderação */}
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-950/60 border border-slate-850 mt-1 select-none">
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-slate-200">Moderação de Envio</span>
                  <span className="text-[9px] text-slate-500 mt-0.5">Apenas administradores podem postar mensagens</span>
                </div>
                <input
                  type="checkbox"
                  checked={onlyAdminsCanMessage}
                  onChange={(e) => setOnlyAdminsCanMessage(e.target.checked)}
                  className="w-4 h-4 accent-emerald-500"
                />
              </div>

              {/* Botões */}
              <div className="flex items-center gap-3 mt-4 border-t border-slate-800 pt-4 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 bg-slate-950 border border-slate-850 hover:bg-slate-950/60 text-slate-400 py-3 rounded-2xl text-xs font-bold transition-all active:scale-95"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!name.trim() || creating}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white py-3 rounded-2xl text-xs font-bold transition-all shadow-lg flex items-center justify-center gap-2 active:scale-95"
                >
                  {creating ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Criando...</span>
                    </>
                  ) : (
                    <span>Criar Grupo</span>
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
