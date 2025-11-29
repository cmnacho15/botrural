// ============================================
// 📊 TABLA DE EQUIVALENCIAS UG (Uruguay)
// NORMALIZADA (acepta singular, plural, mayúsculas, acentos)
// ============================================

export const EQUIVALENCIAS_UG: Record<string, number> = {
  // VACUNOS
  'toros': 1.20,
  'toro': 1.20,
  'vacas': 1.00,
  'vaca': 1.00,
  'novillos +3 años': 1.00,
  'novillo +3 años': 1.00,
  'novillos 2–3 años': 1.00,
  'novillo 2–3 años': 1.00,
  'novillos 1–2 años': 0.7,
  'novillo 1–2 años': 0.7,
  'vaquillonas +2 años': 1.00,
  'vaquillona +2 años': 1.00,
  'vaquillonas 1–2 años': 0.7,
  'vaquillona 1–2 años': 0.7,
  'terneros/as': 0.40,
  'ternero/as': 0.40,
  'ternero': 0.40,
  'terneros': 0.40,

  // OVINOS
  'carneros': 0.17,
  'carnero': 0.17,
  'ovejas': 0.16,
  'oveja': 0.16,
  'capones': 0.14,
  'capon': 0.14,
  'capón': 0.14,
  'borregas 2–4 dientes': 0.16,
  'corderas dl': 0.10,
  'corderos dl': 0.10,
  'corderos/as mamones': 0.10,

  // EQUINOS – YA CUENTAN UG
  'caballos': 1.20,
  'caballo': 1.20,
  'yeguas': 1.20,
  'yegua': 1.20,
  'padrillos': 1.20,
  'padrillo': 1.20,
  'potrillos': 1.20,
  'potrillo': 1.20,
  'equinos': 1.20,
  'equino': 1.20,
}

// ============================================
// 🔧 Normalizador de categorías
// Muy importante para evitar UG=0
// ============================================

function normalizarCategoria(cat: string): string {
  return cat
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, ""); // quita acentos
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

export function calcularUGTotales(animales: Animal[]): number {
  if (!animales || animales.length === 0) return 0

  return animales.reduce((total, animal) => {
    const cat = normalizarCategoria(animal.categoria)
    const equivalencia = EQUIVALENCIAS_UG[cat] || 0
    return total + animal.cantidad * equivalencia
  }, 0)
}

export function calcularCargaGlobal(animales: Animal[], hectareas: number): number {
  if (hectareas <= 0) return 0
  return calcularUGTotales(animales) / hectareas
}

export function calcularCargaInstantanea(animales: Animal[], hectareas: number): number {
  return calcularCargaGlobal(animales, hectareas)
}

// ============================================
// 📌 Estadísticas POR LOTE
// ============================================

export function calcularEstadisticasLote(lote: Lote) {
  const animales = lote.animalesLote || []

  const ugTotales = calcularUGTotales(animales)
  const cargaGlobal = calcularCargaGlobal(animales, lote.hectareas)
  const cargaInstantanea = calcularCargaInstantanea(animales, lote.hectareas)

  const desglosePorTipo = {
    vacunos: 0,
    ovinos: 0,
    yeguarizos: 0
  }

  animales.forEach(animal => {
    const cat = normalizarCategoria(animal.categoria)
    const equivalencia = EQUIVALENCIAS_UG[cat] || 0
    const ugAnimal = animal.cantidad * equivalencia

    if ([
      'toros','toro','vacas','vaca','novillos +3 años','novillo +3 años',
      'novillos 2–3 años','novillo 2–3 años','novillos 1–2 años',
      'novillo 1–2 años','vaquillonas +2 años','vaquillona +2 años',
      'vaquillonas 1–2 años','vaquillona 1–2 años','terneros','ternero'
    ].includes(cat)) {
      desglosePorTipo.vacunos += ugAnimal

    } else if ([
      'carneros','carnero','ovejas','oveja','capones','capon','capón',
      'borregas 2–4 dientes','corderas dl','corderos dl','corderos/as mamones'
    ].includes(cat)) {
      desglosePorTipo.ovinos += ugAnimal

    } else {
      desglosePorTipo.yeguarizos += ugAnimal
    }
  })

  const totalAnimalesPorCategoria = animales.reduce((acc, animal) => {
    const cat = normalizarCategoria(animal.categoria)
    acc[cat] = (acc[cat] || 0) + animal.cantidad
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

// ============================================
// 📌 Estadísticas GLOBAL DEL CAMPO
// ============================================

export function calcularEstadisticasCampo(lotes: Lote[]) {
  const totalHectareas = lotes.reduce((sum, l) => sum + l.hectareas, 0)
  const todosLosAnimales = lotes.flatMap(l => l.animalesLote || [])

  const ugTotalesCampo = calcularUGTotales(todosLosAnimales)
  const cargaGlobalCampo = totalHectareas > 0 ? ugTotalesCampo / totalHectareas : 0

  const desglosePorTipo = { vacunos: 0, ovinos: 0, yeguarizos: 0 }

  todosLosAnimales.forEach(animal => {
    const cat = normalizarCategoria(animal.categoria)
    const equivalencia = EQUIVALENCIAS_UG[cat] || 0
    const ug = animal.cantidad * equivalencia

    if ([
      'toros','toro','vacas','vaca','novillos +3 años','novillo +3 años',
      'novillos 2–3 años','novillo 2–3 años','novillos 1–2 años','novillo 1–2 años',
      'vaquillonas +2 años','vaquillona +2 años','vaquillonas 1–2 años','vaquillona 1–2 años',
      'terneros','ternero'
    ].includes(cat)) {
      desglosePorTipo.vacunos += ug

    } else if ([
      'carneros','carnero','ovejas','oveja','capones','capon','capón',
      'borregas 2–4 dientes','corderas dl','corderos dl','corderos/as mamones'
    ].includes(cat)) {
      desglosePorTipo.ovinos += ug

    } else {
      desglosePorTipo.yeguarizos += ug
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

// ============================================
// 📌 Evaluación de carga
// ============================================

export function evaluarCarga(cargaUGHa: number) {
  if (cargaUGHa < 0.7) {
    return { nivel: 'baja', mensaje: 'Carga baja - Potencial de aumentar dotación', color: 'text-blue-600' }
  } else if (cargaUGHa <= 1.5) {
    return { nivel: 'optima', mensaje: 'Carga óptima para campo natural', color: 'text-green-600' }
  } else if (cargaUGHa <= 2.0) {
    return { nivel: 'alta', mensaje: 'Carga alta - Verificar estado de pasturas', color: 'text-orange-600' }
  } else {
    return { nivel: 'muy-alta', mensaje: 'Carga muy alta - Riesgo de sobrepastoreo', color: 'text-red-600' }
  }
}