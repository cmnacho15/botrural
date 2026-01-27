'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

interface UserDetail {
  user: {
    id: string
    email: string | null
    name: string | null
    apellido: string | null
    telefono: string | null
    role: string
    accesoFinanzas: boolean
    createdAt: string
    updatedAt: string
    lastMessageAt: string | null
    lastLoginAt: string | null
    whatsappState: string | null
    onboardingStartedAt: string | null
    onboardingCompletedAt: string | null
    subscriptionStatus: string | null
    subscriptionPlan: string | null
    trialEndsAt: string | null
    subscriptionEndsAt: string | null
  }
  campo: {
    id: string
    nombre: string
    tipoCampo: string
    grupo: { id: string, nombre: string } | null
    stats: {
      eventos: number
      ventas: number
      gastos: number
      lotes: number
      usuarios: number
      hectareas: number
    }
    lotes: Array<{
      id: string
      nombre: string
      hectareas: number
      animales: number
    }>
  } | null
  otrosCampos: Array<{
    id: string
    nombre: string
    grupo: string | null
    rol: string
    esActivo: boolean
  }>
  grupos: Array<{
    id: string
    nombre: string
    rol: string
    esActivo: boolean
  }>
  activity: {
    totalEventos: number
    eventosLast30Days: number
    invitacionesCreadas: number
    sesionesActivas: number
    eventosByType: Array<{ tipo: string, count: number }>
    recentEventos: Array<{
      id: string
      tipo: string
      descripcion: string | null
      fecha: string
      createdAt: string
      lote: string | null
    }>
  }
  invitaciones: Array<{
    id: string
    role: string
    createdAt: string
    usedAt: string | null
    usedBy: { email: string | null, name: string | null } | null
  }>
}

