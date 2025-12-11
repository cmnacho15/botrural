// 📁 src/app/dashboard/calendario/page.tsx

"use client"

import { useEffect, useState } from "react"
import { 
  Calendar, 
  Plus, 
  Check, 
  X, 
  Clock, 
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Globe
} from "lucide-react"

interface Actividad {
  id: string
  titulo: string
  fechaProgramada: string
  realizada: boolean
  fechaRealizacion: string | null
  origen: "WEB" | "WHATSAPP"
  notas: string | null
  estado: "pendiente" | "realizada" | "vencida" | "hoy"
}

export default function CalendarioPage() {
  const [actividades, setActividades] = useState<Actividad[]>([])
  const [loading, setLoading] = useState(true)
  const [mostrarRealizadas, setMostrarRealizadas] = useState(false)
  const [mesActual, setMesActual] = useState(new Date())
  
  // Modal para nueva actividad
  const [modalOpen, setModalOpen] = useState(false)
  const [nuevoTitulo, setNuevoTitulo] = useState("")
  const [nuevaFecha, setNuevaFecha] = useState("")
  const [nuevaNota, setNuevaNota] = useState("")
  const [guardando, setGuardando] = useState(false)

  // Cargar actividades
  const cargarActividades = async () => {
    try {
      const res = await fetch(`/api/calendario?realizadas=${mostrarRealizadas}`)
      if (res.ok) {
        const data = await res.json()
        setActividades(data)
      }
    } catch (error) {
      console.error("Error cargando actividades:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    cargarActividades()
  }, [mostrarRealizadas])

  // Marcar como realizada/pendiente
  const toggleRealizada = async (id: string, realizada: boolean) => {
    try {
      const res = await fetch(`/api/calendario/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ realizada: !realizada })
      })

      if (res.ok) {
        cargarActividades()
      }
    } catch (error) {
      console.error("Error actualizando actividad:", error)
    }
  }

  // Eliminar actividad
  const eliminarActividad = async (id: string) => {
    if (!confirm("¿Eliminar esta actividad?")) return

    try {
      const res = await fetch(`/api/calendario/${id}`, {
        method: "DELETE"
      })

      if (res.ok) {
        cargarActividades()
      }
    } catch (error) {
      console.error("Error eliminando actividad:", error)
    }
  }

  // Crear nueva actividad
  const crearActividad = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nuevoTitulo.trim() || !nuevaFecha) return

    setGuardando(true)
    try {
      const res = await fetch("/api/calendario", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titulo: nuevoTitulo,
          fechaProgramada: nuevaFecha,
          notas: nuevaNota || null
        })
      })

      if (res.ok) {
        setModalOpen(false)
        setNuevoTitulo("")
        setNuevaFecha("")
        setNuevaNota("")
        cargarActividades()
      } else {
        const error = await res.json()
        alert(error.error || "Error al crear actividad")
      }
    } catch (error) {
      console.error("Error creando actividad:", error)
    } finally {
      setGuardando(false)
    }
  }

  // Generar días del calendario
  const generarDiasCalendario = () => {
    const year = mesActual.getFullYear()
    const month = mesActual.getMonth()
    
    const primerDia = new Date(year, month, 1)
    const ultimoDia = new Date(year, month + 1, 0)
    
    const dias: { fecha: Date; esDelMes: boolean }[] = []
    
    // Días del mes anterior para completar la semana
    const diaSemanaInicio = primerDia.getDay() === 0 ? 6 : primerDia.getDay() - 1
    for (let i = diaSemanaInicio - 1; i >= 0; i--) {
      const fecha = new Date(year, month, -i)
      dias.push({ fecha, esDelMes: false })
    }
    
    // Días del mes actual
    for (let d = 1; d <= ultimoDia.getDate(); d++) {
      dias.push({ fecha: new Date(year, month, d), esDelMes: true })
    }
    
    // Días del próximo mes para completar
    const diasRestantes = 42 - dias.length
    for (let i = 1; i <= diasRestantes; i++) {
      dias.push({ fecha: new Date(year, month + 1, i), esDelMes: false })
    }
    
    return dias
  }

  // Obtener actividades de un día específico
  const getActividadesDia = (fecha: Date) => {
    const fechaStr = fecha.toISOString().split('T')[0]
    return actividades.filter(a => {
      const actFecha = new Date(a.fechaProgramada).toISOString().split('T')[0]
      return actFecha === fechaStr
    })
  }

  // Calcular límites de fecha para el input
  const hoy = new Date()
  const fechaMin = hoy.toISOString().split('T')[0]
  const limite = new Date(hoy)
  limite.setDate(limite.getDate() + 60)
  const fechaMax = limite.toISOString().split('T')[0]

  const diasCalendario = generarDiasCalendario()

  // Estadísticas
  const pendientes = actividades.filter(a => a.estado === "pendiente" || a.estado === "hoy").length
  const vencidas = actividades.filter(a => a.estado === "vencida").length
  const realizadasCount = actividades.filter(a => a.estado === "realizada").length

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Calendar className="w-7 h-7 text-blue-600" />
            Calendario
          </h1>
          <p className="text-gray-500 mt-1">
            Próximos 60 días · Agendá desde la web o WhatsApp
          </p>
        </div>

        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Nueva actividad
        </button>
      </div>

      {/* Estadísticas rápidas */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-yellow-600" />
            <span className="text-yellow-800 font-medium">Pendientes</span>
          </div>
          <p className="text-2xl font-bold text-yellow-900 mt-1">{pendientes}</p>
        </div>
        
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <span className="text-red-800 font-medium">Vencidas</span>
          </div>
          <p className="text-2xl font-bold text-red-900 mt-1">{vencidas}</p>
        </div>
        
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <Check className="w-5 h-5 text-green-600" />
            <span className="text-green-800 font-medium">Realizadas</span>
          </div>
          <p className="text-2xl font-bold text-green-900 mt-1">{realizadasCount}</p>
        </div>
      </div>

      {/* Toggle mostrar realizadas */}
      <div className="mb-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={mostrarRealizadas}
            onChange={(e) => setMostrarRealizadas(e.target.checked)}
            className="w-4 h-4 text-blue-600 rounded"
          />
          <span className="text-gray-700">Mostrar actividades realizadas</span>
        </label>
      </div>

      {/* Navegación del mes */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setMesActual(new Date(mesActual.getFullYear(), mesActual.getMonth() - 1))}
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        
        <h2 className="text-lg font-semibold capitalize">
          {mesActual.toLocaleDateString('es-UY', { month: 'long', year: 'numeric' })}
        </h2>
        
        <button
          onClick={() => setMesActual(new Date(mesActual.getFullYear(), mesActual.getMonth() + 1))}
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Calendario */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
        {/* Días de la semana */}
        <div className="grid grid-cols-7 bg-gray-50 border-b">
          {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(dia => (
            <div key={dia} className="p-3 text-center text-sm font-medium text-gray-600">
              {dia}
            </div>
          ))}
        </div>

        {/* Días */}
        <div className="grid grid-cols-7">
          {diasCalendario.map((dia, idx) => {
            const actividadesDia = getActividadesDia(dia.fecha)
            const esHoy = dia.fecha.toDateString() === new Date().toDateString()
            
            return (
              <div
                key={idx}
                className={`
                  min-h-[100px] p-2 border-b border-r
                  ${!dia.esDelMes ? 'bg-gray-50' : ''}
                  ${esHoy ? 'bg-blue-50' : ''}
                `}
              >
                <div className={`
                  text-sm font-medium mb-1
                  ${!dia.esDelMes ? 'text-gray-400' : 'text-gray-700'}
                  ${esHoy ? 'text-blue-600' : ''}
                `}>
                  {dia.fecha.getDate()}
                </div>
                
                {/* Actividades del día */}
                <div className="space-y-1">
                  {actividadesDia.slice(0, 3).map(act => (
                    <div
                      key={act.id}
                      onClick={() => toggleRealizada(act.id, act.realizada)}
                      className={`
                        text-xs p-1 rounded cursor-pointer truncate
                        flex items-center gap-1
                        ${act.estado === 'realizada' ? 'bg-green-100 text-green-800 line-through' : ''}
                        ${act.estado === 'vencida' ? 'bg-red-100 text-red-800' : ''}
                        ${act.estado === 'hoy' ? 'bg-yellow-100 text-yellow-800 font-medium' : ''}
                        ${act.estado === 'pendiente' ? 'bg-blue-100 text-blue-800' : ''}
                      `}
                      title={act.titulo}
                    >
                      {act.origen === 'WHATSAPP' ? (
                        <MessageSquare className="w-3 h-3 flex-shrink-0" />
                      ) : (
                        <Globe className="w-3 h-3 flex-shrink-0" />
                      )}
                      <span className="truncate">{act.titulo}</span>
                    </div>
                  ))}
                  {actividadesDia.length > 3 && (
                    <div className="text-xs text-gray-500">
                      +{actividadesDia.length - 3} más
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Lista de actividades */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-4 border-b">
          <h3 className="font-semibold text-gray-900">Todas las actividades</h3>
        </div>
        
        {loading ? (
          <div className="p-8 text-center text-gray-500">
            Cargando...
          </div>
        ) : actividades.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Calendar className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No hay actividades agendadas</p>
            <p className="text-sm mt-1">
              Creá una desde acá o enviá un audio a WhatsApp
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {actividades.map(act => (
              <div
                key={act.id}
                className={`
                  p-4 flex items-center justify-between
                  ${act.estado === 'realizada' ? 'bg-gray-50' : ''}
                  ${act.estado === 'vencida' ? 'bg-red-50' : ''}
                  ${act.estado === 'hoy' ? 'bg-yellow-50' : ''}
                `}
              >
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => toggleRealizada(act.id, act.realizada)}
                    className={`
                      w-6 h-6 rounded-full border-2 flex items-center justify-center
                      ${act.realizada 
                        ? 'bg-green-500 border-green-500 text-white' 
                        : 'border-gray-300 hover:border-blue-500'}
                    `}
                  >
                    {act.realizada && <Check className="w-4 h-4" />}
                  </button>
                  
                  <div>
                    <p className={`font-medium ${act.realizada ? 'line-through text-gray-500' : 'text-gray-900'}`}>
                      {act.titulo}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-sm text-gray-500">
                        {new Date(act.fechaProgramada).toLocaleDateString('es-UY', {
                          weekday: 'short',
                          day: 'numeric',
                          month: 'short'
                        })}
                      </span>
                      
                      {act.origen === 'WHATSAPP' && (
                        <span className="inline-flex items-center gap-1 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                          <MessageSquare className="w-3 h-3" />
                          WhatsApp
                        </span>
                      )}
                      
                      {act.estado === 'vencida' && (
                        <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                          Vencida
                        </span>
                      )}
                      
                      {act.estado === 'hoy' && (
                        <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">
                          Hoy
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => eliminarActividad(act.id)}
                  className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal Nueva Actividad */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold mb-4">Nueva actividad</h2>
            
            <form onSubmit={crearActividad}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    ¿Qué tenés que hacer?
                  </label>
                  <input
                    type="text"
                    value={nuevoTitulo}
                    onChange={(e) => setNuevoTitulo(e.target.value)}
                    placeholder="Ej: Vacunar terneros, llamar veterinario..."
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    ¿Cuándo?
                  </label>
                  <input
                    type="date"
                    value={nuevaFecha}
                    onChange={(e) => setNuevaFecha(e.target.value)}
                    min={fechaMin}
                    max={fechaMax}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Máximo 60 días desde hoy
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notas (opcional)
                  </label>
                  <textarea
                    value={nuevaNota}
                    onChange={(e) => setNuevaNota(e.target.value)}
                    placeholder="Información adicional..."
                    rows={2}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardando || !nuevoTitulo.trim() || !nuevaFecha}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {guardando ? "Guardando..." : "Agendar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}