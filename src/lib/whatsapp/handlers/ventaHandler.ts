// src/lib/whatsapp/handlers/ventaHandler.ts

import { prisma } from "@/lib/prisma"
import { processVentaImage, mapearCategoriaVenta } from "@/lib/vision-venta-parser"
import { buscarPotrerosConCategoria } from "@/lib/potrero-helpers"
import { sendWhatsAppMessage, sendCustomButtons } from "../services/messageService"

/**
 * Procesa una imagen de factura de VENTA
 */
export async function handleVentaImage(
  phoneNumber: string,
  imageUrl: string,
  imageName: string,
  campoId: string,
  caption: string
) {
  try {
    const ventaData = await processVentaImage(imageUrl)
    if (!ventaData || !ventaData.renglones?.length) {
      await sendWhatsAppMessage(phoneNumber, "No pude leer la factura de venta. ¿La imagen está clara?")
      return
    }

    await prisma.pendingConfirmation.upsert({
      where: { telefono: phoneNumber },
      create: { 
        telefono: phoneNumber, 
        data: JSON.stringify({ 
          tipo: "VENTA", 
          ventaData, 
          imageUrl, 
          imageName, 
          campoId 
        }) 
      },
      update: { 
        data: JSON.stringify({ 
          tipo: "VENTA", 
          ventaData, 
          imageUrl, 
          imageName, 
          campoId 
        }) 
      },
    })

    await sendVentaConfirmation(phoneNumber, ventaData)
  } catch (error) {
    console.error("Error en handleVentaImage:", error)
    await sendWhatsAppMessage(phoneNumber, "Error procesando la factura de venta.")
  }
}

/**
 * Envía confirmación de venta con botones
 */
async function sendVentaConfirmation(phoneNumber: string, data: any) {
  const renglonesText = data.renglones
    .map((r: any, i: number) => 
      `${i + 1}. ${r.cantidad} ${r.categoria} - ${r.pesoPromedio?.toFixed(1) || 0}kg @ $${r.precioKgUSD?.toFixed(2) || 0}/kg = $${r.importeBrutoUSD?.toFixed(2) || 0}`
    )
    .join("\n")

  const bodyText =
    `*VENTA DE HACIENDA*\n\n` +
    `${data.fecha}\n` +
    `*${data.comprador}*\n` +
    `${data.productor}\n` +
    (data.nroFactura ? `Fact: ${data.nroFactura}\n` : "") +
    (data.nroTropa ? `Tropa: ${data.nroTropa}\n` : "") +
    `\n*Detalle:*\n${renglonesText}\n\n` +
    `${data.cantidadTotal} animales, ${data.pesoTotalKg?.toFixed(1) || 0} kg\n` +
    `Subtotal: $${data.subtotalUSD?.toFixed(2) || 0}\n` +
    `Impuestos: -$${data.totalImpuestosUSD?.toFixed(2) || 0}\n` +
    `*TOTAL: $${data.totalNetoUSD?.toFixed(2) || 0} USD*\n\n` +
    `¿Guardar?`

  await sendCustomButtons(phoneNumber, bodyText, [
    { id: "venta_confirm", title: "Confirmar" },
    { id: "venta_cancel", title: "Cancelar" },
  ])
}

/**
 * Maneja respuesta a botones de venta
 */
export async function handleVentaButtonResponse(phoneNumber: string, buttonId: string) {
  const pending = await prisma.pendingConfirmation.findUnique({ 
    where: { telefono: phoneNumber } 
  })
  
  if (!pending) {
    await sendWhatsAppMessage(phoneNumber, "No hay venta pendiente.")
    return
  }

  const savedData = JSON.parse(pending.data)
  if (savedData.tipo !== "VENTA") {
    await sendWhatsAppMessage(phoneNumber, "Usá los botones de la factura.")
    return
  }

  const action = buttonId.replace("venta_", "")

  if (action === "confirm") {
    await guardarVentaEnBD(savedData, phoneNumber)
  } else {
    await sendWhatsAppMessage(phoneNumber, "Venta cancelada.")
    await prisma.pendingConfirmation.delete({ where: { telefono: phoneNumber } })
  }
}

/**
 * Guarda la venta en la base de datos
 */
