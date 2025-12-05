'use client'

import { memo } from 'react'
import { useOnboardingProgress } from '@/hooks/useOnboardingProgress'
import Link from 'next/link'
import { Rocket } from 'lucide-react'

interface OnboardingIndicatorProps {
  variant?: 'default' | 'compact'
}

function OnboardingIndicator({ variant = 'default' }: OnboardingIndicatorProps) {
  const { totalCompletados, porcentaje, isLoading } = useOnboardingProgress()

  // No mostrar nada mientras carga o si ya completó los 3 pasos
  if (isLoading || totalCompletados === 3) {
    return null
  }

  // Versión compacta para el sidebar
  if (variant === 'compact') {
  return (
    <Link
      href="/dashboard/como-empezar"
      className="flex items-center gap-3 px-3 sm:px-4 py-2.5 rounded-xl text-sm bg-gradient-to-r from-amber-50 to-orange-50 hover:from-amber-100 hover:to-orange-100 border border-amber-200/60 shadow-sm hover:shadow transition-all duration-200 group relative overflow-hidden"
    >
      {/* Efecto de brillo sutil */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
      
      {/* Dot animado */}
      <span className="relative flex h-2 w-2 shrink-0">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
      </span>

      {/* Ícono con fondo */}
      <div className="p-1.5 bg-amber-100 rounded-lg group-hover:bg-amber-200 transition-colors shrink-0">
        <Rocket className="w-3.5 h-3.5 text-amber-600" />
      </div>

      <span className="flex-1 font-medium text-amber-900">Cómo Empezar</span>
      
      {/* Badge con progreso visual */}
      <div className="flex items-center gap-1.5 bg-white/80 backdrop-blur-sm pl-2 pr-2.5 py-1 rounded-full border border-amber-200/80">
        <div className="flex gap-0.5">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={`w-1.5 h-1.5 rounded-full transition-colors ${
                i < totalCompletados ? 'bg-amber-500' : 'bg-amber-200'
              }`}
            />
          ))}
        </div>
        <span className="text-xs font-semibold text-amber-700">
          {totalCompletados}/3
        </span>
      </div>
    </Link>
  )
}

  // Versión por defecto
  return (
    <Link
      href="/dashboard/como-empezar"
      className="block w-full p-4 bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl hover:border-blue-300 hover:shadow-md transition-all group"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-blue-500 rounded-lg group-hover:scale-110 transition-transform">
            <Rocket className="w-5 h-5 text-white" />
          </div>
          <span className="font-semibold text-gray-900">Cómo Empezar</span>
        </div>
        <span className="text-2xl font-bold text-gray-400">
          {totalCompletados}/3
        </span>
      </div>

      {/* Barra de progreso */}
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-300"
          style={{ width: `${porcentaje}%` }}
        />
      </div>

      <p className="text-xs text-gray-600 mt-2">
        Completa los pasos para comenzar
      </p>
    </Link>
  )
}

// 👇 Memoizar el componente para evitar re-renders innecesarios
export default memo(OnboardingIndicator)