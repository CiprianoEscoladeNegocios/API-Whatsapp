'use client'

import React, { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Building2, Sparkles, User, Phone, CheckCircle, Loader2, ArrowRight } from 'lucide-react'

export default function InvitePage() {
  const params = useParams()
  const router = useRouter()
  const token = params.token as string

  const [group, setGroup] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [joining, setJoining] = useState(false)
  const [joined, setJoined] = useState(false)
  const [joinedData, setJoinedData] = useState<any>(null)

  useEffect(() => {
    async function fetchGroup() {
      try {
        // Busca os dados do grupo pelo token
        const res = await fetch(`/api/groups`)
        if (res.ok) {
          const groups = await res.json()
          const matchedGroup = groups.find((g: any) => g.inviteToken === token)
          if (matchedGroup) {
            setGroup(matchedGroup)
          } else {
            setError('Link de convite inválido ou expirado.')
          }
        } else {
          setError('Não foi possível verificar o convite.')
        }
      } catch (err) {
        setError('Erro de rede ao carregar convite.')
      } finally {
        setLoading(false)
      }
    }
    if (token) fetchGroup()
  }, [token])

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !phone.trim() || joining) return

    setJoining(true)
    try {
      const res = await fetch('/api/groups/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          name: name.trim(),
          phone: phone.trim()
        })
      })

      const data = await res.json()
      if (res.ok) {
        setJoinedData(data)
        setJoined(true)
        // Salva informações no localStorage para o chat de aluno saber quem é o remetente
        localStorage.setItem(`group_user_${data.groupId}`, JSON.stringify({
          senderId: data.contactId,
          senderName: data.contactName,
          senderType: 'CONTACT'
        }))
      } else {
        alert(data.error || 'Falha ao ingressar no grupo.')
      }
    } catch (err) {
      console.error(err)
      alert('Erro de conexão ao tentar entrar no grupo.')
    } finally {
      setJoining(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-100 p-6 select-none">
        <div className="w-12 h-12 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4" />
        <span className="text-sm text-slate-400 font-semibold tracking-wider uppercase animate-pulse">
          Validando convite comercial...
        </span>
      </div>
    )
  }

  if (error || !group) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-100 p-6">
        <div className="w-20 h-20 rounded-3xl bg-red-950/20 border border-red-500/20 flex items-center justify-center mb-6">
          <Building2 className="w-10 h-10 text-red-500" />
        </div>
        <h2 className="text-xl font-bold text-white tracking-tight">Convite Indisponível</h2>
        <p className="text-slate-500 text-xs mt-2 max-w-[320px] text-center leading-relaxed">
          {error || 'O link de acesso ao grupo virtual da Cipriano Escola de Negócios expirou ou é inválido.'}
        </p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-slate-100 relative overflow-hidden select-none">
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-emerald-500/5 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-teal-500/5 rounded-full blur-[100px] pointer-events-none" />

      <div className="w-full max-w-md bg-slate-900/60 border border-slate-900 backdrop-blur-xl rounded-3xl p-8 shadow-2xl relative overflow-hidden">
        
        {/* Branding Cipriano */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-emerald-500 to-teal-500 flex items-center justify-center text-white">
            <Building2 className="w-4 h-4" />
          </div>
          <span className="font-extrabold text-sm tracking-widest text-slate-400 uppercase">
            Cipriano Escola de Negócios
          </span>
        </div>

        {!joined ? (
          <>
            {/* Informações do Grupo */}
            <div className="text-center mb-8 flex flex-col items-center">
              {group.avatarUrl ? (
                <img 
                  src={group.avatarUrl} 
                  alt={group.name} 
                  className="w-20 h-20 rounded-3xl border border-slate-800 object-cover shadow-xl mb-4" 
                />
              ) : (
                <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-emerald-600/30 to-teal-500/30 border border-emerald-500/20 flex items-center justify-center font-extrabold text-emerald-400 text-3xl shadow-xl mb-4">
                  {group.name.substring(0, 1).toUpperCase()}
                </div>
              )}
              <h1 className="text-2xl font-bold text-white tracking-tight">{group.name}</h1>
              {group.description && (
                <p className="text-slate-400 text-xs mt-2 leading-relaxed max-w-[320px] mx-auto">
                  {group.description}
                </p>
              )}
            </div>

            {/* Formulário de Ingressar */}
            <form onSubmit={handleJoin} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                  Seu Nome Completo
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                  <input
                    type="text"
                    required
                    placeholder="Ex: João da Silva"
                    className="w-full bg-slate-950 border border-slate-900 focus:border-emerald-600 text-xs pl-10 pr-4 py-3 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none transition-all"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                  Seu WhatsApp (com DDD)
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                  <input
                    type="tel"
                    required
                    placeholder="Ex: 5544999999999"
                    className="w-full bg-slate-950 border border-slate-900 focus:border-emerald-600 text-xs pl-10 pr-4 py-3 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none transition-all"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
                <span className="text-[9px] text-slate-500 leading-tight">
                  Insira o código do país + DDD + Número. Ex: 5544988070836.
                </span>
              </div>

              <button
                type="submit"
                disabled={joining}
                className="w-full bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 disabled:opacity-40 text-white py-3.5 rounded-xl text-xs font-bold transition-all shadow-lg shadow-emerald-900/20 active:scale-[0.98] flex items-center justify-center gap-2 mt-4"
              >
                {joining ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Ingressando no grupo...</span>
                  </>
                ) : (
                  <>
                    <span>Entrar no Grupo Virtual</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </>
        ) : (
          /* Estado de Ingresso Confirmado */
          <div className="text-center flex flex-col items-center py-6 select-none animate-in fade-in duration-300">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-6">
              <CheckCircle className="w-8 h-8 text-emerald-400" />
            </div>
            
            <h2 className="text-2xl font-bold text-white tracking-tight">Tudo pronto, {name}!</h2>
            <p className="text-slate-400 text-xs mt-3 leading-relaxed max-w-[280px]">
              Seu acesso ao grupo virtual foi validado com absoluto sucesso. Uma mensagem de boas-vindas foi disparada no seu WhatsApp!
            </p>

            <button
              onClick={() => router.push(`/group-chat/${joinedData.groupId}`)}
              className="w-full bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white py-3.5 rounded-xl text-xs font-bold transition-all shadow-lg shadow-emerald-900/20 active:scale-[0.98] flex items-center justify-center gap-2 mt-8"
            >
              <span>Acessar Sala de Chat do Grupo</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
