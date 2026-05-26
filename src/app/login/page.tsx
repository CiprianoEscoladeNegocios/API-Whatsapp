'use client'

import { useState, Suspense } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Lock, Mail, ArrowRight, ShieldAlert, Sparkles } from 'lucide-react'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const authError = searchParams.get('error')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const res = await signIn('credentials', {
        email,
        password,
        redirect: false,
      })

      if (res?.error) {
        setError('E-mail ou senha incorretos. Por favor, tente novamente.')
      } else {
        router.push('/')
        router.refresh()
      }
    } catch (err) {
      setError('Ocorreu um erro inesperado. Tente novamente mais tarde.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-slate-950 px-4">
      {/* Background Premium Gradients */}
      <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] rounded-full bg-indigo-900/20 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] rounded-full bg-amber-500/10 blur-[120px] pointer-events-none" />
      <div className="absolute top-[30%] right-[10%] w-[30%] h-[30%] rounded-full bg-violet-800/15 blur-[100px] pointer-events-none" />

      <div className="w-full max-w-md z-10">
        {/* Logo / Header da Cipriano Escola de Negócios */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-500/10 to-indigo-500/10 border border-amber-500/20 rounded-full px-4 py-1.5 mb-4 backdrop-blur-sm">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-semibold text-amber-300 uppercase tracking-widest">
              Cipriano Escola de Negócios
            </span>
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-100 to-amber-200 bg-clip-text text-transparent mb-2">
            Cipriano Conversas
          </h1>
          <p className="text-slate-400 text-sm max-w-xs mx-auto">
            Acelere suas vendas e conexões com automação profissional de WhatsApp.
          </p>
        </div>

        {/* Card do Formulário (Glassmorphism) */}
        <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-2xl p-8 shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* Error Banner */}
            {(error || authError) && (
              <div className="flex items-start gap-3 bg-red-950/40 border border-red-500/30 rounded-xl p-4 text-red-200 text-sm">
                <ShieldAlert className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-red-300">Falha na Autenticação</p>
                  <p className="text-red-400/90 text-xs mt-0.5">
                    {error || 'E-mail ou senha incorretos ou sessão expirada.'}
                  </p>
                </div>
              </div>
            )}

            {/* Input E-mail */}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block">
                E-mail Corporativo
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-slate-500" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="exemplo@ciprianoescola.com.br"
                  className="w-full pl-10 pr-4 py-3 bg-slate-950/50 border border-slate-800 focus:border-amber-500 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-amber-500 transition-all font-sans"
                />
              </div>
            </div>

            {/* Input Senha */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block">
                  Senha de Operador
                </label>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-500" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-3 bg-slate-950/50 border border-slate-800 focus:border-amber-500 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-amber-500 transition-all font-sans"
                />
              </div>
            </div>

            {/* Botão Acessar */}
            <button
              type="submit"
              disabled={loading}
              className="w-full relative bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold py-3.5 px-4 rounded-xl shadow-lg shadow-amber-500/20 hover:shadow-amber-500/30 transition-all transform active:translate-y-0 disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>Entrar no Painel</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Dicas de Acesso (Cipriano Branded) */}
          <div className="mt-8 pt-6 border-t border-slate-800/60 text-center">
            <span className="text-xs text-slate-500 block">
              Seu acesso é monitorado e criptografado de ponta a ponta.
            </span>
            <span className="text-xs text-slate-500 block mt-1">
              Esqueceu sua senha? Entre em contato com o suporte de TI.
            </span>
          </div>
        </div>

        {/* Rodapé Corporativo */}
        <div className="text-center mt-8 text-xs text-slate-600">
          <p>© {new Date().getFullYear()} Cipriano Escola de Negócios. Todos os direitos reservados.</p>
          <p className="mt-1 font-semibold text-slate-500">
            Formando líderes e automatizando o futuro do marketing de alta performance.
          </p>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-slate-400 text-xs font-semibold uppercase tracking-widest font-sans animate-pulse">Cipriano Escola de Negócios</span>
        </div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  )
}
