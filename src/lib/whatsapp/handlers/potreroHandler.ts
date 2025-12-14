// src/lib/whatsapp/handlers/potreroHandler.ts

import { prisma } from "@/lib/prisma"
import { 
  buscarPotreroEnLista,  // 🆕 Nueva función
  buscarAnimalesEnPotrero, 
  obtenerNombresPotreros 
} from "@/lib/potrero-helpers"
import { sendWhatsAppMessage } from "../services/messageService"
import { sendWhatsAppMessageWithButtons } from "../services/messageService"

export async function handleCambioPotrero(phoneNumber: string, data: any) {
  try {
    const user = await prisma.user.findUnique({
      where: { telefono: phoneNumber },
      select: { id: true, campoId: true },
    })

    if (!user || !user.campoId) {
      await sendWhatsAppMessage(
        phoneNumber,
        "No encontré tu cuenta. Registrate primero."
      )
      return
    }

    const { cantidad, categoria, loteOrigen, loteDestino } = data

    if (!categoria) {
      await sendWhatsAppMessage(
        phoneNumber,
        "No entendí qué animales querés mover.\n\nEjemplo: *moví 10 vacas del potrero norte al sur*"
      )
      return
    }

    if (!loteOrigen || !loteDestino) {
      await sendWhatsAppMessage(
        phoneNumber,
        "No entendí los potreros.\n\nEjemplo: *moví 10 vacas del potrero norte al sur*"
      )
      return
    }

    // 🔍 Obtener lista de potreros UNA SOLA VEZ
    const potreros = await prisma.lote.findMany({
      where: { campoId: user.campoId },
      select: { id: true, nombre: true },
    })

    // 🔍 Buscar potreros en la lista (sin más queries a BD)
    const potreroOrigen = buscarPotreroEnLista(loteOrigen, potreros)
    
    if (!potreroOrigen) {
      const nombresDisponibles = potreros.map(p => p.nombre).join(', ')
      await sendWhatsAppMessage(
        phoneNumber,
        `No encontré el potrero "${loteOrigen}".\n\n` +
        `Tus potreros son: ${nombresDisponibles}`
      )
      return
    }

    const potreroDestino = buscarPotreroEnLista(loteDestino, potreros)
    
    if (!potreroDestino) {
      const nombresDisponibles = potreros.map(p => p.nombre).join(', ')
      await sendWhatsAppMessage(
        phoneNumber,
        `No encontré el potrero "${loteDestino}".\n\n` +
        `Tus potreros son: ${nombresDisponibles}`
      )
      return
    }

    if (potreroOrigen.id === potreroDestino.id) {
      await sendWhatsAppMessage(
        phoneNumber,
        "El potrero origen y destino son el mismo."
      )
      return
    }

    const resultadoBusqueda = await buscarAnimalesEnPotrero(categoria, potreroOrigen.id, user.campoId)
    
    if (!resultadoBusqueda.encontrado) {
      if (resultadoBusqueda.opciones && resultadoBusqueda.opciones.length > 0) {
        const opcionesTexto = resultadoBusqueda.opciones
          .map(o => `• ${o.cantidad} ${o.categoria}`)
          .join('\n')
        
        await sendWhatsAppMessage(
          phoneNumber,
          `${resultadoBusqueda.mensaje}\n\n` +
          `En "${potreroOrigen.nombre}" hay:\n${opcionesTexto}\n\n` +
          `Especificá cuál querés mover.`
        )
      } else {
        await sendWhatsAppMessage(
          phoneNumber,
          `${resultadoBusqueda.mensaje || `No hay "${categoria}" en el potrero "${potreroOrigen.nombre}".`}`
        )
      }
      return
    }

    const animalesOrigen = resultadoBusqueda.animal!

    let cantidadMover = cantidad ? parseInt(cantidad) : animalesOrigen.cantidad
    
    if (cantidadMover <= 0) {
      await sendWhatsAppMessage(
        phoneNumber,
        "La cantidad debe ser mayor a 0."
      )
      return
    }

    if (cantidadMover > animalesOrigen.cantidad) {
      await sendWhatsAppMessage(
        phoneNumber,
        `No hay suficientes animales.\n\n` +
        `Solo hay *${animalesOrigen.cantidad} ${animalesOrigen.categoria}* en "${potreroOrigen.nombre}".\n\n` +
        `¿Querés mover los ${animalesOrigen.cantidad}?`
      )
      return
    }

    const confirmationData = {
      tipo: "CAMBIO_POTRERO",
      cantidad: cantidadMover,
      categoria: animalesOrigen.categoria,
      loteId: potreroOrigen.id,
      loteDestinoId: potreroDestino.id,
      loteOrigenNombre: potreroOrigen.nombre,
      loteDestinoNombre: potreroDestino.nombre,
      cantidadDisponible: animalesOrigen.cantidad,
      telefono: phoneNumber,
    }

    await prisma.pendingConfirmation.upsert({
      where: { telefono: phoneNumber },
      create: {
        telefono: phoneNumber,
        data: JSON.stringify(confirmationData),
      },
      update: {
        data: JSON.stringify(confirmationData),
      },
    })

    const mensaje = 
      `*Cambio de Potrero*\n\n` +
      `*${cantidadMover} ${animalesOrigen.categoria}*\n` +
      `De: *${potreroOrigen.nombre}*\n` +
      `A: *${potreroDestino.nombre}*\n\n` +
      (cantidadMover < animalesOrigen.cantidad 
        ? `Quedarán ${animalesOrigen.cantidad - cantidadMover} ${animalesOrigen.categoria} en ${potreroOrigen.nombre}\n\n`
        : '') +
      `¿Confirmar?`

    await sendWhatsAppMessageWithButtons(phoneNumber, mensaje)

  } catch (error) {
    console.error("Error en handleCambioPotrero:", error)
    await sendWhatsAppMessage(
      phoneNumber,
      "Error procesando el cambio de potrero. Intentá de nuevo."
    )
  }
}

