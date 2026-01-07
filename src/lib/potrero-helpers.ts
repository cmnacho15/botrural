//src/lib/potrero-helpers.ts
import { prisma } from "@/lib/prisma"

/**
 * 🔍 Buscar potrero por nombre con match flexible MEJORADO
 * 
 * Maneja variaciones como:
 * - Mayúsculas/minúsculas: "Norte" = "norte" = "NORTE"
 * - Con/sin prefijos: "potrero norte" = "norte"
 * - Números: "lote 1" = "1" = "Lote 1"
 * - Alfanuméricos: "B2" = "B 2" = "be dos" = "b-2"
 * - Espacios extra
 */
export async function buscarPotreroPorNombre(
  nombreBuscado: string,
  campoId: string
): Promise<{ id: string; nombre: string } | null> {
  if (!nombreBuscado || !campoId) return null

  // Normalizar el nombre buscado
  const nombreNormalizado = normalizarNombrePotrero(nombreBuscado)

  // Obtener todos los potreros del campo
  const potreros = await prisma.lote.findMany({
    where: { campoId },
    select: { id: true, nombre: true },
  })

  console.log(`🔍 Buscando potrero: "${nombreBuscado}" → normalizado: "${nombreNormalizado}"`)
  console.log(`📋 Potreros disponibles:`, potreros.map(p => `"${p.nombre}" → "${normalizarNombrePotrero(p.nombre)}"`))

  // 1. Buscar coincidencia exacta normalizada
  for (const potrero of potreros) {
    const nombrePotreroNorm = normalizarNombrePotrero(potrero.nombre)
    
    if (nombrePotreroNorm === nombreNormalizado) {
      console.log(`✅ Match exacto: "${nombreBuscado}" → "${potrero.nombre}"`)
      return potrero
    }
  }

  // 2. Buscar coincidencia parcial (el nombre buscado está contenido o contiene)
  for (const potrero of potreros) {
    const nombrePotreroNorm = normalizarNombrePotrero(potrero.nombre)
    
    // Si el nombre del potrero contiene lo buscado
    if (nombrePotreroNorm.includes(nombreNormalizado)) {
      console.log(`✅ Match parcial (contiene): "${nombreBuscado}" → "${potrero.nombre}"`)
      return potrero
    }
    
    // Si lo buscado contiene el nombre del potrero
    if (nombreNormalizado.includes(nombrePotreroNorm)) {
      console.log(`✅ Match parcial (contenido): "${nombreBuscado}" → "${potrero.nombre}"`)
      return potrero
    }
  }

  // 3. Buscar por patrón alfanumérico (B2, T1, etc.)
  const patronAlfanumerico = extraerPatronAlfanumerico(nombreNormalizado)
  if (patronAlfanumerico) {
    for (const potrero of potreros) {
      const patronPotrero = extraerPatronAlfanumerico(normalizarNombrePotrero(potrero.nombre))
      if (patronPotrero && patronAlfanumerico === patronPotrero) {
        console.log(`✅ Match alfanumérico: "${nombreBuscado}" → "${potrero.nombre}"`)
        return potrero
      }
    }
  }

  // 4. Buscar por número si es numérico
  if (/^\d+$/.test(nombreNormalizado)) {
    for (const potrero of potreros) {
      // Extraer números del nombre del potrero
      const numeros = potrero.nombre.match(/\d+/)
      if (numeros && numeros[0] === nombreNormalizado) {
        console.log(`✅ Match numérico: "${nombreBuscado}" → "${potrero.nombre}"`)
        return potrero
      }
    }
  }

  console.log(`❌ No se encontró potrero para: "${nombreBuscado}"`)
  return null
}

/**
 * Normalizar nombre de potrero para comparación
 * MEJORADO: maneja nombres alfanuméricos cortos como B2, T1
 */
