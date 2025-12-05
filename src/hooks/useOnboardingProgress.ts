import { useState, useEffect, useCallback, useRef } from 'react'

interface OnboardingProgress {
  paso1Completado: boolean
  paso2Completado: boolean
  paso3Completado: boolean
  totalCompletados: number
  porcentaje: number
  isLoading: boolean
}

export function useOnboardingProgress(): OnboardingProgress {
  const [progress, setProgress] = useState<OnboardingProgress>({
    paso1Completado: false,
    paso2Completado: false,
    paso3Completado: false,
    totalCompletados: 0,
    porcentaje: 0,
    isLoading: true
  })

  // Ref para evitar múltiples llamadas simultáneas
  const isCheckingRef = useRef(false)

  const checkProgress = useCallback(async () => {
    // Evitar llamadas duplicadas
    if (isCheckingRef.current) {
      console.log('⏭️ Ya hay una verificación en curso, omitiendo...')
      return
    }

    isCheckingRef.current = true

    try {
      const [lotesRes, datosRes, usuariosRes] = await Promise.all([
        fetch('/api/lotes', { cache: 'no-store' }),
        fetch('/api/datos', { cache: 'no-store' }),
        fetch('/api/usuarios', { cache: 'no-store' })
      ])

      if (!lotesRes.ok || !datosRes.ok || !usuariosRes.ok) {
        console.warn('⚠️ Algunas APIs fallaron')
        setProgress(prev => ({ ...prev, isLoading: false }))
        return
      }

      const [lotes, datos, usuarios] = await Promise.all([
        lotesRes.json(),
        datosRes.json(),
        usuariosRes.json()
      ])

      const paso1 = Array.isArray(lotes) && lotes.length > 0
      const paso2 = Array.isArray(datos) && datos.length > 0
      const paso3 = Array.isArray(usuarios) && usuarios.length > 1

      const total = [paso1, paso2, paso3].filter(Boolean).length
      const porcentaje = Math.round((total / 3) * 100)

      setProgress(prev => {
        // Solo actualizar si realmente cambió algo
        if (
          prev.paso1Completado === paso1 &&
          prev.paso2Completado === paso2 &&
          prev.paso3Completado === paso3 &&
          prev.isLoading === false
        ) {
          console.log('✓ Sin cambios en el progreso')
          return prev
        }

        console.log('📊 Progreso Onboarding actualizado:', {
          paso1: paso1 ? '✅' : '❌',
          paso2: paso2 ? '✅' : '❌',
          paso3: paso3 ? '✅' : '❌',
          total: `${total}/3`
        })

        return {
          paso1Completado: paso1,
          paso2Completado: paso2,
          paso3Completado: paso3,
          totalCompletados: total,
          porcentaje,
          isLoading: false
        }
      })
    } catch (error) {
      console.error('❌ Error checking onboarding progress:', error)
      setProgress(prev => ({ ...prev, isLoading: false }))
    } finally {
      isCheckingRef.current = false
    }
  }, [])

  useEffect(() => {
    console.log('🎯 OnboardingProgress hook montado')
    
    // Primera verificación al montar
    checkProgress()

    // Escuchar evento de revalidación
    const handleRevalidate = () => {
      console.log('🔄 Evento de revalidación recibido')
      checkProgress()
    }

    window.addEventListener('onboarding-revalidate', handleRevalidate)

    return () => {
      console.log('🔚 OnboardingProgress hook desmontado')
      window.removeEventListener('onboarding-revalidate', handleRevalidate)
    }
  }, [checkProgress])

  return progress
}

// Función helper para disparar revalidación desde cualquier parte
export function revalidateOnboardingProgress() {
  console.log('🚀 Disparando evento de revalidación onboarding')
  window.dispatchEvent(new Event('onboarding-revalidate'))
}