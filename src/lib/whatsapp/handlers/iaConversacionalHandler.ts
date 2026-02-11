// src/lib/whatsapp/handlers/iaConversacionalHandler.ts
// Handler de IA conversacional para responder preguntas sobre los datos del usuario

import { prisma } from "@/lib/prisma"
import { sendWhatsAppMessage } from "@/lib/whatsapp"
import Anthropic from "@anthropic-ai/sdk"

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

/**
 * Detecta si el mensaje es una pregunta o consulta
 */
export function esConsultaConversacional(texto: string): boolean {
  const textoLower = texto.toLowerCase()

  // Patrones de preguntas
  const patronesConsulta = [
    /^cu[aá]nto/i,           // cuánto, cuanto
    /^cu[aá]ntos/i,          // cuántos, cuantos
    /^cu[aá]l/i,             // cuál, cual
    /^qu[eé]/i,              // qué, que (al inicio)
    /^c[oó]mo/i,             // cómo, como
    /^d[oó]nde/i,            // dónde, donde
    /^cu[aá]ndo/i,           // cuándo, cuando
    /^hay\s/i,               // hay ...
    /^tengo\s/i,             // tengo ...
    /^tuve\s/i,              // tuve ...
    /\?$/,                   // termina en ?
    /dame\s+(?:un\s+)?resumen/i,
    /pasame\s+(?:los?\s+)?datos/i,
    /mostrame/i,
    /decime/i,
    /cuanto\s+gast[eé]/i,
    /cuantos?\s+animales/i,
    /resumen\s+de/i,
    /total\s+de/i,
  ]

  return patronesConsulta.some(patron => patron.test(textoLower))
}

/**
 * Obtiene el contexto de datos del usuario para la IA
 */
