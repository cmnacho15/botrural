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
      // 🔥 FIX: GPT retorna "milimetros", no "cantidad"
      const mm = data.milimetros || data.cantidad || 0
      mensaje += `*Lluvia*\n• Cantidad: ${mm}mm`
      break
    case "NACIMIENTO":
  mensaje += `*Nacimiento*\n• Cantidad: ${data.cantidad} ${data.categoria}`
  if (data.potrero) mensaje += `\n• Potrero: ${data.potrero}`
  break
    case "MORTANDAD":
      mensaje += `*Mortandad*\n• Cantidad: ${data.cantidad} ${data.categoria}`
      if (data.potrero) mensaje += `\n• Potrero: ${data.potrero}`
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
      mensaje += `*Tratamiento*\n• Producto: ${data.producto}`
      if (data.cantidad) mensaje += `\n• Cantidad: ${data.cantidad} ${data.categoria || 'animales'}`
      if (data.categoria) mensaje += `\n• Categoría: ${data.categoria}`
      if (data.potrero) mensaje += `\n• Potrero: ${data.potrero}`
      break
    case "CONSUMO":
      mensaje += `*Consumo*\n• Cantidad: ${data.cantidad} ${data.categoria}`
      if (data.potrero) mensaje += `\n• Potrero: ${data.potrero}`
      break
    case "SIEMBRA":
      mensaje += `*Siembra*`
      if (data.cantidad) mensaje += `\n• Hectáreas: ${data.cantidad}`
      mensaje += `\n• Cultivo: ${data.cultivo}`
      if (data.lote) mensaje += `\n• Potrero: ${data.lote}`
      break
    case "MOVER_POTRERO_MODULO":
      mensaje += `*Mover Potrero a Módulo*\n• Potrero: ${data.nombrePotrero}\n• Módulo destino: ${data.moduloDestino}`
      break
  }

  // 🔥 FIX: Agregar teléfono al objeto data para que esté disponible al confirmar
  const dataWithPhone = {
    ...data,
    telefono: phone
  }

  await prisma.pendingConfirmation.create({
    data: {
      telefono: phone,
      data: JSON.stringify(dataWithPhone),
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
      } else if (data.tipo === "MOVER_POTRERO_MODULO") {
        const { handleMoverPotreroModuloConfirmacion } = await import("./moverPotreroModuloHandler")
        await handleMoverPotreroModuloConfirmacion(data)
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
  const potreroNombre = data.potrero || data.lote
  if (potreroNombre) {
    const lote = await prisma.lote.findFirst({
      where: {
        campoId: user.campoId,
        nombre: { contains: potreroNombre, mode: "insensitive" },
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
    // 🔥 FIX: usar milimetros (no cantidad)
    const milimetros = data.milimetros || data.cantidad || 0
    
    await prisma.evento.create({
      data: {
        tipo: "LLUVIA",
        descripcion: `Lluvia de ${milimetros}mm`,
        fecha: new Date(),
        cantidad: milimetros,  // Guardamos en cantidad para compatibilidad
        usuarioId: user.id,
        campoId: user.campoId,
      },
    })
  } else if (data.tipo === "NACIMIENTO") {
    // Convertir categoría a formato del sistema
    let categoriaGuardar = data.categoria
    if (data.categoria?.toLowerCase().includes('ternero')) {
      categoriaGuardar = 'Terneros nacidos'
    } else if (data.categoria?.toLowerCase().includes('cordero')) {
      categoriaGuardar = 'Corderos/as Mamones'
    }

    const cantidadNacidos = parseInt(data.cantidad) || 0

    console.log("🐣 NACIMIENTO DEBUG:", {
      loteId,
      potreroNombre,
      categoriaOriginal: data.categoria,
      categoriaGuardar,
      cantidad: cantidadNacidos,
      campoId: user.campoId
    })

    // 1) Crear el evento
    await prisma.evento.create({
      data: {
        tipo: "NACIMIENTO",
        descripcion: `Nacimiento de ${cantidadNacidos} ${data.categoria} en potrero ${data.potrero || 'sin especificar'}`,
        fecha: new Date(),
        cantidad: cantidadNacidos,
        categoria: categoriaGuardar,
        loteId,
        usuarioId: user.id,
        campoId: user.campoId,
      },
    })

    // 2) Actualizar stock de animales en AnimalLote
    if (loteId && cantidadNacidos > 0) {
      const animalExistente = await prisma.animalLote.findFirst({
        where: { 
          loteId, 
          categoria: categoriaGuardar,
          lote: { campoId: user.campoId } 
        },
      })

      if (animalExistente) {
        await prisma.animalLote.update({
          where: { id: animalExistente.id },
          data: { cantidad: animalExistente.cantidad + cantidadNacidos },
        })
      } else {
        await prisma.animalLote.create({
          data: { 
            categoria: categoriaGuardar, 
            cantidad: cantidadNacidos, 
            loteId 
          },
        })
      }

      console.log("✅ AnimalLote actualizado:", categoriaGuardar, cantidadNacidos)
    }
  } else if (data.tipo === "MORTANDAD") {
    const cantidadMuertos = parseInt(data.cantidad) || 0

    console.log("💀 MORTANDAD DEBUG:", {
      loteId,
      potreroNombre,
      categoria: data.categoria,
      cantidad: cantidadMuertos,
      campoId: user.campoId
    })

    // 1) Crear el evento
    await prisma.evento.create({
      data: {
        tipo: "MORTANDAD",
        descripcion: `Mortandad de ${cantidadMuertos} ${data.categoria} en potrero ${data.potrero || 'sin especificar'}`,
        fecha: new Date(),
        cantidad: cantidadMuertos,
        categoria: data.categoria,
        loteId,
        usuarioId: user.id,
        campoId: user.campoId,
      },
    })

    // 2) Restar del stock de animales en AnimalLote
    if (loteId && cantidadMuertos > 0 && data.categoria) {
      const animalExistente = await prisma.animalLote.findFirst({
        where: { 
          loteId, 
          categoria: data.categoria,
          lote: { campoId: user.campoId } 
        },
      })

      if (animalExistente) {
        const nuevaCantidad = Math.max(0, animalExistente.cantidad - cantidadMuertos)
        
        if (nuevaCantidad === 0) {
          await prisma.animalLote.delete({ where: { id: animalExistente.id } })
          console.log("🗑️ AnimalLote eliminado (cantidad llegó a 0)")
        } else {
          await prisma.animalLote.update({
            where: { id: animalExistente.id },
            data: { cantidad: nuevaCantidad },
          })
          console.log("✅ AnimalLote actualizado:", data.categoria, "→", nuevaCantidad)
        }
      } else {
        console.log("⚠️ No se encontró categoría", data.categoria, "en el potrero")
      }
    }
  } else if (data.tipo === "TRATAMIENTO") {
    const cantidadTratados = parseInt(data.cantidad) || 0
    
    console.log("💉 TRATAMIENTO DEBUG:", {
      loteId,
      potreroNombre,
      producto: data.producto,
      categoria: data.categoria,
      cantidad: cantidadTratados,
      campoId: user.campoId
    })

    // Buscar el potrero si se especificó
    let descripcionTratamiento = `Tratamiento: ${data.producto}`
    
    if (data.cantidad && data.categoria) {
      descripcionTratamiento += ` aplicado a ${cantidadTratados} ${data.categoria}`
    }
    
    if (potreroNombre) {
      descripcionTratamiento += ` en potrero ${potreroNombre}`
    }

    // Crear el evento
    await prisma.evento.create({
      data: {
        tipo: "TRATAMIENTO",
        descripcion: descripcionTratamiento,
        fecha: new Date(),
        cantidad: cantidadTratados > 0 ? cantidadTratados : null,
        categoria: data.categoria || null,
        loteId,
        usuarioId: user.id,
        campoId: user.campoId,
      },
    })

    console.log("✅ Tratamiento guardado:", descripcionTratamiento)
  } else if (data.tipo === "CONSUMO") {
    const cantidadConsumidos = parseInt(data.cantidad) || 0
    
    console.log("🍖 CONSUMO DEBUG:", {
      loteId,
      potreroNombre,
      categoria: data.categoria,
      cantidad: cantidadConsumidos,
      campoId: user.campoId
    })

    // Buscar el animalLote para poder crear el renglón
    const animalLote = loteId ? await prisma.animalLote.findFirst({
      where: { 
        loteId, 
        categoria: data.categoria,
        lote: { campoId: user.campoId } 
      },
    }) : null

    if (!animalLote) {
      throw new Error(`No se encontraron animales de ${data.categoria} en el potrero ${potreroNombre || 'especificado'}`)
    }

    if (animalLote.cantidad < cantidadConsumidos) {
      throw new Error(`Solo hay ${animalLote.cantidad} ${data.categoria} disponibles`)
    }

    // Determinar tipo de animal
    const categoriaLower = data.categoria.toLowerCase()
    let tipoAnimal = 'OTRO'
    if (categoriaLower.includes('vaca') || categoriaLower.includes('toro') || 
        categoriaLower.includes('novillo') || categoriaLower.includes('ternero')) {
      tipoAnimal = 'BOVINO'
    } else if (categoriaLower.includes('oveja') || categoriaLower.includes('carnero') || 
               categoriaLower.includes('cordero') || categoriaLower.includes('capón')) {
      tipoAnimal = 'OVINO'
    } else if (categoriaLower.includes('caballo') || categoriaLower.includes('yegua')) {
      tipoAnimal = 'EQUINO'
    }

    // Crear consumo completo en transacción
    await prisma.$transaction(async (tx) => {
      // 1. Crear el Consumo
      const consumo = await tx.consumo.create({
        data: {
          campoId: user.campoId,
          fecha: new Date(),
          descripcion: `Consumo de ${cantidadConsumidos} ${data.categoria}${potreroNombre ? ` en potrero ${potreroNombre}` : ''}`,
          notas: null,
        }
      })

      // 2. Crear el ConsumoRenglon (sin peso ni precio)
      await tx.consumoRenglon.create({
        data: {
          consumoId: consumo.id,
          tipoAnimal,
          categoria: data.categoria,
          cantidad: cantidadConsumidos,
          pesoPromedio: null,
          precioKgUSD: null,
          precioAnimalUSD: null,
          pesoTotalKg: null,
          valorTotalUSD: null,
          descontadoDeStock: true,
          animalLoteId: animalLote.id,
          fechaDescuento: new Date(),
        }
      })

      // 3. Descontar del stock
      const nuevaCantidad = animalLote.cantidad - cantidadConsumidos
      
      if (nuevaCantidad === 0) {
        await tx.animalLote.delete({
          where: { id: animalLote.id }
        })
        console.log("🗑️ AnimalLote eliminado (cantidad llegó a 0)")
      } else {
        await tx.animalLote.update({
          where: { id: animalLote.id },
          data: { cantidad: nuevaCantidad }
        })
        console.log("✅ AnimalLote actualizado:", data.categoria, "→", nuevaCantidad)
      }

      // 4. Actualizar ultimoCambio SOLO si el potrero quedó vacío
      if (loteId) {
        const loteActualizado = await tx.lote.findUnique({
          where: { id: loteId },
          include: { animalesLote: true }
        })
        
        if (loteActualizado && (!loteActualizado.animalesLote || loteActualizado.animalesLote.length === 0)) {
          await tx.lote.update({
            where: { id: loteId },
            data: { ultimoCambio: new Date() }
          })
        }
      }
    })

    console.log("✅ Consumo completo guardado en tabla Consumo y stock actualizado")
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