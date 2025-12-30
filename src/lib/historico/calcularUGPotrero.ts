//src/lib/historico/caclularUGPotrero.ts
import { prisma } from '@/lib/prisma'
import { calcularUGTotales } from '@/lib/ugCalculator'
import { getEquivalenciasUG } from '@/lib/getEquivalenciasUG'

/**
 * Calcula la UG total de un potrero basándose en sus animales actuales
 * Usa las equivalencias ya definidas en ugCalculator.ts
 */
export async function calcularUGPotrero(loteId: string, campoId?: string): Promise<number> {
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

    // ✅ AGRUPAR animales por categoría antes de calcular UG
    const animalesAgrupados = animales.reduce((acc, animal) => {
      const existing = acc.find(a => a.categoria === animal.categoria)
      if (existing) {
        existing.cantidad += animal.cantidad
      } else {
        acc.push({ categoria: animal.categoria, cantidad: animal.cantidad })
      }
      return acc
    }, [] as Array<{ categoria: string; cantidad: number }>)

    // Obtener equivalencias personalizadas si tenemos campoId
    let pesos = undefined
    if (campoId) {
      pesos = await getEquivalenciasUG(campoId)
    }

    // Reutilizar tu función existente con pesos personalizados
    const ugTotal = calcularUGTotales(animalesAgrupados, pesos)

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