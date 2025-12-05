import { useState, useEffect } from 'react'

interface OnboardingProgress {
  paso1Completado: boolean  // Tiene potreros
  paso2Completado: boolean  // Tiene datos/eventos
  paso3Completado: boolean  // Tiene equipo (más de 1 usuario)
  totalCompletados: number
  porcentaje: number
  isLoading: boolean        // 👈 NUEVO
}

export function useOnboardingProgress(): OnboardingProgress {
  const [progress, setProgress] = useState<OnboardingProgress>({
    paso1Completado: false,
    paso2Completado: false,
    paso3Completado: false,
    totalCompletados: 0,
    porcentaje: 0,
    isLoading: true  // 👈 Empieza en true
  })

  useEffect(() => {
    async function checkProgress() {
      try {
        setProgress(prev => ({ ...prev, isLoading: true })) // 👈 Activar loading

        // ✅ Verificar si tiene potreros (Paso 1)
        const lotesRes = await fetch('/api/lotes')
        const lotes = await lotesRes.json()
        const paso1 = Array.isArray(lotes) && lotes.length > 0

        // ✅ Verificar si tiene eventos/datos (Paso 2)
        const datosRes = await fetch('/api/datos')
        const datos = await datosRes.json()
        const paso2 = Array.isArray(datos) && datos.length > 0

        // ✅ Verificar si tiene equipo (Paso 3) - más de 1 usuario
        const usuariosRes = await fetch('/api/usuarios')
        const usuarios = await usuariosRes.json()
        const paso3 = Array.isArray(usuarios) && usuarios.length > 1

        const total = [paso1, paso2, paso3].filter(Boolean).length
        const porcentaje = Math.round((total / 3) * 100)

        setProgress({
          paso1Completado: paso1,
          paso2Completado: paso2,
          paso3Completado: paso3,
          totalCompletados: total,
          porcentaje,
          isLoading: false  // 👈 Desactivar loading
        })

        console.log('📊 Progreso Onboarding:', {
          paso1: paso1 ? '✅' : '❌',
          paso2: paso2 ? '✅' : '❌', 
          paso3: paso3 ? '✅' : '❌',
          total: `${total}/3`
        })
      } catch (error) {
        console.error('❌ Error checking onboarding progress:', error)
        setProgress(prev => ({ ...prev, isLoading: false })) // 👈 Desactivar loading en error
      }
    }

    checkProgress()
    
    // ✅ Recargar cada vez que el usuario vuelva a la página
    const interval = setInterval(checkProgress, 5000) // Cada 5 segundos
    
    return () => clearInterval(interval)
  }, [])

  return progress
}