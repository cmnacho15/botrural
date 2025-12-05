'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Rocket, ChevronDown, ChevronUp, Check, X } from 'lucide-react'
import { useOnboardingProgress } from '@/hooks/useOnboardingProgress'
import ModalNuevoDato from '@/app/components/modales/ModalNuevoDato'
import ModalInvitarUsuario from '@/app/components/modales/ModalInvitarUsuario'

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

  // Estado de pasos expandidos - por defecto expandir el primer paso incompleto
  const [pasosExpandidos, setPasosExpandidos] = useState({
    paso1: !paso1Completado,
    paso2: paso1Completado && !paso2Completado,
    paso3: paso1Completado && paso2Completado && !paso3Completado
  })

  // Modales
  const [modalDatoOpen, setModalDatoOpen] = useState(false)
  const [tipoDato, setTipoDato] = useState('')
  const [modalEquipoOpen, setModalEquipoOpen] = useState(false)

  const togglePaso = (paso: 'paso1' | 'paso2' | 'paso3') => {
    setPasosExpandidos(prev => ({
      ...prev,
      [paso]: !prev[paso]
    }))
  }

  const handleDatoSuccess = () => {
    setModalDatoOpen(false)
    setTipoDato('')
  }

  const handleEquipoSuccess = () => {
    setModalEquipoOpen(false)
  }

  // URLs de iconos (usando Flaticon CDN)
  const iconos = {
    formulario: 'https://cdn-icons-png.flaticon.com/512/3075/3075908.png',
    excel: 'https://cdn-icons-png.flaticon.com/512/732/732220.png',
    kmz: 'https://cdn-icons-png.flaticon.com/512/2875/2875421.png',
    croquis: 'https://cdn-icons-png.flaticon.com/512/4727/4727496.png',
    whatsapp: 'https://cdn-icons-png.flaticon.com/512/733/733585.png',
    web: 'https://cdn-icons-png.flaticon.com/512/3067/3067260.png',
    admin: 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png',
    usuario: 'https://cdn-icons-png.flaticon.com/512/3135/3135789.png',
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
                  3 pasos para empezar a usar FieldData
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
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                  <OpcionCard
                    icono={iconos.formulario}
                    titulo="Ingresar Manualmente"
                    subtitulo="Ideal si son pocos potreros"
                    href="/dashboard/lotes/nuevo"
                  />
                  <OpcionCard
                    icono={iconos.excel}
                    titulo="CSV o Excel"
                    subtitulo="Cargá todos de una vez"
                    disabled
                    onClick={() => {}}
                  />
                  <OpcionCard
                    icono={iconos.kmz}
                    titulo="KMZ de Google Earth"
                    subtitulo="Subí tus potreros y tu mapa"
                    disabled
                    onClick={() => {}}
                  />
                  <OpcionCard
                    icono={iconos.croquis}
                    titulo="Imagen de un croquis"
                    subtitulo="Te dibujamos el mapa"
                    disabled
                    onClick={() => {}}
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
                      // TODO: Conectar con el bot de WhatsApp
                      alert('Próximamente: conexión directa al bot de WhatsApp')
                    }}
                  />
                  <OpcionCard
                    icono={iconos.web}
                    titulo="Ingresar en la Web"
                    subtitulo="Ideal cuando estás en la oficina"
                    onClick={() => setModalDatoOpen(true)}
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl mx-auto">
                  <OpcionCard
                    icono={iconos.admin}
                    titulo="Invitar Administradores"
                    subtitulo="Tienen acceso a la plataforma web y el bot"
                    onClick={() => setModalEquipoOpen(true)}
                  />
                  <OpcionCard
                    icono={iconos.usuario}
                    titulo="Invitar Usuarios"
                    subtitulo="Solo tienen acceso al bot de WhatsApp"
                    onClick={() => setModalEquipoOpen(true)}
                  />
                </div>
              </Paso>

            </div>
          </div>

          {/* Mensaje de completado */}
          {totalCompletados === 3 && (
            <div className="mt-6 p-6 bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl text-white text-center">
              <h3 className="text-xl font-bold mb-2">🎉 ¡Felicitaciones!</h3>
              <p>Ya completaste todos los pasos. Estás listo para aprovechar FieldData al máximo.</p>
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

      {/* Modal selector de tipo de dato */}
      <ModalSelectorTipoDato 
        isOpen={modalDatoOpen}
        onClose={() => setModalDatoOpen(false)}
        onSelectTipo={(tipo) => {
          setTipoDato(tipo)
          setModalDatoOpen(false)
        }}
      />

      {/* Si ya seleccionó tipo, mostrar el modal correspondiente */}
      {tipoDato && (
        <ModalNuevoDato
          isOpen={!!tipoDato}
          onClose={() => setTipoDato('')}
          tipo={tipoDato}
          onSuccess={handleDatoSuccess}
        />
      )}

      {/* Modal de invitar usuario */}
      <ModalInvitarUsuario
        isOpen={modalEquipoOpen}
        onClose={() => setModalEquipoOpen(false)}
        onSuccess={handleEquipoSuccess}
      />
    </>
  )
}

