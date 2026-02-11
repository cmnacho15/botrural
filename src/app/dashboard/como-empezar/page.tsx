'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Rocket, ChevronDown, ChevronUp, Check } from 'lucide-react'
import { useOnboardingProgress } from '@/hooks/useOnboardingProgress'
import ModalInvitarUsuario from '@/app/components/modales/ModalInvitarUsuario'
import ModalNuevoDato from '@/app/components/modales/ModalNuevoDato'
import KMZUploader from '@/app/preferencias/components/KMZUploader'
import { toast } from '@/app/components/Toast'
// ==========================================
// 📦 COMPONENTE CARD DE OPCIÓN
// ==========================================
interface OpcionCardProps {
  icono: string
  titulo: string
  subtitulo: string
  onClick?: () => void
  href?: string
  disabled?: boolean
  destacado?: boolean
}

function OpcionCard({ icono, titulo, subtitulo, onClick, href, disabled, destacado }: OpcionCardProps) {
  const baseClasses = `
    flex flex-col items-center justify-center p-6 rounded-xl border-2 transition-all duration-200 min-h-[180px]
    ${disabled 
      ? 'bg-gray-50 border-gray-200 cursor-not-allowed opacity-60' 
      : destacado
        ? 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-300 hover:border-green-400 hover:shadow-lg cursor-pointer'
        : 'bg-white border-gray-200 hover:border-blue-300 hover:shadow-md cursor-pointer'
    }
  `

  const content = (
    <>
      <div className="mb-4 h-16 w-16 flex items-center justify-center">
        <img src={icono} alt={titulo} className="w-14 h-14 object-contain" />
      </div>
      <h4 className="font-semibold text-gray-900 text-center text-sm">{titulo}</h4>
      <p className="text-xs text-gray-500 text-center mt-1">{subtitulo}</p>
    </>
  )

  if (href && !disabled) {
    return (
      <Link href={href} className={baseClasses}>
        {content}
      </Link>
    )
  }

  return (
    <button onClick={onClick} disabled={disabled} className={baseClasses}>
      {content}
    </button>
  )
}

// ==========================================
// 📦 COMPONENTE PASO EXPANDIBLE
// ==========================================
interface PasoProps {
  numero: number
  titulo: string
  completado: boolean
  expandido: boolean
  onToggle: () => void
  children: React.ReactNode
}

function Paso({ numero, titulo, completado, expandido, onToggle, children }: PasoProps) {
  return (
    <div className={`
      rounded-xl border transition-all duration-300 overflow-hidden bg-white
      ${completado ? 'border-green-200' : 'border-gray-200'}
    `}>
      {/* Header del paso */}
      <button 
        onClick={onToggle}
        className="w-full flex items-center gap-4 p-5 hover:bg-gray-50/50 transition-colors text-left"
      >
        <div className={`
          w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg flex-shrink-0
          ${completado 
            ? 'bg-green-500 text-white' 
            : 'bg-gray-200 text-gray-600'
          }
        `}>
          {completado ? <Check className="w-5 h-5" /> : numero}
        </div>
        <span className={`text-lg font-medium flex-1 ${completado ? 'text-green-700' : 'text-gray-900'}`}>
          {titulo}
        </span>
        {expandido ? (
          <ChevronUp className="w-5 h-5 text-gray-400 flex-shrink-0" />
        ) : (
          <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0" />
        )}
      </button>

      {/* Contenido expandible */}
      <div className={`
        transition-all duration-300 ease-in-out
        ${expandido ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'}
        overflow-hidden
      `}>
        <div className="px-5 pb-6 pt-2">
          {children}
        </div>
      </div>
    </div>
  )
}

// ==========================================
// 📦 MENÚ GIGANTE DE EVENTOS (igual al layout)
// ==========================================
interface MenuEventosProps {
  isOpen: boolean
  onClose: () => void
  onSelectTipo: (tipo: string) => void
}

