// src/lib/whatsapp/handlers/observacionHandler.ts
// Handler para procesar fotos de observaciones de campo (no facturas)
// Si el caption describe un evento conocido, lo guarda como ese tipo de evento con foto adjunta

import { prisma } from "@/lib/prisma"
import { sendWhatsAppMessage, sendWhatsAppMessageWithButtons } from "../services/messageService"
import { uploadObservacionToSupabase } from "@/lib/supabase-storage"
import { parseMessageWithAI } from "@/lib/openai-parser"

// Tipos de eventos que pueden tener foto adjunta
const EVENTOS_CON_FOTO = [
  'NACIMIENTO', 'MORTANDAD', 'TRATAMIENTO', 'MANEJO', 'VENTA', 'COMPRA',
  'LLUVIA', 'HELADA', 'DESTETE', 'TACTO', 'CONSUMO', 'ABORTO',
  'SIEMBRA', 'COSECHA', 'PULVERIZACION', 'RECATEGORIZACION'
]

// Iconos por tipo de evento
const ICONOS_EVENTO: Record<string, string> = {
  NACIMIENTO: '🐣',
  MORTANDAD: '💀',
  TRATAMIENTO: '💉',
  MANEJO: '🔧',
  VENTA: '💰',
  COMPRA: '🛒',
  LLUVIA: '🌧️',
  HELADA: '❄️',
  DESTETE: '🔀',
  TACTO: '✋',
  CONSUMO: '🍖',
  ABORTO: '❌',
  SIEMBRA: '🌱',
  COSECHA: '🌾',
  PULVERIZACION: '💦',
  RECATEGORIZACION: '🏷️',
  OBSERVACION: '📸',
}

/**
 * Guarda una observación de campo con foto
 */
export async function handleObservacionImage(
  phoneNumber: string,
  imageBuffer: Buffer,
  mimeType: string,
  campoId: string,
  userId: string,
  caption: string
) {
  console.log("INICIO handleObservacionImage")

  try {
    // Subir imagen a Supabase
    const uploadResult = await uploadObservacionToSupabase(imageBuffer, mimeType, campoId)

    if (!uploadResult) {
      await sendWhatsAppMessage(phoneNumber, "Error guardando la foto. Intenta de nuevo.")
      return
    }

    // Crear evento de tipo OBSERVACION
    const evento = await prisma.evento.create({
      data: {
        tipo: "OBSERVACION",
        descripcion: caption || "Observación de campo",
        fecha: new Date(),
        campoId,
        usuarioId: userId,
        imageUrl: uploadResult.url,
        metadata: {
          imageName: uploadResult.fileName,
          captionOriginal: caption,
        },
      },
    })

    console.log("Observación guardada:", evento.id)

    await sendWhatsAppMessage(
      phoneNumber,
      `📸 *Observación guardada*\n\n` +
      `📝 ${caption || "(Sin descripción)"}\n` +
      `📅 ${new Date().toLocaleDateString("es-UY")}\n\n` +
      `Podés verla en la sección de Datos de la app.`
    )

  } catch (error) {
    console.error("Error en handleObservacionImage:", error)
    await sendWhatsAppMessage(phoneNumber, "Error guardando la observación. Intenta de nuevo.")
  }
}

/**
 * Guarda una foto como observación o como evento específico si se detecta en el caption
 * Primero intenta parsear el caption para ver si describe un evento conocido
 */
export async function saveObservacionFromUrl(
  phoneNumber: string,
  imageUrl: string,
  imageName: string,
  campoId: string,
  userId: string,
  caption: string
) {
  console.log("INICIO saveObservacionFromUrl - caption:", caption)

  try {
    // Si no hay caption, guardar como observación simple
    if (!caption || caption.trim() === "") {
      return await guardarComoObservacion(phoneNumber, imageUrl, imageName, campoId, userId, caption)
    }

    // Obtener potreros y categorías para el parser
    const potreros = await prisma.lote.findMany({
      where: { campoId },
      select: { id: true, nombre: true },
      orderBy: { nombre: 'asc' }
    })

    const categorias = await prisma.categoriaAnimal.findMany({
      where: { campoId, activo: true },
      select: { nombreSingular: true, nombrePlural: true }
    })

    // Intentar parsear el caption con IA
    console.log("🤖 Intentando parsear caption como evento...")
    const parsedData = await parseMessageWithAI(caption, potreros, categorias, userId)

    // Si se detectó un evento conocido, solicitar confirmación (igual que con texto)
    if (parsedData && parsedData.tipo && EVENTOS_CON_FOTO.includes(parsedData.tipo)) {
      console.log(`✅ Detectado evento tipo ${parsedData.tipo}, solicitando confirmación con foto adjunta`)
      return await solicitarConfirmacionConFoto(phoneNumber, imageUrl, imageName, campoId, userId, parsedData)
    }

    // Si no se detectó evento o es un tipo no soportado, guardar como observación
    console.log("📸 No se detectó evento específico, guardando como observación")
    return await guardarComoObservacion(phoneNumber, imageUrl, imageName, campoId, userId, caption)

  } catch (error) {
    console.error("Error en saveObservacionFromUrl:", error)
    await sendWhatsAppMessage(phoneNumber, "Error guardando la foto. Intenta de nuevo.")
    return false
  }
}