// ==========================================
// 📦 MODAL SELECTOR DE TIPO DE DATO
// ==========================================
interface ModalSelectorTipoDatoProps {
  isOpen: boolean
  onClose: () => void
  onSelectTipo: (tipo: string) => void
}

function ModalSelectorTipoDato({ isOpen, onClose, onSelectTipo }: ModalSelectorTipoDatoProps) {
  if (!isOpen) return null

  const categorias = [
    {
      titulo: '🌾 Agricultura',
      opciones: [
        { tipo: 'siembra', nombre: 'Siembra' },
        { tipo: 'cosecha', nombre: 'Cosecha' },
        { tipo: 'pulverizacion', nombre: 'Pulverización' },
        { tipo: 'refertilizacion', nombre: 'Refertilización' },
        { tipo: 'riego', nombre: 'Riego' },
        { tipo: 'monitoreo', nombre: 'Monitoreo' },
      ]
    },
    {
      titulo: '🐄 Ganadería',
      opciones: [
        { tipo: 'cambio-potrero', nombre: 'Cambio de Potrero' },
        { tipo: 'nacimiento', nombre: 'Nacimiento' },
        { tipo: 'tratamiento', nombre: 'Tratamiento' },
        { tipo: 'mortandad', nombre: 'Mortandad' },
        { tipo: 'tacto', nombre: 'Tacto' },
        { tipo: 'recategorizacion', nombre: 'Recategorización' },
      ]
    },
    {
      titulo: '💰 Finanzas',
      opciones: [
        { tipo: 'gasto', nombre: 'Gasto' },
        { tipo: 'ingreso', nombre: 'Ingreso' },
        { tipo: 'compra', nombre: 'Compra' },
        { tipo: 'venta', nombre: 'Venta' },
      ]
    },
    {
      titulo: '🌤️ Clima y otros',
      opciones: [
        { tipo: 'lluvia', nombre: 'Lluvia' },
        { tipo: 'helada', nombre: 'Helada' },
        { tipo: 'uso-insumos', nombre: 'Uso de Insumos' },
        { tipo: 'ingreso-insumos', nombre: 'Ingreso de Insumos' },
        { tipo: 'consumo', nombre: 'Consumo' },
        { tipo: 'otros-labores', nombre: 'Otros Labores' },
      ]
    },
  ]

  return (
    <div className="fixed inset-0 backdrop-blur-md bg-black/30 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-200 sticky top-0 bg-white z-10">
          <h2 className="text-xl font-bold text-gray-900">¿Qué tipo de dato quieres ingresar?</h2>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Contenido */}
        <div className="p-5 space-y-6">
          {categorias.map((categoria, idx) => (
            <div key={idx}>
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                {categoria.titulo}
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {categoria.opciones.map((opcion) => (
                  <button
                    key={opcion.tipo}
                    onClick={() => onSelectTipo(opcion.tipo)}
                    className="px-4 py-3 bg-gray-50 hover:bg-blue-50 hover:border-blue-300 border-2 border-gray-100 rounded-xl text-gray-700 hover:text-blue-700 font-medium transition-all text-sm text-left"
                  >
                    {opcion.nombre}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}