'use client'

import React, { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { 
  Users, 
  Plus, 
  Search, 
  Trash2, 
  Pencil, 
  ShieldAlert, 
  Key, 
  X, 
  Sparkles, 
  ShieldCheck, 
  Mail, 
  UserCheck, 
  Loader2 
} from 'lucide-react'

interface Operator {
  id: string
  name: string
  email: string
  role: 'ADMIN' | 'OPERATOR'
  createdAt: string
}

export default function UsersPage() {
  const { data: session, status } = useSession()
  
  const [operators, setOperators] = useState<Operator[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  // Estados de Criação
  const [isNewOpen, setIsNewOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newRole, setNewRole] = useState<'ADMIN' | 'OPERATOR'>('OPERATOR')
  const [isSaving, setIsSaving] = useState(false)

  // Estados de Edição
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [editingId, setEditingId] = useState('')
  const [editName, setEditName] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editPassword, setEditPassword] = useState('')
  const [editRole, setEditRole] = useState<'ADMIN' | 'OPERATOR'>('OPERATOR')
  const [isUpdating, setIsUpdating] = useState(false)

  const loadOperators = async () => {
    try {
      setIsLoading(true)
      const res = await fetch('/api/users')
      if (res.ok) {
        const data = await res.json()
        setOperators(data)
      } else {
        const data = await res.json()
        setErrorMsg(data.error || 'Erro ao carregar lista de operadores.')
      }
    } catch (err) {
      console.error('Erro ao buscar operadores:', err)
      setErrorMsg('Erro de rede ao buscar operadores.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (session?.user?.role === 'ADMIN') {
      loadOperators()
    }
  }, [session])

  // CRIAÇÃO DE OPERADOR
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName || !newEmail || !newPassword || isSaving) return

    setIsSaving(true)
    setErrorMsg('')
    setSuccessMsg('')

    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName,
          email: newEmail,
          password: newPassword,
          role: newRole
        })
      })

      const data = await res.json()

      if (res.ok) {
        setSuccessMsg(`Operador "${newName}" cadastrado com sucesso!`)
        setNewName('')
        setNewEmail('')
        setNewPassword('')
        setNewRole('OPERATOR')
        setIsNewOpen(false)
        loadOperators()
      } else {
        setErrorMsg(data.error || 'Erro ao criar operador.')
      }
    } catch (err) {
      console.error('Erro ao criar operador:', err)
      setErrorMsg('Erro de rede ao salvar operador.')
    } finally {
      setIsSaving(false)
    }
  }

  // EDIÇÃO - ABRIR MODAL
  const openEditModal = (op: Operator) => {
    setEditingId(op.id)
    setEditName(op.name)
    setEditEmail(op.email)
    setEditRole(op.role)
    setEditPassword('') // Não carregar senha por segurança
    setErrorMsg('')
    setSuccessMsg('')
    setIsEditOpen(true)
  }

  // ATUALIZAÇÃO DE OPERADOR
  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingId || !editName || !editEmail || isUpdating) return

    setIsUpdating(true)
    setErrorMsg('')
    setSuccessMsg('')

    try {
      const res = await fetch('/api/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingId,
          name: editName,
          email: editEmail,
          password: editPassword,
          role: editRole
        })
      })

      const data = await res.json()

      if (res.ok) {
        setSuccessMsg(`Operador "${editName}" atualizado com sucesso!`)
        setIsEditOpen(false)
        loadOperators()
      } else {
        setErrorMsg(data.error || 'Erro ao atualizar operador.')
      }
    } catch (err) {
      console.error('Erro ao atualizar operador:', err)
      setErrorMsg('Erro de rede ao atualizar operador.')
    } finally {
      setIsUpdating(false)
    }
  }

  // EXCLUSÃO DE OPERADOR
  const handleDelete = async (id: string, name: string) => {
    if (id === session?.user?.id) {
      setErrorMsg('Não é permitido excluir a sua própria conta ativa.')
      return
    }

    if (!confirm(`Tem certeza absoluta que deseja remover o operador "${name}"? Esta ação é irreversível!`)) {
      return
    }

    setErrorMsg('')
    setSuccessMsg('')

    try {
      const res = await fetch(`/api/users?id=${id}`, {
        method: 'DELETE'
      })

      const data = await res.json()

      if (res.ok) {
        setSuccessMsg(`Operador "${name}" removido com sucesso.`)
        loadOperators()
      } else {
        setErrorMsg(data.error || 'Erro ao remover operador.')
      }
    } catch (err) {
      console.error('Erro ao remover operador:', err)
      setErrorMsg('Erro de rede ao remover operador.')
    }
  }

  // Se a sessão estiver carregando
  if (status === 'loading') {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-950">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-10 h-10 text-amber-500 animate-spin" />
          <span className="text-slate-400 text-sm font-medium">Validando privilégios de acesso...</span>
        </div>
      </div>
    )
  }

  // Se o usuário não for administrador - BLOQUEIO COMPLETO
  if (session?.user?.role !== 'ADMIN') {
    return (
      <div className="flex-1 flex items-center justify-center p-8 bg-slate-950 relative overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-red-950/20 blur-[100px] pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-amber-950/10 blur-[100px] pointer-events-none" />
        
        <div className="max-w-md w-full text-center bg-slate-900/40 backdrop-blur-xl border border-red-500/20 rounded-3xl p-8 shadow-2xl relative z-10">
          <div className="w-16 h-16 bg-red-950/60 border border-red-500/30 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-red-950/30">
            <ShieldAlert className="w-8 h-8 text-red-400 animate-bounce" />
          </div>
          <div className="inline-flex items-center gap-2 bg-red-950/30 border border-red-500/20 rounded-full px-3 py-1 mb-4">
            <span className="text-[10px] font-bold uppercase tracking-wider text-red-400">Acesso Restrito</span>
          </div>
          <h2 className="text-2xl font-bold text-white mb-3">Área Exclusiva de Administradores</h2>
          <p className="text-slate-400 text-sm leading-relaxed mb-6">
            Lamento, mas a sua conta atual possui privilégios de **Operador**. Apenas administradores da **Cipriano Escola de Negócios** possuem acesso à governança de usuários e gestão de operadores da plataforma.
          </p>
          <div className="text-xs text-slate-500 border-t border-slate-800/80 pt-4">
            Cipriano Escola de Negócios • Sistema de Auditoria Interna
          </div>
        </div>
      </div>
    )
  }

  // Filtragem dos Operadores
  const filteredOperators = operators.filter(op => 
    op.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    op.email.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="flex-1 overflow-y-auto p-8 bg-slate-950">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-5 h-5 text-amber-400" />
            <span className="text-xs uppercase font-extrabold tracking-widest text-amber-400 animate-pulse">
              Controle de Acessos & Governança (RBAC)
            </span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
            Gestão de Operadores
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Gerencie credenciais, adicione colaboradores e controle os privilégios da plataforma.
          </p>
        </div>
        
        <button
          onClick={() => {
            setErrorMsg('')
            setSuccessMsg('')
            setIsNewOpen(true)
          }}
          className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold px-5 py-3 rounded-2xl shadow-lg shadow-amber-500/10 transition-all transform hover:-translate-y-0.5"
        >
          <Plus className="w-5 h-5" />
          <span>Novo Operador</span>
        </button>
      </div>

      {/* MENSAGENS DE NOTIFICAÇÃO */}
      {successMsg && (
        <div className="mb-6 bg-emerald-950/40 border border-emerald-500/30 text-emerald-200 p-4 rounded-2xl flex items-center gap-3 text-sm animate-fade-in">
          <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="mb-6 bg-red-950/40 border border-red-500/30 text-red-200 p-4 rounded-2xl flex items-center gap-3 text-sm animate-fade-in">
          <ShieldAlert className="w-5 h-5 text-red-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* BUSCA E TABELA */}
      <div className="bg-slate-900/30 backdrop-blur-xl border border-slate-900 rounded-3xl p-6 shadow-xl">
        <div className="flex items-center gap-3 mb-6 bg-slate-950/50 border border-slate-800 rounded-2xl px-4 py-3 max-w-md focus-within:border-amber-500 transition-colors">
          <Search className="w-5 h-5 text-slate-500" />
          <input
            type="text"
            placeholder="Buscar por nome ou e-mail..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-transparent border-none outline-none w-full text-slate-100 placeholder-slate-600 text-sm"
          />
        </div>

        {/* LOADING LISTA */}
        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
            <span className="text-slate-500 text-sm font-medium">Buscando operadores cadastrados...</span>
          </div>
        ) : filteredOperators.length === 0 ? (
          <div className="py-20 text-center border-2 border-dashed border-slate-900 rounded-2xl">
            <Users className="w-12 h-12 text-slate-700 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-400 mb-1">Nenhum operador encontrado</h3>
            <p className="text-slate-600 text-sm">
              Tente redefinir sua busca ou crie um novo operador comercial.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-900 text-slate-500 text-xs font-bold uppercase tracking-wider">
                  <th className="pb-4 pl-4">Operador</th>
                  <th className="pb-4">E-mail Corporativo</th>
                  <th className="pb-4">Cargo / Função</th>
                  <th className="pb-4">Data de Cadastro</th>
                  <th className="pb-4 pr-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900/60">
                {filteredOperators.map((op) => (
                  <tr key={op.id} className="hover:bg-slate-900/20 transition-colors group">
                    <td className="py-4 pl-4 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center font-bold text-slate-300 uppercase">
                        {op.name.split(' ').map(n => n[0]).join('').substring(0, 2)}
                      </div>
                      <div className="flex flex-col">
                        <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                          {op.name}
                          {op.id === session?.user?.id && (
                            <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full font-medium border border-slate-700">Você</span>
                          )}
                        </span>
                      </div>
                    </td>
                    <td className="py-4 text-sm text-slate-400 font-sans">
                      {op.email}
                    </td>
                    <td className="py-4">
                      {op.role === 'ADMIN' ? (
                        <span className="inline-flex items-center gap-1 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">
                          <UserCheck className="w-3.5 h-3.5" />
                          <span>Administrador</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">
                          <Users className="w-3.5 h-3.5" />
                          <span>Operador</span>
                        </span>
                      )}
                    </td>
                    <td className="py-4 text-xs text-slate-500">
                      {new Date(op.createdAt).toLocaleDateString('pt-BR', {
                        day: '2-digit',
                        month: 'long',
                        year: 'numeric'
                      })}
                    </td>
                    <td className="py-4 pr-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEditModal(op)}
                          className="p-2 text-slate-500 hover:text-amber-400 hover:bg-slate-900/60 rounded-xl transition-all"
                          title="Editar Operador"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        
                        <button
                          onClick={() => handleDelete(op.id, op.name)}
                          disabled={op.id === session?.user?.id}
                          className="p-2 text-slate-500 hover:text-red-400 hover:bg-slate-900/60 rounded-xl transition-all disabled:opacity-30 disabled:pointer-events-none"
                          title={op.id === session?.user?.id ? "Não é possível se autoexcluir" : "Remover Operador"}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ================= MODAL CADASTRAR NOVO ================= */}
      {isNewOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-3xl p-6 shadow-2xl relative animate-scale-up">
            <button
              onClick={() => setIsNewOpen(false)}
              className="absolute top-4 right-4 text-slate-500 hover:text-slate-300 p-2 hover:bg-slate-800 rounded-xl transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-600 flex items-center justify-center text-slate-950 font-bold shadow-lg shadow-amber-500/10">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">Novo Operador</h3>
                <p className="text-xs text-slate-500">Cadastre um novo colaborador na plataforma.</p>
              </div>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Nome Completo</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: João Silva"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-4 py-3 text-white placeholder-slate-700 text-sm outline-none transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">E-mail Corporativo</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-600" />
                  <input
                    type="email"
                    required
                    placeholder="joao@ciprianoescola.com.br"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl pl-10 pr-4 py-3 text-white placeholder-slate-700 text-sm outline-none transition-colors"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Senha de Acesso</label>
                <div className="relative">
                  <Key className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-600" />
                  <input
                    type="password"
                    required
                    placeholder="Mínimo 6 caracteres"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl pl-10 pr-4 py-3 text-white placeholder-slate-700 text-sm outline-none transition-colors"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Cargo / Nível de Acesso</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as 'ADMIN' | 'OPERATOR')}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-4 py-3 text-white text-sm outline-none transition-colors cursor-pointer"
                >
                  <option value="OPERATOR">Operador (Apenas Chat e Campanhas)</option>
                  <option value="ADMIN">Administrador (Controle Total)</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={isSaving}
                className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-amber-500/10 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <span>Cadastrar Colaborador</span>}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL EDITAR EXISTENTE ================= */}
      {isEditOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-3xl p-6 shadow-2xl relative animate-scale-up">
            <button
              onClick={() => setIsEditOpen(false)}
              className="absolute top-4 right-4 text-slate-500 hover:text-slate-300 p-2 hover:bg-slate-800 rounded-xl transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-600 flex items-center justify-center text-slate-950 font-bold shadow-lg shadow-amber-500/10">
                <Pencil className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">Editar Operador</h3>
                <p className="text-xs text-slate-500">Altere dados ou privilégios do colaborador.</p>
              </div>
            </div>

            <form onSubmit={handleUpdate} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Nome Completo</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: João Silva"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-4 py-3 text-white placeholder-slate-700 text-sm outline-none transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">E-mail Corporativo</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-600" />
                  <input
                    type="email"
                    required
                    placeholder="joao@ciprianoescola.com.br"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl pl-10 pr-4 py-3 text-white placeholder-slate-700 text-sm outline-none transition-colors"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Nova Senha (Opcional)</label>
                <div className="relative">
                  <Key className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-600" />
                  <input
                    type="password"
                    placeholder="Deixe em branco para manter a atual"
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl pl-10 pr-4 py-3 text-white placeholder-slate-700 text-sm outline-none transition-colors"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Cargo / Nível de Acesso</label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as 'ADMIN' | 'OPERATOR')}
                  disabled={editingId === session?.user?.id}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-4 py-3 text-white text-sm outline-none transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="OPERATOR">Operador (Apenas Chat e Campanhas)</option>
                  <option value="ADMIN">Administrador (Controle Total)</option>
                </select>
                {editingId === session?.user?.id && (
                  <span className="text-[10px] text-slate-500 block mt-1">Por segurança, você não pode alterar o seu próprio cargo corporativo.</span>
                )}
              </div>

              <button
                type="submit"
                disabled={isUpdating}
                className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-amber-500/10 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isUpdating ? <Loader2 className="w-5 h-5 animate-spin" /> : <span>Salvar Alterações</span>}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
