// src/lib/ugCalculator.ts
// ============================================
// 📊 CALCULADORA DE UNIDADES GANADERAS (UG)
// ============================================
// Soporta equivalencias personalizadas por campo

// ============================================
// 📊 PESOS DEFAULT (en kg)
// ============================================
// 1 UG = 380 kg (vaca de referencia)
// Equivalencia = pesoKg / 380

export const PESOS_DEFAULT: Record<string, number> = {
  // 🐄 VACUNOS
  'Toros': 456,           // 1.20 UG
  'Vacas': 380,           // 1.00 UG
  'Vacas Gordas': 456,    // 1.20 UG
  'Novillos +3 años': 456, // 1.20 UG
  'Novillos 2–3 años': 380, // 1.00 UG
  'Novillos 1–2 años': 266, // 0.70 UG
  'Vaquillonas +2 años': 380, // 1.00 UG
  'Vaquillonas 1–2 años': 266, // 0.70 UG
  'Terneros': 152,        // 0.40 UG
  'Terneras': 152,        // 0.40 UG
  'Terneros nacidos': 0,  // 0 UG
  
  // 🐑 OVINOS
  'Carneros': 65,         // 0.17 UG
  'Ovejas': 61,           // 0.16 UG
  'Capones': 53,          // 0.14 UG
  'Borregas 2–4 dientes': 61, // 0.16 UG
  'Corderas DL': 38,      // 0.10 UG
  'Corderos DL': 38,      // 0.10 UG
  'Corderos/as Mamones': 38, // 0.10 UG

  // 🐴 YEGUARIZOS
  'Padrillos': 456,       // 1.20 UG
  'Yeguas': 456,          // 1.20 UG
  'Caballos': 456,        // 1.20 UG
  'Potrillos': 456,       // 1.20 UG
}

// ============================================
// 📊 EQUIVALENCIAS UG DEFAULT (para compatibilidad)
// ============================================
// Estas se calculan de PESOS_DEFAULT / 380
export const EQUIVALENCIAS_UG: Record<string, number> = Object.fromEntries(
  Object.entries(PESOS_DEFAULT).map(([cat, peso]) => [cat, peso / 380])
)

// Peso de referencia (1 UG)
export const PESO_REFERENCIA_UG = 380

// ============================================
// 🧮 INTERFACES
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

// Tipo para equivalencias personalizadas (pesoKg por categoría)
export type EquivalenciasPersonalizadas = Record<string, number>

// ============================================
// 🔄 FUNCIÓN PARA OBTENER EQUIVALENCIAS
// ============================================

/**
 * Convierte pesos a equivalencias UG
 * @param pesos - Mapa de categoria -> pesoKg
 * @returns Mapa de categoria -> equivalenciaUG
 */
export function pesosToEquivalencias(pesos: Record<string, number>): Record<string, number> {
  return Object.fromEntries(
    Object.entries(pesos).map(([cat, peso]) => [cat, peso / PESO_REFERENCIA_UG])
  )
}

/**
 * Obtiene la equivalencia UG para una categoría
 * Usa personalizadas si existen, sino usa default
 */
function getEquivalencia(
  categoria: string, 
  personalizadas?: EquivalenciasPersonalizadas
): number {
  if (personalizadas && personalizadas[categoria] !== undefined) {
    // Convertir peso personalizado a UG
    return personalizadas[categoria] / PESO_REFERENCIA_UG
  }
  // Usar equivalencia default
  return EQUIVALENCIAS_UG[categoria] || 0
}

// ============================================
// 🧮 FUNCIONES DE CÁLCULO
// ============================================

/**
 * Calcula las UG de las vacas considerando terneros nacidos
 * 🆕 LÓGICA ESPECIAL: Vacas con ternero nacido = 1.2 UG
 */
