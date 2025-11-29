// ============================================
// 📊 TABLA DE EQUIVALENCIAS UG (Uruguay)
// ============================================

export const EQUIVALENCIAS_UG: Record<string, number> = {
  // 🐄 VACUNOS
  'Toros': 1.20,
  'Vacas': 1.00,
  'Novillos +3 años': 1.00,
  'Novillos 2–3 años': 1.00,
  'Novillos 1–2 años': 0.7,
  'Vaquillonas +2 años': 1.00,
  'Vaquillonas 1–2 años': 0.7,
  'Terneros/as': 0.40,

  // 🐑 OVINOS
  'Carneros': 0.17,
  'Ovejas': 0.16,
  'Capones': 0.14,
  'Borregas 2–4 dientes': 0.16,
  'Corderas DL': 0.10,
  'Corderos DL': 0.10,
  'Corderos/as Mamones': 0.10,

  // 🐴 YEGUARIZOS (ahora SÍ se cuentan en UG)
  'Padrillos': 1.2,
  'Yeguas': 1.2,
  'Caballos': 1.2,
  'Potrillos': 1.2,
}

// ============================================
// 🧮 FUNCIONES DE CÁLCULO
// ============================================

interface Animal {
  categoria: string
  cantidad: number
}

interface Lote {
  id: string
  nombre: string
  hectareas: number
  animalesLote?: Animal[]
}

/**
 * Calcula las UG totales de una lista de animales
 */
export function calcularUGTotales(animales: Animal[]): number {
  if (!animales || animales.length === 0) return 0

  return animales.reduce((total, animal) => {
    const equivalencia = EQUIVALENCIAS_UG[animal.categoria] || 0
    return total + (animal.cantidad * equivalencia)
  }, 0)
}

/**
 * Calcula la CARGA GLOBAL (UG/ha) de un lote
 * Carga Global = Total UG ÷ Hectáreas totales
 */
export function calcularCargaGlobal(
  animales: Animal[],
  hectareas: number
): number {
  if (hectareas <= 0) return 0
  
  const ugTotales = calcularUGTotales(animales)
  return ugTotales / hectareas
}

/**
 * Calcula la CARGA INSTANTÁNEA (UG/ha) de un potrero
 * En este caso es igual a la carga global porque los animales están
 * en ese potrero específico en ese momento
 */
export function calcularCargaInstantanea(
  animales: Animal[],
  hectareas: number
): number {
  return calcularCargaGlobal(animales, hectareas)
}

/**
 * Calcula estadísticas completas de un lote
 */
export function calcularEstadisticasLote(lote: Lote) {
  // ✅ AHORA SE INCLUYEN TODOS LOS ANIMALES (incluyendo yeguarizos)
  const animales = lote.animalesLote || []
  const ugTotales = calcularUGTotales(animales)
  const cargaGlobal = calcularCargaGlobal(animales, lote.hectareas)
  const cargaInstantanea = calcularCargaInstantanea(animales, lote.hectareas)

  // Desglose por tipo de animal
  const desglosePorTipo = {
    vacunos: 0,
    ovinos: 0,
    yeguarizos: 0
  }

  animales.forEach(animal => {
    const equivalencia = EQUIVALENCIAS_UG[animal.categoria] || 0
    const ugAnimal = animal.cantidad * equivalencia

    if (['Toros', 'Vacas', 'Novillos +3 años', 'Novillos 2–3 años', 
         'Novillos 1–2 años', 'Vaquillonas +2 años', 'Vaquillonas 1–2 años', 
         'Terneros/as'].includes(animal.categoria)) {
      desglosePorTipo.vacunos += ugAnimal
    } else if (['Carneros', 'Ovejas', 'Capones', 'Borregas 2–4 dientes', 
                'Corderas DL', 'Corderos DL', 'Corderos/as Mamones'].includes(animal.categoria)) {
      desglosePorTipo.ovinos += ugAnimal
    } else if (['Padrillos', 'Yeguas', 'Caballos', 'Potrillos'].includes(animal.categoria)) {
      desglosePorTipo.yeguarizos += ugAnimal
    }
  })

  // Total de animales por categoría
  const totalAnimalesPorCategoria = animales.reduce((acc, animal) => {
    acc[animal.categoria] = (acc[animal.categoria] || 0) + animal.cantidad
    return acc
  }, {} as Record<string, number>)

  return {
    ugTotales,
    cargaGlobal,
    cargaInstantanea,
    desglosePorTipo,
    totalAnimalesPorCategoria,
    totalAnimales: animales.reduce((sum, a) => sum + a.cantidad, 0),
    hectareas: lote.hectareas
  }
}