function normalizarNombrePotrero(nombre: string): string {
  let normalizado = nombre
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
  
  // 🔢 PRIMERO: Convertir números en texto a dígitos
  const numerosTexto: Record<string, string> = {
    'cero': '0', 'uno': '1', 'dos': '2', 'tres': '3', 'cuatro': '4',
    'cinco': '5', 'seis': '6', 'siete': '7', 'ocho': '8', 'nueve': '9',
    'diez': '10', 'once': '11', 'doce': '12', 'trece': '13', 
    'catorce': '14', 'quince': '15', 'dieciseis': '16', 'diecisiete': '17',
    'dieciocho': '18', 'diecinueve': '19', 'veinte': '20'
  }
  
  Object.entries(numerosTexto).forEach(([texto, num]) => {
    normalizado = normalizado.replace(
      new RegExp(`\\b${texto}\\b`, 'g'), 
      num
    )
  })
  
  // 🔤 SEGUNDO: Remover espacios y guiones entre alfanuméricos
  normalizado = normalizado
    .replace(/([a-z0-9])\s*[-_]\s*([a-z0-9])/gi, '$1$2')
    .replace(/([a-z])\s+(\d)/gi, '$1$2')
    .replace(/(\d)\s+([a-z])/gi, '$1$2')
  
  // 📝 TERCERO: Remover prefijos SOLO si hay algo después
  if (normalizado.length > 4) {
    normalizado = normalizado
      .replace(/^(potrero|lote|campo|paddock)\s+(.+)$/i, '$2')
      .replace(/^(el|la|los|las)\s+(.+)$/i, '$2')
  }
  
  return normalizado.trim()
}

/**
 * 🔤 Extraer patrón alfanumérico (B2 → b2, T1 → t1)
 * Usado para matchear nombres como "B2", "T1", "A3", etc.
 */

/**
 * 🔍 Buscar potrero en una lista (sin consultar BD) - VERSIÓN MEJORADA
 * Prioriza SIEMPRE el match exacto normalizado.
 * Solo usa matches parciales o alfanuméricos si no hay exacto.
 */
export function buscarPotreroEnLista(
  nombreBuscado: string,
  potreros: Array<{ id: string; nombre: string }>
): { id: string; nombre: string } | null {
  if (!nombreBuscado || !potreros.length) return null

  const nombreNormalizado = normalizarNombrePotrero(nombreBuscado)

  let mejorMatch: { id: string; nombre: string; score: number } | null = null

  for (const potrero of potreros) {
    const nombrePotreroNorm = normalizarNombrePotrero(potrero.nombre)

    // Score 100: coincidencia exacta → retornamos INMEDIATAMENTE
    if (nombrePotreroNorm === nombreNormalizado) {
      return potrero // ¡Prioridad absoluta!
    }

    // Score 50: el buscado está completamente contenido en el potrero
    if (nombrePotreroNorm.includes(nombreNormalizado)) {
      const score = 50
      if (!mejorMatch || score > mejorMatch.score) {
        mejorMatch = { ...potrero, score }
      }
    }

    // Score 30: el potrero está completamente contenido en el buscado
    if (nombreNormalizado.includes(nombrePotreroNorm)) {
      const score = 30
      if (!mejorMatch || score > mejorMatch.score) {
        mejorMatch = { ...potrero, score }
      }
    }

    // Score 20: match alfanumérico (B2, T1, etc.)
    const patronBuscado = extraerPatronAlfanumerico(nombreNormalizado)
    const patronPotrero = extraerPatronAlfanumerico(nombrePotreroNorm)
    if (patronBuscado && patronPotrero && patronBuscado === patronPotrero) {
      if (!mejorMatch || 20 > mejorMatch.score) {
        mejorMatch = { ...potrero, score: 20 }
      }
    }
  }

  // Si no hubo match exacto, devolvemos el mejor parcial encontrado
  if (mejorMatch) {
    console.log(`✅ Match aproximado: "${nombreBuscado}" → "${mejorMatch.nombre}"`)
    return { id: mejorMatch.id, nombre: mejorMatch.nombre }
  }

  console.log(`❌ No se encontró potrero para: "${nombreBuscado}" (normalizado: "${nombreNormalizado}")`)
  return null
}
/**
 * 🔤 Extraer patrón alfanumérico (B2 → b2, T1 → t1)
 * Usado para matchear nombres como "B2", "T1", "A3", etc.
 */
function extraerPatronAlfanumerico(nombre: string): string | null {
  // Buscar patrón: 1-2 letras + 1-3 números (B2, T1, AB12, etc.)
  const match = nombre.match(/^([a-z]{1,2})(\d{1,3})$/i)
  if (match) {
    return (match[1] + match[2]).toLowerCase()
  }
  return null
}

/**
 * 🐄 Buscar categoría de animal con match flexible
 * 
 * Busca en las categorías reales del campo (CategoriaAnimal)
 * y hace match inteligente con lo que dice el usuario.
 * 
 * Retorna:
 * - categoriaExacta: si hay match único
 * - null: si no hay match
 * - array de opciones: si hay ambigüedad (ej: "novillos" matchea con 3 categorías)
 */
