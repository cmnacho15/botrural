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
      className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-sm bg-amber-50 hover:bg-amber-100 border border-amber-200 transition-colors group relative"
    >
      {/* Dot animado */}
      <span className="absolute left-1.5 top-1/2 -translate-y-1/2 flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
      </span>

      <Rocket className="w-4 h-4 text-amber-600 group-hover:text-amber-700 ml-2" />
      <span className="flex-1 text-amber-900">Cómo Empezar</span>
      <span className="bg-amber-200 text-amber-700 px-1.5 py-0.5 rounded text-xs font-semibold">
        {totalCompletados}/3
      </span>
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