/**
 * Calcula estadísticas de TODOS los lotes (carga global del campo completo)
 */
export function calcularEstadisticasCampo(lotes: Lote[]) {
  const totalHectareas = lotes.reduce((sum, l) => sum + l.hectareas, 0)
  // ✅ AHORA SE INCLUYEN TODOS LOS ANIMALES (incluyendo yeguarizos)
  const todosLosAnimales = lotes.flatMap(l => l.animalesLote || [])
  
  const ugTotalesCampo = calcularUGTotales(todosLosAnimales)
  const cargaGlobalCampo = totalHectareas > 0 
    ? ugTotalesCampo / totalHectareas 
    : 0

  // Desglose por tipo
  const desglosePorTipo = {
    vacunos: 0,
    ovinos: 0,
    yeguarizos: 0
  }

  todosLosAnimales.forEach(animal => {
    const equivalencia = EQUIVALENCIAS_UG[animal.categoria] || 0
    const ugAnimal = animal.cantidad * equivalencia

    if (['Toros', 'Vacas', 'Novillos +3 años', 'Novillos 2–3 años', 
         'Novillos 1–2 años', 'Vaquillonas +2 años', 'Vaquillonas 1–2 años', 
         'Terneros/as'].includes(animal.categoria)) {
      desglosePorTipo.vacunos += ugAnimal
    } else if (['Carneros', 'Ovejas', 'Capones', 'Borregas 2–4 dientes', 
                'Corderas DL', 'Corderos DL', 'Corderos/as Mamones'].includes(animal.categoria)) {
      desglosePorTipo.ovinos += ugAnimal
    } else if (['Padrillos', 'Yeguas', 'Caballos', 'Potrillos'].includes(animal.categoria)) {
      desglosePorTipo.yeguarizos += ugAnimal
    }
  })

  return {
    totalHectareas,
    ugTotalesCampo,
    cargaGlobalCampo,
    desglosePorTipo,
    totalAnimales: todosLosAnimales.reduce((sum, a) => sum + a.cantidad, 0),
    cantidadLotes: lotes.length
  }
}

/**
 * Evalúa si la carga es adecuada para campo natural en Uruguay
 * Referencia: 0.7 - 1.5 UG/ha en campo natural
 */
export function evaluarCarga(cargaUGHa: number): {
  nivel: 'baja' | 'optima' | 'alta' | 'muy-alta'
  mensaje: string
  color: string
} {
  if (cargaUGHa < 0.7) {
    return {
      nivel: 'baja',
      mensaje: 'Carga baja - Potencial de aumentar dotación',
      color: 'text-blue-600'
    }
  } else if (cargaUGHa >= 0.7 && cargaUGHa <= 1.5) {
    return {
      nivel: 'optima',
      mensaje: 'Carga óptima para campo natural',
      color: 'text-green-600'
    }
  } else if (cargaUGHa > 1.5 && cargaUGHa <= 2.0) {
    return {
      nivel: 'alta',
      mensaje: 'Carga alta - Verificar estado de pasturas',
      color: 'text-orange-600'
    }
  } else {
    return {
      nivel: 'muy-alta',
      mensaje: 'Carga muy alta - Riesgo de sobrepastoreo',
      color: 'text-red-600'
    }
  }
}