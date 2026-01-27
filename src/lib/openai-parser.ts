
// src/lib/openai-parser.ts
import OpenAI from "openai"
import { prisma } from "@/lib/prisma"
import { trackOpenAIChat, trackOpenAIWhisper, trackAIUsage } from "@/lib/ai-usage-tracker"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// ============================================================
// 🚀 NIVEL 1: DETECCIÓN CON REGEX (SIN IA - COSTO $0)
// ============================================================
// Detecta eventos simples que no necesitan inteligencia artificial
// Ejemplos: "llovió 10mm", "mapa", "calendario", "reporte de carga"

function detectSimpleEvent(messageText: string): object | null {
  const text = messageText.toLowerCase().trim()

  // 🌧️ LLUVIA: "llovió 10mm", "cayeron 25 milímetros", "lluvia 15mm"
  const lluviaMatch = text.match(/(?:llovi[oó]|lluvia|cayeron?)\s*(\d+(?:[.,]\d+)?)\s*(?:mm|milimetros|milímetros)/i)
  if (lluviaMatch) {
    const milimetros = parseFloat(lluviaMatch[1].replace(',', '.'))
    console.log(`⚡ [NIVEL 1 - REGEX] Detectado LLUVIA: ${milimetros}mm`)
    return { tipo: "LLUVIA", milimetros }
  }

  // 🌧️ LLUVIA alternativo: "10mm de lluvia", "25 mm"
  const lluviaAltMatch = text.match(/^(\d+(?:[.,]\d+)?)\s*(?:mm|milimetros|milímetros)(?:\s+de\s+lluvia)?$/i)
  if (lluviaAltMatch) {
    const milimetros = parseFloat(lluviaAltMatch[1].replace(',', '.'))
    console.log(`⚡ [NIVEL 1 - REGEX] Detectado LLUVIA (alt): ${milimetros}mm`)
    return { tipo: "LLUVIA", milimetros }
  }

  // ❄️ HELADA: "helada", "heló", "hubo helada"
  const heladaMatch = text.match(/(?:hel[oó]|helada|hubo\s+helada)/i)
  if (heladaMatch && !text.includes('vacun')) { // evitar "vacuna contra helada"
    console.log(`⚡ [NIVEL 1 - REGEX] Detectado HELADA`)
    return { tipo: "HELADA" }
  }

  // 🗺️ MAPA: "mapa", "ver mapa", "mapa del campo"
  if (/^(?:mapa|ver\s+mapa|mapa\s+del\s+campo|mostrame\s+el\s+mapa|quiero\s+ver\s+el\s+mapa|mandame\s+el\s+mapa|imagen\s+del\s+campo)$/i.test(text)) {
    console.log(`⚡ [NIVEL 1 - REGEX] Detectado MAPA`)
    return { tipo: "MAPA" }
  }

  // 📅 CALENDARIO_CONSULTAR: "calendario", "qué tengo pendiente", "actividades"
  if (/^(?:calendario|que\s+tengo\s+pendiente|qué\s+tengo\s+pendiente|actividades|pendientes|tareas)$/i.test(text)) {
    console.log(`⚡ [NIVEL 1 - REGEX] Detectado CALENDARIO_CONSULTAR`)
    return { tipo: "CALENDARIO_CONSULTAR" }
  }

  // 📊 REPORTE_CARGA: "pdf carga", "reporte de carga", "stock actual", etc.
  if (/(?:pdf\s*(?:de\s*)?carga|reporte\s*(?:de\s*)?carga|carga\s+actual|stock\s+actual|cuantos\s+animales|cuántos\s+animales|resumen\s+(?:de\s+)?animales|planilla\s+(?:de\s+)?carga)/i.test(text)) {
    console.log(`⚡ [NIVEL 1 - REGEX] Detectado REPORTE_CARGA`)
    return { tipo: "REPORTE_CARGA" }
  }

  // 🐄 REPORTE_PASTOREO: "reporte pastoreo", "pdf pastoreo", etc.
  if (/(?:reporte\s*(?:de\s*)?pastoreo|pdf\s*(?:de\s*)?pastoreo|pastoreo\s+rotativo|historial\s+(?:de\s+)?pastoreo|rotaci[oó]n\s+(?:de\s+)?potreros)/i.test(text)) {
    console.log(`⚡ [NIVEL 1 - REGEX] Detectado REPORTE_PASTOREO`)
    return { tipo: "REPORTE_PASTOREO" }
  }

  // 🔬 REPORTE_DAO: "reporte dao", "pdf dao", etc.
  if (/(?:reporte\s*(?:de\s*)?dao|pdf\s*(?:de\s*)?dao|historial\s*(?:de\s*)?dao|daos\s+registrados|ver\s+daos)/i.test(text)) {
    console.log(`⚡ [NIVEL 1 - REGEX] Detectado REPORTE_DAO`)
    return { tipo: "REPORTE_DAO" }
  }

  // No se detectó evento simple
  return null
}

