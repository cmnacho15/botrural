  //src/lib/potrero-helpers.ts
import { prisma } from "@/lib/prisma"

/**
 * 🔍 Buscar potrero por nombre con match flexible
 * 
 * Maneja variaciones como:
 * - Mayúsculas/minúsculas: "Norte" = "norte" = "NORTE"
 * - Con/sin prefijos: "potrero norte" = "norte"
 * - Números: "lote 1" = "1" = "Lote 1"
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

  // Buscar coincidencia exacta normalizada
  for (const potrero of potreros) {
    const nombrePotreroNorm = normalizarNombrePotrero(potrero.nombre)
    
    if (nombrePotreroNorm === nombreNormalizado) {
      return potrero
    }
  }

  // Buscar coincidencia parcial (el nombre buscado está contenido o contiene)
  for (const potrero of potreros) {
    const nombrePotreroNorm = normalizarNombrePotrero(potrero.nombre)
    
    // Si el nombre del potrero contiene lo buscado
    if (nombrePotreroNorm.includes(nombreNormalizado)) {
      return potrero
    }
    
    // Si lo buscado contiene el nombre del potrero
    if (nombreNormalizado.includes(nombrePotreroNorm)) {
      return potrero
    }
  }

  // Buscar por número si es numérico
  if (/^\d+$/.test(nombreNormalizado)) {
    for (const potrero of potreros) {
      // Extraer números del nombre del potrero
      const numeros = potrero.nombre.match(/\d+/)
      if (numeros && numeros[0] === nombreNormalizado) {
        return potrero
      }
    }
  }

  return null
}

/**
 * Normalizar nombre de potrero para comparación
 */
function normalizarNombrePotrero(nombre: string): string {
  return nombre
    .toLowerCase()
    .trim()
    // Remover prefijos comunes
    .replace(/^(potrero|lote|campo|paddock)\s*/i, '')
    // Remover artículos
    .replace(/^(el|la|los|las|del|de la)\s*/i, '')
    // Normalizar espacios múltiples
    .replace(/\s+/g, ' ')
    .trim()
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
  return categoria
    // Remover rangos de edad
    .replace(/[\+\-]?\d+[\s\-–]*\d*\s*(años?|meses?|dias?)?/gi, '')
    // Remover sufijos de género
    .replace(/[\/\-]?(as?|os?)$/i, '')
    // Remover "dientes", "diente", "dl", etc.
    .replace(/\s*\d+[\s\-]*dientes?/gi, '')
    .replace(/\s*dl$/gi, '')
    .replace(/\s*mamones?$/gi, '')
    // Normalizar plurales comunes
    .replace(/vacas?/i, 'vaca')
    .replace(/toros?/i, 'toro')
    .replace(/novillos?/i, 'novillo')
    .replace(/vaquillonas?/i, 'vaquillona')
    .replace(/terneros?/i, 'ternero')
    .replace(/terneras?/i, 'ternera')
    .replace(/ovejas?/i, 'oveja')
    .replace(/carneros?/i, 'carnero')
    .replace(/corderos?/i, 'cordero')
    .replace(/corderas?/i, 'cordera')
    .replace(/borregas?/i, 'borrega')
    .replace(/capones?/i, 'capon')
    .replace(/yeguas?/i, 'yegua')
    .replace(/caballos?/i, 'caballo')
    .replace(/potrillos?/i, 'potrillo')
    .replace(/padrillos?/i, 'padrillo')
    .trim()
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