/**
 * Guarda como observación simple (comportamiento original)
 */
async function guardarComoObservacion(
  phoneNumber: string,
  imageUrl: string,
  imageName: string,
  campoId: string,
  userId: string,
  caption: string
) {
  const evento = await prisma.evento.create({
    data: {
      tipo: "OBSERVACION",
      descripcion: caption || "Observación de campo",
      fecha: new Date(),
      campoId,
      usuarioId: userId,
      imageUrl: imageUrl,
      metadata: {
        imageName: imageName,
        captionOriginal: caption,
      },
    },
  })

  console.log("Observación guardada:", evento.id)

  await sendWhatsAppMessage(
    phoneNumber,
    `📸 *Observación guardada*\n\n` +
    `📝 ${caption || "(Sin descripción)"}\n` +
    `📅 ${new Date().toLocaleDateString("es-UY")}\n\n` +
    `Podés verla en la sección de Datos de la app.`
  )

  return true
}

/**
 * Guarda un evento específico con foto adjunta
 */
async function guardarEventoConFoto(
  phoneNumber: string,
  imageUrl: string,
  imageName: string,
  campoId: string,
  userId: string,
  caption: string,
  parsedData: any,
  potreros: Array<{ id: string; nombre: string }>
) {
  const tipo = parsedData.tipo
  const icono = ICONOS_EVENTO[tipo] || '📌'

  // Buscar potrero si se mencionó
  let loteId: string | null = null
  let loteNombre: string | null = null

  if (parsedData.potrero) {
    const potrero = potreros.find(p =>
      p.nombre.toLowerCase() === parsedData.potrero.toLowerCase()
    )
    if (potrero) {
      loteId = potrero.id
      loteNombre = potrero.nombre
    }
  }

  // Construir descripción según el tipo de evento
  let descripcion = caption
  if (tipo === 'LLUVIA' && parsedData.milimetros) {
    descripcion = `Lluvia: ${parsedData.milimetros}mm`
  } else if (tipo === 'HELADA') {
    descripcion = 'Helada registrada'
  }

  // Crear el evento
  const evento = await prisma.evento.create({
    data: {
      tipo: tipo,
      descripcion: descripcion,
      fecha: new Date(),
      campoId,
      usuarioId: userId,
      loteId: loteId,
      imageUrl: imageUrl,
      cantidad: parsedData.cantidad || null,
      categoria: parsedData.categoria || null,
      monto: parsedData.precioUnitario ? parsedData.cantidad * parsedData.precioUnitario : null,
      metadata: {
        imageName: imageName,
        captionOriginal: caption,
        parsedData: parsedData,
        conFoto: true,
      },
    },
  })

  console.log(`Evento ${tipo} con foto guardado:`, evento.id)

  // Construir mensaje de confirmación
  let mensaje = `${icono} *${formatTipoEvento(tipo)} registrado*\n\n`

  if (parsedData.cantidad && parsedData.categoria) {
    mensaje += `🐄 ${parsedData.cantidad} ${parsedData.categoria}\n`
  }
  if (tipo === 'LLUVIA' && parsedData.milimetros) {
    mensaje += `💧 ${parsedData.milimetros} mm\n`
  }
  if (loteNombre) {
    mensaje += `📍 Potrero: ${loteNombre}\n`
  }
  mensaje += `📅 ${new Date().toLocaleDateString("es-UY")}\n`
  mensaje += `📷 Con foto adjunta\n\n`
  mensaje += `Podés verlo en la sección de Datos de la app.`

  await sendWhatsAppMessage(phoneNumber, mensaje)

  return true
}

