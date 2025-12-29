
// src/lib/openai-parser.ts
import OpenAI from "openai"
import { prisma } from "@/lib/prisma"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function parseMessageWithAI(
  messageText: string, 
  potreros: Array<{ id: string; nombre: string }>,
  categorias: Array<{ nombreSingular: string; nombrePlural: string }>
) {
  try {
    // Formatear para el prompt
    const nombresPotreros = potreros.map(p => p.nombre).join(", ")
    const nombresCategorias = categorias
      .flatMap(c => [c.nombreSingular, c.nombrePlural])
      .filter((v, i, a) => a.indexOf(v) === i)
      .join(", ")

    console.log(`📋 Potreros del campo: ${nombresPotreros}`)
    
    // Obtener fecha actual para el cálculo de días
// 🔥 Obtener fecha actual en zona horaria de Montevideo
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
   - "moví X animales del potrero A al B"
   - "pasé 10 vacas de norte a sur"
   Retorna:
   {
     "tipo": "CAMBIO_POTRERO",
     "categoria": "vacas" (usa categoría de la lista disponible),
     "cantidad": 10,
     "loteOrigen": "Norte" (nombre EXACTO de la lista, NO uses "potreroOrigen"),
     "loteDestino": "Sur" (nombre EXACTO de la lista, NO uses "potreroDestino")
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
   - "vacuné 30 terneros con aftosa"
   - "di antibiótico a 10 vacas en el norte"
   - "desparasité 20 novillos"
   - "tratamiento antiparasitario a 15 animales"
   
   IMPORTANTE: 
   - "producto" es el medicamento/tratamiento (ivermectina, aftosa, antibiótico, etc.)
   - Si no especifica cantidad, asume que es a todos los animales del potrero
   - Si no especifica potrero, déjalo en null
   
   Retorna:
   {
     "tipo": "TRATAMIENTO",
     "producto": "ivermectina",
     "cantidad": 50,
     "categoria": "vacas",
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
export async function transcribeAudio(audioUrl: string): Promise<string | null> {
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
    return transcriptionResponse
  } catch (error) {
    console.error("❌ Error en transcribeAudio:", error)
    return null
  }
}