// src/lib/openai-parser.ts
import OpenAI from "openai"
import { prisma } from "@/lib/prisma"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function parseMessageWithAI(messageText: string, telefono: string) {
  try {
    // 🔥 Obtener el campo del usuario
    const usuario = await prisma.user.findUnique({
      where: { telefono: telefono },
      select: { 
        campoId: true,
      },
    })

    if (!usuario?.campoId) {
      console.log("⚠️ Usuario sin campo asignado")
      return null
    }

    // 🔥 Obtener TODOS los potreros del campo
    const potreros = await prisma.lote.findMany({
      where: { campoId: usuario.campoId },
      select: { id: true, nombre: true },
      orderBy: { nombre: 'asc' },
    })

    const nombresPotreros = potreros.map(p => p.nombre).join(", ")

    console.log(`📋 Potreros del campo: ${nombresPotreros}`)

    // 🔥 Obtener categorías de animales del campo
    const categorias = await prisma.categoriaAnimal.findMany({
      where: { 
        campoId: usuario.campoId,
        activo: true,
      },
      select: { nombreSingular: true, nombrePlural: true },
    })

    const nombresCategorias = categorias
      .flatMap(c => [c.nombreSingular, c.nombrePlural])
      .filter((v, i, a) => a.indexOf(v) === i) // unique
      .join(", ")

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

IMPORTANTE PARA CAMBIOS DE POTRERO:
- El usuario SOLO puede mover animales entre los potreros listados arriba
- Debes normalizar los nombres al formato EXACTO que aparece en la lista
- Si el usuario dice "B2", "be dos", "B 2", "potrero B2" → usa "B2" (el nombre exacto de la lista)
- Si el usuario dice "T1", "te uno", "T 1" → usa "T1"
- Si el usuario menciona un potrero que NO está en la lista, marca como error

EJEMPLOS DE NORMALIZACIÓN:
Usuario dice: "moví vacas de be dos a te uno"
- potreroOrigen: "B2" (nombre exacto de la lista)
- potreroDestino: "T1" (nombre exacto de la lista)

Usuario dice: "moví vacas del potrero B 2 al lote T 1"
- potreroOrigen: "B2"
- potreroDestino: "T1"

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
     "potreroOrigen": "Norte" (nombre EXACTO de la lista),
     "potreroDestino": "Sur" (nombre EXACTO de la lista)
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

3. MUERTE:
   - "murieron 2 vacas"
   - "se murió un ternero en el lote sur"
   Retorna:
   {
     "tipo": "MUERTE",
     "categoria": "vacas",
     "cantidad": 2,
     "potrero": "Sur" (nombre EXACTO si se menciona)
   }

4. VENTA:
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

5. COMPRA:
   - "compré 20 terneros a $300"
   Retorna:
   {
     "tipo": "COMPRA",
     "categoria": "terneros",
     "cantidad": 20,
     "precioUnitario": 300
   }

6. LLUVIA:
   - "llovieron 25mm"
   - "cayeron 30 milímetros"
   Retorna:
   {
     "tipo": "LLUVIA",
     "milimetros": 25
   }

7. GASTO:
   - "gasté $5000 en alimento"
   - "compré fertilizante por $3000"
   Retorna:
   {
     "tipo": "GASTO",
     "descripcion": "alimento",
     "monto": 5000,
     "categoria": "Alimentos Animales"
   }

8. CALENDARIO_CREAR:
   - "en 14 días sacar tablilla"
   - "el martes vacunar"
   - "mañana revisar alambrado"
   Retorna:
   {
     "tipo": "CALENDARIO_CREAR",
     "descripcion": "sacar tablilla",
     "fecha": "2025-12-28" (calcular fecha correcta),
     "prioridad": "media"
   }

9. CALENDARIO_CONSULTAR:
   - "calendario"
   - "qué tengo pendiente"
   - "actividades"
   Retorna:
   {
     "tipo": "CALENDARIO_CONSULTAR"
   }

VALIDACIÓN CRÍTICA PARA CAMBIO_POTRERO:
- Antes de retornar, verifica que potreroOrigen Y potreroDestino estén en la lista de potreros disponibles
- Si alguno NO está en la lista, retorna:
{
  "tipo": "ERROR",
  "mensaje": "No encontré el potrero [nombre]. Los potreros disponibles son: ${nombresPotreros}"
}

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

    // 🔥 VALIDACIÓN ADICIONAL: Si es CAMBIO_POTRERO, verificar que los potreros existen
    if (data.tipo === "CAMBIO_POTRERO") {
      const origenExiste = potreros.some(p => 
        p.nombre.toLowerCase() === data.potreroOrigen?.toLowerCase()
      )
      const destinoExiste = potreros.some(p => 
        p.nombre.toLowerCase() === data.potreroDestino?.toLowerCase()
      )

      if (!origenExiste || !destinoExiste) {
        console.log(`❌ Potrero no válido: origen=${data.potreroOrigen}, destino=${data.potreroDestino}`)
        return {
          tipo: "ERROR",
          mensaje: `No encontré los potreros mencionados. Tus potreros son: ${nombresPotreros}`,
        }
      }

      // Normalizar nombres a los EXACTOS de la DB
      if (origenExiste) {
        const potreroOrigenReal = potreros.find(p => 
          p.nombre.toLowerCase() === data.potreroOrigen?.toLowerCase()
        )
        if (potreroOrigenReal) {
          data.potreroOrigen = potreroOrigenReal.nombre
        }
      }

      if (destinoExiste) {
        const potreroDestinoReal = potreros.find(p => 
          p.nombre.toLowerCase() === data.potreroDestino?.toLowerCase()
        )
        if (potreroDestinoReal) {
          data.potreroDestino = potreroDestinoReal.nombre
        }
      }

      console.log(`✅ Potreros validados: ${data.potreroOrigen} → ${data.potreroDestino}`)
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
    // Descargar el audio
    const audioResponse = await fetch(audioUrl, {
      headers: {
        "Authorization": `Bearer ${process.env.WHATSAPP_TOKEN}`,
      },
    })

    if (!audioResponse.ok) {
      console.error("Error descargando audio")
      return null
    }

    const audioBuffer = await audioResponse.arrayBuffer()
    const audioBlob = new Blob([audioBuffer], { type: "audio/ogg" })

    // Crear FormData para enviar a Whisper
    const formData = new FormData()
    formData.append("file", audioBlob, "audio.ogg")
    formData.append("model", "whisper-1")
    formData.append("language", "es")

    // Transcribir con Whisper
    const transcriptionResponse = await openai.audio.transcriptions.create({
      file: audioBlob as any,
      model: "whisper-1",
      language: "es",
    })

    return transcriptionResponse.text
  } catch (error) {
    console.error("❌ Error en transcribeAudio:", error)
    return null
  }
}