async function obtenerContextoUsuario(campoId: string): Promise<string> {
  // 1. Obtener animales por potrero
  const animales = await prisma.animalLote.findMany({
    where: {
      lote: { campoId },
      cantidad: { gt: 0 }
    },
    include: {
      lote: { select: { nombre: true } }
    }
  })

  // Agrupar animales
  const resumenAnimales: Record<string, number> = {}
  const animalesPorPotrero: Record<string, Record<string, number>> = {}
  let totalAnimales = 0

  for (const a of animales) {
    const cat = a.categoria || 'Sin categoría'
    const potrero = a.lote?.nombre || 'Sin potrero'

    resumenAnimales[cat] = (resumenAnimales[cat] || 0) + a.cantidad
    totalAnimales += a.cantidad

    if (!animalesPorPotrero[potrero]) animalesPorPotrero[potrero] = {}
    animalesPorPotrero[potrero][cat] = (animalesPorPotrero[potrero][cat] || 0) + a.cantidad
  }

  // 2. Obtener gastos/ingresos (últimos 60 días, más registros)
  const hace60Dias = new Date()
  hace60Dias.setDate(hace60Dias.getDate() - 60)

  const movimientos = await prisma.gasto.findMany({
    where: {
      campoId,
      fecha: { gte: hace60Dias }
    },
    select: {
      tipo: true,
      monto: true,
      descripcion: true,
      fecha: true,
      categoria: true,
      proveedor: true,
      pagado: true
    },
    orderBy: { fecha: 'desc' },
    take: 50
  })

  let totalGastos = 0
  let totalIngresos = 0
  const gastosPorCategoria: Record<string, number> = {}
  const listaGastos: string[] = []
  const listaIngresos: string[] = []

  for (const m of movimientos) {
    const fechaStr = m.fecha.toLocaleDateString('es-UY')
    const montoStr = `$${m.monto.toLocaleString()}`
    const desc = m.descripcion || m.categoria || 'Sin descripción'
    const prov = m.proveedor ? ` (${m.proveedor})` : ''
    const pagadoStr = m.pagado ? '' : ' [PENDIENTE]'

    if (m.tipo === 'GASTO') {
      totalGastos += m.monto
      const cat = m.categoria || 'Sin categoría'
      gastosPorCategoria[cat] = (gastosPorCategoria[cat] || 0) + m.monto
      listaGastos.push(`${fechaStr}: ${montoStr} - ${desc}${prov}${pagadoStr}`)
    } else {
      totalIngresos += m.monto
      listaIngresos.push(`${fechaStr}: ${montoStr} - ${desc}${prov}`)
    }
  }

  // 3. Eventos recientes
  const eventosRecientes = await prisma.evento.findMany({
    where: {
      lote: { campoId },
      fecha: { gte: hace60Dias }
    },
    select: {
      tipo: true,
      cantidad: true,
      fecha: true,
      lote: { select: { nombre: true } },
      categoria: true
    },
    orderBy: { fecha: 'desc' },
    take: 15
  })

  // 4. Potreros
  const potreros = await prisma.lote.findMany({
    where: { campoId },
    select: { nombre: true, hectareas: true }
  })

  // Construir contexto
  let contexto = `=== DATOS DEL CAMPO ===\n\n`

  // Animales
  contexto += `🐄 ANIMALES (Total: ${totalAnimales})\n`
  for (const [cat, cant] of Object.entries(resumenAnimales)) {
    contexto += `  - ${cat}: ${cant}\n`
  }
  contexto += `\nPor potrero:\n`
  for (const [potrero, cats] of Object.entries(animalesPorPotrero)) {
    const totalPotrero = Object.values(cats).reduce((a, b) => a + b, 0)
    contexto += `  ${potrero} (${totalPotrero} animales): ${Object.entries(cats).map(([c, n]) => `${n} ${c}`).join(', ')}\n`
  }

  // Gastos
  contexto += `\n💰 FINANZAS (últimos 60 días)\n`
  contexto += `  - Total gastos: $${totalGastos.toLocaleString()}\n`
  contexto += `  - Total ingresos: $${totalIngresos.toLocaleString()}\n`

  if (Object.keys(gastosPorCategoria).length > 0) {
    contexto += `\n  Gastos por categoría:\n`
    for (const [cat, monto] of Object.entries(gastosPorCategoria)) {
      contexto += `    - ${cat}: $${monto.toLocaleString()}\n`
    }
  }

  if (listaGastos.length > 0) {
    contexto += `\n  📋 DETALLE DE GASTOS:\n`
    for (const g of listaGastos.slice(0, 30)) {
      contexto += `    ${g}\n`
    }
  }

  if (listaIngresos.length > 0) {
    contexto += `\n  📋 DETALLE DE INGRESOS:\n`
    for (const i of listaIngresos.slice(0, 20)) {
      contexto += `    ${i}\n`
    }
  }

  // Eventos recientes
  if (eventosRecientes.length > 0) {
    contexto += `\n📋 EVENTOS RECIENTES\n`
    for (const e of eventosRecientes.slice(0, 10)) {
      const fecha = e.fecha.toLocaleDateString('es-UY')
      contexto += `  - ${fecha}: ${e.tipo} ${e.cantidad || ''} ${e.categoria || ''} en ${e.lote?.nombre || ''}\n`
    }
  }

  // Potreros
  contexto += `\n🗺️ POTREROS (${potreros.length})\n`
  for (const p of potreros) {
    contexto += `  - ${p.nombre}${p.hectareas ? ` (${p.hectareas} ha)` : ''}\n`
  }

  return contexto
}

/**
 * Responde una pregunta usando Claude Haiku
 */
export async function handleIAConversacional(
  from: string,
  pregunta: string,
  campoId: string,
  nombreCampo: string
): Promise<boolean> {
  try {
    console.log(`🤖 IA Conversacional - Pregunta: "${pregunta}"`)

    // Obtener contexto del usuario
    const contexto = await obtenerContextoUsuario(campoId)

    // Llamar a Claude Haiku
    const response = await anthropic.messages.create({
      model: "claude-3-haiku-20240307",
      max_tokens: 1000,
      messages: [
        {
          role: "user",
          content: `Sos el asistente de un campo agropecuario llamado "${nombreCampo}".
Respondé la siguiente pregunta del productor de forma clara, concisa y amigable.
Usá emojis cuando sea apropiado. Respondé en español rioplatense.
Si no tenés información suficiente, decilo honestamente.

${contexto}

PREGUNTA DEL USUARIO: ${pregunta}

Respondé directamente sin explicaciones adicionales:`
        }
      ]
    })

    const respuesta = response.content[0].type === 'text'
      ? response.content[0].text
      : 'No pude procesar tu consulta.'

    console.log(`🤖 IA Conversacional - Respuesta: "${respuesta.substring(0, 100)}..."`)

    await sendWhatsAppMessage(from, respuesta)
    return true

  } catch (error) {
    console.error('❌ Error en IA Conversacional:', error)
    return false
  }
}