export async function buscarCategoriaAnimal(
  categoriaBuscada: string,
  campoId: string
): Promise<{
  encontrada: boolean
  categoria?: string
  opciones?: string[]
  mensaje?: string
}> {
  if (!categoriaBuscada || !campoId) {
    return { encontrada: false, mensaje: "Categoría no especificada" }
  }

  // Obtener todas las categorías del campo
  const categoriasDB = await prisma.categoriaAnimal.findMany({
    where: { 
      campoId,
      activo: true,
    },
    select: { 
      nombreSingular: true, 
      nombrePlural: true,
      tipoAnimal: true,
    },
  })

  // También obtener las categorías que ya están en uso en AnimalLote
  const categoriasEnUso = await prisma.animalLote.findMany({
    where: {
      lote: { campoId },
    },
    select: { categoria: true },
    distinct: ['categoria'],
  })

  // Combinar ambas listas (las de CategoriaAnimal y las que están en uso)
  const todasLasCategorias = new Set<string>()
  
  categoriasDB.forEach(cat => {
    todasLasCategorias.add(cat.nombreSingular)
    if (cat.nombrePlural !== cat.nombreSingular) {
      todasLasCategorias.add(cat.nombrePlural)
    }
  })
  
  categoriasEnUso.forEach(cat => {
    todasLasCategorias.add(cat.categoria)
  })

  const categoriasArray = Array.from(todasLasCategorias)
  const buscadaNorm = normalizarCategoria(categoriaBuscada)

  // 1. Buscar coincidencia exacta
  for (const categoria of categoriasArray) {
    if (normalizarCategoria(categoria) === buscadaNorm) {
      return { encontrada: true, categoria }
    }
  }

  // 2. Buscar coincidencia parcial (la categoría contiene lo buscado)
  const coincidenciasParciales: string[] = []
  
  for (const categoria of categoriasArray) {
    const categoriaNorm = normalizarCategoria(categoria)
    
    // Si la categoría empieza con lo buscado
    if (categoriaNorm.startsWith(buscadaNorm)) {
      coincidenciasParciales.push(categoria)
      continue
    }
    
    // Si lo buscado está contenido en la categoría
    if (categoriaNorm.includes(buscadaNorm)) {
      coincidenciasParciales.push(categoria)
      continue
    }

    // Match por raíz (sin plurales, sin rangos de edad)
    const raizBuscada = obtenerRaizCategoria(buscadaNorm)
    const raizCategoria = obtenerRaizCategoria(categoriaNorm)
    
    if (raizBuscada === raizCategoria) {
      coincidenciasParciales.push(categoria)
    }
  }

  // Si hay exactamente una coincidencia parcial, usarla
  if (coincidenciasParciales.length === 1) {
    return { encontrada: true, categoria: coincidenciasParciales[0] }
  }

  // Si hay múltiples coincidencias, devolver opciones
  if (coincidenciasParciales.length > 1) {
    return { 
      encontrada: false, 
      opciones: coincidenciasParciales,
      mensaje: `Hay varias categorías que coinciden con "${categoriaBuscada}"`
    }
  }

  // No se encontró nada
  return { 
    encontrada: false, 
    mensaje: `No encontré la categoría "${categoriaBuscada}"`,
    opciones: categoriasArray.slice(0, 10), // Mostrar algunas opciones disponibles
  }
}

/**
 * Normalizar categoría de animal para comparación
 */
