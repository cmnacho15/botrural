'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import useSWR from 'swr'
import { DatosProvider, useDatos } from '@/app/contexts/DatosContext'
import { InsumosProvider, useInsumos } from '@/app/contexts/InsumosContext'
import { GastosProvider, useGastos } from '@/app/contexts/GastosContext'
import ModalNuevoDato from '@/app/components/modales/ModalNuevoDato'
import { useSession } from 'next-auth/react'

// SWR
const fetcher = (url: string) => fetch(url).then((res) => res.json())

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <DatosProvider>
      <InsumosProvider>
        <GastosProvider>
          <DashboardLayoutInner>{children}</DashboardLayoutInner>
        </GastosProvider>
      </InsumosProvider>
    </DatosProvider>
  )
}

function DashboardLayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [nuevoDatoMenuOpen, setNuevoDatoMenuOpen] = useState(false)
  const [modalTipo, setModalTipo] = useState<string | null>(null)
  const [openSections, setOpenSections] = useState<Record<number, boolean>>({})
  const { refetch: refetchDatos } = useDatos()
  const { refreshInsumos } = useInsumos()
  const { refreshGastos } = useGastos()

  const { data: session, status } = useSession()

  // ⛔ Si no está cargada la sesión todavía → loading
  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center h-screen">
        Cargando...
      </div>
    )
  }

  // ⛔ Si no hay sesión → redirect login
  if (!session?.user) {
    router.push('/login')
    return null
  }

  const user = session.user
  const role = user.roleCode;  // ✔️ ahora toma el valor correcto del enum
const accesoFinanzas = user.accesoFinanzas ?? false;

  // Bloqueo total a EMPLEADO
  if (role === 'EMPLEADO') {
    return (
      <div className="flex items-center justify-center h-screen">
        No tenés acceso al panel. Usá el bot de WhatsApp.
      </div>
    )
  }

  // Nombre del campo
  const { data, error, isLoading } = useSWR('/api/usuarios/campo', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 1000 * 60 * 5,
  })

  const campoNombre = error ? 'Error' : isLoading ? '' : data?.campoNombre ?? 'Mi Campo'

  // ============================
  // MENÚ SEGÚN ROL
  // ============================

  const menuSections = [
    {
      title: campoNombre,
      items: [
        { href: '/dashboard/empezar', icon: '🚀', label: 'Cómo Empezar' },
        { href: '/dashboard', icon: '📊', label: 'Resumen' },
        { href: '/dashboard/datos', icon: '📝', label: 'Datos' },
        { href: '/dashboard/mapa', icon: '🗺️', label: 'Mapa' },
      ],
    },

    {
      title: 'Gestión',
      items: [
        { href: '/dashboard/lotes', icon: '🏞️', label: 'Potreros' },
        role === 'CONTADOR'
          ? null
          : { href: '/dashboard/insumos', icon: '📦', label: 'Insumos' },
        role === 'CONTADOR'
          ? null
          : { href: '/dashboard/mano-de-obra', icon: '👷', label: 'Mano de Obra' },

        // Gastos (roles con acceso)
        role === 'ADMIN_GENERAL' ||
        role === 'CONTADOR' ||
        (role === 'COLABORADOR' && accesoFinanzas)
          ? { href: '/dashboard/gastos', icon: '💰', label: 'Gastos' }
          : null,
      ].filter(Boolean),
    },

    {
      title: 'Configuración',
      items: [
        // Solo ADMIN_GENERAL
        role === 'ADMIN_GENERAL'
          ? { href: '/dashboard/equipo', icon: '👥', label: 'Equipo' }
          : null,

        role === 'ADMIN_GENERAL'
          ? { href: '/dashboard/preferencias', icon: '⚙️', label: 'Preferencias' }
          : null,
      ].filter(Boolean),
    },
  ]

  // EVENTOS
  const eventosOptions = [
    {
      category: 'Animales',
      items: [
        { icon: '⊞', label: 'Cambio de Potrero', action: 'cambio-potrero' },
        { icon: '💉', label: 'Tratamiento', action: 'tratamiento' },
        { icon: '💵', label: 'Venta', action: 'venta' },
        { icon: '🛒', label: 'Compra', action: 'compra' },
        { icon: '🚚', label: 'Traslado', action: 'traslado' },
        { icon: '🐣', label: 'Nacimiento', action: 'nacimiento' },
      ],
    },
  ]

  const handleSuccess = async () => {
    await Promise.all([refetchDatos(), refreshInsumos(), refreshGastos()])
    setModalTipo(null)
  }

  const handleEventoClick = (action: string) => {
    setNuevoDatoMenuOpen(false)
    setModalTipo(action)
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">

      {/* HEADER */}
      <header className="bg-white border-b border-gray-200 px-4 sm:px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 lg:hidden"
          >
            ☰
          </button>

          <div className="flex items-center gap-2">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-green-400 to-blue-500" />
            <span className="text-lg sm:text-xl font-bold text-gray-900">BotRural</span>
          </div>
        </div>

        {/* NUEVO DATO */}
        {role !== 'CONTADOR' && (
          <button
            onClick={() => setNuevoDatoMenuOpen(!nuevoDatoMenuOpen)}
            className="flex items-center gap-2 px-3 sm:px-4 py-2.5 rounded-lg bg-blue-500 text-white hover:bg-blue-600"
          >
            ＋ <span className="hidden sm:inline">Nuevo Dato</span>
          </button>
        )}
      </header>

      {/* BODY */}
      <div className="flex flex-1 overflow-hidden">

        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* SIDEBAR */}
        <aside
          className={`fixed lg:static inset-y-0 left-0 z-50 top-[57px] lg:top-0 w-60 sm:w-64 bg-white border-r border-gray-200 flex flex-col transform transition-transform ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
          }`}
        >
          <nav className="flex-1 p-4 overflow-y-auto">
            {menuSections.map((section, idx) => (
              <div key={idx} className="mb-6">
                <h3 className="px-4 mb-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  {section.title}
                </h3>

                <div className="space-y-1">
                  {section.items.map((item: any) => {
                    const isActive = pathname.startsWith(item.href)

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
                      </Link>
                    )
                  })}
                </div>
              </div>
            ))}
          </nav>
        </aside>

        {/* MAIN CONTENT */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>

      {/* MODAL NUEVO DATO */}
      <ModalNuevoDato
        isOpen={modalTipo !== null}
        onClose={() => setModalTipo(null)}
        tipo={modalTipo || ''}
        onSuccess={handleSuccess}
      />

    </div>
  )
}