import { useState, useEffect, useCallback, useRef } from 'react'
interface OnboardingProgress {
  paso1Completado: boolean
  paso2Completado: boolean
  paso3Completado: boolean
  totalCompletados: number
  porcentaje: number
  isLoading: boolean
}
// Nombre del evento personalizado
const ONBOARDING_REVALIDATE_EVENT = 'onboarding-revalidate'
export function useOnboardingProgress(): OnboardingProgress {
  const [progress, setProgress] = useState<OnboardingProgress>({
    paso1Completado: false,
    paso2Completado: false,
    paso3Completado: false,
    totalCompletados: 0,
    porcentaje: 0,
    isLoading: true
  })
  const isCheckingRef = useRef(false)
  const checkProgress = useCallback(async () => {
    if (isCheckingRef.current) return
    isCheckingRef.current = true
    try {
      const [lotesRes, datosRes, usuariosRes] = await Promise.all([
        fetch('/api/lotes', { cache: 'no-store' }),
        fetch('/api/datos', { cache: 'no-store' }),
        fetch('/api/usuarios', { cache: 'no-store' })
      ])
      if (!lotesRes.ok || !datosRes.ok || !usuariosRes.ok) {
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
        // Solo actualizar si algo cambió
        if (
          prev.paso1Completado === paso1 &&
          prev.paso2Completado === paso2 &&
          prev.paso3Completado === paso3 &&
          !prev.isLoading
        ) {
          return prev
        }
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
      console.error('Error checking onboarding progress:', error)
      setProgress(prev => ({ ...prev, isLoading: false }))
    } finally {
      isCheckingRef.current = false
    }
  }, [])
  useEffect(() => {
    // Check inicial
    checkProgress()
    // Listener para evento de revalidación (desde cualquier componente)
    const handleRevalidate = () => checkProgress()

    // Listener para cuando el usuario vuelve a la pestaña
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkProgress()
      }
    }
    window.addEventListener(ONBOARDING_REVALIDATE_EVENT, handleRevalidate)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      window.removeEventListener(ONBOARDING_REVALIDATE_EVENT, handleRevalidate)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [checkProgress])
  return progress
}
/**
 * Llamar esta función después de:
 * - Crear un potrero (paso 1)
 * - Ingresar un dato (paso 2)  
 * - Invitar un usuario (paso 3)
 */
export function revalidateOnboarding() {
  window.dispatchEvent(new Event(ONBOARDING_REVALIDATE_EVENT))
}