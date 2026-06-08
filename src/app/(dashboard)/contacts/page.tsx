'use client'

import React, { useEffect, useState, useRef } from 'react'
import { 
  Users, 
  Search, 
  Upload, 
  Tag, 
  Trash2, 
  X, 
  Plus, 
  Check, 
  FileText, 
  AlertCircle,
  Sparkles,
  Pencil
} from 'lucide-react'
import Papa from 'papaparse'

interface Contact {
  id: string
  name: string
  phone: string
  tags: string[]
  createdAt: string
}

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  // Estados para Criação Individual
  const [isNewContactOpen, setIsNewContactOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [newTagsStr, setNewTagsStr] = useState('')
  const [isSavingContact, setIsSavingContact] = useState(false)

  // Estados para Edição de Contato
  const [isEditContactOpen, setIsEditContactOpen] = useState(false)
  const [editingContactId, setEditingContactId] = useState('')
  const [editName, setEditName] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editTagsStr, setEditTagsStr] = useState('')
  const [isSavingEdit, setIsSavingEdit] = useState(false)

  // Estados para Importação de CSV
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false)
  const [csvData, setCsvData] = useState<any[]>([])
  const [csvHeaders, setCsvHeaders] = useState<string[]>([])
  const [selectedNameHeader, setSelectedNameHeader] = useState('')
  const [selectedPhoneHeader, setSelectedPhoneHeader] = useState('')
  const [selectedTagHeader, setSelectedTagHeader] = useState('')
  const [previewContacts, setPreviewContacts] = useState<any[]>([])
  const [isImporting, setIsImporting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // CARREGAR CONTATOS
  const loadContacts = async () => {
    try {
      setIsLoading(true)
      const res = await fetch('/api/contacts')
      if (res.ok) {
        const data = await res.json()
        setContacts(data)
      }
    } catch (err) {
      console.error('Erro ao buscar contatos:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadContacts()
  }, [])

  // CRIAÇÃO INDIVIDUAL DE CONTATO
  const handleCreateContact = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName || !newPhone || isSavingContact) return

    setIsSavingContact(true)
    try {
      const res = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName,
          phone: newPhone,
          tags: newTagsStr
        })
      })

      if (res.ok) {
        setNewName('')
        setNewPhone('')
        setNewTagsStr('')
        setIsNewContactOpen(false)
        loadContacts()
      } else {
        let errorMessage = 'Erro ao criar contato.'
        try {
          const errData = await res.json()
          errorMessage = errData.error || errorMessage
        } catch {
          errorMessage = `Erro do servidor (Status ${res.status})`
        }
        alert(errorMessage)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setIsSavingContact(false)
    }
  }

  // ABRIR FORMULÁRIO DE EDIÇÃO
  const openEditModal = (contact: Contact) => {
    setEditingContactId(contact.id)
    setEditName(contact.name)
    setEditPhone(contact.phone)
    setEditTagsStr(contact.tags.join(', '))
    setIsEditContactOpen(true)
  }

  // ATUALIZAR CONTATO
  const handleEditContact = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingContactId || !editName || !editPhone || isSavingEdit) return

    setIsSavingEdit(true)
    try {
      const res = await fetch('/api/contacts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingContactId,
          name: editName,
          phone: editPhone,
          tags: editTagsStr
        })
      })

      if (res.ok) {
        setIsEditContactOpen(false)
        loadContacts()
      } else {
        let errorMessage = 'Erro ao editar contato.'
        try {
          const errData = await res.json()
          errorMessage = errData.error || errorMessage
        } catch {
          errorMessage = `Erro do servidor (Status ${res.status})`
        }
        alert(errorMessage)
      }
    } catch (err) {
      console.error('Erro de conexão ao editar contato:', err)
    } finally {
      setIsSavingEdit(false)
    }
  }

  // LEITURA DO ARQUIVO CSV COM PAPAPARSE
  const handleCsvFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setErrorMsg('')
    Papa.parse(file, {
      header: true, // Lê a primeira linha como cabeçalho
      skipEmptyLines: true,
      complete: (results) => {
        if (results.data && results.data.length > 0) {
          const headers = Object.keys(results.data[0] as Record<string, any>)
          setCsvHeaders(headers)
          setCsvData(results.data)

          // Tenta mapear de forma inteligente buscando nomes comuns de colunas
          const nameMatch = headers.find(h => 
            /nome|name|completo/i.test(h)
          ) || headers[0]
          
          const phoneMatch = headers.find(h => 
            /telefone|celular|phone|whatsapp|tel/i.test(h)
          ) || headers[1] || headers[0]

          const tagMatch = headers.find(h => 
            /tag|tags|grupo|segmento|categoria/i.test(h)
          ) || ''

          setSelectedNameHeader(nameMatch)
          setSelectedPhoneHeader(phoneMatch)
          setSelectedTagHeader(tagMatch)
        } else {
          setErrorMsg('O arquivo CSV parece estar vazio ou formatado incorretamente.')
        }
      },
      error: (err) => {
        setErrorMsg(`Erro de leitura: ${err.message}`)
      }
    })
  }

  // ATUALIZAR PRÉVIA DE MAPEAÇÃO DE COLUNAS
  useEffect(() => {
    if (csvData.length === 0 || !selectedNameHeader || !selectedPhoneHeader) {
      setPreviewContacts([])
      return
    }

    // Pega as primeiras 5 linhas para pré-visualização
    const preview = csvData.slice(0, 5).map(row => {
      let tags: string[] = []
      if (selectedTagHeader && row[selectedTagHeader]) {
        tags = String(row[selectedTagHeader]).split(',').map(t => t.trim()).filter(Boolean)
      } else {
        tags = ['Importado CSV']
      }

      return {
        name: row[selectedNameHeader] || '',
        phone: row[selectedPhoneHeader] || '',
        tags
      }
    })

    setPreviewContacts(preview)
  }, [csvData, selectedNameHeader, selectedPhoneHeader, selectedTagHeader])

  // SALVAR DISPARO EM LOTE DO CSV NO BANCO
  const handleImportCsv = async () => {
    if (csvData.length === 0 || !selectedNameHeader || !selectedPhoneHeader || isImporting) return

    setIsImporting(true)
    setErrorMsg('')

    try {
      // Mapeia todas as linhas do CSV com base nos cabeçalhos selecionados
      const mappedContacts = csvData.map(row => {
        let tags: string[] = []
        if (selectedTagHeader && row[selectedTagHeader]) {
          tags = String(row[selectedTagHeader]).split(',').map(t => t.trim()).filter(Boolean)
        } else {
          tags = ['Importado CSV']
        }

        return {
          name: row[selectedNameHeader]?.trim() || 'Sem Nome',
          phone: row[selectedPhoneHeader]?.replace(/\D/g, '') || '',
          tags
        }
      }).filter(c => c.phone.length >= 10) // Ignora registros sem telefone válido

      if (mappedContacts.length === 0) {
        throw new Error('Nenhum contato com número de telefone válido foi encontrado para importação.')
      }

      const res = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mappedContacts)
      })

      if (res.ok) {
        setIsCsvModalOpen(false)
        setCsvData([])
        setCsvHeaders([])
        setSelectedNameHeader('')
        setSelectedPhoneHeader('')
        setSelectedTagHeader('')
        loadContacts()
      } else {
        let errorMessage = 'Erro ao importar contatos.'
        try {
          const errData = await res.json()
          errorMessage = errData.error || errorMessage
        } catch {
          errorMessage = `Erro do servidor (Status ${res.status})`
        }
        setErrorMsg(errorMessage)
      }
    } catch (err: any) {
      console.error(err)
      setErrorMsg(err.message || 'Ocorreu um erro no processamento em lote.')
    } finally {
      setIsImporting(false)
    }
  }

  const filteredContacts = contacts.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.phone.includes(searchTerm)
  )

  return (
    <div className="flex-1 overflow-y-auto p-8 select-none">
      {/* HEADER PRINCIPAL */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-2">
            <Users className="w-8 h-8 text-emerald-400" />
            <span>Gestão de Contatos</span>
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Cadastre novos leads, importe contatos via planilha e organize segmentações com Tags de marketing.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsCsvModalOpen(true)}
            className="flex items-center gap-2 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 font-semibold px-5 py-3 rounded-2xl transition-all"
          >
            <Upload className="w-4 h-4 text-emerald-400" />
            <span>Importar CSV</span>
          </button>
          
          <button
            onClick={() => setIsNewContactOpen(true)}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-5 py-3 rounded-2xl shadow-xl shadow-emerald-600/10 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Novo Contato</span>
          </button>
        </div>
      </div>

      {/* FERRAMENTA DE BUSCA */}
      <div className="bg-slate-900/40 border border-slate-900 p-4 rounded-2xl mb-6">
        <div className="relative max-w-md">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Buscar contatos por nome ou telefone..."
            className="w-full bg-slate-950/60 border border-slate-900 focus:border-emerald-600 text-sm pl-10 pr-4 py-2.5 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* TABELA DE CONTATOS PREMIUM */}
      <div className="bg-slate-900/40 border border-slate-900 rounded-3xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-900 bg-slate-950/40 text-slate-400 text-xs font-bold uppercase tracking-wider select-none">
                <th className="p-4 pl-6">Nome</th>
                <th className="p-4">Telefone WhatsApp</th>
                <th className="p-4">Tags de Segmentação</th>
                <th className="p-4">Cadastrado Em</th>
                <th className="p-4 text-right pr-6">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-900/60 text-sm">
              {isLoading ? (
                <tr>
                  <td colSpan={4} className="p-12 text-center text-slate-500">
                    <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                    <span>Carregando seus contatos comerciais...</span>
                  </td>
                </tr>
              ) : filteredContacts.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-12 text-center text-slate-600">
                    Nenhum contato cadastrado. Comece importando uma planilha ou criando um novo contato!
                  </td>
                </tr>
              ) : (
                filteredContacts.map((contact) => (
                  <tr key={contact.id} className="hover:bg-slate-900/20 transition-colors group">
                    <td className="p-4 pl-6 font-semibold text-slate-200">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-slate-950 border border-slate-900 flex items-center justify-center font-bold text-emerald-400">
                          {contact.name.substring(0, 1).toUpperCase()}
                        </div>
                        <span>{contact.name}</span>
                      </div>
                    </td>
                    <td className="p-4 text-slate-400">
                      +{contact.phone}
                    </td>
                    <td className="p-4">
                      <div className="flex flex-wrap gap-1.5">
                        {contact.tags.map((tag, idx) => (
                          <span 
                            key={idx}
                            className="inline-flex items-center gap-1 text-[10px] bg-slate-950 text-slate-400 border border-slate-900 px-2 py-0.5 rounded-lg font-bold"
                          >
                            <Tag className="w-2.5 h-2.5 text-slate-500" />
                            <span>{tag}</span>
                          </span>
                        ))}
                        {contact.tags.length === 0 && (
                          <span className="text-xs text-slate-600">Sem tags</span>
                        )}
                      </div>
                    </td>
                    <td className="p-4 text-slate-500">
                      {new Date(contact.createdAt).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="p-4 text-right pr-6">
                      <button
                        onClick={() => openEditModal(contact)}
                        className="text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 p-2 rounded-xl transition-all"
                        title="Editar Contato"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 1. MODAL: CRIAR NOVO CONTATO */}
      {isNewContactOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-slate-950 border border-slate-900 w-full max-w-md rounded-3xl p-6 relative">
            <button 
              onClick={() => setIsNewContactOpen(false)}
              className="absolute right-4 top-4 text-slate-500 hover:text-slate-300 transition-colors p-1.5 hover:bg-slate-900 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-xl font-bold text-white mb-6">Criar Novo Contato</h3>

            <form onSubmit={handleCreateContact} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-slate-400 font-bold uppercase tracking-wider">Nome Completo</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: André Cipriano"
                  className="bg-slate-900/60 border border-slate-900 focus:border-emerald-600 text-sm px-4 py-3 rounded-xl text-slate-100 focus:outline-none transition-all"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-slate-400 font-bold uppercase tracking-wider">Telefone (Com DDI e DDD)</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: 5511999999999"
                  className="bg-slate-900/60 border border-slate-900 focus:border-emerald-600 text-sm px-4 py-3 rounded-xl text-slate-100 focus:outline-none transition-all"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-slate-400 font-bold uppercase tracking-wider">Tags (Separadas por vírgula)</label>
                <input
                  type="text"
                  placeholder="Ex: lead, VIP, Aluno"
                  className="bg-slate-900/60 border border-slate-900 focus:border-emerald-600 text-sm px-4 py-3 rounded-xl text-slate-100 focus:outline-none transition-all"
                  value={newTagsStr}
                  onChange={(e) => setNewTagsStr(e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-3 mt-6 border-t border-slate-900/60 pt-4">
                <button
                  type="button"
                  onClick={() => setIsNewContactOpen(false)}
                  className="bg-slate-900 hover:bg-slate-800 text-slate-300 font-semibold px-5 py-3 rounded-xl transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingContact}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-5 py-3 rounded-xl shadow-lg hover:shadow-emerald-600/10 transition-all flex items-center gap-2"
                >
                  {isSavingContact ? 'Salvando...' : 'Salvar Contato'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. MODAL: IMPORTAR CSV */}
      {isCsvModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-slate-950 border border-slate-900 w-full max-w-2xl rounded-3xl p-6 relative">
            <button 
              onClick={() => {
                setIsCsvModalOpen(false)
                setCsvData([])
                setCsvHeaders([])
              }}
              className="absolute right-4 top-4 text-slate-500 hover:text-slate-300 transition-colors p-1.5 hover:bg-slate-900 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-xl font-bold text-white flex items-center gap-2 mb-2">
              <Upload className="w-5 h-5 text-emerald-400" />
              <span>Importação em Massa via CSV</span>
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed mb-6">
              Faça upload do seu arquivo de planilha `.csv`. Você poderá mapear dinamicamente as colunas correspondentes ao Nome e ao Telefone dos clientes.
            </p>

            {/* SELEÇÃO DO ARQUIVO */}
            {csvData.length === 0 ? (
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-800 hover:border-emerald-500/40 rounded-2xl p-10 flex flex-col items-center justify-center gap-3 bg-slate-900/10 cursor-pointer group transition-all"
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".csv"
                  className="hidden"
                  onChange={handleCsvFileUpload}
                />
                <div className="w-12 h-12 rounded-xl bg-slate-900 flex items-center justify-center text-slate-400 group-hover:text-emerald-400 transition-colors">
                  <FileText className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-300">Escolha ou arraste o arquivo CSV</p>
                  <p className="text-xs text-slate-500 mt-1">Formatos suportados: apenas .csv de texto simples</p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-6">
                {/* CONFIGURAÇÃO DE MAPEAMENTO */}
                <div className="grid grid-cols-3 gap-4 bg-slate-900/40 border border-slate-900 p-4 rounded-2xl">
                  {/* Coluna Nome */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs text-slate-400 font-bold uppercase tracking-wider">Coluna do Nome</label>
                    <select
                      className="w-full bg-slate-950 border border-slate-900 focus:border-emerald-600 text-sm px-3.5 py-2.5 rounded-xl text-slate-100 focus:outline-none transition-all"
                      value={selectedNameHeader}
                      onChange={(e) => setSelectedNameHeader(e.target.value)}
                    >
                      {csvHeaders.map((header) => (
                        <option key={header} value={header}>{header}</option>
                      ))}
                    </select>
                  </div>

                  {/* Coluna Telefone */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs text-slate-400 font-bold uppercase tracking-wider">Coluna do Telefone</label>
                    <select
                      className="w-full bg-slate-950 border border-slate-900 focus:border-emerald-600 text-sm px-3.5 py-2.5 rounded-xl text-slate-100 focus:outline-none transition-all"
                      value={selectedPhoneHeader}
                      onChange={(e) => setSelectedPhoneHeader(e.target.value)}
                    >
                      {csvHeaders.map((header) => (
                        <option key={header} value={header}>{header}</option>
                      ))}
                    </select>
                  </div>

                  {/* Coluna Tags */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs text-slate-400 font-bold uppercase tracking-wider">Coluna de Tags</label>
                    <select
                      className="w-full bg-slate-950 border border-slate-900 focus:border-emerald-600 text-sm px-3.5 py-2.5 rounded-xl text-slate-100 focus:outline-none transition-all"
                      value={selectedTagHeader}
                      onChange={(e) => setSelectedTagHeader(e.target.value)}
                    >
                      <option value="">[Padrão / Nenhuma]</option>
                      {csvHeaders.map((header) => (
                        <option key={header} value={header}>{header}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* PRÉVIA DE MAPEAÇÃO */}
                <div>
                  <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block mb-3">Prévia dos Contatos (Primeiras 5 linhas)</span>
                  <div className="border border-slate-900 rounded-2xl overflow-hidden bg-slate-950/60">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-900 bg-slate-950 text-slate-500 font-bold uppercase">
                          <th className="p-3">Nome Mapeado</th>
                          <th className="p-3">Telefone Sanitizado</th>
                          <th className="p-3">Tags Adicionadas</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-900/60 text-slate-300">
                        {previewContacts.map((c, idx) => (
                          <tr key={idx}>
                            <td className="p-3 font-semibold text-slate-200">{c.name || '[Vazio]'}</td>
                            <td className="p-3">+{c.phone || '[Vazio]'}</td>
                            <td className="p-3">
                              <div className="flex flex-wrap gap-1">
                                {c.tags.map((tag: string, tagIdx: number) => (
                                  <span 
                                    key={tagIdx}
                                    className="bg-slate-900 border border-slate-800 text-[9px] font-bold text-slate-400 px-1.5 py-0.5 rounded-md"
                                  >
                                    {tag}
                                  </span>
                                ))}
                                {c.tags.length === 0 && (
                                  <span className="text-[9px] text-slate-600">Sem tags</span>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {errorMsg && (
                  <div className="flex items-center gap-2 p-3.5 rounded-xl bg-red-950/40 border border-red-500/20 text-xs text-red-400">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                {/* BOTÕES DE CONTROLE */}
                <div className="flex justify-between items-center mt-4 border-t border-slate-900/60 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setCsvData([])
                      setCsvHeaders([])
                      setSelectedTagHeader('')
                    }}
                    className="text-xs text-red-400 hover:text-red-300 hover:bg-red-500/5 px-4 py-2 rounded-xl transition-all"
                  >
                    Mudar Arquivo
                  </button>

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setIsCsvModalOpen(false)
                        setCsvData([])
                        setCsvHeaders([])
                        setSelectedTagHeader('')
                      }}
                      className="bg-slate-900 hover:bg-slate-800 text-slate-300 font-semibold px-5 py-3 rounded-xl transition-all"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleImportCsv}
                      disabled={isImporting}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-5 py-3 rounded-xl shadow-lg hover:shadow-emerald-600/10 transition-all flex items-center gap-2"
                    >
                      <Check className="w-4 h-4" />
                      <span>{isImporting ? 'Importando...' : `Importar ${csvData.length} Contatos`}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. MODAL: EDITAR CONTATO */}
      {isEditContactOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-slate-950 border border-slate-900 w-full max-w-md rounded-3xl p-6 relative">
            <button 
              onClick={() => setIsEditContactOpen(false)}
              className="absolute right-4 top-4 text-slate-500 hover:text-slate-300 transition-colors p-1.5 hover:bg-slate-900 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-xl font-bold text-white mb-6">Editar Contato Comercial</h3>

            <form onSubmit={handleEditContact} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-slate-400 font-bold uppercase tracking-wider">Nome Completo</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: André Cipriano"
                  className="bg-slate-900/60 border border-slate-900 focus:border-emerald-600 text-sm px-4 py-3 rounded-xl text-slate-100 focus:outline-none transition-all"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-slate-400 font-bold uppercase tracking-wider">Telefone (Com DDI e DDD)</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: 5511999999999"
                  className="bg-slate-900/60 border border-slate-900 focus:border-emerald-600 text-sm px-4 py-3 rounded-xl text-slate-100 focus:outline-none transition-all"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-slate-400 font-bold uppercase tracking-wider">Tags (Separadas por vírgula)</label>
                <input
                  type="text"
                  placeholder="Ex: lead, VIP, Aluno"
                  className="bg-slate-900/60 border border-slate-900 focus:border-emerald-600 text-sm px-4 py-3 rounded-xl text-slate-100 focus:outline-none transition-all"
                  value={editTagsStr}
                  onChange={(e) => setEditTagsStr(e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-3 mt-6 border-t border-slate-900/60 pt-4">
                <button
                  type="button"
                  onClick={() => setIsEditContactOpen(false)}
                  className="bg-slate-900 hover:bg-slate-800 text-slate-300 font-semibold px-5 py-3 rounded-xl transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-5 py-3 rounded-xl shadow-lg hover:shadow-emerald-600/10 transition-all flex items-center gap-2"
                >
                  {isSavingEdit ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