// ============================================================
// 🚀 NIVEL 2: PARSING CON GPT-4O-MINI (COSTO ~$0.0003)
// ============================================================
// Para eventos de complejidad media que necesitan algo de interpretación
// pero no requieren el contexto completo de potreros/categorías

async function parseWithMini(
  messageText: string,
  categorias: Array<{ nombreSingular: string; nombrePlural: string }>,
  userId?: string
): Promise<object | null> {
  const nombresCategorias = categorias
    .flatMap(c => [c.nombreSingular, c.nombrePlural])
    .filter((v, i, a) => a.indexOf(v) === i)
    .join(", ")

  // Prompt CORTO (~300 tokens vs ~3800 del completo)
  const shortPrompt = `Procesa este mensaje de un productor agropecuario uruguayo.

CATEGORÍAS DE ANIMALES: ${nombresCategorias || "vacas, terneros, novillos, ovejas"}

DETECTA UNO DE ESTOS EVENTOS:
- NACIMIENTO: "nacieron X terneros" → {"tipo":"NACIMIENTO","categoria":"terneros","cantidad":X}
- MORTANDAD: "murieron X vacas" → {"tipo":"MORTANDAD","categoria":"vacas","cantidad":X}
- CONSUMO: "consumí X vacas" → {"tipo":"CONSUMO","categoria":"vacas","cantidad":X}
- COMPRA: "compré X terneros a $Y" → {"tipo":"COMPRA","categoria":"terneros","cantidad":X,"precioUnitario":Y}
- VENTA: "vendí X novillos a $Y" → {"tipo":"VENTA","categoria":"novillos","cantidad":X,"precioUnitario":Y}
- LLUVIA: "llovió Xmm" → {"tipo":"LLUVIA","milimetros":X}
- HELADA: "heló/helada" → {"tipo":"HELADA"}

Si el mensaje NO encaja en estos tipos, responde: {"tipo":"COMPLEJO"}

RESPONDE SOLO JSON:`

  try {
    console.log(`🔵 [NIVEL 2 - MINI] Procesando: "${messageText}"`)

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: shortPrompt },
        { role: "user", content: messageText }
      ],
      max_tokens: 150,
      temperature: 0.1,
    })

    // Trackear uso (muy bajo costo)
    if (userId) {
      trackOpenAIChat(userId, 'MESSAGE_PARSER', response, { level: 'mini', messageLength: messageText.length })
    }

    const content = response.choices[0].message.content
    if (!content) return null

    const jsonStr = content.replace(/```json/g, "").replace(/```/g, "").trim()
    const data = JSON.parse(jsonStr)

    // Si el modelo dice que es COMPLEJO, retornar null para ir al nivel 3
    if (data.tipo === "COMPLEJO") {
      console.log(`🔵 [NIVEL 2 - MINI] Evento complejo, escalando a nivel 3`)
      return null
    }

    console.log(`✅ [NIVEL 2 - MINI] Parseado:`, data)
    return data

  } catch (error) {
    console.error(`⚠️ [NIVEL 2 - MINI] Error, escalando a nivel 3:`, error)
    return null
  }
}

// ============================================================
// 🚀 NIVEL 3: PARSING COMPLETO CON GPT-4O (COSTO ~$0.02)
// ============================================================
// Para eventos complejos que necesitan contexto completo:
// - CAMBIO_POTRERO (necesita lista de potreros)
// - TRATAMIENTO (estructura compleja)
// - TACTO, DAO (estructura compleja)
// - CALENDARIO_CREAR (cálculo de fechas)
// - STOCK_EDICION (necesita lista de potreros)
// - GASTO (clasificación de categorías)

