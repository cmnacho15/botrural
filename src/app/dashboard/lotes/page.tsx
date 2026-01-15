//src/app/dashboard/lotes/page.tsx
'use client';
export const dynamic = "force-dynamic"

import { useState, useRef } from 'react'
import KMZUploader from '@/app/preferencias/components/KMZUploader'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import useSWR from 'swr'
import { EQUIVALENCIAS_UG, calcularRelacionLanarVacuno, calcularUGTotales } from '@/lib/ugCalculator'
import BotonDescargarCarga from '@/app/dashboard/lotes/components/BotonDescargarCarga'
import { useEquivalenciasUG } from '@/hooks/useEquivalenciasUG'

interface Lote {
  id: string
  nombre: string
  hectareas: number
  diasPastoreo: number
  diasDescanso: number
  esPastoreable: boolean  // 🔥 NUEVO
  moduloPastoreoId: string | null
  cultivos: Array<{ 
    tipoCultivo: string
    hectareas: number
    fechaSiembra: string
  }>
  animalesLote: Array<{ 
    cantidad: number
    categoria: string 
  }>
}

// ==========================================
// 💡 COMPONENTE TOOLTIP
// ==========================================
interface TooltipProps {
  children: React.ReactNode
  content: React.ReactNode
}

function Tooltip({ children, content }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 })
  const [arrowLeft, setArrowLeft] = useState(0)
  const [posicionArriba, setPosicionArriba] = useState(false)
  const triggerRef = useRef<HTMLDivElement>(null)

  const handleMouseEnter = () => {
    if (!triggerRef.current) return

    const rect = triggerRef.current.getBoundingClientRect()
    const tooltipWidth = 384 // w-96 = 384px
    const tooltipHeight = 320 // altura del tooltip + margen extra

// Detectar si hay espacio abajo
const espacioAbajo = window.innerHeight - rect.bottom
const hayEspacioAbajo = espacioAbajo > tooltipHeight + 50
    
    let top: number
    if (hayEspacioAbajo) {
      // Posicionar DEBAJO
      top = rect.bottom + 12
      setPosicionArriba(false)
    } else {
  // Posicionar ARRIBA - borde inferior del tooltip toca borde superior del badge
  top = rect.top - 12
  setPosicionArriba(true)
}
    
    // Centrar horizontalmente respecto al trigger
    let left = rect.left + rect.width / 2 - tooltipWidth / 2
    
    // Ajustar si se sale de la pantalla
    if (left < 10) {
      left = 10
    } else if (left + tooltipWidth > window.innerWidth - 10) {
      left = window.innerWidth - tooltipWidth - 10
    }
    
    // Calcular posición de la flecha para que apunte al centro del trigger
    const arrowLeftPosition = rect.left + rect.width / 2 - left
    
    setTooltipPosition({ top, left })
    setArrowLeft(arrowLeftPosition)
    setIsVisible(true)
  }

  const tooltipContent = isVisible && (
    <div 
      style={{
  position: 'fixed',
  ...(posicionArriba 
    ? { bottom: `${window.innerHeight - tooltipPosition.top}px` }
    : { top: `${tooltipPosition.top}px` }
  ),
  left: `${tooltipPosition.left}px`,
  zIndex: 9999
}}
      className="w-96 p-4 bg-gray-900 text-white text-sm rounded-lg shadow-2xl pointer-events-none"
    >
      {/* Flecha dinámica: arriba o abajo según posición */}
      <div 
        className={`absolute w-3 h-3 bg-gray-900 transform rotate-45 ${posicionArriba ? 'bottom-[-6px]' : 'top-[-6px]'}`}
        style={{ left: `${arrowLeft}px`, marginLeft: '-6px' }}
      ></div>
      {content}
    </div>
  )

  return (
    <>
      <div 
        ref={triggerRef}
        className="relative inline-block"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={() => setIsVisible(false)}
      >
        <div className="cursor-help">
          {children}
        </div>
      </div>
      {typeof window !== 'undefined' && createPortal(tooltipContent, document.body)}
    </>
  )
}