export async function ejecutarCambioPotrero(data: any) {
  const user = await prisma.user.findUnique({
    where: { telefono: data.telefono },
    select: { id: true, campoId: true },
  })

  if (!user || !user.campoId) {
    throw new Error("Usuario no encontrado")
  }

  // 🔒 USAR TRANSACCIÓN para evitar race conditions
  await prisma.$transaction(async (tx) => {
    const animalOrigen = await tx.animalLote.findFirst({
      where: { 
        loteId: data.loteId, 
        categoria: data.categoria,
        lote: { campoId: user.campoId }
      },
    })

    if (!animalOrigen || animalOrigen.cantidad < data.cantidad) {
      throw new Error("No hay suficientes animales")
    }

    const nuevaCantidadOrigen = animalOrigen.cantidad - data.cantidad
    
    if (nuevaCantidadOrigen === 0) {
      await tx.animalLote.delete({ where: { id: animalOrigen.id } })
    } else {
      await tx.animalLote.update({
        where: { id: animalOrigen.id },
        data: { cantidad: nuevaCantidadOrigen },
      })
    }

    const animalDestino = await tx.animalLote.findFirst({
      where: { 
        loteId: data.loteDestinoId, 
        categoria: data.categoria,
        lote: { campoId: user.campoId }
      },
    })

    if (animalDestino) {
      await tx.animalLote.update({
        where: { id: animalDestino.id },
        data: { cantidad: animalDestino.cantidad + data.cantidad },
      })
    } else {
      await tx.animalLote.create({
        data: {
          categoria: data.categoria,
          cantidad: data.cantidad,
          loteId: data.loteDestinoId,
        },
      })
    }

    await tx.lote.update({
      where: { id: data.loteId },
      data: { ultimoCambio: new Date() },
    })

    await tx.lote.update({
      where: { id: data.loteDestinoId },
      data: { ultimoCambio: new Date() },
    })

    const descripcion = `Cambio de ${data.cantidad} ${data.categoria} del potrero "${data.loteOrigenNombre}" al potrero "${data.loteDestinoNombre}".`

    await tx.evento.create({
      data: {
        tipo: "CAMBIO_POTRERO",
        descripcion,
        fecha: new Date(),
        cantidad: data.cantidad,
        categoria: data.categoria,
        loteId: data.loteId,
        loteDestinoId: data.loteDestinoId,
        usuarioId: user.id,
        campoId: user.campoId,
        origenSnig: "BOT",
      },
    })

    console.log(`✅ Cambio de potrero ejecutado: ${descripcion}`)
  })
}