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

RESPONDE SIEMPRE EN JSON con esta estructura:
{
  "tipo": "LLUVIA" | "NACIMIENTO" | "MORTANDAD" | "GASTO" | "TRATAMIENTO" | "SIEMBRA" | null,
  "cantidad": número o null,
  "categoria": string o null (para animales: "ternero", "vaca", "toro", "novillo" | para GASTOS: usar categorías de arriba),
  "lote": string o null (nombre del potrero),
  "monto": número o null (para gastos),
  "descripcion": string,
  "producto": string o null (para tratamientos),
  "cultivo": string o null (para siembra),
  "metodoPago": "Contado" | "Plazo" (solo para GASTOS),
  "diasPlazo": número o null (días de plazo, solo si metodoPago es "Plazo"),
  "pagado": boolean (solo para GASTOS, true si está pagado, false si está pendiente),
  "proveedor": string o null (nombre del proveedor/comercio si se menciona)
}

Si el mensaje NO es sobre ningún evento agrícola, retorna { "tipo": null }.

EJEMPLOS:
Usuario: "Llovieron 25mm"
Respuesta: {"tipo":"LLUVIA","cantidad":25,"descripcion":"Llovieron 25mm"}

Usuario: "Nacieron 3 terneros en potrero norte"
Respuesta: {"tipo":"NACIMIENTO","cantidad":3,"categoria":"ternero","lote":"norte","descripcion":"Nacieron 3 terneros en potrero norte"}

Usuario: "Murieron 2 vacas"
Respuesta: {"tipo":"MORTANDAD","cantidad":2,"categoria":"vaca","descripcion":"Murieron 2 vacas"}

Usuario: "Gasté $5000 en alimento"
Respuesta: {"tipo":"GASTO","monto":5000,"descripcion":"alimento","categoria":"Alimento"}

Usuario: "gasté 2000 pesos en hamburguesas"
Respuesta: {"tipo":"GASTO","monto":2000,"descripcion":"hamburguesas para el personal","categoria":"Alimento"}

Usuario: "pagué 3000 al veterinario"
Respuesta: {"tipo":"GASTO","monto":3000,"descripcion":"consulta veterinaria","categoria":"Veterinario"}

Usuario: "compré gasoil por 8000"
Respuesta: {"tipo":"GASTO","monto":8000,"descripcion":"combustible gasoil","categoria":"Combustible"}

Usuario: "gasté 1500 en cerveza"
Respuesta: {"tipo":"GASTO","monto":1500,"descripcion":"cerveza","categoria":"Otros"}

Usuario: "Vacuné 10 vacas con ivermectina en lote sur"
Respuesta: {"tipo":"TRATAMIENTO","cantidad":10,"categoria":"vaca","producto":"ivermectina","lote":"sur","descripcion":"Vacunación de 10 vacas con ivermectina en lote sur"}

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