// ==========================================
// 📊 CONTENIDO TOOLTIP CARGA GLOBAL
// ==========================================
function TooltipCargaGlobal() {
  return (
    <div className="space-y-3">
      <div>
        <p className="font-semibold mb-1">🌍 Carga Global (UG/ha)</p>
        <p className="text-gray-300 text-xs leading-relaxed">
          Promedio de UG por hectárea considerando superficie de pastoreo ganadero.
        </p>
      </div>
      
      <div className="border-t border-gray-700 pt-2">
        <p className="font-semibold mb-1">📏 ¿Qué es una UG?</p>
        <p className="text-gray-300 text-xs leading-relaxed mb-2">
          <strong>Unidad Ganadera (UG):</strong> Equivale a una vaca de 380 kg de peso vivo.
        </p>
        <ul className="text-gray-300 text-xs space-y-1 list-disc list-inside">
          <li>Consume aprox. <strong>2.800 kg MS/año</strong> (≈ 7,6 kg MS/día)</li>
          <li>Permite comparar diferentes categorías de animales</li>
        </ul>
      </div>

      <div className="border-t border-gray-700 pt-2">
        <p className="font-semibold mb-1">🐄 Ejemplos de equivalencias:</p>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-gray-300">
          <div>• Vaca: <strong>1.00 UG</strong></div>
          <div>• Toro: <strong>1.20 UG</strong></div>
          <div>• Novillo +3a: <strong>1.20 UG</strong></div>
          <div>• Ternero: <strong>0.40 UG</strong></div>
          <div>• Oveja: <strong>0.16 UG</strong></div>
          <div>• Cordero: <strong>0.10 UG</strong></div>
        </div>
      </div>
    </div>
  )
}

// ==========================================
// 📊 CONTENIDO TOOLTIP CARGA POTRERO
// ==========================================
function TooltipCargaPotrero() {
  return (
    <div className="space-y-3">
      <div>
        <p className="font-semibold mb-1">📍 Carga del Potrero (UG/ha)</p>
        <p className="text-gray-300 text-xs leading-relaxed">
          UG por hectárea en este potrero específico según los animales actuales.
        </p>
      </div>
      
      <div className="border-t border-gray-700 pt-2">
        <p className="font-semibold mb-1">📏 ¿Qué es una UG?</p>
        <p className="text-gray-300 text-xs leading-relaxed mb-2">
          <strong>Unidad Ganadera (UG):</strong> Equivale a una vaca de 380 kg de peso vivo.
        </p>
        <ul className="text-gray-300 text-xs space-y-1 list-disc list-inside">
          <li>Consume aprox. <strong>2.800 kg MS/año</strong> (≈ 7,6 kg MS/día)</li>
          <li>Permite comparar diferentes categorías de animales</li>
        </ul>
      </div>

      <div className="border-t border-gray-700 pt-2">
        <p className="font-semibold mb-1">🐄 Ejemplos de equivalencias:</p>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-gray-300">
          <div>• Vaca: <strong>1.00 UG</strong></div>
          <div>• Toro: <strong>1.20 UG</strong></div>
          <div>• Novillo +3a: <strong>1.20 UG</strong></div>
          <div>• Ternero: <strong>0.40 UG</strong></div>
          <div>• Oveja: <strong>0.16 UG</strong></div>
          <div>• Cordero: <strong>0.10 UG</strong></div>
        </div>
      </div>
    </div>
  )
}

// Modal de confirmación
interface ModalConfirmarBorradoProps {
  isOpen: boolean
  nombrePotrero: string
  animales: Array<{ categoria: string; cantidad: number }>
  cultivos: Array<{ tipoCultivo: string; hectareas: number }>
  onConfirmar: () => void
  onCancelar: () => void
  loading?: boolean
}

