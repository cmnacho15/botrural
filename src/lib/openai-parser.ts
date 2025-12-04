import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

/**
 * 🤖 Parsear mensaje usando GPT-4o-mini con detección inteligente de categorías
 */
export async function parseMessageWithAI(message: string, telefono: string) {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `Sos un asistente de campo agrícola en Uruguay. Tu tarea es extraer datos estructurados de mensajes sobre ganadería y agricultura.

TIPOS DE EVENTOS VÁLIDOS:
- LLUVIA: registros de precipitaciones
- NACIMIENTO: nacimientos de animales
- MORTANDAD: muertes de animales
- GASTO: gastos realizados (contado o a plazo)
- TRATAMIENTO: aplicación de medicamentos/vacunas
- SIEMBRA: siembra de cultivos
- CAMBIO_POTRERO: mover animales de un potrero/lote a otro

CATEGORÍAS DE GASTOS (MUY IMPORTANTE):
Cuando el tipo es "GASTO", SIEMPRE deduce la categoría correcta:
- "Alimento": comida, alimento, balanceado, suplemento, ración, forraje, heno, silo, maíz para consumo, hamburguesas, comida para personal
- "Veterinario": veterinario, vacuna, medicamento, droga, tratamiento veterinario, consulta veterinaria, ivermectina, antibiótico
- "Combustible": nafta, gasoil, combustible, diesel, gas oil
- "Insumos": semillas, fertilizante, agroquímico, herbicida, insecticida, abono
- "Mantenimiento": arreglo, reparación, mantenimiento, repuesto, herramienta
- "Salarios": sueldo, jornal, pago empleado, salario, honorario
- "Servicios": luz, agua, internet, teléfono, servicio
- "Otros": si no encaja en ninguna categoría anterior

CONDICIONES DE PAGO (PARA GASTOS):
- Detectá si el gasto es "contado" o "a plazo"
- Si menciona "a plazo", "en X días", "a X días", "financiado", "cuenta corriente", "crédito", extraé los días
- Si dice "pagado", "ya pagué", "cancelado" → pagado: true
- Si dice "debo", "pendiente", "por pagar", "no pagué" → pagado: false
- Por defecto: contado y pagado

CAMBIO DE POTRERO (MUY IMPORTANTE):
Detectar cuando el usuario quiere MOVER animales de un lugar a otro.
Palabras clave: "moví", "mover", "pasé", "pasar", "cambié", "cambiar", "trasladé", "trasladar", "llevé", "llevar", "saqué", "sacar"
Debe extraer:
- cantidad: número de animales (puede ser null si no se especifica, se moverán todos)
- categoria: tipo de animal (vacas, terneros, novillos, toros, ovejas, corderos, yeguas, potros, vaquillonas, etc.)
- loteOrigen: nombre del potrero/lote de origen (limpiar prefijos como "potrero", "lote", "del", "de")
- loteDestino: nombre del potrero/lote de destino (limpiar prefijos como "potrero", "lote", "al", "a")

IMPORTANTE para nombres de potreros:
- Extraer solo el nombre limpio, sin "potrero", "lote", "del", "al", etc.
- Ejemplo: "del potrero norte" → "norte"
- Ejemplo: "al lote 2" → "2"
- Ejemplo: "de campo grande" → "campo grande"

RESPONDE SIEMPRE EN JSON con esta estructura:
{
  "tipo": "LLUVIA" | "NACIMIENTO" | "MORTANDAD" | "GASTO" | "TRATAMIENTO" | "SIEMBRA" | "CAMBIO_POTRERO" | null,
  "cantidad": número o null,
  "categoria": string o null,
  "lote": string o null (nombre del potrero - para eventos que NO son cambio de potrero),
  "loteOrigen": string o null (nombre del potrero origen - SOLO para CAMBIO_POTRERO),
  "loteDestino": string o null (nombre del potrero destino - SOLO para CAMBIO_POTRERO),
  "monto": número o null (para gastos),
  "descripcion": string,
  "producto": string o null (para tratamientos),
  "cultivo": string o null (para siembra),
  "metodoPago": "Contado" | "Plazo" (solo para GASTOS),
  "diasPlazo": número o null,
  "pagado": boolean (solo para GASTOS),
  "proveedor": string o null
}

Si el mensaje NO es sobre ningún evento agrícola, retorna { "tipo": null }.

EJEMPLOS:
Usuario: "Llovieron 25mm"
Respuesta: {"tipo":"LLUVIA","cantidad":25,"descripcion":"Llovieron 25mm"}

Usuario: "Nacieron 3 terneros en potrero norte"
Respuesta: {"tipo":"NACIMIENTO","cantidad":3,"categoria":"terneros","lote":"norte","descripcion":"Nacieron 3 terneros en potrero norte"}

Usuario: "Murieron 2 vacas"
Respuesta: {"tipo":"MORTANDAD","cantidad":2,"categoria":"vacas","descripcion":"Murieron 2 vacas"}

Usuario: "Gasté $5000 en alimento"
Respuesta: {"tipo":"GASTO","monto":5000,"descripcion":"alimento","categoria":"Alimento","metodoPago":"Contado","pagado":true}

Usuario: "moví 10 vacas del potrero norte al potrero sur"
Respuesta: {"tipo":"CAMBIO_POTRERO","cantidad":10,"categoria":"vacas","loteOrigen":"norte","loteDestino":"sur","descripcion":"Cambio de 10 vacas de norte a sur"}

Usuario: "pasé 5 terneros de lote 1 a lote 2"
Respuesta: {"tipo":"CAMBIO_POTRERO","cantidad":5,"categoria":"terneros","loteOrigen":"1","loteDestino":"2","descripcion":"Cambio de 5 terneros de lote 1 a lote 2"}

Usuario: "cambié 20 novillos de campo grande a campo chico"
Respuesta: {"tipo":"CAMBIO_POTRERO","cantidad":20,"categoria":"novillos","loteOrigen":"campo grande","loteDestino":"campo chico","descripcion":"Cambio de 20 novillos de campo grande a campo chico"}

Usuario: "llevé las ovejas del potrero 3 al 4"
Respuesta: {"tipo":"CAMBIO_POTRERO","cantidad":null,"categoria":"ovejas","loteOrigen":"3","loteDestino":"4","descripcion":"Cambio de ovejas del potrero 3 al 4"}

Usuario: "trasladé 15 vaquillonas desde el fondo hasta la entrada"
Respuesta: {"tipo":"CAMBIO_POTRERO","cantidad":15,"categoria":"vaquillonas","loteOrigen":"fondo","loteDestino":"entrada","descripcion":"Cambio de 15 vaquillonas de fondo a entrada"}

Usuario: "saqué todas las vacas del norte y las mandé al sur"
Respuesta: {"tipo":"CAMBIO_POTRERO","cantidad":null,"categoria":"vacas","loteOrigen":"norte","loteDestino":"sur","descripcion":"Cambio de vacas de norte a sur"}

Usuario: "Vacuné 10 vacas con ivermectina en lote sur"
Respuesta: {"tipo":"TRATAMIENTO","cantidad":10,"categoria":"vacas","producto":"ivermectina","lote":"sur","descripcion":"Vacunación de 10 vacas con ivermectina en lote sur"}

Usuario: "Sembré 5 hectáreas de soja"
Respuesta: {"tipo":"SIEMBRA","cantidad":5,"cultivo":"soja","descripcion":"Siembra de 5 hectáreas de soja"}`
        },
        {
          role: "user",
          content: message
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
    })

    const result = completion.choices[0].message.content
    if (!result) return null

    const parsed = JSON.parse(result)
    
    if (!parsed.tipo) return null

    return {
      ...parsed,
      telefono
    }

  } catch (error) {
    console.error("Error parseando con GPT:", error)
    return null
  }
}