export async function parseMessageWithAI(
  messageText: string,
  potreros: Array<{ id: string; nombre: string }>,
  categorias: Array<{ nombreSingular: string; nombrePlural: string }>,
  userId?: string
) {
  try {
    // ============================================================
    // NIVEL 1: Intentar detectar con regex (sin costo)
    // ============================================================
    const simpleEvent = detectSimpleEvent(messageText)
    if (simpleEvent) {
      console.log(`✅ [OPTIMIZADO] Evento simple detectado sin IA`)
      // Trackear como "sin costo" para estadísticas
      if (userId) {
        trackAIUsage({
          userId,
          provider: 'OPENAI',
          model: 'regex-local',
          feature: 'MESSAGE_PARSER',
          inputTokens: 0,
          outputTokens: 0,
          metadata: { level: 'regex', messageLength: messageText.length }
        })
      }
      return simpleEvent
    }

    // ============================================================
    // NIVEL 2: Intentar con gpt-4o-mini (bajo costo)
    // ============================================================
    const miniResult = await parseWithMini(messageText, categorias, userId)
    if (miniResult) {
      console.log(`✅ [OPTIMIZADO] Evento parseado con gpt-4o-mini`)
      return miniResult
    }

    // ============================================================
    // NIVEL 3: Usar gpt-4o completo (alto costo, pero necesario)
    // ============================================================
    console.log(`🔴 [NIVEL 3 - GPT-4O] Procesando evento complejo: "${messageText}"`)

    // Formatear para el prompt
    const nombresPotreros = potreros.map(p => p.nombre).join(", ")
    const nombresCategorias = categorias
      .flatMap(c => [c.nombreSingular, c.nombrePlural])
      .filter((v, i, a) => a.indexOf(v) === i)
      .join(", ")

    console.log(`📋 Potreros del campo: ${nombresPotreros}`)

    // Obtener fecha actual en zona horaria de Montevideo
    const ahora = new Date()
    const fechaMontevideoStr = ahora.toLocaleString('es-UY', {
      timeZone: 'America/Montevideo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    })
    const [dia, mes, año] = fechaMontevideoStr.split(/[\/\s,]+/)
    const fechaActual = `${año}-${mes}-${dia}`

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `
Eres un asistente que procesa mensajes de texto de un productor agropecuario.

🏞️ CONTEXTO IMPORTANTE - POTREROS DISPONIBLES EN ESTE CAMPO:
${nombresPotreros || "No hay potreros creados aún"}

🐄 CATEGORÍAS DE ANIMALES DISPONIBLES:
${nombresCategorias || "No hay categorías definidas"}


📅 FECHA ACTUAL (Montevideo, Uruguay): ${fechaActual}
DÍA DE HOY: ${new Date().toLocaleDateString('es-UY', { weekday: 'long', timeZone: 'America/Montevideo' })}

IMPORTANTE PARA CAMBIOS DE POTRERO:
- El usuario SOLO puede mover animales entre los potreros listados arriba
- Debes normalizar los nombres al formato EXACTO que aparece en la lista
- Si el usuario dice "B2", "be dos", "B 2", "potrero B2" → usa "B2" (el nombre exacto de la lista)
- Si el usuario dice "T1", "te uno", "T 1" → usa "T1"
- Si el usuario menciona un potrero que NO está en la lista, marca como error

EJEMPLOS DE NORMALIZACIÓN:
Usuario dice: "moví vacas de be dos a te uno"
- loteOrigen: "B2" (nombre exacto de la lista)
- loteDestino: "T1" (nombre exacto de la lista)

Usuario dice: "moví vacas del potrero B 2 al lote T 1"
- loteOrigen: "B2"
- loteDestino: "T1"

Usuario dice: "moví vacas de norte a sur"
- Si en la lista hay "Norte" y "Sur" → usa esos nombres exactos
- Si no existen → marca error

TIPOS DE EVENTOS QUE DEBES DETECTAR:

1. CAMBIO_POTRERO:
   
   A) MOVIMIENTO NORMAL (categoría específica):
   - "moví X animales del potrero A al B"
   - "pasé 10 vacas de norte a sur"
   Retorna:
   {
     "tipo": "CAMBIO_POTRERO",
     "categoria": "vacas" (usa categoría de la lista disponible),
     "cantidad": 10,
     "loteOrigen": "Norte" (nombre EXACTO de la lista),
     "loteDestino": "Sur" (nombre EXACTO de la lista)
   }
   
   B) MOVER TODO (vaciar potrero completo):
   - "mover todo del norte al sur"
   - "paso todo de norte a sur"
   - "vaciar norte al sur"
   - "mover todos los animales del norte al sur"
   
   IMPORTANTE: Cuando dice "todo" o "todos los animales" sin especificar categoría:
   - NO incluyas el campo "categoria"
   - NO incluyas el campo "cantidad"
   - Marca con "moverTodo": true
   
   Retorna:
   {
     "tipo": "CAMBIO_POTRERO",
     "moverTodo": true,
     "loteOrigen": "Norte" (nombre EXACTO de la lista),
     "loteDestino": "Sur" (nombre EXACTO de la lista)
   }

2. NACIMIENTO:
   - "nacieron 3 terneros"
   - "parió una vaca en el potrero norte"
   Retorna:
   {
     "tipo": "NACIMIENTO",
     "categoria": "terneros",
     "cantidad": 3,
     "potrero": "Norte" (nombre EXACTO si se menciona)
   }

3. MORTANDAD:
   - "murieron 2 vacas"
   - "se murió un ternero en el lote sur"
   - "murió un novillo"
   - "perdí 3 ovejas"
   Retorna:
   {
     "tipo": "MORTANDAD",
     "categoria": "vacas",
     "cantidad": 2,
     "potrero": "Sur" (nombre EXACTO si se menciona)
   }

4. TRATAMIENTO:
   - "apliqué ivermectina a 50 vacas"
   - "baño aplicado a vacas toros y terneros"
   - "di antibiótico a 10 vacas en el norte y 15 terneros en el sur"
   - "desparasité todo el campo con ivermectina"
   - "baño a vacas y terneros, mancha y gangrena a terneros"
   - "tratamiento antiparasitario"
   
   IMPORTANTE - REGLAS DE AGRUPACIÓN: 
   - "producto" es el medicamento/tratamiento (ivermectina, aftosa, antibiótico, baño, etc.)
   - Si el MISMO producto se aplica a MÚLTIPLES CATEGORÍAS → usa array "categorias"
   - Si son PRODUCTOS DIFERENTES → usa array "tratamientos"
   - "todoElCampo": true si dice "todo el campo", "todos los potreros", "en todo el establecimiento"
   - Si no especifica cantidad/potrero, son opcionales (null)
   
   FORMATO ÚNICO - UNA CATEGORÍA:
   {
     "tipo": "TRATAMIENTO",
     "producto": "ivermectina",
     "cantidad": 50,
     "categoria": "vacas",
     "potrero": "Norte",
     "todoElCampo": false
   }
   
   FORMATO ÚNICO - MÚLTIPLES CATEGORÍAS (mismo producto):
   Ejemplo: "Baño aplicado a vacas, toros y terneros"
   {
     "tipo": "TRATAMIENTO",
     "producto": "baño",
     "categorias": ["vacas", "toros", "terneros"]
   }
   
   FORMATO MÚLTIPLE - PRODUCTOS DIFERENTES:
   Ejemplo: "Baño a vacas y terneros, mancha y gangrena a terneros"
   {
     "tipo": "TRATAMIENTO",
     "tratamientos": [
       {
         "producto": "baño",
         "categorias": ["vacas", "terneros"]
       },
       {
         "producto": "mancha y gangrena",
         "categoria": "terneros"
       }
     ]
   }
   
   FORMATO MÚLTIPLE - MISMO PRODUCTO EN DIFERENTES POTREROS:
   Ejemplo: "Apliqué ivermectina en norte y este"
   {
     "tipo": "TRATAMIENTO",
     "tratamientos": [
       {
         "producto": "ivermectina",
         "potrero": "Norte"
       },
       {
         "producto": "ivermectina",
         "potrero": "Este"
       }
     ]
   }
   
   IMPORTANTE - "TODO" se refiere a TODO LO QUE HAY EN ESE POTRERO:
   - "Bañé todo el norte" = baño en potrero norte a todos los animales presentes
   - "Vacuné el sur" = vacuna en potrero sur a todos los animales presentes
   - "Desparasité todo en el este" = antiparasitario en potrero este a todos
   
   NO retornes "todoElCampo": true NUNCA. Solo potrero sin categoría.
   
   Ejemplo: "Bañé todo el norte"
   {
     "tipo": "TRATAMIENTO",
     "producto": "baño",
     "potrero": "Norte"
   }


   5. TACTO:
   - "tacto en potrero norte 83 tactadas 59 preñadas"
   - "tacto en sol 120 animales 95 preñadas"
   - "tacto en potrero sol 83 preñadas 67 falladas"
   - "hice tacto en el sur: 100 tactadas, 78 preñadas"
   - "tactamos 150 vacas en el oeste, 120 preñadas"
   
   IMPORTANTE - TRES FORMATOS POSIBLES:
   
   A) Si dice "X tactadas/animales" + "Y preñadas":
      → cantidad = X
      → preñadas = Y
      Ejemplo: "150 tactadas 83 preñadas" → cantidad: 150, preñadas: 83
   
   B) Si dice "X tactadas" + "Y falladas" (SIN mencionar preñadas):
      → cantidad = X
      → preñadas = X - Y
      Ejemplo: "100 tactadas 25 falladas" → cantidad: 100, preñadas: 75
   
   C) Si dice "X preñadas" + "Y falladas" (SIN mencionar total):
      → cantidad = X + Y (SUMAR AMBAS)
      → preñadas = X
      Ejemplo: "83 preñadas 67 falladas" → cantidad: 150, preñadas: 83
   
   CRÍTICO: Si solo menciona preñadas y falladas (sin total), DEBES SUMARLAS para obtener el total tactado.
   
   Retorna:
   {
     "tipo": "TACTO",
     "potrero": "Sol" (nombre EXACTO),
     "cantidad": 150,
     "preñadas": 83
   }

   6. DAO (Diagnóstico de Actividad Ovárica):
   - "hice dao en potrero norte a 98 vacas: 20 preñadas, 30 ciclando, 25 anestro superficial, 23 anestro profundo"
   - "dao en sol, 92 vaquillonas: 50 preñadas, 20 ciclando, 15 anestro superficial, 7 anestro profundo"
   - "dao en casco, 100 vacas: 60 preñadas, 40 ciclando"
   - "resultados dao potrero este, 80 vaquillonas +2 años: preñadas 45, ciclando 20"
   
   IMPORTANTE:
   - SIEMPRE debe incluir potrero y categoría
   - SIEMPRE debe tener al menos UN resultado (preñadas, ciclando, anestro superficial o anestro profundo)
   - Si NO menciona un estado, ese valor es 0
   - La cantidad examinada se calcula automáticamente sumando todos los estados
   - Solo aplica a categorías femeninas bovinas: Vacas, Vacas Gordas, Vaquillonas +2 años, Vaquillonas 1-2 años
   
   Retorna:
   {
     "tipo": "DAO",
     "potrero": "Norte" (nombre EXACTO de la lista),
     "categoria": "Vacas" (nombre EXACTO de la lista),
     "prenado": 20,
     "ciclando": 30,
     "anestroSuperficial": 25,
     "anestroProfundo": 23
   }
   
   NOTA: Si el usuario NO menciona el potrero, retorna error pidiendo que lo especifique.

6. CONSUMO:
   - "consumí 2 vacas"
   - "faené un novillo del norte"
   - "consumimos 3 ovejas"
   - "consumo de 1 vaca en el sur"
   - "consumo familiar 1 vaca"
   
   IMPORTANTE:
   - Es para consumo propio/familiar
   - Resta animales del potrero
   - Si no especifica potrero, déjalo en null
   
   Retorna:
   {
     "tipo": "CONSUMO",
     "categoria": "vacas",
     "cantidad": 2,
     "potrero": "Norte"
   }

7. VENTA:
   - "vendí 5 novillos a $500 cada uno"
   - "vendí 10 vacas"
   Retorna:
   {
     "tipo": "VENTA",
     "categoria": "novillos",
     "cantidad": 5,
     "precioUnitario": 500,
     "potrero": null (si no se menciona)
   }

8. COMPRA:
   - "compré 20 terneros a $300"
   Retorna:
   {
     "tipo": "COMPRA",
     "categoria": "terneros",
     "cantidad": 20,
     "precioUnitario": 300
   }

9. LLUVIA:
   - "llovieron 25mm"
   - "cayeron 30 milímetros"
   Retorna:
   {
     "tipo": "LLUVIA",
     "milimetros": 25
   }

10. GASTO:
   - "gasté $5000 en alimento"
   - "compré fertilizante por $3000"
   Retorna:
   {
     "tipo": "GASTO",
     "descripcion": "alimento",
     "monto": 5000,
     "categoria": "Alimentos Animales"
   }

11. CALENDARIO_CREAR:
   - "en 14 días sacar tablilla"
   - "el martes vacunar"
   - "el 5 de enero revisar alambrado"
   - "mañana revisar alambrado"
   - "pasado mañana fumigar"
   
   IMPORTANTE: Debes calcular "diasDesdeHoy" a partir de HOY (${fechaActual}).
   
   Para fechas RELATIVAS (en X días, mañana, etc):
   - "mañana" → diasDesdeHoy: 1
   - "pasado mañana" → diasDesdeHoy: 2
   - "en 5 días" → diasDesdeHoy: 5
   - "en 2 semanas" → diasDesdeHoy: 14
   
   Para fechas ESPECÍFICAS (el 5 de enero, el martes, etc):
   - Calcula cuántos días faltan desde HOY hasta esa fecha
   - Ejemplo: Si hoy es 28 de diciembre y dice "el 5 de enero", son 8 días
   - Ejemplo: Si hoy es lunes 30 y dice "el martes", son 1 día
   - SIEMPRE incluye en "fechaRelativa" la fecha específica que mencionó
   
   Retorna:
   {
     "tipo": "CALENDARIO_CREAR",
     "titulo": "sacar tablilla",
     "diasDesdeHoy": 14,
     "fechaRelativa": "en 14 días" (o "el 5 de enero" si fue fecha específica),
     "descripcion": "sacar tablilla a terneros en potrero sol"
   }

12. CALENDARIO_CONSULTAR:
   - "calendario"
   - "qué tengo pendiente"
   - "actividades"
   Retorna:
   {
     "tipo": "CALENDARIO_CONSULTAR"
   }

   13. REPORTE_CARGA:
   - "pasame el pdf de carga"
   - "carga actual"
   - "reporte de carga"
   - "cuántos animales tengo"
   - "stock actual"
   - "resumen de animales"
   - "pdf carga"
   - "planilla de carga"
   Retorna:
   {
     "tipo": "REPORTE_CARGA"
   }

   14. REPORTE_PASTOREO:
   - "reporte de pastoreo"
   - "reporte pastoreo"
   - "pdf de pastoreo"
   - "pastoreo rotativo"
   - "historial de pastoreo"
   - "rotación de potreros"
   Retorna:
   {
     "tipo": "REPORTE_PASTOREO"
   }
 
   15. REPORTE_DAO:
   - "reporte dao"
   - "reporte de dao"
   - "pdf dao"
   - "pdf de dao"
   - "historial dao"
   - "historial de dao"
   - "daos registrados"
   - "ver daos"
   Retorna:
   {
     "tipo": "REPORTE_DAO"
   }
     
   15. MAPA:
   - "mapa"
   - "mapa del campo"
   - "ver mapa"
   - "mostrame el mapa"
   - "quiero ver el mapa"
   - "mandame el mapa"
   - "imagen del campo"
   Retorna:
   {
     "tipo": "MAPA"
   }

   // 🔥 AGREGAR ESTO NUEVO AQUÍ 👇
   16. STOCK_EDICION:
   - "conté 11 novillos en casco"
   - "hay 15 vacas en el norte"
   - "en el sur tengo 20 terneros"
   - "15 vacas en potrero sol"
   - "tengo 30 novillos en el este"
   - "encontré 25 terneros en el oeste"
   
   IMPORTANTE:
   - Es un conteo/actualización de stock en un potrero
   - NO es un movimiento entre potreros (eso usa "moví" o "pasé")
   - El usuario está informando cuántos animales HAY actualmente
   - Detecta verbos como: conté, hay, tengo, están, encontré, vi
   - SIEMPRE debe incluir el nombre del potrero
   
   Retorna:
   {
     "tipo": "STOCK_EDICION",
     "categoria": "novillos",
     "cantidad": 11,
     "potrero": "Casco" (nombre EXACTO de la lista)
   }
   // 🔥 FIN DE LO QUE SE AGREGA
     
⚠️ CRÍTICO: Para CAMBIO_POTRERO usa SIEMPRE "loteOrigen" y "loteDestino", NUNCA "potreroOrigen" ni "potreroDestino"

RESPONDE ÚNICAMENTE CON EL JSON, SIN TEXTO ADICIONAL.
          `,
        },
        {
          role: "user",
          content: messageText,
        },
      ],
      max_tokens: 500,
      temperature: 0.1,
    })

    // Trackear uso de IA (nivel 3 - completo)
    if (userId) {
      trackOpenAIChat(userId, 'MESSAGE_PARSER', response, { level: 'gpt-4o-full', messageLength: messageText.length })
    }

    const content = response.choices[0].message.content
    if (!content) return null

    // Parsear JSON
    const jsonStr = content.replace(/```json/g, "").replace(/```/g, "").trim()
    const data = JSON.parse(jsonStr)

    console.log("✅ GPT parseó:", data)

    // 🔥 MAPEO DE SEGURIDAD: Si GPT usó los nombres incorrectos, corregirlos
    if (data.tipo === "CAMBIO_POTRERO") {
      if (data.potreroOrigen && !data.loteOrigen) {
        console.log("⚠️ Corrigiendo campo: potreroOrigen → loteOrigen")
        data.loteOrigen = data.potreroOrigen
        delete data.potreroOrigen
      }
      if (data.potreroDestino && !data.loteDestino) {
        console.log("⚠️ Corrigiendo campo: potreroDestino → loteDestino")
        data.loteDestino = data.potreroDestino
        delete data.potreroDestino
      }
    }

    return data
  } catch (error) {
    console.error("❌ Error en parseMessageWithAI:", error)
    return null
  }
}

