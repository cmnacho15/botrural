import { prisma } from '@/lib/prisma'
import { calcularUGTotales } from '@/lib/ugCalculator'

/**
 * Calcula la UG total de un potrero basándose en sus animales actuales
 * Usa las equivalencias ya definidas en ugCalculator.ts
 */
export async function calcularUGPotrero(loteId: string): Promise<number> {
  try {
    const animales = await prisma.animalLote.findMany({
      where: { loteId },
      select: {
        categoria: true,
        cantidad: true,
      },
    })

    if (animales.length === 0) {
      return 0
    }

    // Reutilizar tu función existente
    const ugTotal = calcularUGTotales(animales)

    return Math.round(ugTotal * 100) / 100 // Redondear a 2 decimales
  } catch (error) {
    console.error(`Error calculando UG del lote ${loteId}:`, error)
    throw error
  }
}

/**
 * Calcula la UG total de todos los potreros de un campo
 */
export async function calcularUGCampo(campoId: string): Promise<number> {
  try {
    const lotes = await prisma.lote.findMany({
      where: { campoId },
      select: { id: true },
    })

    let ugTotal = 0

    for (const lote of lotes) {
      const ugLote = await calcularUGPotrero(lote.id)
      ugTotal += ugLote
    }

    return Math.round(ugTotal * 100) / 100
  } catch (error) {
    console.error(`Error calculando UG del campo ${campoId}:`, error)
    throw error
  }
}