function normalizarCategoria(categoria: string): string {
  return categoria
    .toLowerCase()
    .trim()
    // Normalizar caracteres especiales
    .replace(/[\/\-–—]/g, ' ')
    // Normalizar espacios
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Obtener raíz de una categoría (sin plurales, sin rangos)
 * "novillos +3 años" → "novillo"
 * "vacas" → "vaca"
 * "terneros/as" → "ternero"
 */
function obtenerRaizCategoria(categoria: string): string {
  let raiz = categoria
    // Remover rangos de edad
    .replace(/[\+\-]?\d+[\s\-–]*\d*\s*(años?|meses?|dias?)?/gi, '')
    .replace(/\s*\d+[\s\-]*dientes?/gi, '')
    .replace(/\s*dl$/gi, '')
    .replace(/\s*mamones?$/gi, '')
  
  // 🆕 Remover diminutivos ANTES de normalizar plurales
  raiz = raiz
    .replace(/(it[oa]s?)$/i, '') // ovejita, vaquita, ternerito
    .replace(/(cit[oa]s?)$/i, '') // vaquicita
  
  // Remover sufijos de género
  raiz = raiz
    .replace(/[\/\-]?(as?|os?)$/i, '')
  
  // Normalizar plurales comunes
  raiz = raiz
    .replace(/\b(vacas?)\b/i, 'vaca')
    .replace(/\b(toros?)\b/i, 'toro')
    .replace(/\b(novillos?)\b/i, 'novillo')
    .replace(/\b(vaquillonas?)\b/i, 'vaquillona')
    .replace(/\b(terneros?)\b/i, 'ternero')
    .replace(/\b(terneras?)\b/i, 'ternera')
    .replace(/\b(ovejas?)\b/i, 'oveja')
    .replace(/\b(carneros?)\b/i, 'carnero')
    .replace(/\b(corderos?)\b/i, 'cordero')
    .replace(/\b(corderas?)\b/i, 'cordera')
    .replace(/\b(borregas?)\b/i, 'borrega')
    .replace(/\b(capones?)\b/i, 'capon')
    .replace(/\b(yeguas?)\b/i, 'yegua')
    .replace(/\b(caballos?)\b/i, 'caballo')
    .replace(/\b(potrillos?)\b/i, 'potrillo')
    .replace(/\b(padrillos?)\b/i, 'padrillo')
    .trim()
  
  return raiz
}
 

/**
 * 🐄 Buscar animales de una categoría en un potrero específico
 * 
 * Usa el match flexible de categorías
 */
export async function buscarAnimalesEnPotrero(
  categoriaBuscada: string,
  loteId: string,
  campoId: string
): Promise<{
  encontrado: boolean
  animal?: { id: string; categoria: string; cantidad: number }
  opciones?: Array<{ categoria: string; cantidad: number }>
  mensaje?: string
}> {
  if (!categoriaBuscada || !loteId) {
    return { encontrado: false, mensaje: "Datos incompletos" }
  }

  // Obtener todos los animales del potrero
  const animalesEnPotrero = await prisma.animalLote.findMany({
    where: {
      loteId,
      lote: { campoId },
    },
    select: { id: true, categoria: true, cantidad: true },
  })

  if (animalesEnPotrero.length === 0) {
    return { encontrado: false, mensaje: "No hay animales en este potrero" }
  }

  const buscadaNorm = normalizarCategoria(categoriaBuscada)
  const raizBuscada = obtenerRaizCategoria(buscadaNorm)

  // 1. Buscar coincidencia exacta
  for (const animal of animalesEnPotrero) {
    if (normalizarCategoria(animal.categoria) === buscadaNorm) {
      return { encontrado: true, animal }
    }
  }

  // 2. Buscar por raíz
  const coincidencias: Array<{ id: string; categoria: string; cantidad: number }> = []
  
  for (const animal of animalesEnPotrero) {
    const raizAnimal = obtenerRaizCategoria(normalizarCategoria(animal.categoria))
    
    if (raizBuscada === raizAnimal) {
      coincidencias.push(animal)
    }
  }

  // Si hay exactamente una coincidencia, usarla
  if (coincidencias.length === 1) {
    return { encontrado: true, animal: coincidencias[0] }
  }

  // Si hay múltiples coincidencias, preguntar
  if (coincidencias.length > 1) {
    return {
      encontrado: false,
      opciones: coincidencias.map(a => ({ categoria: a.categoria, cantidad: a.cantidad })),
      mensaje: `Hay varias categorías de "${categoriaBuscada}" en este potrero`,
    }
  }

  // No se encontró
  return {
    encontrado: false,
    opciones: animalesEnPotrero.map(a => ({ categoria: a.categoria, cantidad: a.cantidad })),
    mensaje: `No hay "${categoriaBuscada}" en este potrero`,
  }
}

/**
 * 📋 Obtener lista de potreros del campo (para mensajes de ayuda)
 */
export async function obtenerNombresPotreros(campoId: string): Promise<string[]> {
  const potreros = await prisma.lote.findMany({
    where: { campoId },
    select: { nombre: true },
    orderBy: { nombre: 'asc' },
  })

  return potreros.map(p => p.nombre)
}

/**
 * 📋 Obtener categorías de animales en un potrero (para mensajes de ayuda)
 */
export async function obtenerCategoriasEnPotrero(
  loteId: string,
  campoId: string
): Promise<Array<{ categoria: string; cantidad: number }>> {
  const animales = await prisma.animalLote.findMany({
    where: {
      loteId,
      lote: { campoId },
    },
    select: { categoria: true, cantidad: true },
    orderBy: { categoria: 'asc' },
  })

  return animales
}

/**
 * 🔍 Buscar potreros que tengan una categoría de animal específica
 */
export async function buscarPotrerosConCategoria(
  categoriaBuscada: string,
  campoId: string
): Promise<Array<{ loteId: string; loteNombre: string; cantidad: number; categoria: string }>> {
  const animales = await prisma.animalLote.findMany({
    where: {
      lote: { campoId },
    },
    include: {
      lote: { select: { id: true, nombre: true } },
    },
  })

  const buscadaNorm = categoriaBuscada.toLowerCase().trim()
  const resultados: Array<{ loteId: string; loteNombre: string; cantidad: number; categoria: string }> = []

  for (const animal of animales) {
    const categoriaNorm = animal.categoria.toLowerCase().trim()
    
    // Match flexible: oveja/ovejas, cordero/corderos, etc.
    if (
      categoriaNorm.includes(buscadaNorm) ||
      buscadaNorm.includes(categoriaNorm) ||
      categoriaNorm.replace(/s$/, '') === buscadaNorm.replace(/s$/, '')
    ) {
      resultados.push({
        loteId: animal.lote.id,
        loteNombre: animal.lote.nombre,
        cantidad: animal.cantidad,
        categoria: animal.categoria,
      })
    }
  }

  return resultados
}

/**
 * 🕒 Actualizar ultimoCambio solo si el potrero quedó vacío
 * 
 * Esta función evita resetear los días de pastoreo cuando se mueven
 * ALGUNOS animales pero el potrero NO queda completamente vacío.
 * 
 * REGLA: Solo actualiza ultimoCambio si animalesLote.length === 0
 */
export async function actualizarUltimoCambioSiVacio(loteId: string) {
  const lote = await prisma.lote.findUnique({
    where: { id: loteId },
    include: { animalesLote: true }
  })
  
  if (!lote) return
  
  const tieneAnimales = lote.animalesLote && lote.animalesLote.length > 0
  
  // ✅ SOLO actualizar si el potrero quedó COMPLETAMENTE VACÍO
  if (!tieneAnimales) {
    console.log(`🔄 Potrero "${lote.nombre}" quedó VACÍO → reseteando ultimoCambio`)
    await prisma.lote.update({
      where: { id: loteId },
      data: { ultimoCambio: new Date() }
    })
  } else {
    console.log(`✅ Potrero "${lote.nombre}" aún tiene animales → manteniendo ultimoCambio`)
  }
}


























/**
 * 🔍 Buscar potrero considerando MÓDULOS si hay nombres duplicados
 */
export async function buscarPotreroConModulos(
  nombreBuscado: string,
  campoId: string
): Promise<{
  unico: boolean
  lote?: { id: string; nombre: string; moduloNombre?: string }
  opciones?: Array<{ id: string; nombre: string; moduloNombre: string | null }>
}> {
  const potreros = await prisma.lote.findMany({
    where: { campoId },
    select: { 
      id: true, 
      nombre: true,
      moduloPastoreo: { select: { nombre: true } }
    },
  })

  const nombreNorm = normalizarNombrePotrero(nombreBuscado)
  const matches: Array<{ id: string; nombre: string; moduloNombre: string | null }> = []

  for (const potrero of potreros) {
    if (normalizarNombrePotrero(potrero.nombre) === nombreNorm) {
      matches.push({
        id: potrero.id,
        nombre: potrero.nombre,
        moduloNombre: potrero.moduloPastoreo?.nombre || null
      })
    }
  }

  if (matches.length === 0) return { unico: false, opciones: [] }
  if (matches.length === 1) return { unico: true, lote: matches[0] }
  
  // Hay duplicados - verificar si tienen módulos
  const conModulos = matches.filter(m => m.moduloNombre !== null)
  
  if (conModulos.length > 0) {
    return { unico: false, opciones: matches }
  }
  
  // Duplicados sin módulos, tomar el primero
  return { unico: true, lote: matches[0] }
}