async function guardarVentaEnBD(savedData: any, phoneNumber: string) {
  try {
    const { ventaData, imageUrl, imageName, campoId } = savedData

    console.log("ventaData recibida:", JSON.stringify(ventaData, null, 2))

    const user = await prisma.user.findUnique({ 
      where: { telefono: phoneNumber }, 
      select: { id: true } 
    })

    const venta = await prisma.venta.create({
      data: {
        campoId,
        fecha: new Date(ventaData.fecha),
        comprador: ventaData.comprador,
        consignatario: ventaData.consignatario || null,
        nroTropa: ventaData.nroTropa || null,
        nroFactura: ventaData.nroFactura || null,
        metodoPago: ventaData.metodoPago || "Contado",
        diasPlazo: ventaData.diasPlazo || null,
        pagado: ventaData.metodoPago === "Contado",
        moneda: "USD",
        tasaCambio: ventaData.tipoCambio || null,
        subtotalUSD: ventaData.subtotalUSD,
        totalImpuestosUSD: ventaData.totalImpuestosUSD || 0,
        totalNetoUSD: ventaData.totalNetoUSD,
        imageUrl,
        imageName,
        impuestos: ventaData.impuestos || null,
        notas: "Venta desde WhatsApp",
      },
    })

    // Crear renglones
    const renglonesCreados: Array<{ id: string; categoria: string; cantidad: number }> = []
    
    for (const r of ventaData.renglones) {
      const mapped = mapearCategoriaVenta(r.categoria)
      const renglon = await prisma.ventaRenglon.create({
        data: {
          ventaId: venta.id,
          tipo: "GANADO",
          tipoAnimal: r.tipoAnimal || mapped.tipoAnimal,
          categoria: mapped.categoria,
          raza: r.raza || null,
          cantidad: r.cantidad,
          pesoPromedio: r.pesoPromedio,
          precioKgUSD: r.precioKgUSD,
          precioAnimalUSD: r.pesoPromedio * r.precioKgUSD,
          pesoTotalKg: r.pesoTotalKg,
          importeBrutoUSD: r.importeBrutoUSD,
          descontadoDeStock: false,
        },
      })
      renglonesCreados.push({ 
        id: renglon.id, 
        categoria: mapped.categoria, 
        cantidad: r.cantidad 
      })
    }

    await prisma.evento.create({
      data: {
        tipo: "VENTA",
        descripcion: `Venta a ${ventaData.comprador}: ${ventaData.cantidadTotal} animales`,
        fecha: new Date(ventaData.fecha),
        cantidad: ventaData.cantidadTotal,
        monto: ventaData.totalNetoUSD,
        comprador: ventaData.comprador,
        campoId,
        usuarioId: user?.id || null,
        origenSnig: "BOT",
      },
    })

    await prisma.pendingConfirmation.delete({ where: { telefono: phoneNumber } })

    await sendWhatsAppMessage(
      phoneNumber,
      `✅ *Venta guardada!*\n\n${ventaData.cantidadTotal} animales\n$${ventaData.totalNetoUSD?.toFixed(2)} USD`
    )

    // Preguntar por descuento de stock para cada categoría
    await preguntarDescuentoStock(phoneNumber, campoId, renglonesCreados, venta.id)

  } catch (error) {
    console.error("Error guardando venta:", error)
    await sendWhatsAppMessage(phoneNumber, "Error guardando la venta.")
  }
}

/**
 * Pregunta de qué potrero descontar animales vendidos
 */
