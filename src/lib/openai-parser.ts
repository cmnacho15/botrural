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

ZONA HORARIA: America/Montevideo (Uruguay, UTC-3)
FECHA ACTUAL: ${new Date().toLocaleDateString('es-UY', { timeZone: 'America/Montevideo', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}

TIPOS DE EVENTOS VÁLIDOS:
- LLUVIA: registros de precipitaciones
- NACIMIENTO: nacimientos de animales
- MORTANDAD: muertes de animales
- GASTO: gastos realizados (contado o a plazo)
- TRATAMIENTO: aplicación de medicamentos/vacunas
- SIEMBRA: siembra de cultivos
- CAMBIO_POTRERO: mover animales de un potrero/lote a otro
- MOVER_POTRERO_MODULO: mover un potrero de un módulo de pastoreo a otro
- CALENDARIO_CREAR: agendar una actividad/recordatorio futuro
- CALENDARIO_CONSULTAR: preguntar por actividades pendientes

📅 CALENDARIO - CREAR ACTIVIDAD:
Detectar cuando el usuario quiere AGENDAR algo para el futuro.
Palabras clave: "acordame", "recordame", "en X días", "el martes", "la semana que viene", "el día 20", "tengo que", "hay que", "no olvidar", "anotar", "agendar"

Debe extraer:
- titulo: la actividad a realizar (ej: "sacar tablilla", "vacunar", "llamar veterinario")
- fechaRelativa: descripción de cuándo (ej: "en 14 días", "el martes", "el 20 de enero")
- diasDesdeHoy: número de días desde hoy (calculalo vos). Si dice "mañana" = 1, "pasado mañana" = 2, "en una semana" = 7, "el martes" = calcular días hasta el próximo martes, etc.

📅 CALENDARIO - CONSULTAR:
Detectar cuando el usuario pregunta por sus actividades agendadas.
Palabras clave: "calendario", "pendientes", "qué tengo", "qué hay agendado", "actividades", "recordatorios", "qué debo hacer"

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

MOVER_POTRERO_MODULO (MÓDULOS DE PASTOREO):
Detectar cuando el usuario quiere mover un POTRERO completo de un módulo de pastoreo a otro.
Palabras clave: "mover potrero", "pasar potrero", "cambiar potrero", "potrero a módulo", "lote a módulo"
Debe extraer:
- nombrePotrero: nombre del potrero a mover (limpiar prefijos como "potrero", "lote", "el")
- moduloDestino: nombre del módulo destino (puede ser letras+números o cualquier nombre: "D3", "v1", "Módulo Norte", etc.)

IMPORTANTE para MOVER_POTRERO_MODULO:
- NO confundir con CAMBIO_POTRERO (que mueve ANIMALES entre potreros)
- MOVER_POTRERO_MODULO mueve el POTRERO entre módulos de pastoreo rotativo
- Ejemplo: "mover potrero bajo a módulo D3" → mueve el potrero "bajo" al módulo "D3"
- Ejemplo: "pasar lote norte al v1" → mueve el potrero "norte" al módulo "v1"

RESPONDE SIEMPRE EN JSON con esta estructura:
{
  "tipo": "LLUVIA" | "NACIMIENTO" | "MORTANDAD" | "GASTO" | "TRATAMIENTO" | "SIEMBRA" | "CAMBIO_POTRERO" | "MOVER_POTRERO_MODULO" | "CALENDARIO_CREAR" | "CALENDARIO_CONSULTAR" | null,
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
  "proveedor": string o null,
  "nombrePotrero": string o null (nombre del potrero a mover - SOLO para MOVER_POTRERO_MODULO),
  "moduloDestino": string o null (nombre del módulo destino - SOLO para MOVER_POTRERO_MODULO),
  "titulo": string o null (para CALENDARIO_CREAR - la actividad a realizar),
  "fechaRelativa": string o null (para CALENDARIO_CREAR - descripción de cuándo),
  "diasDesdeHoy": número o null (para CALENDARIO_CREAR - días calculados desde hoy)
}

Si el mensaje NO es sobre ningún evento agrícola ni calendario, retorna { "tipo": null }.

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

Usuario: "mover potrero bajo a módulo D3"
Respuesta: {"tipo":"MOVER_POTRERO_MODULO","nombrePotrero":"bajo","moduloDestino":"D3","descripcion":"Mover potrero bajo a módulo D3"}

Usuario: "pasar el potrero norte al módulo v1"
Respuesta: {"tipo":"MOVER_POTRERO_MODULO","nombrePotrero":"norte","moduloDestino":"v1","descripcion":"Mover potrero norte a módulo v1"}

Usuario: "cambiar lote sur de módulo, ponerlo en D2"
Respuesta: {"tipo":"MOVER_POTRERO_MODULO","nombrePotrero":"sur","moduloDestino":"D2","descripcion":"Mover potrero sur a módulo D2"}

Usuario: "Vacuné 10 vacas con ivermectina en lote sur"
Respuesta: {"tipo":"TRATAMIENTO","cantidad":10,"categoria":"vacas","producto":"ivermectina","lote":"sur","descripcion":"Vacunación de 10 vacas con ivermectina en lote sur"}

Usuario: "Sembré 5 hectáreas de soja"
Respuesta: {"tipo":"SIEMBRA","cantidad":5,"cultivo":"soja","descripcion":"Siembra de 5 hectáreas de soja"}

Usuario: "en 14 días tengo que sacar tablilla"
Respuesta: {"tipo":"CALENDARIO_CREAR","titulo":"sacar tablilla","fechaRelativa":"en 14 días","diasDesdeHoy":14,"descripcion":"Agendar: sacar tablilla en 14 días"}

Usuario: "acordame el martes de llamar al veterinario"
Respuesta: {"tipo":"CALENDARIO_CREAR","titulo":"llamar al veterinario","fechaRelativa":"el martes","diasDesdeHoy":3,"descripcion":"Agendar: llamar al veterinario el martes"}

Usuario: "la semana que viene hay que vacunar"
Respuesta: {"tipo":"CALENDARIO_CREAR","titulo":"vacunar","fechaRelativa":"la semana que viene","diasDesdeHoy":7,"descripcion":"Agendar: vacunar en 7 días"}

Usuario: "el 20 revisar bebederos"
Respuesta: {"tipo":"CALENDARIO_CREAR","titulo":"revisar bebederos","fechaRelativa":"el 20","diasDesdeHoy":9,"descripcion":"Agendar: revisar bebederos el día 20"}

Usuario: "mañana llega el camión"
Respuesta: {"tipo":"CALENDARIO_CREAR","titulo":"llega el camión","fechaRelativa":"mañana","diasDesdeHoy":1,"descripcion":"Agendar: llega el camión mañana"}

Usuario: "pasado mañana pagar al peón"
Respuesta: {"tipo":"CALENDARIO_CREAR","titulo":"pagar al peón","fechaRelativa":"pasado mañana","diasDesdeHoy":2,"descripcion":"Agendar: pagar al peón en 2 días"}

Usuario: "calendario"
Respuesta: {"tipo":"CALENDARIO_CONSULTAR","descripcion":"Consultar actividades pendientes"}

Usuario: "qué tengo pendiente"
Respuesta: {"tipo":"CALENDARIO_CONSULTAR","descripcion":"Consultar actividades pendientes"}

Usuario: "pendientes"
Respuesta: {"tipo":"CALENDARIO_CONSULTAR","descripcion":"Consultar actividades pendientes"}

Usuario: "qué hay agendado"
Respuesta: {"tipo":"CALENDARIO_CONSULTAR","descripcion":"Consultar actividades pendientes"}`
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