/**
 * 🎤 Transcribir audio con Whisper de OpenAI
 */
export async function transcribeAudio(audioUrl: string, userId?: string): Promise<string | null> {
  try {
    console.log("🎤 Descargando audio desde WhatsApp...")
    
    // Descargar el audio
    const audioResponse = await fetch(audioUrl, {
      headers: {
        "Authorization": `Bearer ${process.env.WHATSAPP_TOKEN}`,
      },
    })

    if (!audioResponse.ok) {
      console.error("❌ Error descargando audio:", audioResponse.status)
      return null
    }

    const audioBuffer = await audioResponse.arrayBuffer()
    console.log(`✅ Audio descargado: ${audioBuffer.byteLength} bytes`)

    // Convertir ArrayBuffer a File object (lo que espera OpenAI SDK)
    const audioFile = new File([audioBuffer], "audio.ogg", { 
      type: "audio/ogg; codecs=opus" 
    })

    console.log("🤖 Enviando a Whisper para transcripción...")

    // Transcribir con Whisper
    const transcriptionResponse = await openai.audio.transcriptions.create({
      file: audioFile,
      model: "whisper-1",
      language: "es",
      response_format: "text"
    })

    console.log("✅ Transcripción exitosa:", transcriptionResponse)

    // Trackear uso de Whisper
    if (userId && transcriptionResponse) {
      trackOpenAIWhisper(userId, transcriptionResponse.length, { audioBytes: audioBuffer.byteLength })
    }

    return transcriptionResponse
  } catch (error) {
    console.error("❌ Error en transcribeAudio:", error)
    return null
  }
}