async function preguntarDescuentoStock(
  phoneNumber: string,
  campoId: string,
  renglones: Array<{ id: string; categoria: string; cantidad: number }>,
  ventaId: string
) {
  // Tomar el primer renglón pendiente
  const renglon = renglones[0]
  if (!renglon) return

  const potreros = await buscarPotrerosConCategoria(renglon.categoria, campoId)

  if (potreros.length === 0) {
    await sendWhatsAppMessage(
      phoneNumber,
      `No encontré ${renglon.categoria} en ningún potrero. Descontá manualmente desde la web.`
    )
    if (renglones.length > 1) {
      await preguntarDescuentoStock(phoneNumber, campoId, renglones.slice(1), ventaId)
    }
    return
  }

  const totalDisponible = potreros.reduce((sum, p) => sum + p.cantidad, 0)

  if (totalDisponible < renglon.cantidad) {
    await sendWhatsAppMessage(
      phoneNumber,
      `Solo hay ${totalDisponible} ${renglon.categoria} en total, pero vendiste ${renglon.cantidad}. Revisá el stock en la web.`
    )
    if (renglones.length > 1) {
      await preguntarDescuentoStock(phoneNumber, campoId, renglones.slice(1), ventaId)
    }
    return
  }

  // Guardar estado pendiente
  await prisma.pendingConfirmation.upsert({
    where: { telefono: phoneNumber },
    create: {
      telefono: phoneNumber,
      data: JSON.stringify({
        tipo: "DESCUENTO_STOCK",
        ventaId,
        renglonId: renglon.id,
        categoria: renglon.categoria,
        cantidadVendida: renglon.cantidad,
        potreros,
        campoId,
        renglonesPendientes: renglones.slice(1),
      }),
    },
    update: {
      data: JSON.stringify({
        tipo: "DESCUENTO_STOCK",
        ventaId,
        renglonId: renglon.id,
        categoria: renglon.categoria,
        cantidadVendida: renglon.cantidad,
        potreros,
        campoId,
        renglonesPendientes: renglones.slice(1),
      }),
    },
  })

  if (potreros.length === 1) {
    const p = potreros[0]
    await sendCustomButtons(
      phoneNumber,
      `*Descontar ${renglon.cantidad} ${renglon.categoria}*\n\nDel potrero *${p.loteNombre}* (tiene ${p.cantidad})\n\n¿Confirmar?`,
      [
        { id: `stock_confirm_${p.loteId}`, title: "Confirmar" },
        { id: "stock_skip", title: "Omitir" },
      ]
    )
  } else {
    const botones = potreros.slice(0, 3).map(p => ({
      id: `stock_confirm_${p.loteId}`,
      title: `${p.loteNombre} (${p.cantidad})`.slice(0, 20),
    }))

    const mensaje =
      `*Descontar ${renglon.cantidad} ${renglon.categoria}*\n\n` +
      `¿De qué potrero?\n` +
      potreros.map(p => `• ${p.loteNombre}: ${p.cantidad}`).join('\n') +
      `\n\nElegí uno:`

    await sendCustomButtons(phoneNumber, mensaje, botones)
  }
}

/**
 * Maneja respuesta a botones de descuento de stock
 */
export async function handleStockButtonResponse(phoneNumber: string, buttonId: string) {
  const pending = await prisma.pendingConfirmation.findUnique({ 
    where: { telefono: phoneNumber } 
  })
  
  if (!pending) {
    await sendWhatsAppMessage(phoneNumber, "No hay operación pendiente.")
    return
  }

  const data = JSON.parse(pending.data)
  if (data.tipo !== "DESCUENTO_STOCK") {
    await sendWhatsAppMessage(phoneNumber, "Usá los botones correspondientes.")
    return
  }

  if (buttonId === "stock_skip") {
    await sendWhatsAppMessage(
      phoneNumber, 
      `Omitido. Descontá ${data.categoria} desde la web.`
    )
    await prisma.pendingConfirmation.delete({ where: { telefono: phoneNumber } })
    
    if (data.renglonesPendientes?.length > 0) {
      await preguntarDescuentoStock(
        phoneNumber, 
        data.campoId, 
        data.renglonesPendientes, 
        data.ventaId
      )
    }
    return
  }

  const loteId = buttonId.replace("stock_confirm_", "")
  const potrero = data.potreros.find((p: any) => p.loteId === loteId)

  if (!potrero) {
    await sendWhatsAppMessage(phoneNumber, "Potrero no encontrado.")
    return
  }

  try {
    const animalLote = await prisma.animalLote.findFirst({
      where: { loteId, categoria: potrero.categoria },
    })

    if (!animalLote || animalLote.cantidad < data.cantidadVendida) {
      await sendWhatsAppMessage(
        phoneNumber, 
        `No hay suficientes ${data.categoria} en ${potrero.loteNombre}.`
      )
      return
    }

    const nuevaCantidad = animalLote.cantidad - data.cantidadVendida

    if (nuevaCantidad === 0) {
      await prisma.animalLote.delete({ where: { id: animalLote.id } })
    } else {
      await prisma.animalLote.update({
        where: { id: animalLote.id },
        data: { cantidad: nuevaCantidad },
      })
    }

    await prisma.ventaRenglon.update({
      where: { id: data.renglonId },
      data: { descontadoDeStock: true, animalLoteId: animalLote.id },
    })

    await sendWhatsAppMessage(
      phoneNumber,
      `✅ Descontado: ${data.cantidadVendida} ${data.categoria} de *${potrero.loteNombre}*\n(Quedan ${nuevaCantidad})`
    )

    await prisma.pendingConfirmation.delete({ where: { telefono: phoneNumber } })

    if (data.renglonesPendientes?.length > 0) {
      await preguntarDescuentoStock(
        phoneNumber, 
        data.campoId, 
        data.renglonesPendientes, 
        data.ventaId
      )
    }

  } catch (error) {
    console.error("Error descontando stock:", error)
    await sendWhatsAppMessage(phoneNumber, "Error descontando del stock.")
  }
}