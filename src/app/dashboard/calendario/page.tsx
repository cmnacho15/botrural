// 📁 src/app/dashboard/calendario/page.tsx

"use client"

import { useEffect, useState } from "react"
import { 
  Calendar, 
  Plus, 
  Check, 
  Trash2, 
  Clock, 
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Globe,
  X
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

// 🇺🇾 Helper para convertir fechas ISO a fecha local Uruguay sin problemas de zona horaria
const parseFechaLocal = (fechaISO: string): Date => {
  const [year, month, day] = fechaISO.split('T')[0].split('-')
  return new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
}

export default function CalendarioPage() {
  const [actividades, setActividades] = useState<Actividad[]>([])
  const [loading, setLoading] = useState(true)
  const [mostrarRealizadas, setMostrarRealizadas] = useState(true)
  const [mesActual, setMesActual] = useState(new Date())
  
  // Modal para nueva actividad
  const [modalOpen, setModalOpen] = useState(false)
  const [nuevoTitulo, setNuevoTitulo] = useState("")
  const [nuevaFecha, setNuevaFecha] = useState("")
  const [nuevaNota, setNuevaNota] = useState("")
  const [guardando, setGuardando] = useState(false)

  // Modal para ver detalle de actividad
 // Modal para ver detalle de actividad
  const [actividadSeleccionada, setActividadSeleccionada] = useState<Actividad | null>(null)
  
  // Estado para modo edición
  const [modoEdicion, setModoEdicion] = useState(false)
  const [tituloEdicion, setTituloEdicion] = useState("")
  const [fechaEdicion, setFechaEdicion] = useState("")
  const [notaEdicion, setNotaEdicion] = useState("")
  const [guardandoEdicion, setGuardandoEdicion] = useState(false)

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
        setActividadSeleccionada(null)
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
        setActividadSeleccionada(null)
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

  // Actualizar actividad existente
  const actualizarActividad = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!actividadSeleccionada || !tituloEdicion.trim() || !fechaEdicion) return

    setGuardandoEdicion(true)
    try {
      const res = await fetch(`/api/calendario/${actividadSeleccionada.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titulo: tituloEdicion,
          fechaProgramada: fechaEdicion,
          notas: notaEdicion || null
        })
      })

      if (res.ok) {
        setModoEdicion(false)
        cargarActividades()
        // Actualizar la actividad seleccionada con los nuevos datos
        const actividadActualizada = await res.json()
        setActividadSeleccionada(actividadActualizada)
      } else {
        const error = await res.json()
        alert(error.error || "Error al actualizar actividad")
      }
    } catch (error) {
      console.error("Error actualizando actividad:", error)
    } finally {
      setGuardandoEdicion(false)
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
    const actFecha = parseFechaLocal(a.fechaProgramada)
    const actFechaStr = `${actFecha.getFullYear()}-${String(actFecha.getMonth() + 1).padStart(2, '0')}-${String(actFecha.getDate()).padStart(2, '0')}`
    return actFechaStr === fechaStr
  })
}

  
  const hoy = new Date()
  const fechaMin = hoy.toISOString().split('T')[0]
  
  

  const diasCalendario = generarDiasCalendario()

  // Estadísticas
  const pendientes = actividades.filter(a => a.estado === "pendiente" || a.estado === "hoy").length
  const vencidas = actividades.filter(a => a.estado === "vencida").length
  const realizadasCount = actividades.filter(a => a.estado === "realizada").length

  // Colores más vivos para el calendario
  const getColorDia = (actividadesDia: Actividad[]) => {
    if (actividadesDia.length === 0) return ""
    
    const tieneVencida = actividadesDia.some(a => a.estado === "vencida")
    const tieneHoy = actividadesDia.some(a => a.estado === "hoy")
    const tieneRealizada = actividadesDia.every(a => a.estado === "realizada")
    
    if (tieneVencida) return "bg-red-100 border-red-300"
    if (tieneHoy) return "bg-amber-100 border-amber-300"
    if (tieneRealizada) return "bg-green-100 border-green-300"
    return "bg-blue-100 border-blue-300"
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Calendar className="w-7 h-7 text-blue-600" />
            Calendario
          </h1>
          <p className="text-gray-500 mt-1">
  Agendá desde la web o WhatsApp
</p>
        </div>

        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200"
        >
          <Plus className="w-5 h-5" />
          Nueva actividad
        </button>
      </div>

      {/* Estadísticas rápidas */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-6">
        <div className="bg-gradient-to-br from-amber-50 to-amber-100 border-2 border-amber-200 rounded-xl p-3 sm:p-4">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-600" />
            <span className="text-amber-800 font-medium text-sm sm:text-base">Pendientes</span>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-amber-900 mt-1">{pendientes}</p>
        </div>
        
        <div className="bg-gradient-to-br from-red-50 to-red-100 border-2 border-red-200 rounded-xl p-3 sm:p-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <span className="text-red-800 font-medium text-sm sm:text-base">Vencidas</span>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-red-900 mt-1">{vencidas}</p>
        </div>
        
        <div className="bg-gradient-to-br from-green-50 to-green-100 border-2 border-green-200 rounded-xl p-3 sm:p-4">
          <div className="flex items-center gap-2">
            <Check className="w-5 h-5 text-green-600" />
            <span className="text-green-800 font-medium text-sm sm:text-base">Realizadas</span>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-green-900 mt-1">{realizadasCount}</p>
        </div>
      </div>

      {/* Toggle ocultar realizadas */}
      <div className="mb-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={!mostrarRealizadas}
            onChange={(e) => setMostrarRealizadas(!e.target.checked)}
            className="w-4 h-4 text-blue-600 rounded"
          />
          <span className="text-gray-700">Ocultar actividades realizadas</span>
        </label>
      </div>

      {/* Navegación del mes */}
      <div className="flex items-center justify-between mb-4 bg-white rounded-xl border border-gray-200 p-3">
        <button
          onClick={() => setMesActual(new Date(mesActual.getFullYear(), mesActual.getMonth() - 1))}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        
        <h2 className="text-lg font-semibold capitalize">
          {mesActual.toLocaleDateString('es-UY', { month: 'long', year: 'numeric' })}
        </h2>
        
        <button
          onClick={() => setMesActual(new Date(mesActual.getFullYear(), mesActual.getMonth() + 1))}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Calendario */}
      <div className="bg-white rounded-xl border-2 border-gray-200 overflow-hidden mb-6 shadow-sm">
        {/* Días de la semana */}
        <div className="grid grid-cols-7 bg-gray-100 border-b-2 border-gray-200">
          {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(dia => (
            <div key={dia} className="p-2 sm:p-3 text-center text-xs sm:text-sm font-semibold text-gray-600">
              {dia}
            </div>
          ))}
        </div>

        {/* Días */}
        <div className="grid grid-cols-7">
          {diasCalendario.map((dia, idx) => {
            const actividadesDia = getActividadesDia(dia.fecha)
            const esHoy = dia.fecha.toDateString() === new Date().toDateString()
            const colorDia = getColorDia(actividadesDia)
            
            return (
              <div
                key={idx}
                className={`
                  min-h-[80px] sm:min-h-[100px] p-1 sm:p-2 border-b border-r border-gray-100
                  ${!dia.esDelMes ? 'bg-gray-50' : ''}
                  ${esHoy ? 'ring-2 ring-blue-500 ring-inset' : ''}
                  ${colorDia}
                `}
              >
                <div className={`
                  text-xs sm:text-sm font-semibold mb-1
                  ${!dia.esDelMes ? 'text-gray-400' : 'text-gray-700'}
                  ${esHoy ? 'text-blue-600' : ''}
                `}>
                  {dia.fecha.getDate()}
                  {esHoy && <span className="ml-1 text-[10px] sm:text-xs font-normal">(hoy)</span>}
                </div>
                
                {/* Actividades del día - Click abre detalle */}
                <div className="space-y-1">
                  {actividadesDia.slice(0, 2).map(act => (
                    <div
                      key={act.id}
                      onClick={() => setActividadSeleccionada(act)}
                      className={`
                        text-[10px] sm:text-xs p-1 sm:p-1.5 rounded cursor-pointer
                        flex items-center gap-1 transition-all hover:scale-[1.02]
                        ${act.estado === 'realizada' ? 'bg-green-500 text-white' : ''}
                        ${act.estado === 'vencida' ? 'bg-red-500 text-white' : ''}
                        ${act.estado === 'hoy' ? 'bg-amber-500 text-white font-semibold' : ''}
                        ${act.estado === 'pendiente' ? 'bg-yellow-100 text-amber-800' : ''}
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
                  {actividadesDia.length > 2 && (
                    <div 
                      className="text-[10px] sm:text-xs text-gray-600 font-medium cursor-pointer hover:text-blue-600"
                      onClick={() => setActividadSeleccionada(actividadesDia[0])}
                    >
                      +{actividadesDia.length - 2} más
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Lista de actividades */}
      <div className="bg-white rounded-xl border-2 border-gray-200 shadow-sm">
        <div className="p-4 border-b border-gray-200 bg-gray-50 rounded-t-xl">
          <h3 className="font-semibold text-gray-900">Todas las actividades</h3>
        </div>
        
        {loading ? (
          <div className="p-8 text-center text-gray-500">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3"></div>
            Cargando...
          </div>
        ) : actividades.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Calendar className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="font-medium">No hay actividades agendadas</p>
            <p className="text-sm mt-1">
              Creá una desde acá o enviá un audio a WhatsApp
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {actividades.map(act => (
              <div
                key={act.id}
                className={`
                  p-4 flex items-center justify-between hover:bg-gray-50 transition-colors cursor-pointer
                  ${act.estado === 'realizada' ? 'bg-green-50/50' : ''}
                  ${act.estado === 'vencida' ? 'bg-red-50/50' : ''}
                  ${act.estado === 'hoy' ? 'bg-amber-50/50' : ''}
                `}
                onClick={() => setActividadSeleccionada(act)}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {/* Indicador de estado */}
                  <div className={`
                    w-3 h-3 rounded-full flex-shrink-0
                    ${act.estado === 'realizada' ? 'bg-green-500' : ''}
                    ${act.estado === 'vencida' ? 'bg-red-500' : ''}
                    ${act.estado === 'hoy' ? 'bg-amber-500' : ''}
                    ${act.estado === 'pendiente' ? 'bg-blue-500' : ''}
                  `} />
                  
                  <div className="min-w-0 flex-1">
                    <p className={`font-medium truncate ${act.realizada ? 'line-through text-gray-500' : 'text-gray-900'}`}>
                      {act.titulo}
                    </p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="text-sm text-gray-500">
  {parseFechaLocal(act.fechaProgramada).toLocaleDateString('es-UY', {
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
                        <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">
                          Vencida
                        </span>
                      )}
                      
                      {act.estado === 'hoy' && (
                        <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                          ¡Hoy!
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal Nueva Actividad */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Nueva actividad</h2>
              <button 
                onClick={() => setModalOpen(false)}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
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
                    className="w-full px-4 py-3 border-2 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
  className="w-full px-4 py-3 border-2 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
  required
/>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notas (opcional)
                  </label>
                  <textarea
                    value={nuevaNota}
                    onChange={(e) => setNuevaNota(e.target.value)}
                    placeholder="Información adicional..."
                    rows={2}
                    className="w-full px-4 py-3 border-2 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-xl hover:bg-gray-50 font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardando || !nuevoTitulo.trim() || !nuevaFecha}
                  className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 font-medium"
                >
                  {guardando ? "Guardando..." : "Agendar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Detalle de Actividad */}
      {actividadSeleccionada && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  {actividadSeleccionada.origen === 'WHATSAPP' ? (
                    <span className="inline-flex items-center gap-1 text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                      <MessageSquare className="w-3 h-3" />
                      WhatsApp
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                      <Globe className="w-3 h-3" />
                      Web
                    </span>
                  )}
                  
                  {actividadSeleccionada.estado === 'vencida' && (
                    <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full font-medium">
                      Vencida
                    </span>
                  )}
                  {actividadSeleccionada.estado === 'hoy' && (
                    <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full font-medium">
                      ¡Hoy!
                    </span>
                  )}
                  {actividadSeleccionada.estado === 'realizada' && (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">
                      Realizada
                    </span>
                  )}
                </div>
                
                {!modoEdicion ? (
                  <h2 className="text-xl font-bold text-gray-900">
                    {actividadSeleccionada.titulo}
                  </h2>
                ) : (
                  <form onSubmit={actualizarActividad}>
                    <input
                      type="text"
                      value={tituloEdicion}
                      onChange={(e) => setTituloEdicion(e.target.value)}
                      className="text-xl font-bold text-gray-900 w-full px-3 py-2 border-2 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 mb-2"
                      required
                      autoFocus
                    />
                  </form>
                )}
              </div>
              <button 
                onClick={() => {
                  setActividadSeleccionada(null)
                  setModoEdicion(false)
                }}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {!modoEdicion ? (
              // Vista normal
              <>
                <div className="space-y-3 mb-6">
                  <div className="flex items-center gap-3 text-gray-600">
                    <Calendar className="w-5 h-5" />
                    <span>
  {parseFechaLocal(actividadSeleccionada.fechaProgramada).toLocaleDateString('es-UY', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })}
</span>
                  </div>
                  
                  {actividadSeleccionada.notas && (
                    <div className="bg-gray-50 rounded-xl p-4">
                      <p className="text-sm text-gray-600 font-medium mb-1">Notas:</p>
                      <p className="text-gray-800">{actividadSeleccionada.notas}</p>
                    </div>
                  )}
                  
                  {actividadSeleccionada.fechaRealizacion && (
  <div className="text-sm text-green-600">
    ✓ Realizada el {parseFechaLocal(actividadSeleccionada.fechaRealizacion).toLocaleDateString('es-UY')}
  </div>
)}
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => eliminarActividad(actividadSeleccionada.id)}
                    className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-red-200 text-red-600 rounded-xl hover:bg-red-50 font-medium"
                  >
                    <Trash2 className="w-4 h-4" />
                    Eliminar
                  </button>
                  
                  <button
                    onClick={() => {
                      setModoEdicion(true)
                      setTituloEdicion(actividadSeleccionada.titulo)
                      setFechaEdicion(actividadSeleccionada.fechaProgramada.split('T')[0])
                      setNotaEdicion(actividadSeleccionada.notas || "")
                    }}
                    className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-blue-200 text-blue-600 rounded-xl hover:bg-blue-50 font-medium"
                  >
                    Editar
                  </button>
                  
                  <button
                    onClick={() => toggleRealizada(actividadSeleccionada.id, actividadSeleccionada.realizada)}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium ${
                      actividadSeleccionada.realizada
                        ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                        : 'bg-green-600 text-white hover:bg-green-700'
                    }`}
                  >
                    <Check className="w-4 h-4" />
                    {actividadSeleccionada.realizada ? 'Marcar pendiente' : 'Marcar realizada'}
                  </button>
                </div>
              </>
            ) : (
              // Modo edición
              <form onSubmit={actualizarActividad}>
                <div className="space-y-4 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Fecha
                    </label>
                    <input
                      type="date"
                      value={fechaEdicion}
                      onChange={(e) => setFechaEdicion(e.target.value)}
                      min={fechaMin}
                      className="w-full px-4 py-3 border-2 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Notas (opcional)
                    </label>
                    <textarea
                      value={notaEdicion}
                      onChange={(e) => setNotaEdicion(e.target.value)}
                      placeholder="Información adicional..."
                      rows={3}
                      className="w-full px-4 py-3 border-2 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setModoEdicion(false)}
                    className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-xl hover:bg-gray-50 font-medium"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={guardandoEdicion || !tituloEdicion.trim() || !fechaEdicion}
                    className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 font-medium"
                  >
                    {guardandoEdicion ? "Guardando..." : "Guardar cambios"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}