/**
 * 🎤 Transcribir audio con Whisper
 */
export async function transcribeAudio(audioUrl: string): Promise<string | null> {
  try {
    console.log("🎤 Descargando audio desde:", audioUrl)
    
    // Descargar el audio desde WhatsApp
    const audioResponse = await fetch(audioUrl, {
      headers: {
        'Authorization': `Bearer ${process.env.WHATSAPP_TOKEN}`
      }
    })

    if (!audioResponse.ok) {
      console.error("❌ Error descargando audio:", audioResponse.status, await audioResponse.text())
      return null
    }

    console.log("✅ Audio descargado, tamaño:", audioResponse.headers.get('content-length'))

    // Convertir a buffer
    const audioBuffer = await audioResponse.arrayBuffer()
    const audioBlob = new Blob([audioBuffer], { type: 'audio/ogg; codecs=opus' })
    const audioFile = new File([audioBlob], 'audio.ogg', { type: 'audio/ogg; codecs=opus' })

    console.log("📤 Enviando a Whisper, tamaño archivo:", audioFile.size)

    // Transcribir con Whisper
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: "whisper-1",
      language: "es",
    })

    console.log("✅ Transcripción exitosa:", transcription)
    
    // Whisper puede devolver un objeto o string
    const text = typeof transcription === 'string' ? transcription : transcription.text
    
    console.log("📝 Texto transcrito:", text)
    return text

  } catch (error: any) {
    console.error("💥 Error transcribiendo audio:", error)
    console.error("💥 Error detalles:", error.message)
    console.error("💥 Error stack:", error.stack)
    return null
  }
}