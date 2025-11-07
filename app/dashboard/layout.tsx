'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import useSWR from 'swr'
import { InsumosProvider } from '@/app/contexts/InsumosContext'
import { GastosProvider } from '@/app/contexts/GastosContext'
import ModalNuevoDato from '@/app/components/modales/ModalNuevoDato'

// 🔄 Hook SWR para traer datos con cache
const fetcher = (url: string) => fetch(url).then((res) => res.json())

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [nuevoDatoMenuOpen, setNuevoDatoMenuOpen] = useState(false)
  const [modalTipo, setModalTipo] = useState<string | null>(null)

  // 🧠 Carga el nombre del campo asociado al usuario
  const { data, error, isLoading } = useSWR('/api/usuarios/campo', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 1000 * 60 * 5, // cache 5 minutos
  })

  // 🌾 Nombre del campo
  const campoNombre = error
    ? 'Error al cargar'
    : isLoading
    ? null
    : data?.campoNombre || 'Sin campo'

  const menuSections = [
    {
      title: campoNombre || '', // si está cargando, no muestra texto
      items: [
        { href: '/dashboard/empezar', icon: '🚀', label: 'Cómo Empezar', badge: '2/3' },
        { href: '/dashboard', icon: '📊', label: 'Resumen' },
        { href: '/dashboard/datos', icon: '📝', label: 'Datos' },
        { href: '/dashboard/mapa', icon: '🗺️', label: 'Mapa' },
      ],
    },
    {
      title: 'Gestión',
      items: [
        { href: '/dashboard/lotes', icon: '🏞️', label: 'Potreros' },
        { href: '/dashboard/gastos', icon: '💰', label: 'Gastos' },
        { href: '/dashboard/insumos', icon: '📦', label: 'Insumos' },
      ],
    },
    {
      title: 'Configuración',
      items: [
        { href: '/dashboard/equipo', icon: '👥', label: 'Equipo' },
        { href: '/dashboard/preferencias', icon: '⚙️', label: 'Preferencias' },
      ],
    },
  ]

  const handleEventoClick = (action: string) => {
    setNuevoDatoMenuOpen(false)
    setModalTipo(action)
  }

  return (
    <InsumosProvider>
      <GastosProvider>
        <div className="flex flex-col h-screen bg-gray-50">
          {/* HEADER */}
          <header className="bg-white border-b border-gray-200 px-4 sm:px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Botón hamburguesa (solo móvil) */}
              <button
                onClick={() => setSidebarOpen(true)}
                className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 lg:hidden"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                </svg>
              </button>

              {/* LOGO */}
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-green-400 to-blue-500" />
                <span className="text-lg sm:text-xl font-bold text-gray-900">
                  BotRural
                </span>
              </div>
            </div>

            {/* NUEVO DATO */}
            <div className="relative">
              <button
                onClick={() => setNuevoDatoMenuOpen(!nuevoDatoMenuOpen)}
                className="flex items-center gap-2 px-3 sm:px-4 py-2.5 rounded-lg bg-blue-500 text-white hover:bg-blue-600 font-medium text-sm sm:text-base"
              >
                <span className="text-lg sm:text-xl">＋</span>
                <span className="hidden sm:inline">Nuevo Dato</span>
              </button>
            </div>
          </header>

          {/* CONTENIDO PRINCIPAL */}
          <div className="flex flex-1 overflow-hidden">
            {/* Overlay móvil */}
            {sidebarOpen && (
              <div
                className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden"
                onClick={() => setSidebarOpen(false)}
              />
            )}

            {/* SIDEBAR */}
            <aside
              className={`fixed lg:static inset-y-0 left-0 z-50 top-[57px] lg:top-0 w-60 sm:w-64 bg-white border-r border-gray-200 flex flex-col transform transition-transform duration-300 ease-in-out ${
                sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
              }`}
            >
              <nav className="flex-1 p-4 overflow-y-auto">
                {menuSections.map((section, idx) => (
                  <div key={idx} className="mb-6">
                    <h3 className="px-4 mb-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      {isLoading ? (
                        <div className="h-3 w-24 bg-gray-200 rounded-full animate-pulse" />
                      ) : (
                        section.title
                      )}
                    </h3>

                    <div className="space-y-1">
                      {section.items.map((item) => {
                        const isActive =
                          pathname === item.href || pathname.startsWith(item.href + '/')
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setSidebarOpen(false)}
                            className={`flex items-center justify-between px-4 py-2.5 rounded-lg text-sm ${
                              isActive
                                ? 'bg-blue-50 text-blue-600 font-medium'
                                : 'text-gray-700 hover:bg-gray-100'
                            }`}
                          >
                            <div className="flex items-center gap-2 sm:gap-3">
                              <span>{item.icon}</span>
                              <span>{item.label}</span>
                            </div>
                            {item.badge && (
                              <span className="bg-blue-500 text-white text-xs px-2 py-0.5 rounded-full">
                                {item.badge}
                              </span>
                            )}
                          </Link>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </nav>
            </aside>

            {/* MAIN */}
            <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">{children}</main>
          </div>

          {/* MODAL NUEVO DATO */}
          <ModalNuevoDato
            isOpen={modalTipo !== null}
            onClose={() => setModalTipo(null)}
            tipo={modalTipo || ''}
            onSuccess={() => setModalTipo(null)}
          />
        </div>
      </GastosProvider>
    </InsumosProvider>
  )
}