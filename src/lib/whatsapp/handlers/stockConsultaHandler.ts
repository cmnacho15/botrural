// src/lib/whatsapp/handlers/stockConsultaHandler.ts

import { prisma } from "@/lib/prisma"
import { sendWhatsAppMessage, sendCustomButtons } from "../services/messageService"
import { buscarPotreroEnLista } from "@/lib/potrero-helpers"

/**
 * FASE 1: Usuario pide ver stock de un potrero
 */
export async function handleStockConsulta(
  phoneNumber: string,
  nombrePotrero: string,
  campoId: string
) {
  try {
    // Buscar el potrero
    const potreros = await prisma.lote.findMany({
      where: { campoId },
      select: { id: true, nombre: true }
    })

    const potrero = buscarPotreroEnLista(nombrePotrero, potreros)

    if (!potrero) {
      const nombresDisponibles = potreros.map(p => p.nombre).join(', ')
      await sendWhatsAppMessage(
        phoneNumber,
        `No encontré el potrero "${nombrePotrero}".\n\nTus potreros son: ${nombresDisponibles}`
      )
      return
    }

    // Obtener stock del potrero
    const stock = await prisma.animalLote.findMany({
      where: { loteId: potrero.id },
      orderBy: { categoria: 'asc' }
    })

    if (stock.length === 0) {
      await sendWhatsAppMessage(
        phoneNumber,
        `El potrero *${potrero.nombre}* está vacío.\n\nNo hay animales registrados.`
      )
      return
    }

    // Formatear stock
    const stockTexto = stock
      .map(a => {
        const peso = a.peso ? ` (${a.peso.toFixed(0)}kg prom)` : ''
        return `• ${a.cantidad} ${a.categoria}${peso}`
      })
      .join('\n')

    const totalAnimales = stock.reduce((sum, a) => sum + a.cantidad, 0)

    const mensaje = 
      `*Stock de ${potrero.nombre}*\n\n` +
      `${stockTexto}\n\n` +
      `Total: *${totalAnimales} animales*\n\n` +
      `Para editar, enviá:\n` +
      `"Vacas 15" (reemplaza la cantidad)\n` +
      `"Novillos 0" (elimina la categoría)`

    // Guardar estado para permitir ediciones
    await prisma.pendingConfirmation.upsert({
      where: { telefono: phoneNumber },
      create: {
        telefono: phoneNumber,
        data: JSON.stringify({
          tipo: "STOCK_CONSULTA",
          loteId: potrero.id,
          loteNombre: potrero.nombre,
          stockActual: stock.map(a => ({
            categoria: a.categoria,
            cantidad: a.cantidad,
            peso: a.peso
          }))
        })
      },
      update: {
        data: JSON.stringify({
          tipo: "STOCK_CONSULTA",
          loteId: potrero.id,
          loteNombre: potrero.nombre,
          stockActual: stock.map(a => ({
            categoria: a.categoria,
            cantidad: a.cantidad,
            peso: a.peso
          }))
        })
      }
    })

    await sendWhatsAppMessage(phoneNumber, mensaje)

  } catch (error) {
    console.error("Error en handleStockConsulta:", error)
    await sendWhatsAppMessage(
      phoneNumber,
      "Error consultando el stock. Intentá de nuevo."
    )
  }
}

/**
 * FASE 2: Usuario edita una categoría
 */
