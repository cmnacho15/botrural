'use client'

import { useOnboardingProgress } from '@/hooks/useOnboardingProgress'
import Link from 'next/link'
import { Rocket } from 'lucide-react'

interface OnboardingIndicatorProps {
  variant?: 'default' | 'compact'
}

export default function OnboardingIndicator({ variant = 'default' }: OnboardingIndicatorProps) {
  const { totalCompletados, porcentaje } = useOnboardingProgress()

  // Si ya completó los 3 pasos, no mostrar nada (sin animación, desaparece instantáneamente)
  if (totalCompletados === 3) {
    return null
  }

  // Versión compacta para el sidebar (más pequeña y profesional)
  if (variant === 'compact') {
    return (
      <Link
        href="/dashboard/como-empezar"
        className="flex items-center gap-2 px-3 sm:px-4 py-1.5 rounded-lg text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors group"
      >
        <Rocket className="w-4 h-4 text-blue-500 group-hover:text-blue-600" />
        <span className="flex-1">Cómo Empezar</span>
        <span className="bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded text-xs font-medium">
          {totalCompletados}/3
        </span>
      </Link>
    )
  }

  // Versión por defecto (más grande, para otras ubicaciones)
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