'use client'

import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function BannerRecategorizacion() {
  const router = useRouter()
  const [mostrar, setMostrar] = useState(false)
  const [cerrado, setCerrado] = useState(false)

  useEffect(() => {
    // Verificar si estamos dentro de los 15 días antes del 1ro de enero
    const hoy = new Date()
    const anioActual = hoy.getFullYear()
    const proximoEnero = new Date(anioActual + 1, 0, 1) // 1 de enero del próximo año
    
    // Si ya pasó el 1 de enero de este año, usar el del próximo
    const fechaObjetivo = hoy > new Date(anioActual, 0, 1) 
      ? proximoEnero 
      : new Date(anioActual, 0, 1)
    
    const diasFaltantes = Math.ceil((fechaObjetivo.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24))
    
    // Mostrar si faltan 15 días o menos
    if (diasFaltantes > 0 && diasFaltantes <= 15) {
      // Verificar si el usuario cerró el banner hoy
      const cerradoHoy = localStorage.getItem('banner-recategorizacion-cerrado')
      const fechaCerrado = cerradoHoy ? new Date(cerradoHoy) : null
      
      if (!fechaCerrado || fechaCerrado.toDateString() !== hoy.toDateString()) {
        setMostrar(true)
      }
    }
  }, [])

  const handleCerrar = () => {
    // Guardar que se cerró hoy
    localStorage.setItem('banner-recategorizacion-cerrado', new Date().toISOString())
    setCerrado(true)
  }

  const handleVerDetalles = () => {
    router.push('/dashboard/preferencias?tab=recategorizacion')
  }

  if (!mostrar || cerrado) return null

  return (
    <div className="bg-amber-50 border-b border-amber-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1">
            <div className="text-2xl">⚠️</div>
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-900">
                Recategorización automática el 1ro de enero
              </p>
              <p className="text-xs text-amber-700 mt-0.5">
                Bovinos: Terneros → Novillos 1-2, Vaquillonas +2 → Vacas, etc. | 
                Ovinos: Corderas DL → Borregas, Borregas → Ovejas
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={handleVerDetalles}
              className="px-3 py-1.5 text-xs bg-amber-600 text-white rounded-lg hover:bg-amber-700 font-medium transition"
            >
              Ver detalles
            </button>
            <button
              onClick={handleCerrar}
              className="p-1 text-amber-600 hover:text-amber-800 transition"
              title="Cerrar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}