/**
 * Formatea el tipo de evento para mostrar
 */
function formatTipoEvento(tipo: string): string {
  const nombres: Record<string, string> = {
    NACIMIENTO: 'Nacimiento',
    MORTANDAD: 'Mortandad',
    TRATAMIENTO: 'Tratamiento',
    MANEJO: 'Manejo',
    VENTA: 'Venta',
    COMPRA: 'Compra',
    LLUVIA: 'Lluvia',
    HELADA: 'Helada',
    DESTETE: 'Destete',
    TACTO: 'Tacto',
    CONSUMO: 'Consumo',
    ABORTO: 'Aborto',
    SIEMBRA: 'Siembra',
    COSECHA: 'Cosecha',
    PULVERIZACION: 'Pulverización',
    RECATEGORIZACION: 'Recategorización',
  }
  return nombres[tipo] || tipo
}

/**
 * Solicita confirmación para un evento detectado en foto con descripción
 * Similar a solicitarConfirmacion pero incluye datos de la imagen
 */
async function solicitarConfirmacionConFoto(
  phoneNumber: string,
  imageUrl: string,
  imageName: string,
  campoId: string,
  userId: string,
  parsedData: any
) {
  const tipo = parsedData.tipo
  const icono = ICONOS_EVENTO[tipo] || '📌'

  let mensaje = "*Entendí:*\n\n"

  switch (tipo) {
    case "LLUVIA":
      const mm = parsedData.milimetros || parsedData.cantidad || 0
      mensaje += `${icono} *Lluvia*\n• Cantidad: ${mm}mm`
      break
    case "NACIMIENTO":
      mensaje += `${icono} *Nacimiento*\n• Cantidad: ${parsedData.cantidad} ${parsedData.categoria}`
      if (parsedData.potrero) mensaje += `\n• Potrero: ${parsedData.potrero}`
      break
    case "MORTANDAD":
      mensaje += `${icono} *Mortandad*\n• Cantidad: ${parsedData.cantidad} ${parsedData.categoria}`
      if (parsedData.potrero) mensaje += `\n• Potrero: ${parsedData.potrero}`
      break
    case "HELADA":
      mensaje += `${icono} *Helada registrada*`
      break
    case "TRATAMIENTO":
      mensaje += `${icono} *Tratamiento*\n• Producto: ${parsedData.producto}`
      if (parsedData.categoria) {
        if (parsedData.cantidad) {
          mensaje += `\n• Aplicado a: ${parsedData.cantidad} ${parsedData.categoria}`
        } else {
          mensaje += `\n• Aplicado a: ${parsedData.categoria}`
        }
      }
      if (parsedData.potrero) mensaje += `\n• Potrero: ${parsedData.potrero}`
      break
    case "CONSUMO":
      mensaje += `🍖 *Consumo*\n• Cantidad: ${parsedData.cantidad} ${parsedData.categoria}`
      if (parsedData.potrero) mensaje += `\n• Potrero: ${parsedData.potrero}`
      break
    case "MANEJO":
      // Mostrar la descripción tal como la escribió el usuario
      mensaje += `${icono} *Manejo:* ${parsedData.descripcion}`
      break
    default:
      mensaje += `${icono} *${formatTipoEvento(tipo)}*`
      if (parsedData.cantidad) mensaje += `\n• Cantidad: ${parsedData.cantidad}`
      if (parsedData.categoria) mensaje += `\n• Categoría: ${parsedData.categoria}`
      if (parsedData.potrero) mensaje += `\n• Potrero: ${parsedData.potrero}`
  }

  mensaje += `\n📷 Con foto adjunta`

  // Guardar en pendingConfirmation con los datos de la imagen
  const dataConFoto = {
    ...parsedData,
    telefono: phoneNumber,
    imageUrl,
    imageName,
    campoId,
    userId,
    conFoto: true
  }

  await prisma.pendingConfirmation.upsert({
    where: { telefono: phoneNumber },
    create: {
      telefono: phoneNumber,
      data: JSON.stringify(dataConFoto),
    },
    update: {
      data: JSON.stringify(dataConFoto),
    }
  })

  // Enviar mensaje con botones de confirmación
  await sendWhatsAppMessageWithButtons(phoneNumber, mensaje)

  return true
}