function ModalConfirmarBorrado({
  isOpen,
  nombrePotrero,
  animales,
  cultivos,
  onConfirmar,
  onCancelar,
  loading = false
}: ModalConfirmarBorradoProps) {
  if (!isOpen) return null

  const tieneAnimales = animales.length > 0
  const tieneCultivos = cultivos.length > 0

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Confirmar Borrado</h2>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-gray-700">
            Se eliminará el potrero <strong>"{nombrePotrero}"</strong>. Para proceder, 
            {tieneAnimales && tieneCultivos && ' el potrero no deberá tener ningún animal ni cultivo.'}
            {tieneAnimales && !tieneCultivos && ' el potrero no deberá tener ningún animal.'}
            {!tieneAnimales && tieneCultivos && ' el potrero no deberá tener ningún cultivo.'}
          </p>

          {tieneAnimales && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <h3 className="font-semibold text-red-800 mb-2 flex items-center gap-2">
                🐄 Animales presentes ({animales.reduce((sum, a) => sum + a.cantidad, 0)} total)
              </h3>
              <ul className="space-y-1 text-sm text-red-700">
                {animales.map((animal, idx) => (
                  <li key={idx} className="flex justify-between">
                    <span>{animal.categoria}</span>
                    <span className="font-medium">{animal.cantidad}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {tieneCultivos && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <h3 className="font-semibold text-amber-800 mb-2 flex items-center gap-2">
                🌾 Cultivos presentes
              </h3>
              <ul className="space-y-1 text-sm text-amber-700">
                {cultivos.map((cultivo, idx) => (
                  <li key={idx} className="flex justify-between">
                    <span>{cultivo.tipoCultivo}</span>
                    <span className="font-medium">{cultivo.hectareas.toFixed(1)} ha</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {!tieneAnimales && !tieneCultivos && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-green-700 text-sm">
                ✅ El potrero está vacío y puede ser eliminado.
              </p>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-gray-200 flex gap-3">
          <button
            onClick={onCancelar}
            disabled={loading}
            className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition disabled:opacity-50 font-medium"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirmar}
            disabled={loading || tieneAnimales || tieneCultivos}
            className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {loading ? 'Eliminando...' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  )
}

const fetcher = (url: string) => fetch(url).then((res) => res.json())

export default function LotesPage() {
  // ✅ Cargar lotes con SWR
  const { data: lotes = [], isLoading: loadingLotes, mutate: refreshLotes } = useSWR<Lote[]>(
    '/api/lotes',
    fetcher,
    {
      revalidateOnFocus: true,
      refreshInterval: 30000,
    }
  )

  // ✅ Cargar campo con SWR
  const { data: campo, isLoading: loadingCampo } = useSWR('/api/campos', fetcher)
  const nombreCampo = campo?.nombre || ''

  // ✅ Cargar módulos con SWR
  const { data: modulos = [], isLoading: loadingModulos } = useSWR<Array<{
    id: string
    nombre: string
    descripcion: string | null
    _count: { lotes: number }
  }>>(
    '/api/modulos-pastoreo',
    fetcher,
    {
      revalidateOnFocus: true,
      refreshInterval: 30000,
    }
  )

  const [modalBorrado, setModalBorrado] = useState<{
    isOpen: boolean
    loteId: string
    nombre: string
    animales: Array<{ categoria: string; cantidad: number }>
    cultivos: Array<{ tipoCultivo: string; hectareas: number }>
  }>({
    isOpen: false,
    loteId: '',
    nombre: '',
    animales: [],
    cultivos: []
  })

  const [loadingBorrado, setLoadingBorrado] = useState(false)
  const [showModalKMZ, setShowModalKMZ] = useState(false)
  // Hook para equivalencias UG personalizadas
  const { pesos: pesosPersonalizados, isLoading: loadingEquivalencias } = useEquivalenciasUG()

  // Estados para controlar qué acordeones están abiertos (CERRADOS por defecto)
const [acordeonesAbiertos, setAcordeonesAbiertos] = useState<{[key: string]: boolean}>({})

  // Función para toggle de acordeones
  const toggleAcordeon = (id: string) => {
    setAcordeonesAbiertos(prev => ({
      ...prev,
      [id]: !prev[id]
    }))
  }

  // ==========================================
  // 🗑️ ABRIR MODAL DE CONFIRMACIÓN
  // ==========================================
  function abrirModalBorrado(lote: Lote) {
    setModalBorrado({
      isOpen: true,
      loteId: lote.id,
      nombre: lote.nombre,
      animales: lote.animalesLote || [],
      cultivos: lote.cultivos || []
    })
  }

  // ==========================================
  // 🗑️ ELIMINAR LOTE
  // ==========================================
  async function eliminarLote() {
    setLoadingBorrado(true)

    try {
      const response = await fetch(`/api/lotes/${modalBorrado.loteId}`, { 
        method: 'DELETE' 
      })

      if (response.ok) {
        refreshLotes()
        setModalBorrado({
          isOpen: false,
          loteId: '',
          nombre: '',
          animales: [],
          cultivos: []
        })
        alert('Potrero eliminado correctamente')
      } else {
        const error = await response.json()
        alert(error.error || 'Error al eliminar el potrero')
      }
    } catch (error) {
      console.error('Error eliminando lote:', error)
      alert('Error al eliminar el potrero')
    } finally {
      setLoadingBorrado(false)
    }
  }

  // 🔥 AGRUPAR LOTES POR MÓDULOS
  const lotesAgrupados = {
    modulos: modulos.map(modulo => ({
      ...modulo,
      lotes: lotes.filter(lote => lote.moduloPastoreoId === modulo.id)
    })),
    sinModulo: lotes.filter(lote => !lote.moduloPastoreoId)
  }

  // Calcular totales por módulo
 const calcularTotalesModulo = (lotesDelModulo: Lote[]) => {
    // 🔥 SOLO CONSIDERAR POTREROS PASTOREABLES
    const lotesPastoreables = lotesDelModulo.filter(l => l.esPastoreable !== false)
    const totalHectareas = lotesPastoreables.reduce((sum, l) => sum + l.hectareas, 0)
    const todosAnimales = lotesPastoreables.flatMap(l => l.animalesLote || [])
    
    // ✅ AGRUPAR animales por categoría antes de calcular UG
    const animalesAgrupados = todosAnimales.reduce((acc, animal) => {
      const existing = acc.find(a => a.categoria === animal.categoria)
      if (existing) {
        existing.cantidad += animal.cantidad
      } else {
        acc.push({ categoria: animal.categoria, cantidad: animal.cantidad })
      }
      return acc
    }, [] as Array<{ categoria: string; cantidad: number }>)
    
    const totalAnimales = todosAnimales.reduce((sum, a) => sum + a.cantidad, 0)
    const ugTotales = calcularUGTotales(animalesAgrupados, pesosPersonalizados)
    const ugPorHa = totalHectareas > 0 ? ugTotales / totalHectareas : 0
    
    return { totalHectareas, totalAnimales, ugPorHa }
  }

  // 🎴 COMPONENTE PARA RENDERIZAR UN POTRERO (reutilizable)
  const PotreroCard = ({ lote }: { lote: Lote }) => (
    <tr key={lote.id} className="hover:bg-gray-50 transition">
      <td className="px-6 py-4">
        <div className="font-medium text-gray-900">{lote.nombre}</div>
        <div className="text-sm text-gray-500">
          {Number(lote.hectareas).toLocaleString('es-UY', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}{' '}
          has
        </div>
      </td>

      <td className="px-6 py-4 text-sm text-gray-700">
        {lote.cultivos?.length > 0 ? (
          <div className="space-y-1">
            {lote.cultivos.map((cultivo, idx) => (
              <Link
                key={idx}
                href={`/dashboard/datos?potreros=${encodeURIComponent(lote.nombre)}&cultivos=${encodeURIComponent(cultivo.tipoCultivo)}`}
                className="block"
              >
                <div className="inline-block px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm hover:bg-green-200 transition cursor-pointer">
                  <span className="font-medium">{cultivo.tipoCultivo}</span>
                  <span className="text-xs ml-1">({cultivo.hectareas.toFixed(1)} ha)</span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <span className="text-gray-400 italic">Sin cultivos</span>
        )}
      </td>

      <td className="px-6 py-4 text-sm text-gray-700">
        {lote.animalesLote.length > 0 ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative group">
                <div className="inline-block px-3 py-1 bg-blue-600 text-white rounded-full text-sm font-semibold cursor-pointer">
                  {lote.animalesLote.reduce((sum, a) => sum + a.cantidad, 0)} ({lote.diasPastoreo || 0} días)
                </div>
                <div className="hidden group-hover:block absolute z-10 px-3 py-2 text-sm text-white bg-gray-900 rounded-lg shadow-lg -top-10 left-0 whitespace-nowrap">
                  {lote.animalesLote.reduce((sum, a) => sum + a.cantidad, 0)} animales, {lote.diasPastoreo || 0} días de pastoreo
                </div>
              </div>
              
              {/* CARGA UG/ha DEL POTRERO CON TOOLTIP */}
{(() => {
  // ✅ Agrupar animales por categoría antes de calcular UG
  const animalesAgrupados = (lote.animalesLote || []).reduce((acc, animal) => {
    const existing = acc.find(a => a.categoria === animal.categoria)
    if (existing) {
      existing.cantidad += animal.cantidad
    } else {
      acc.push({ categoria: animal.categoria, cantidad: animal.cantidad })
    }
    return acc
  }, [] as Array<{ categoria: string; cantidad: number }>)
  
  const ugTotales = calcularUGTotales(animalesAgrupados, pesosPersonalizados)
  const cargaUG = lote.hectareas > 0 ? ugTotales / lote.hectareas : 0
                
                const color = 
                  cargaUG < 0.7 ? 'bg-blue-100 text-blue-700' :
                  cargaUG <= 1.5 ? 'bg-green-100 text-green-700' :
                  cargaUG <= 2.0 ? 'bg-orange-100 text-orange-700' :
                  'bg-red-100 text-red-700'
                
                return (
                  <Tooltip content={<TooltipCargaPotrero />}>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${color}`}>
                      {cargaUG.toFixed(2)} UG/ha
                    </span>
                  </Tooltip>
                )
              })()}
            </div>
            
            <div className="flex flex-wrap gap-2">
              {lote.animalesLote.map((animal, idx) => (
                <Link
                  key={idx}
                  href={`/dashboard/datos?potreros=${encodeURIComponent(lote.nombre)}&animales=${encodeURIComponent(animal.categoria)}`}
                >
                  <div className="inline-block px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm hover:bg-gray-200 transition cursor-pointer">
                    <span className="font-medium">{animal.cantidad}</span> {animal.categoria}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ) : (
  <div className="space-y-2">
    {lote.esPastoreable === false ? (
      // 🔒 POTRERO NO PASTOREABLE
      <div className="relative group">
        <div className="inline-block px-3 py-1 bg-gray-400 text-white rounded-full text-sm font-semibold cursor-pointer">
          No pastoreable
        </div>
        <div className="hidden group-hover:block absolute z-10 px-3 py-2 text-sm text-white bg-gray-900 rounded-lg shadow-lg -top-10 left-0 whitespace-nowrap">
          Este potrero no es apto para pastoreo
        </div>
      </div>
    ) : (
      // ✅ POTRERO EN DESCANSO
      <div className="relative group">
        <div className="inline-block px-3 py-1 bg-green-600 text-white rounded-full text-sm font-semibold cursor-pointer">
          Descanso ({lote.diasDescanso || 0} días)
        </div>
        <div className="hidden group-hover:block absolute z-10 px-3 py-2 text-sm text-white bg-gray-900 rounded-lg shadow-lg -top-10 left-0 whitespace-nowrap">
          Potrero en descanso: {lote.diasDescanso || 0} días
        </div>
      </div>
    )}
  </div>
)}
      </td>

      <td className="px-6 py-4 text-right">
        <div className="flex justify-end gap-3">
          <button className="text-gray-400 hover:text-gray-600 transition" title="Ver detalles">
            🔗
          </button>

          <Link
            href={`/dashboard/lotes/${lote.id}/editar`}
            className="text-gray-400 hover:text-gray-600 transition"
            title="Editar"
          >
            ✏️
          </Link>

          <button
            onClick={() => abrirModalBorrado(lote)}
            className="text-gray-400 hover:text-red-600 transition"
            title="Eliminar"
          >
            🗑️
          </button>
        </div>
      </td>
    </tr>
  )

  const loading = loadingLotes || loadingCampo || loadingModulos || loadingEquivalencias
  const hayLotes = lotes.length > 0

  if (loading) {
    return (
      <div className="bg-gray-50 min-h-screen p-4 sm:p-6 md:p-8 flex items-center justify-center">
        <p className="text-gray-600">Cargando potreros...</p>
      </div>
    )
  }

  return (
    <>
      <div className="bg-gray-50 min-h-screen p-4 sm:p-6 md:p-8 text-gray-900">
        {/* HEADER */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 gap-6">
          <div className="text-center md:text-left space-y-1">
  <h1 className="text-3xl font-bold text-gray-900 leading-tight">
    {nombreCampo ? `Potreros en ${nombreCampo}` : 'Potreros'}
  </h1>
  
  <div className="flex items-center gap-3 flex-wrap justify-center md:justify-start">
    {/* SUPERFICIE TOTAL */}
    {hayLotes && (() => {
    const superficieTotal = lotes.reduce((sum, l) => sum + l.hectareas, 0)
    return (
      <span className="px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-700">
        Superficie total: {superficieTotal.toFixed(2)} ha
      </span>
    )
  })()}

  {/* SPG (SUPERFICIE DE PASTOREO GANADERO) */}
{hayLotes && (() => {
  const lotesPastoreables = lotes.filter(l => l.esPastoreable !== false)
  const spg = lotesPastoreables.reduce((sum, l) => sum + l.hectareas, 0)
  return (
    <Tooltip content={
      <div className="space-y-2">
        <div>
          <p className="font-semibold mb-1">🌾 SPG - Superficie de Pastoreo Ganadero</p>
          <p className="text-gray-300 text-xs leading-relaxed">
            Suma de hectáreas de todos los potreros marcados como <strong>pastoreables</strong>.
          </p>
        </div>
        
        <div className="border-t border-gray-700 pt-2">
          <p className="text-gray-300 text-xs leading-relaxed">
            Solo incluye potreros aptos para pastoreo de animales. Los potreros agrícolas o no pastoreables quedan excluidos del cálculo de carga animal.
          </p>
        </div>
      </div>
    }>
      <span className="px-3 py-1 rounded-full text-sm font-medium bg-cyan-100 text-cyan-700">
        SPG: {spg.toFixed(2)} ha
      </span>
    </Tooltip>
  )
})()}
  
  {/* 🌾 CARGA GLOBAL DEL CAMPO CON TOOLTIP */}
{hayLotes && (() => {
  // 🔥 SOLO CONSIDERAR POTREROS PASTOREABLES
  const lotesPastoreables = lotes.filter(l => l.esPastoreable !== false)
  const totalHectareas = lotesPastoreables.reduce((sum, l) => sum + l.hectareas, 0)
  const todosAnimales = lotesPastoreables.flatMap(l => l.animalesLote || [])

  // ✅ AGRUPAR animales por categoría antes de calcular UG
  const animalesAgrupados = todosAnimales.reduce((acc, animal) => {
    const existing = acc.find(a => a.categoria === animal.categoria)
    if (existing) {
      existing.cantidad += animal.cantidad
    } else {
      acc.push({ categoria: animal.categoria, cantidad: animal.cantidad })
    }
    return acc
  }, [] as Array<{ categoria: string; cantidad: number }>)

  const ugTotales = calcularUGTotales(animalesAgrupados, pesosPersonalizados)
  const cargaGlobal = totalHectareas > 0 ? ugTotales / totalHectareas : 0
                
  if (todosAnimales.length === 0) return null
  
  const color = 
    cargaGlobal < 0.7 ? 'bg-blue-100 text-blue-700' :
    cargaGlobal <= 1.5 ? 'bg-green-100 text-green-700' :
    cargaGlobal <= 2.0 ? 'bg-orange-100 text-orange-700' :
    'bg-red-100 text-red-700'
  
  return (
    <Tooltip content={<TooltipCargaGlobal />}>
      <span className={`px-3 py-1 rounded-full text-sm font-medium ${color}`}>
        {cargaGlobal.toFixed(2)} UG/ha
      </span>
    </Tooltip>
  )
})()}

  {/* RELACIÓN LANAR🐑/VACUNO🐄*/}
  {hayLotes && (() => {
    const { totalOvinos, totalVacunos, relacion } = calcularRelacionLanarVacuno(lotes)
    
    // Solo mostrar si HAY AMBOS (ovinos Y vacunos)
    if (totalOvinos === 0 || totalVacunos === 0 || relacion === null) return null
    
    return (
      <span className="px-3 py-1 rounded-full text-sm font-medium bg-purple-100 text-purple-700">
        Relación Lanar/Vacuno: {relacion.toFixed(2)}
      </span>
    )
  })()}
</div>
            <p className="text-gray-600 text-sm">
              Gestión de potreros y lotes del campo
            </p>
          </div>

          {hayLotes && (
  <div className="flex flex-col gap-3 items-end">
    {/* PRIMERA FILA: Nuevo potrero + Importar CSV */}
    <div className="flex flex-wrap justify-center md:justify-end gap-3">
      <Link
        href="/dashboard/lotes/nuevo"
        className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-100 text-gray-800 shadow-sm transition text-sm"
      >
        <span className="text-lg">+</span> Nuevo potrero
      </Link>
      <BotonDescargarCarga />
    </div>

    {/* SEGUNDA FILA: Evolución Carga Animal + (Reporte Pastoreo si hay módulos en uso) */}
    <div className="flex flex-wrap justify-center md:justify-end gap-3">
      <Link
        href="/dashboard/ug-evolution"
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 shadow-sm transition text-sm font-medium"
      >
        <span className="text-lg">📊</span> Evolución de Carga Animal
      </Link>
      
      {/* 🔥 NUEVO: Mostrar SOLO si hay módulos CON potreros asignados */}
      {lotesAgrupados.modulos.some(m => m.lotes.length > 0) && (
        <Link
          href="/dashboard/reportes/pastoreo"
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-600 text-white hover:bg-purple-700 shadow-sm transition text-sm font-medium"
        >
          <span className="text-lg">📋</span> Reporte Pastoreo
        </Link>
      )}
    </div>
  </div>
)}
        </div>

        {/* CONTENIDO */}
        <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
          {!hayLotes ? (
  <div className="p-10 text-center">
    <h3 className="text-xl font-semibold text-gray-900 mb-2">
      {nombreCampo ? `Potreros en ${nombreCampo}` : 'Potreros'}
    </h3>
    <p className="text-gray-600 mb-8">
      Ingresá los potreros de tu campo para empezar a usar la app.
    </p>

    <div className="flex flex-col sm:flex-row justify-center gap-6 max-w-4xl mx-auto">
      <Link
        href="/dashboard/lotes/nuevo"
        className="flex flex-col items-center justify-center bg-white border-2 border-gray-200 rounded-xl p-10 hover:border-gray-300 hover:shadow-md transition flex-1"
      >
        <img
          src="https://cdn-icons-png.flaticon.com/512/3075/3075908.png"
          alt="Formulario"
          className="w-16 h-16 mb-4"
        />
        <p className="font-semibold text-gray-900 text-lg mb-2">
          Ingresar Manualmente
        </p>
        <p className="text-sm text-gray-500 text-center">
          Ideal si son pocos potreros
        </p>
      </Link>

      <button
        onClick={() => setShowModalKMZ(true)}
        className="flex flex-col items-center justify-center bg-white border-2 border-gray-200 rounded-xl p-10 hover:border-gray-300 hover:shadow-md transition flex-1"
      >
        <img
          src="https://cdn-icons-png.flaticon.com/512/2875/2875421.png"
          alt="Google Earth"
          className="w-16 h-16 mb-4"
        />
        <p className="font-semibold text-gray-900 text-lg mb-2">
          KMZ de Google Earth
        </p>
        <p className="text-sm text-gray-500 text-center">
          Subí tus potreros y tu mapa
        </p>
      </button>
    </div>
  </div>
) : (
            <div className="space-y-4 p-6">
              
              {/* 📦 MÓDULOS DE PASTOREO */}
              {lotesAgrupados.modulos.map((modulo) => {
                const estaAbierto = acordeonesAbiertos[modulo.id] ?? false
                const { totalHectareas, totalAnimales, ugPorHa } = calcularTotalesModulo(modulo.lotes)
                
                return (
                  <div key={modulo.id} className="border border-gray-200 rounded-lg overflow-hidden">
                    {/* HEADER DEL MÓDULO */}
                    <button
  onClick={() => toggleAcordeon(modulo.id)}
  className="w-full px-6 py-4 bg-purple-50 hover:bg-purple-100 transition flex items-center justify-between group"
>
  <div className="flex items-center gap-3">
    {/* Icono con animación */}
    <span className="text-2xl transition-transform duration-200" style={{ transform: estaAbierto ? 'rotate(90deg)' : 'rotate(0deg)' }}>
      ▶
    </span>
    <div className="text-left">
      <h3 className="font-semibold text-gray-900 flex items-center gap-2">
        {modulo.nombre}
        <span className="text-xs text-gray-500 font-normal group-hover:text-gray-700">
          (click para {estaAbierto ? 'contraer' : 'expandir'})
        </span>
      </h3>
      {modulo.descripcion && (
        <p className="text-sm text-gray-600">{modulo.descripcion}</p>
      )}
    </div>
  </div>
  
  <div className="flex items-center gap-3 flex-wrap justify-end">
    <span className="text-sm text-gray-600 bg-white px-3 py-1 rounded-full">
  {modulo.lotes.length} potrero{modulo.lotes.length !== 1 ? 's' : ''}
</span>

{/* 🔥 NUEVO: UG/ha del módulo con tooltip */}
{totalAnimales > 0 && (() => {
  const color = 
    ugPorHa < 0.7 ? 'bg-blue-100 text-blue-700' :
    ugPorHa <= 1.5 ? 'bg-green-100 text-green-700' :
    ugPorHa <= 2.0 ? 'bg-orange-100 text-orange-700' :
    'bg-red-100 text-red-700'
  
  return (
    <Tooltip content={<TooltipCargaGlobal />}>
      <span className={`px-3 py-1 rounded-full text-sm font-medium ${color}`}>
        {ugPorHa.toFixed(2)} UG/ha
      </span>
    </Tooltip>
  )
})()}

<span className="text-sm text-gray-600 bg-white px-3 py-1 rounded-full">
  {totalHectareas.toFixed(1)} ha
</span>
    
    
    {/* 🐄 CATEGORÍAS PRESENTES */}
    {(() => {
      const categoriasPorTipo = modulo.lotes
        .flatMap(l => l.animalesLote || [])
        .reduce((acc, animal) => {
          if (!acc[animal.categoria]) {
            acc[animal.categoria] = 0
          }
          acc[animal.categoria] += animal.cantidad
          return acc
        }, {} as Record<string, number>)
      
      const categoriasArray = Object.entries(categoriasPorTipo)
      
      if (categoriasArray.length === 0) return null
      
      return categoriasArray.map(([categoria, cantidad]) => (
        <span key={categoria} className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-medium">
          {cantidad} {categoria}
        </span>
      ))
    })()}
  </div>
</button>
                    
                    {/* CONTENIDO DEL MÓDULO */}
                    {estaAbierto && modulo.lotes.length > 0 && (
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                                Potrero
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                                Cultivos
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                                Animales
                              </th>
                              <th className="px-6 py-3 text-right text-xs font-medium text-gray-600 uppercase tracking-wider">
                                Acciones
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-100">
                            {modulo.lotes.map((lote) => (
                              <PotreroCard key={lote.id} lote={lote} />
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    
                    {estaAbierto && modulo.lotes.length === 0 && (
                      <div className="px-6 py-8 text-center text-gray-500 italic">
                        No hay potreros en este módulo
                      </div>
                    )}
                  </div>
                )
              })}
              
              {/* 📦 POTREROS SIN MÓDULO (RESTO DEL CAMPO) */}
{lotesAgrupados.sinModulo.length > 0 && (
  // 🔥 SI HAY MÓDULOS CREADOS -> mostrar acordeón "Resto del campo"
  // 🔥 SI NO HAY MÓDULOS -> mostrar tabla directa sin acordeón
  modulos.length > 0 ? (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={() => toggleAcordeon('sin-modulo')}
        className="w-full px-6 py-4 bg-gray-50 hover:bg-gray-100 transition flex items-center justify-between group"
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl transition-transform duration-200" style={{ transform: (acordeonesAbiertos['sin-modulo'] ?? false) ? 'rotate(90deg)' : 'rotate(0deg)' }}>
            ▶
          </span>
          <div className="text-left">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              Resto del campo
              <span className="text-xs text-gray-500 font-normal group-hover:text-gray-700">
                (click para {(acordeonesAbiertos['sin-modulo'] ?? false) ? 'contraer' : 'expandir'})
              </span>
            </h3>
            <p className="text-sm text-gray-600">Potreros sin módulo de pastoreo asignado</p>
          </div>
        </div>
        
        <span className="text-sm text-gray-600 bg-white px-3 py-1 rounded-full">
          {lotesAgrupados.sinModulo.length} potrero{lotesAgrupados.sinModulo.length !== 1 ? 's' : ''}
        </span>
      </button>
      
      {(acordeonesAbiertos['sin-modulo'] ?? false) && (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                  Potrero
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                  Cultivos
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                  Animales
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-600 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {lotesAgrupados.sinModulo.map((lote) => (
                <PotreroCard key={lote.id} lote={lote} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  ) : (
    // 🔥 NO HAY MÓDULOS -> Mostrar tabla directa
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
              Potrero
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
              Cultivos
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
              Animales
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-600 uppercase tracking-wider">
              Acciones
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-100">
          {lotesAgrupados.sinModulo.map((lote) => (
            <PotreroCard key={lote.id} lote={lote} />
              ))}
            </tbody>
          </table>
        </div>
      )
    )}
              
            </div>
          )}
        </div>
      </div>

      {/* MODAL DE CONFIRMACIÓN */}
      <ModalConfirmarBorrado
        isOpen={modalBorrado.isOpen}
        nombrePotrero={modalBorrado.nombre}
        animales={modalBorrado.animales}
        cultivos={modalBorrado.cultivos}
        onConfirmar={eliminarLote}
        onCancelar={() => setModalBorrado({
          isOpen: false,
          loteId: '',
          nombre: '',
          animales: [],
          cultivos: []
        })}
        loading={loadingBorrado}
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
                  refreshLotes()
                }} 
              />
            </div>
          </div>
        </div>
      )}
    </>
  )
}