export async function handleStockEdicion(
  phoneNumber: string,
  messageText: string  // ← CAMBIAR nombre del parámetro
): Promise<boolean> {  // ← AGREGAR tipo de retorno explícito
  try {
    // Obtener estado pendiente
    const pending = await prisma.pendingConfirmation.findUnique({
      where: { telefono: phoneNumber }
    })

    if (!pending) {
      return false // No hay consulta activa
    }

    const data = JSON.parse(pending.data)

    if (data.tipo !== "STOCK_CONSULTA") {
      return false // No es una consulta de stock
    }

    // Parsear edición: "Vacas 12" o "12 Vacas"
    const match = messageText.match(/^(\d+)\s+(.+)|(.+)\s+(\d+)$/i)

    if (!match) {
      return false // No es una edición válida
    }

    const cantidad = parseInt(match[1] || match[4])
    const categoriaTexto = (match[2] || match[3]).trim()

    // Buscar categoría en el stock actual
    const categoriaEncontrada = data.stockActual.find((a: any) => 
      a.categoria.toLowerCase().includes(categoriaTexto.toLowerCase()) ||
      categoriaTexto.toLowerCase().includes(a.categoria.toLowerCase())
    )

    if (!categoriaEncontrada) {
      await sendWhatsAppMessage(
        phoneNumber,
        `⚠️ "${categoriaTexto}" no está en este potrero.\n\nCategorías disponibles:\n` +
        data.stockActual.map((a: any) => `• ${a.categoria}`).join('\n')
      )
      return true
    }

    // Guardar cambio pendiente
    const cambiosPendientes = data.cambiosPendientes || []
    
    // Actualizar o agregar cambio
    const cambioExistente = cambiosPendientes.findIndex(
      (c: any) => c.categoria === categoriaEncontrada.categoria
    )

    if (cambioExistente >= 0) {
      cambiosPendientes[cambioExistente] = {
        categoria: categoriaEncontrada.categoria,
        cantidadOriginal: categoriaEncontrada.cantidad,
        cantidadNueva: cantidad
      }
    } else {
      cambiosPendientes.push({
        categoria: categoriaEncontrada.categoria,
        cantidadOriginal: categoriaEncontrada.cantidad,
        cantidadNueva: cantidad
      })
    }

    // Actualizar estado
    await prisma.pendingConfirmation.update({
      where: { telefono: phoneNumber },
      data: {
        data: JSON.stringify({
          ...data,
          cambiosPendientes
        })
      }
    })

    // Mostrar resumen de cambios
    const resumen = cambiosPendientes
      .map((c: any) => {
        if (c.cantidadNueva === 0) {
          return `• ${c.categoria}: ~~${c.cantidadOriginal}~~ → **ELIMINAR**`
        }
        return `• ${c.categoria}: ${c.cantidadOriginal} → **${c.cantidadNueva}**`
      })
      .join('\n')

    const mensaje = 
      `*Cambios pendientes en ${data.loteNombre}:*\n\n` +
      `${resumen}\n\n` +
      `¿Confirmar?`

    await sendCustomButtons(phoneNumber, mensaje, [
      { id: "stock_confirm", title: "✅ Confirmar" },
      { id: "stock_cancel", title: "❌ Cancelar" }
    ])

    return true

  } catch (error) {
    console.error("Error en handleStockEdicion:", error)
    return false
  }
}

/**
 * FASE 3: Botones de confirmación
 */
export async function handleStockButtonResponse(
  phoneNumber: string,
  buttonId: string
) {
  const pending = await prisma.pendingConfirmation.findUnique({
    where: { telefono: phoneNumber }
  })

  if (!pending) {
    await sendWhatsAppMessage(phoneNumber, "No hay operación pendiente.")
    return
  }

  const data = JSON.parse(pending.data)

  if (data.tipo !== "STOCK_CONSULTA") {
    await sendWhatsAppMessage(phoneNumber, "Usá los botones correspondientes.")
    return
  }

  if (buttonId === "stock_cancel") {
    await sendWhatsAppMessage(phoneNumber, "❌ Cambios cancelados.")
    await prisma.pendingConfirmation.delete({ where: { telefono: phoneNumber } })
    return
  }

  if (buttonId === "stock_confirm") {
    try {
      // Aplicar cambios
      await prisma.$transaction(async (tx) => {
        for (const cambio of data.cambiosPendientes) {
          const animalLote = await tx.animalLote.findFirst({
            where: {
              loteId: data.loteId,
              categoria: cambio.categoria
            }
          })

          if (!animalLote) continue

          if (cambio.cantidadNueva === 0) {
            // Eliminar
            await tx.animalLote.delete({
              where: { id: animalLote.id }
            })
          } else {
            // Actualizar
            await tx.animalLote.update({
              where: { id: animalLote.id },
              data: { cantidad: cambio.cantidadNueva }
            })
          }
        }
      })

      await sendWhatsAppMessage(
        phoneNumber,
        `✅ Stock de *${data.loteNombre}* actualizado correctamente.`
      )

      await prisma.pendingConfirmation.delete({ where: { telefono: phoneNumber } })

    } catch (error) {
      console.error("Error aplicando cambios de stock:", error)
      await sendWhatsAppMessage(
        phoneNumber,
        "❌ Error aplicando los cambios. Intentá de nuevo."
      )
    }
  }
}