'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import { 
  LayoutDashboard, 
  MessageSquare, 
  Users, 
  FileText, 
  Megaphone,
  LogOut,
  Building2,
  Sparkles,
  UserCheck,
  Network,
  Settings
} from 'lucide-react'

interface SidebarItemProps {
  href: string
  icon: React.ReactNode
  label: string
  active: boolean
}

function SidebarItem({ href, icon, label, active }: SidebarItemProps) {
  return (
    <Link 
      href={href}
      className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 font-medium ${
        active 
          ? 'bg-gradient-to-r from-emerald-600 to-teal-700 text-white shadow-lg shadow-emerald-900/30 scale-[1.02]' 
          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
      }`}
    >
      <div className={`transition-transform duration-300 ${active ? 'scale-110' : ''}`}>
        {icon}
      </div>
      <span>{label}</span>
    </Link>
  )
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const { data: session } = useSession()

  const userName = session?.user?.name || 'Operador'
  const userRole = session?.user?.role || 'OPERATOR'
  const initials = session?.user?.name
    ? session.user.name.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase()
    : 'OP'

  const menuItems = [
    { href: '/', icon: <LayoutDashboard className="w-5 h-5" />, label: 'Dashboard' },
    { href: '/chat', icon: <MessageSquare className="w-5 h-5" />, label: 'Live Chat' },
    { href: '/contacts', icon: <Users className="w-5 h-5" />, label: 'Contatos' },
    { href: '/templates', icon: <FileText className="w-5 h-5" />, label: 'Templates' },
    { href: '/campaigns', icon: <Megaphone className="w-5 h-5" />, label: 'Campanhas' },
    { href: '/groups', icon: <Network className="w-5 h-5" />, label: 'Grupos' },
  ]

  if (userRole === 'ADMIN') {
    menuItems.push({ href: '/users', icon: <UserCheck className="w-5 h-5" />, label: 'Operadores' })
    menuItems.push({ href: '/settings', icon: <Settings className="w-5 h-5" />, label: 'Configurações' })
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-950 text-slate-100">
      {/* SIDEBAR CORPORATIVA */}
      <aside className="w-72 border-r border-slate-900 bg-slate-950/80 backdrop-blur-xl flex flex-col justify-between p-6 shrink-0 select-none">
        <div className="flex flex-col gap-8">
          {/* Logo e Branding da Cipriano Escola de Negócios */}
          <div className="flex items-center gap-3 px-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-500 flex items-center justify-center text-white shadow-xl shadow-emerald-500/20">
              <Building2 className="w-5 h-5" />
            </div>
            <div className="flex flex-col">
              <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
                CIPRIANO
              </span>
              <span className="text-[10px] uppercase font-bold tracking-widest text-slate-500">
                Escola de Negócios
              </span>
            </div>
          </div>

          {/* Menu de Navegação */}
          <nav className="flex flex-col gap-2">
            {menuItems.map((item) => (
              <SidebarItem
                key={item.href}
                href={item.href}
                icon={item.icon}
                label={item.label}
                active={
                  item.href === '/' 
                    ? pathname === '/' 
                    : pathname.startsWith(item.href)
                }
              />
            ))}
          </nav>
        </div>

        {/* Rodapé da Sidebar */}
        <div className="flex flex-col gap-4">
          <div className="p-4 rounded-2xl bg-gradient-to-b from-slate-900/80 to-slate-950 border border-slate-900 flex flex-col gap-2 relative overflow-hidden group">
            <div className="absolute -right-4 -bottom-4 w-12 h-12 bg-emerald-500/10 rounded-full blur-xl group-hover:scale-150 transition-transform duration-500" />
            <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase tracking-wider">
              <Sparkles className="w-4 h-4" />
              <span>Plano Pro</span>
            </div>
            <p className="text-slate-500 text-xs leading-relaxed">
              Mensagens ilimitadas ativadas via Supabase.
            </p>
          </div>

          <div className="border-t border-slate-900 pt-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-slate-900 flex items-center justify-center font-bold text-slate-300 border border-slate-800 uppercase">
                {initials}
              </div>
              <div className="flex flex-col max-w-[140px] truncate">
                <span className="text-sm font-semibold text-slate-300 truncate" title={userName}>
                  {userName}
                </span>
                <span className="text-xs text-slate-500 font-medium">
                  {userRole === 'ADMIN' ? 'Administrador' : 'Operador'}
                </span>
              </div>
            </div>
            <button 
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="text-slate-500 hover:text-red-400 transition-colors p-2 hover:bg-slate-900/50 rounded-lg"
              title="Sair da conta"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </aside>

      {/* CONTAINER PRINCIPAL */}
      <main className="flex-1 flex flex-col min-w-0 bg-slate-950 overflow-hidden relative">
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-emerald-500/5 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-teal-500/5 rounded-full blur-[100px] pointer-events-none" />
        {children}
      </main>
    </div>
  )
}
