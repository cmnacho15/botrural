// src/hooks/useEquivalenciasUG.ts
'use client'

import useSWR from 'swr'
import { PESOS_DEFAULT } from '@/lib/ugCalculator'

const fetcher = (url: string) => fetch(url).then(res => res.json())

export type EquivalenciasPersonalizadas = Record<string, number>

interface EquivalenciasResponse {
  campoId: string
  equivalencias: Array<{
    categoria: string
    pesoKg: number
    pesoDefault: number
    equivalenciaUG: number
    esPersonalizada: boolean
    id: string | null
  }>
  pesoReferencia: number
}

/**
 * Hook para obtener las equivalencias UG personalizadas del campo actual
 * Retorna los pesos en kg por categoría (para pasar a calcularUGTotales)
 */
export function useEquivalenciasUG() {
  const { data, error, isLoading } = useSWR<EquivalenciasResponse>(
    '/api/equivalencias-ug',
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000, // Cache por 1 minuto
    }
  )

  // Convertir a mapa de pesos
  const pesos: EquivalenciasPersonalizadas = { ...PESOS_DEFAULT }
  
  if (data?.equivalencias) {
    for (const eq of data.equivalencias) {
      pesos[eq.categoria] = eq.pesoKg
    }
  }

  return {
    pesos,
    isLoading,
    error,
    hayPersonalizaciones: data?.equivalencias?.some(eq => eq.esPersonalizada) ?? false
  }
}