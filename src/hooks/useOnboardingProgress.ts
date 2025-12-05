import { useState, useEffect } from 'react'

interface OnboardingProgress {
  paso1Completado: boolean  // Tiene potreros
  paso2Completado: boolean  // Tiene datos/eventos
  paso3Completado: boolean  // Tiene equipo (más de 1 usuario)
  totalCompletados: number
  porcentaje: number
}

export function useOnboardingProgress(): OnboardingProgress {
  const [progress, setProgress] = useState<OnboardingProgress>({
    paso1Completado: false,
    paso2Completado: false,
    paso3Completado: false,
    totalCompletados: 0,
    porcentaje: 0
  })

  useEffect(() => {
    async function checkProgress() {
      try {
        // Verificar si tiene potreros (Paso 1)
        const lotesRes = await fetch('/api/lotes')
        const lotes = await lotesRes.json()
        const paso1 = Array.isArray(lotes) && lotes.length > 0

        // Verificar si tiene eventos/datos (Paso 2)
        const eventosRes = await fetch('/api/eventos')
        const eventos = await eventosRes.json()
        const paso2 = Array.isArray(eventos) && eventos.length > 0

        // Verificar si tiene equipo (Paso 3) - más de 1 usuario
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
          porcentaje
        })
      } catch (error) {
        console.error('Error checking onboarding progress:', error)
      }
    }

    checkProgress()
  }, [])

  return progress
}