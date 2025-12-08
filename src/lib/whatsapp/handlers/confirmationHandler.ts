// src/lib/whatsapp/handlers/confirmationHandler.ts

import { prisma } from "@/lib/prisma"
import { getUSDToUYU } from "@/lib/currency"
import { sendWhatsAppMessage, sendWhatsAppMessageWithButtons } from "../services/messageService"
import { ejecutarCambioPotrero } from "./potreroHandler"
import { handleAwaitingInvoiceType } from "./imageHandler"

/**
 * Solicita confirmación para datos de texto/audio (excepto CAMBIO_POTRERO que tiene su propio flujo)
 */
export async function solicitarConfirmacion(phone: string, data: any) {
  let mensaje = "*Entendí:*\n\n"

  switch (data.tipo) {
    case "LLUVIA":
      mensaje += `*Lluvia*\n• Cantidad: ${data.cantidad}mm`
      break
    case "NACIMIENTO":
      mensaje += `*Nacimiento*\n• Cantidad: ${data.cantidad} ${data.categoria}`
      if (data.lote) mensaje += `\n• Potrero: ${data.lote}`
      break
    case "MORTANDAD":
      mensaje += `*Mortandad*\n• Cantidad: ${data.cantidad} ${data.categoria}`
      if (data.lote) mensaje += `\n• Potrero: ${data.lote}`
      break
    case "GASTO":
      mensaje += `*Gasto*\n• Monto: $${data.monto}\n• Concepto: ${data.descripcion}\n• Categoría: ${data.categoria}`

      if (data.proveedor) {
        mensaje += `\n• Proveedor: ${data.proveedor}`
      }

      if (data.metodoPago === "Plazo") {
        mensaje += `\n• Pago: A plazo (${data.diasPlazo} días)`
        mensaje += `\n• Estado: ${data.pagado ? "Pagado" : "Pendiente"}`
      } else {
        mensaje += `\n• Pago: Contado`
      }
      break
    case "TRATAMIENTO":
      mensaje += `*Tratamiento*\n• Cantidad: ${data.cantidad}\n• Producto: ${data.producto}`
      if (data.lote) mensaje += `\n• Potrero: ${data.lote}`
      break
    case "SIEMBRA":
      mensaje += `*Siembra*`
      if (data.cantidad) mensaje += `\n• Hectáreas: ${data.cantidad}`
      mensaje += `\n• Cultivo: ${data.cultivo}`
      if (data.lote) mensaje += `\n• Potrero: ${data.lote}`
      break
  }

  await prisma.pendingConfirmation.create({
    data: {
      telefono: phone,
      data: JSON.stringify(data),
    },
  })

  await sendWhatsAppMessageWithButtons(phone, mensaje)
}

/**
 * Maneja la respuesta del usuario a una confirmación pendiente
 */
export async function handleConfirmacion(
  phone: string,
  respuesta: string,
  confirmacion: any
) {
  const respuestaLower = respuesta.toLowerCase().trim()
  const data = JSON.parse(confirmacion.data)

  // ✅ CRÍTICO: Manejar primero las respuestas de tipo de factura
  if (data.tipo === "AWAITING_INVOICE_TYPE") {
    const wasHandled = await handleAwaitingInvoiceType(phone, respuesta, confirmacion)
    if (wasHandled) return // ⚠️ IMPORTANTE: salir aquí para evitar doble procesamiento
  }

  // Validación: no usar texto para confirmar facturas con botones
  if (data.tipo === "INVOICE") {
    await sendWhatsAppMessage(
      phone,
      "Para la factura usá los botones de confirmación que te envié."
    )
    return
  }

  if (
    respuestaLower === "confirmar" ||
    respuestaLower === "si" ||
    respuestaLower === "sí" ||
    respuestaLower === "yes" ||
    respuesta === "btn_confirmar"
  ) {
    try {
      if (data.tipo === "CAMBIO_POTRERO") {
        await ejecutarCambioPotrero(data)
      } else {
        await handleDataEntry(data)
      }
      await sendWhatsAppMessage(
        phone,
        "✅ *Dato guardado correctamente* en el sistema."
      )
    } catch (error) {
      console.error("Error guardando dato:", error)
      await sendWhatsAppMessage(
        phone,
        "❌ Error al guardar el dato. Intenta de nuevo."
      )
    }

    await prisma.pendingConfirmation
      .delete({
        where: { telefono: phone },
      })
      .catch(() => {})

    return
  }

  if (
    respuestaLower === "editar" ||
    respuestaLower === "modificar" ||
    respuesta === "btn_editar"
  ) {
    await sendWhatsAppMessage(
      phone,
      "Ok, enviame los datos corregidos.\n\nEjemplo:\n• llovieron 30mm\n• nacieron 5 terneros\n• moví 10 vacas del norte al sur"
    )

    await prisma.pendingConfirmation
      .delete({
        where: { telefono: phone },
      })
      .catch(() => {})

    return
  }

  if (
    respuestaLower === "cancelar" ||
    respuestaLower === "no" ||
    respuesta === "btn_cancelar"
  ) {
    await sendWhatsAppMessage(
      phone,
      "❌ Dato cancelado. Podés enviar uno nuevo cuando quieras."
    )

    await prisma.pendingConfirmation
      .delete({
        where: { telefono: phone },
      })
      .catch(() => {})

    return
  }

  await sendWhatsAppMessage(
    phone,
    "Por favor selecciona una opción:\n• *Confirmar* - para guardar\n• *Editar* - para corregir\n• *Cancelar* - para descartar"
  )
}