function calcularUGVacas(
  animales: Animal[], 
  personalizadas?: EquivalenciasPersonalizadas
): number {
  const ternerosNacidos = animales.find(a => a.categoria === 'Terneros nacidos')?.cantidad || 0
  const vacasTotal = animales.find(a => a.categoria === 'Vacas')?.cantidad || 0
  const vacasConCria = Math.min(ternerosNacidos, vacasTotal)
  const vacasSinCria = Math.max(0, vacasTotal - ternerosNacidos)
  
  // Vacas con cría = 1.2 UG (o personalizado + 20%)
  const ugVacaSinCria = getEquivalencia('Vacas', personalizadas)
  const ugVacaConCria = ugVacaSinCria * 1.2
  
  return (vacasConCria * ugVacaConCria) + (vacasSinCria * ugVacaSinCria)
}

/**
 * Calcula las UG totales de una lista de animales
 * @param animales - Lista de animales con categoría y cantidad
 * @param personalizadas - Pesos personalizados (opcional, en kg)
 */
export function calcularUGTotales(
  animales: Animal[], 
  personalizadas?: EquivalenciasPersonalizadas
): number {
  if (!animales || animales.length === 0) return 0

  let ugTotales = 0
  
  // 1️⃣ Calcular UG de vacas con lógica especial
  const ugVacas = calcularUGVacas(animales, personalizadas)
  ugTotales += ugVacas

  // 2️⃣ Calcular UG del resto de animales (excepto vacas)
  for (const animal of animales) {
    // Saltar vacas - ya las contamos arriba
    if (animal.categoria === 'Vacas') {
      continue
    }
    
    const equivalencia = getEquivalencia(animal.categoria, personalizadas)
    ugTotales += animal.cantidad * equivalencia
  }

  return ugTotales
}

/**
 * Calcula la CARGA GLOBAL (UG/ha) de un lote
 */
export function calcularCargaGlobal(
  animales: Animal[],
  hectareas: number,
  personalizadas?: EquivalenciasPersonalizadas
): number {
  if (hectareas <= 0) return 0
  
  const ugTotales = calcularUGTotales(animales, personalizadas)
  return ugTotales / hectareas
}

/**
 * Calcula la CARGA INSTANTÁNEA (UG/ha) de un potrero
 */
export function calcularCargaInstantanea(
  animales: Animal[],
  hectareas: number,
  personalizadas?: EquivalenciasPersonalizadas
): number {
  return calcularCargaGlobal(animales, hectareas, personalizadas)
}

/**
 * Calcula estadísticas completas de un lote
 */
