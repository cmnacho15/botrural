// src/lib/getEquivalenciasUG.ts
// Helper para obtener equivalencias UG personalizadas de un campo
import { prisma } from "@/lib/prisma"
import { PESOS_DEFAULT } from "@/lib/ugCalculator"

export type EquivalenciasPersonalizadas = Record<string, number>

/**
 * Obtiene los pesos personalizados de un campo (para usar en cálculos de UG)
 * @param campoId - ID del campo
 * @returns Mapa de categoria -> pesoKg (incluye defaults para categorías sin personalizar)
 */
export async function getEquivalenciasUG(campoId: string): Promise<EquivalenciasPersonalizadas> {
  // Obtener personalizaciones del campo
  const personalizadas = await prisma.equivalenciaUG.findMany({
    where: { campoId }
  })

  // Empezar con defaults
  const pesos: EquivalenciasPersonalizadas = { ...PESOS_DEFAULT }

  // Sobrescribir con personalizadas
  for (const eq of personalizadas) {
    pesos[eq.categoria] = eq.pesoKg
  }

  return pesos
}

/**
 * Verifica si un campo tiene equivalencias personalizadas
 * @param campoId - ID del campo
 * @returns true si tiene al menos una personalización
 */
export async function tieneEquivalenciasPersonalizadas(campoId: string): Promise<boolean> {
  const count = await prisma.equivalenciaUG.count({
    where: { campoId }
  })
  return count > 0
}