/**
 * Guarda el dato confirmado en la base de datos
 */
async function handleDataEntry(data: any) {
  const user = await prisma.user.findUnique({
    where: { telefono: data.telefono },
    select: { id: true, campoId: true },
  })

  if (!user || !user.campoId) {
    throw new Error("Usuario no encontrado")
  }

  let loteId: string | null = null
  if (data.lote) {
    const lote = await prisma.lote.findFirst({
      where: {
        campoId: user.campoId,
        nombre: { contains: data.lote, mode: "insensitive" },
      },
      select: { id: true },
    })
    loteId = lote?.id || null
  }

  if (data.tipo === "GASTO") {
    const moneda = data.moneda === "USD" ? "USD" : "UYU"
    const montoOriginal = data.monto ?? 0

    let tasaCambio: number | null = null
    let montoEnUYU = montoOriginal
    let montoEnUSD = montoOriginal

    if (moneda === "USD") {
      try {
        tasaCambio = await getUSDToUYU()
      } catch (err) {
        console.log("Error obteniendo dólar → uso 40 por defecto")
        tasaCambio = 40
      }
      montoEnUYU = montoOriginal * tasaCambio
      montoEnUSD = montoOriginal
    } else {
      try {
        tasaCambio = await getUSDToUYU()
        montoEnUSD = montoOriginal / tasaCambio
      } catch (err) {
        montoEnUSD = montoOriginal / 40
      }
    }

    await prisma.gasto.create({
      data: {
        tipo: "GASTO",
        fecha: new Date(),
        descripcion: data.descripcion,
        categoria: data.categoria || "Otros",
        campoId: user.campoId,
        metodoPago: data.metodoPago || "Contado",
        diasPlazo:
          data.metodoPago === "Plazo"
            ? data.diasPlazo ?? null
            : null,
        pagado:
          data.metodoPago === "Plazo"
            ? (data.pagado !== undefined ? data.pagado : false)
            : true,
        proveedor: data.proveedor || null,
        iva: data.iva ?? null,
        moneda,
        montoOriginal,
        tasaCambio,
        montoEnUYU,
        montoEnUSD,
        especie: null,
        monto: montoEnUYU,
      },
    })

    return
  } else if (data.tipo === "LLUVIA") {
    await prisma.evento.create({
      data: {
        tipo: "LLUVIA",
        descripcion: data.descripcion,
        fecha: new Date(),
        cantidad: data.cantidad,
        usuarioId: user.id,
        campoId: user.campoId,
      },
    })
  } else {
    await prisma.evento.create({
      data: {
        tipo: data.tipo,
        descripcion: data.descripcion || `${data.tipo} registrado`,
        fecha: new Date(),
        cantidad: data.cantidad || null,
        categoria: data.categoria || null,
        loteId,
        usuarioId: user.id,
        campoId: user.campoId,
      },
    })
  }

  console.log(`Dato guardado: ${data.tipo}`)
}