function MenuGiganteEventos({ isOpen, onClose, onSelectTipo }: MenuEventosProps) {
  if (!isOpen) return null

  return (
    <div 
      className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[70] flex justify-center items-start pt-4 sm:pt-10 p-3 sm:p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-xl shadow-2xl p-4 sm:p-6 md:p-8 max-w-5xl w-full relative my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 sm:top-4 sm:right-4 text-gray-400 hover:text-gray-600 text-2xl sm:text-3xl leading-none"
        >
          ×
        </button>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 sm:gap-6 md:gap-8 mt-8 sm:mt-0">
          
          {/* ANIMALES */}
          <div>
            <h3 className="font-bold mb-3 sm:mb-4 text-gray-800 text-xs sm:text-sm uppercase tracking-wide">ANIMALES</h3>
            <div className="space-y-1">
              {[
                ["cambio-potrero", "🔄", "Cambio De Potrero"],
                ["tratamiento", "💉", "Tratamiento"],
                ["venta", "💵", "Venta"],
                ["compra", "🛒", "Compra"],
                ["traslado", "🚚", "Traslado"],
                ["nacimiento", "🐄", "Nacimiento"],
                ["mortandad", "💀", "Mortandad"],
                ["consumo", "🥩", "Consumo"],
                ["aborto", "❌", "Aborto"],
                ["destete", "🍼", "Destete"],
                ["tacto", "✋", "Tacto"],
                ["recategorizacion", "🏷️", "Recategorización"],
                ["dao", "🔬", "DAO"],  // ← AGREGAR ESTA LÍNEA
              ].map(([tipo, emoji, label]) => (
                <button
                  key={tipo}
                  onClick={() => onSelectTipo(tipo)}
                  className="w-full text-left flex items-center gap-2 text-xs sm:text-sm py-2 px-2 sm:px-3 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                >
                  <span className="text-sm sm:text-base">{emoji}</span>
                  <span className="truncate">{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* AGRICULTURA */}
          <div>
            <h3 className="font-bold mb-3 sm:mb-4 text-gray-800 text-xs sm:text-sm uppercase tracking-wide">AGRICULTURA</h3>
            <div className="space-y-1">
              {[
                ["siembra", "🌱", "Siembra"],
                ["pulverizacion", "💧", "Pulverización"],
                ["refertilizacion", "🌿", "Refertilización"],
                ["riego", "💦", "Riego"],
                ["monitoreo", "🔍", "Monitoreo"],
                ["cosecha", "🌾", "Cosecha"],
                ["otros-labores", "🔧", "Otros Labores"],
              ].map(([tipo, emoji, label]) => (
                <button
                  key={tipo}
                  onClick={() => onSelectTipo(tipo)}
                  className="w-full text-left flex items-center gap-2 text-xs sm:text-sm py-2 px-2 sm:px-3 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                >
                  <span className="text-sm sm:text-base">{emoji}</span>
                  <span className="truncate">{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* CLIMA */}
          <div>
            <h3 className="font-bold mb-3 sm:mb-4 text-gray-800 text-xs sm:text-sm uppercase tracking-wide">CLIMA</h3>
            <div className="space-y-1">
              <button
                onClick={() => onSelectTipo("lluvia")} 
                className="w-full text-left flex items-center gap-2 text-xs sm:text-sm py-2 px-2 sm:px-3 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              >
                <span className="text-sm sm:text-base">🌧️</span>
                <span>Lluvia</span>
              </button>
              <button
                onClick={() => onSelectTipo("helada")} 
                className="w-full text-left flex items-center gap-2 text-xs sm:text-sm py-2 px-2 sm:px-3 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              >
                <span className="text-sm sm:text-base">❄️</span>
                <span>Helada</span>
              </button>
            </div>
          </div>

          {/* INSUMOS */}
          <div>
            <h3 className="font-bold mb-3 sm:mb-4 text-gray-800 text-xs sm:text-sm uppercase tracking-wide">INSUMOS</h3>
            <div className="space-y-1">
              <button
                onClick={() => onSelectTipo("uso-insumos")} 
                className="w-full text-left flex items-center gap-2 text-xs sm:text-sm py-2 px-2 sm:px-3 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              >
                <span className="text-sm sm:text-base">📤</span>
                <span>Uso</span>
              </button>
              <button
                onClick={() => onSelectTipo("ingreso-insumos")} 
                className="w-full text-left flex items-center gap-2 text-xs sm:text-sm py-2 px-2 sm:px-3 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              >
                <span className="text-sm sm:text-base">📥</span>
                <span>Ingreso</span>
              </button>
            </div>
          </div>

          {/* FINANZAS */}
          <div>
            <h3 className="font-bold mb-3 sm:mb-4 text-gray-800 text-xs sm:text-sm uppercase tracking-wide">FINANZAS</h3>
            <div className="space-y-1">
              <button
                onClick={() => onSelectTipo("gasto")} 
                className="w-full text-left flex items-center gap-2 text-xs sm:text-sm py-2 px-2 sm:px-3 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              >
                <span className="text-sm sm:text-base">💰</span>
                <span>Gasto</span>
              </button>
              <button
                onClick={() => onSelectTipo("ingreso")} 
                className="w-full text-left flex items-center gap-2 text-xs sm:text-sm py-2 px-2 sm:px-3 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              >
                <span className="text-sm sm:text-base">✅</span>
                <span>Ingreso</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ==========================================
// 🚀 COMPONENTE PRINCIPAL
// ==========================================
export default function ComoEmpezar() {
  const {
    paso1Completado,
    paso2Completado,
    paso3Completado,
    totalCompletados,
    porcentaje
  } = useOnboardingProgress()

  // Estado de pasos expandidos
  const [pasosExpandidos, setPasosExpandidos] = useState({
    paso1: !paso1Completado,
    paso2: paso1Completado && !paso2Completado,
    paso3: paso1Completado && paso2Completado && !paso3Completado
  })

  // Estado para el menú de eventos y modal
  const [menuEventosOpen, setMenuEventosOpen] = useState(false)
  const [tipoDatoSeleccionado, setTipoDatoSeleccionado] = useState('')
  const [modalEquipoOpen, setModalEquipoOpen] = useState(false)
   const [showModalKMZ, setShowModalKMZ] = useState(false)

  const togglePaso = (paso: 'paso1' | 'paso2' | 'paso3') => {
    setPasosExpandidos(prev => ({
      ...prev,
      [paso]: !prev[paso]
    }))
  }

  // URLs de iconos
  const iconos = {
    formulario: 'https://cdn-icons-png.flaticon.com/512/3075/3075908.png',
    excel: 'https://cdn-icons-png.flaticon.com/512/732/732220.png',
    kmz: 'https://cdn-icons-png.flaticon.com/512/2875/2875421.png',
    croquis: 'https://cdn-icons-png.flaticon.com/512/4727/4727496.png',
    whatsapp: 'https://cdn-icons-png.flaticon.com/512/733/733585.png',
    web: 'https://cdn-icons-png.flaticon.com/512/3067/3067260.png',
  }

  return (
    <>
      <div className="bg-gray-50 min-h-screen p-4 sm:p-6 md:p-8">
        <div className="max-w-4xl mx-auto">
          
          {/* Card principal */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            
            {/* Header */}
            <div className="p-6 sm:p-8 border-b border-gray-100">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
                  3 pasos para empezar a usar BotRural
                </h1>
                <span className="text-2xl sm:text-3xl font-bold text-gray-400">
                  {porcentaje}%
                </span>
              </div>
              
              {/* Barra de progreso */}
              <div className="mt-4 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-green-500 rounded-full transition-all duration-700 ease-out"
                  style={{ width: `${porcentaje}%` }}
                />
              </div>

              {/* Mensaje de ayuda */}
              <p className="text-gray-600 mt-4 text-sm sm:text-base">
                ¿Alguna duda?{' '}
                <a href="#" className="text-blue-600 hover:underline font-medium">Agendá</a>
                {' '}una reunión de capacitación gratuita con nuestro equipo o{' '}
                <a href="#" className="text-blue-600 hover:underline font-medium">escribinos</a>
                {' '}por WhatsApp.
              </p>
            </div>

            {/* Pasos */}
            <div className="p-4 sm:p-6 space-y-4">
              
              {/* PASO 1: Cargar potreros */}
              <Paso
                numero={1}
                titulo="Carga los potreros de tu campo"
                completado={paso1Completado}
                expandido={pasosExpandidos.paso1}
                onToggle={() => togglePaso('paso1')}
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 max-w-2xl mx-auto">
  <OpcionCard
    icono={iconos.formulario}
    titulo="Ingresar Manualmente"
    subtitulo="Ideal si son pocos potreros"
    href="/dashboard/lotes/nuevo"
  />
  <OpcionCard
    icono={iconos.kmz}
    titulo="KMZ de Google Earth"
    subtitulo="Subí tus potreros y tu mapa"
    onClick={() => setShowModalKMZ(true)}
  />
</div>
                
                <div className="text-center mt-6">
                  <a 
                    href="#" 
                    className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium text-sm"
                  >
                    Ver Video Demo
                  </a>
                </div>
              </Paso>

              {/* PASO 2: Ingresar primer dato */}
              <Paso
                numero={2}
                titulo="Ingresa tu primer dato!"
                completado={paso2Completado}
                expandido={pasosExpandidos.paso2}
                onToggle={() => togglePaso('paso2')}
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl mx-auto">
                  <OpcionCard
                    icono={iconos.whatsapp}
                    titulo="Ingresar en WhatsApp"
                    subtitulo="Ideal cuando estás en el campo"
                    destacado
                    onClick={() => {
                      toast.info('Próximamente: conexión directa al bot de WhatsApp')
                    }}
                  />
                  <OpcionCard
                    icono={iconos.web}
                    titulo="Ingresar en la Web"
                    subtitulo="Ideal cuando estás en la oficina"
                    onClick={() => setMenuEventosOpen(true)}
                  />
                </div>
                
                <div className="text-center mt-6">
                  <a 
                    href="#" 
                    className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium text-sm"
                  >
                    Ver Video Demo
                  </a>
                </div>
              </Paso>

              {/* PASO 3: Invitar equipo */}
              <Paso
                numero={3}
                titulo="Invita a los miembros de tu equipo"
                completado={paso3Completado}
                expandido={pasosExpandidos.paso3}
                onToggle={() => togglePaso('paso3')}
              >
                <div className="text-center">
                  <p className="text-gray-600 mb-4">
                    Invita a colaboradores, administradores o contadores para que puedan acceder a la plataforma.
                  </p>
                  <button
                    onClick={() => setModalEquipoOpen(true)}
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                  >
                    Invitar Usuario
                  </button>
                </div>
              </Paso>

            </div>
          </div>

          {/* Mensaje de completado */}
          {totalCompletados === 3 && (
            <div className="mt-6 p-6 bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl text-white text-center">
              <h3 className="text-xl font-bold mb-2">🎉 ¡Felicitaciones!</h3>
              <p>Ya completaste todos los pasos. Estás listo para aprovechar BotRural al máximo.</p>
              <Link 
                href="/dashboard"
                className="inline-block mt-4 px-6 py-2 bg-white text-green-600 font-semibold rounded-lg hover:bg-gray-100 transition"
              >
                Ir al Dashboard
              </Link>
            </div>
          )}

        </div>
      </div>

      {/* Menú gigante de eventos */}
      <MenuGiganteEventos
        isOpen={menuEventosOpen}
        onClose={() => setMenuEventosOpen(false)}
        onSelectTipo={(tipo) => {
          setTipoDatoSeleccionado(tipo)
          setMenuEventosOpen(false)
        }}
      />

      {/* Modal del evento seleccionado */}
      {tipoDatoSeleccionado && (
        <ModalNuevoDato
          isOpen={!!tipoDatoSeleccionado}
          onClose={() => setTipoDatoSeleccionado('')}
          tipo={tipoDatoSeleccionado}
          onSuccess={() => {
            setTipoDatoSeleccionado('')
            window.location.reload()
          }}
        />
      )}

      {/* Modal de invitar usuario */}
      <ModalInvitarUsuario
        isOpen={modalEquipoOpen}
        onClose={() => setModalEquipoOpen(false)}
        onSuccess={() => {
          setModalEquipoOpen(false)
          window.location.reload()
        }}
      />

      {/* MODAL KMZ */}
      {showModalKMZ && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[80] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center sticky top-0 bg-white">
                <h2 className="text-lg font-semibold text-gray-900">
                  Subir KMZ o KML de Google Earth
                </h2>
              <button
                onClick={() => setShowModalKMZ(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
              >
                ✕
              </button>
            </div>

            <div className="p-6">
              <KMZUploader 
                onComplete={() => {
                  setShowModalKMZ(false)
                  window.location.reload()
                }} 
              />
            </div>
          </div>
        </div>
      )}
    </>
  )
}