export default function UserDetailPage() {
  const params = useParams()
  const router = useRouter()
  const userId = params.id as string

  const [data, setData] = useState<UserDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('general')

  useEffect(() => {
    fetchUser()
  }, [userId])

  async function fetchUser() {
    try {
      const res = await fetch(`/api/admin/users/${userId}`)
      if (res.ok) {
        const data = await res.json()
        setData(data)
      } else if (res.status === 404) {
        router.push('/admin/usuarios')
      }
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  function formatDate(dateStr: string | null) {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString('es-UY', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const roleLabels: Record<string, { label: string, color: string }> = {
    ADMIN_GENERAL: { label: 'Admin General', color: 'bg-purple-500' },
    COLABORADOR: { label: 'Colaborador', color: 'bg-blue-500' },
    EMPLEADO: { label: 'Empleado', color: 'bg-gray-500' },
    CONTADOR: { label: 'Contador', color: 'bg-amber-500' }
  }

  const tipoEventoLabels: Record<string, string> = {
    TRATAMIENTO: 'Tratamiento',
    CAMBIO_POTRERO: 'Cambio Potrero',
    NACIMIENTO: 'Nacimiento',
    MORTANDAD: 'Mortandad',
    VENTA: 'Venta',
    COMPRA: 'Compra',
    TACTO: 'Tacto',
    LLUVIA: 'Lluvia',
    GASTO: 'Gasto',
    RECATEGORIZACION: 'Recategorización'
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="p-6 text-center text-gray-400">
        Usuario no encontrado
      </div>
    )
  }

  const { user, campo, activity } = data

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.back()}
          className="p-2 hover:bg-gray-700 rounded-lg transition"
        >
          <span className="text-gray-400">←</span>
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-white">
            {user.name || user.apellido || 'Sin nombre'}
          </h1>
          <p className="text-gray-400 text-sm">
            {user.email || user.telefono || 'Sin contacto'}
          </p>
        </div>
        <span className={`px-3 py-1 rounded-full text-sm font-medium text-white ${roleLabels[user.role]?.color || 'bg-gray-500'}`}>
          {roleLabels[user.role]?.label || user.role}
        </span>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <p className="text-gray-400 text-sm">Eventos totales</p>
          <p className="text-2xl font-bold text-white">{activity.totalEventos.toLocaleString()}</p>
        </div>
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <p className="text-gray-400 text-sm">Últimos 30 días</p>
          <p className="text-2xl font-bold text-white">{activity.eventosLast30Days}</p>
        </div>
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <p className="text-gray-400 text-sm">Invitaciones</p>
          <p className="text-2xl font-bold text-white">{activity.invitacionesCreadas}</p>
        </div>
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <p className="text-gray-400 text-sm">Sesiones activas</p>
          <p className="text-2xl font-bold text-white">{activity.sesionesActivas}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-700">
        <nav className="flex gap-4">
          {['general', 'campo', 'actividad'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-3 font-medium text-sm border-b-2 transition ${
                activeTab === tab
                  ? 'border-purple-500 text-purple-400'
                  : 'border-transparent text-gray-400 hover:text-white'
              }`}
            >
              {tab === 'general' && '👤 General'}
              {tab === 'campo' && '🏠 Campo'}
              {tab === 'actividad' && '📊 Actividad'}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab: General */}
      {activeTab === 'general' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Info básica */}
          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
            <h2 className="text-lg font-semibold text-white mb-4">Información Personal</h2>
            <div className="space-y-3">
              <InfoRow label="ID" value={user.id} />
              <InfoRow label="Nombre" value={user.name || '-'} />
              <InfoRow label="Apellido" value={user.apellido || '-'} />
              <InfoRow label="Email" value={user.email || '-'} />
              <InfoRow label="Teléfono" value={user.telefono || '-'} />
              <InfoRow label="Acceso Finanzas" value={user.accesoFinanzas ? 'Sí' : 'No'} />
            </div>
          </div>

          {/* Fechas */}
          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
            <h2 className="text-lg font-semibold text-white mb-4">Fechas</h2>
            <div className="space-y-3">
              <InfoRow label="Registro" value={formatDate(user.createdAt)} />
              <InfoRow label="Último login web" value={formatDate(user.lastLoginAt)} />
              <InfoRow label="Último mensaje bot" value={formatDate(user.lastMessageAt)} />
              <InfoRow label="Estado WhatsApp" value={user.whatsappState || 'IDLE'} />
              <InfoRow label="Onboarding iniciado" value={formatDate(user.onboardingStartedAt)} />
              <InfoRow label="Onboarding completado" value={formatDate(user.onboardingCompletedAt)} />
            </div>
          </div>

          {/* Suscripción */}
          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
            <h2 className="text-lg font-semibold text-white mb-4">Suscripción</h2>
            <div className="space-y-3">
              <InfoRow label="Estado" value={user.subscriptionStatus || 'N/A'} />
              <InfoRow label="Plan" value={user.subscriptionPlan || 'N/A'} />
              <InfoRow label="Trial termina" value={formatDate(user.trialEndsAt)} />
              <InfoRow label="Suscripción termina" value={formatDate(user.subscriptionEndsAt)} />
            </div>
          </div>

          {/* Grupos */}
          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
            <h2 className="text-lg font-semibold text-white mb-4">Grupos y Campos</h2>
            {data.grupos.length > 0 ? (
              <div className="space-y-2 mb-4">
                <p className="text-gray-400 text-sm">Grupos:</p>
                {data.grupos.map(g => (
                  <div key={g.id} className="flex items-center gap-2">
                    <span className="text-white">{g.nombre}</span>
                    <span className="text-xs text-gray-500">({g.rol})</span>
                    {g.esActivo && <span className="text-xs text-green-400">Activo</span>}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm">Sin grupos asignados</p>
            )}

            {data.otrosCampos.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-700">
                <p className="text-gray-400 text-sm mb-2">Otros campos:</p>
                {data.otrosCampos.map(c => (
                  <div key={c.id} className="flex items-center gap-2">
                    <span className="text-white">{c.nombre}</span>
                    {c.grupo && <span className="text-xs text-gray-500">({c.grupo})</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab: Campo */}
      {activeTab === 'campo' && (
        <div className="space-y-6">
          {campo ? (
            <>
              {/* Info del campo */}
              <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-white">{campo.nombre}</h2>
                    <p className="text-gray-400 text-sm mt-1">
                      {campo.tipoCampo} • {campo.grupo?.nombre || 'Sin grupo'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-white">{campo.stats.hectareas.toFixed(0)}</p>
                    <p className="text-gray-400 text-sm">hectáreas</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-6">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-white">{campo.stats.lotes}</p>
                    <p className="text-gray-400 text-sm">Potreros</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-white">{campo.stats.usuarios}</p>
                    <p className="text-gray-400 text-sm">Usuarios</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-white">{campo.stats.eventos.toLocaleString()}</p>
                    <p className="text-gray-400 text-sm">Eventos</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-green-400">{campo.stats.ventas}</p>
                    <p className="text-gray-400 text-sm">Ventas</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-rose-400">{campo.stats.gastos}</p>
                    <p className="text-gray-400 text-sm">Gastos</p>
                  </div>
                </div>
              </div>

              {/* Potreros */}
              <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                <h3 className="text-lg font-semibold text-white mb-4">Potreros ({campo.lotes.length})</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {campo.lotes.map(lote => (
                    <div key={lote.id} className="bg-gray-700/50 rounded-lg p-3">
                      <p className="text-white font-medium">{lote.nombre}</p>
                      <p className="text-gray-400 text-sm">
                        {lote.hectareas.toFixed(1)} ha • {lote.animales} categorías
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="bg-gray-800 rounded-xl p-12 border border-gray-700 text-center">
              <span className="text-4xl">🏠</span>
              <p className="text-gray-400 mt-4">Este usuario no tiene campo asignado</p>
            </div>
          )}
        </div>
      )}

      {/* Tab: Actividad */}
      {activeTab === 'actividad' && (
        <div className="space-y-6">
          {/* Eventos por tipo */}
          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
            <h3 className="text-lg font-semibold text-white mb-4">Eventos por Tipo</h3>
            <div className="space-y-3">
              {activity.eventosByType.slice(0, 10).map((item) => {
                const maxCount = activity.eventosByType[0]?.count || 1
                const percentage = (item.count / maxCount * 100).toFixed(0)
                return (
                  <div key={item.tipo} className="flex items-center gap-3">
                    <span className="text-gray-400 w-36 text-sm">
                      {tipoEventoLabels[item.tipo] || item.tipo}
                    </span>
                    <div className="flex-1 bg-gray-700 rounded-full h-3">
                      <div
                        className="bg-purple-500 h-3 rounded-full"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <span className="text-white font-medium w-16 text-right">
                      {item.count.toLocaleString()}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Eventos recientes */}
          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
            <h3 className="text-lg font-semibold text-white mb-4">Eventos Recientes</h3>
            <div className="space-y-3">
              {activity.recentEventos.map((evento) => (
                <div key={evento.id} className="flex items-start gap-3 py-2 border-b border-gray-700/50 last:border-0">
                  <span className="text-xl">
                    {evento.tipo === 'TRATAMIENTO' && '💉'}
                    {evento.tipo === 'VENTA' && '💰'}
                    {evento.tipo === 'COMPRA' && '🛒'}
                    {evento.tipo === 'NACIMIENTO' && '🐣'}
                    {evento.tipo === 'MORTANDAD' && '💀'}
                    {evento.tipo === 'TACTO' && '🔬'}
                    {evento.tipo === 'CAMBIO_POTRERO' && '🚶'}
                    {evento.tipo === 'LLUVIA' && '🌧️'}
                    {!['TRATAMIENTO', 'VENTA', 'COMPRA', 'NACIMIENTO', 'MORTANDAD', 'TACTO', 'CAMBIO_POTRERO', 'LLUVIA'].includes(evento.tipo) && '📋'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium">
                      {tipoEventoLabels[evento.tipo] || evento.tipo}
                    </p>
                    {evento.descripcion && (
                      <p className="text-gray-400 text-xs truncate">{evento.descripcion}</p>
                    )}
                    {evento.lote && (
                      <p className="text-gray-500 text-xs">Potrero: {evento.lote}</p>
                    )}
                  </div>
                  <span className="text-gray-500 text-xs whitespace-nowrap">
                    {formatDate(evento.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Invitaciones */}
          {data.invitaciones.length > 0 && (
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
              <h3 className="text-lg font-semibold text-white mb-4">Invitaciones Creadas</h3>
              <div className="space-y-2">
                {data.invitaciones.map((inv) => (
                  <div key={inv.id} className="flex items-center justify-between py-2 border-b border-gray-700/50 last:border-0">
                    <div>
                      <span className="text-gray-400 text-sm">Rol: </span>
                      <span className="text-white text-sm">{inv.role}</span>
                    </div>
                    <div className="text-right">
                      {inv.usedBy ? (
                        <span className="text-green-400 text-sm">
                          Usada por {inv.usedBy.name || inv.usedBy.email}
                        </span>
                      ) : (
                        <span className="text-yellow-400 text-sm">Pendiente</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function InfoRow({ label, value }: { label: string, value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-400 text-sm">{label}</span>
      <span className="text-white text-sm font-medium">{value}</span>
    </div>
  )
}