export function calcularEstadisticasLote(
  lote: Lote, 
  personalizadas?: EquivalenciasPersonalizadas
) {
  const animales = lote.animalesLote || []
  const ugTotales = calcularUGTotales(animales, personalizadas)
  const cargaGlobal = calcularCargaGlobal(animales, lote.hectareas, personalizadas)
  const cargaInstantanea = calcularCargaInstantanea(animales, lote.hectareas, personalizadas)

  // Desglose por tipo de animal
  const desglosePorTipo = {
    vacunos: 0,
    ovinos: 0,
    yeguarizos: 0
  }

  // Calcular UG de vacas con lógica especial
  const ugVacas = calcularUGVacas(animales, personalizadas)
  desglosePorTipo.vacunos += ugVacas

  const categoriasVacunas = ['Toros', 'Vacas Gordas', 'Novillos +3 años', 'Novillos 2–3 años', 
    'Novillos 1–2 años', 'Vaquillonas +2 años', 'Vaquillonas 1–2 años', 
    'Terneros', 'Terneras', 'Terneros nacidos']
  
  const categoriasOvinas = ['Carneros', 'Ovejas', 'Capones', 'Borregas 2–4 dientes', 
    'Corderas DL', 'Corderos DL', 'Corderos/as Mamones']
  
  const categoriasEquinas = ['Padrillos', 'Yeguas', 'Caballos', 'Potrillos']

  animales.forEach(animal => {
    if (animal.categoria === 'Vacas') return // Ya contadas

    const equivalencia = getEquivalencia(animal.categoria, personalizadas)
    const ugAnimal = animal.cantidad * equivalencia

    if (categoriasVacunas.includes(animal.categoria)) {
      desglosePorTipo.vacunos += ugAnimal
    } else if (categoriasOvinas.includes(animal.categoria)) {
      desglosePorTipo.ovinos += ugAnimal
    } else if (categoriasEquinas.includes(animal.categoria)) {
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
export function calcularEstadisticasCampo(
  lotes: Lote[], 
  personalizadas?: EquivalenciasPersonalizadas
) {
  const totalHectareas = lotes.reduce((sum, l) => sum + l.hectareas, 0)
  const todosLosAnimales = lotes.flatMap(l => l.animalesLote || [])
  
  const ugTotalesCampo = calcularUGTotales(todosLosAnimales, personalizadas)
  const cargaGlobalCampo = totalHectareas > 0 
    ? ugTotalesCampo / totalHectareas 
    : 0

  // Desglose por tipo
  const desglosePorTipo = {
    vacunos: 0,
    ovinos: 0,
    yeguarizos: 0
  }

  const ugVacas = calcularUGVacas(todosLosAnimales, personalizadas)
  desglosePorTipo.vacunos += ugVacas

  const categoriasVacunas = ['Toros', 'Vacas Gordas', 'Novillos +3 años', 'Novillos 2–3 años', 
    'Novillos 1–2 años', 'Vaquillonas +2 años', 'Vaquillonas 1–2 años', 
    'Terneros', 'Terneras', 'Terneros nacidos']
  
  const categoriasOvinas = ['Carneros', 'Ovejas', 'Capones', 'Borregas 2–4 dientes', 
    'Corderas DL', 'Corderos DL', 'Corderos/as Mamones']
  
  const categoriasEquinas = ['Padrillos', 'Yeguas', 'Caballos', 'Potrillos']

  todosLosAnimales.forEach(animal => {
    if (animal.categoria === 'Vacas') return

    const equivalencia = getEquivalencia(animal.categoria, personalizadas)
    const ugAnimal = animal.cantidad * equivalencia

    if (categoriasVacunas.includes(animal.categoria)) {
      desglosePorTipo.vacunos += ugAnimal
    } else if (categoriasOvinas.includes(animal.categoria)) {
      desglosePorTipo.ovinos += ugAnimal
    } else if (categoriasEquinas.includes(animal.categoria)) {
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

/**
 * Calcula la relación Lanar/Vacuno del campo
 */
export function calcularRelacionLanarVacuno(lotes: Lote[]): {
  totalOvinos: number
  totalVacunos: number
  relacion: number | null
} {
  const todosAnimales = lotes.flatMap(l => l.animalesLote || [])
  
  const categoriasOvinas = ['Carneros', 'Ovejas', 'Capones', 'Borregas 2–4 dientes', 
                            'Corderas DL', 'Corderos DL', 'Corderos/as Mamones']
  
  const categoriasVacunas = ['Toros', 'Vacas', 'Vacas Gordas', 'Novillos +3 años', 'Novillos 2–3 años', 
                           'Novillos 1–2 años', 'Vaquillonas +2 años', 'Vaquillonas 1–2 años', 
                           'Terneros', 'Terneras', 'Terneros nacidos']
  
  const totalOvinos = todosAnimales
    .filter(a => categoriasOvinas.includes(a.categoria))
    .reduce((sum, a) => sum + a.cantidad, 0)
  
  const totalVacunos = todosAnimales
    .filter(a => categoriasVacunas.includes(a.categoria))
    .reduce((sum, a) => sum + a.cantidad, 0)
  
  const relacion = totalVacunos > 0 ? totalOvinos / totalVacunos : null
  
  return {
    totalOvinos,
    totalVacunos,
    relacion
  }
}