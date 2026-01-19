// src/lib/whatsapp/handlers/confirmationHandler.ts

import { prisma } from "@/lib/prisma"
import { getUSDToUYU } from "@/lib/currency"
import { sendWhatsAppMessage, sendWhatsAppMessageWithButtons } from "../services/messageService"
import { ejecutarCambioPotrero } from "./potreroHandler"
import { handleAwaitingInvoiceType } from "./imageHandler"
import { confirmarDAO } from "./daoHandler"

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
      // TRATAMIENTO ahora se maneja con su propio handler
      // No hacer nada aquí, el bot-webhook ya llamó a handleTratamiento
      return
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

  // 🆕 Manejar selección de potrero para stock
  if (data.tipo === "ELEGIR_POTRERO_STOCK") {
    const numero = parseInt(respuesta.trim())
    
    if (isNaN(numero)) {
      await sendWhatsAppMessage(phone, "❌ Escribí el número del potrero que querés consultar.")
      return
    }
    
    // Importar dinámicamente el handler
    const { handleSeleccionPotreroStock } = await import("./stockConsultaHandler")
    
    // Obtener campoId del usuario
    const usuario = await prisma.user.findUnique({
      where: { telefono: phone },
      select: { campoId: true }
    })
    
    if (!usuario?.campoId) {
      await sendWhatsAppMessage(phone, "❌ No tenés un campo configurado.")
      return
    }
    
    await handleSeleccionPotreroStock(phone, numero, data.opciones, usuario.campoId)
    return // 🔥 IMPORTANTE: salir aquí
  }

  // 🆕 Manejar selección de potrero para DAO
  if (data.tipo === "ELEGIR_POTRERO_DAO") {
    const numero = parseInt(respuesta.trim())
    
    if (isNaN(numero) || numero < 1 || numero > data.opciones.length) {
      await sendWhatsAppMessage(phone, "❌ Número inválido. Escribí el número del potrero.")
      return
    }
    
    const potreroSeleccionado = data.opciones[numero - 1]
    
    // Llamar a handleDAO nuevamente con el potrero específico
    const { handleDAO } = await import("./daoHandler")
    await handleDAO(phone, {
      potrero: potreroSeleccionado.nombre,
      categoria: data.categoria,
      prenado: data.prenado,
      ciclando: data.ciclando,
      anestroSuperficial: data.anestroSuperficial,
      anestroProfundo: data.anestroProfundo,
      _potreroId: potreroSeleccionado.id
    })

    // 🔥 NO borrar la confirmación aquí - handleDAO crea una nueva
    return
  }

  // 🆕 Manejar selección de potrero para TACTO
  if (data.tipo === "ELEGIR_POTRERO_TACTO") {
    const numero = parseInt(respuesta.trim())
    
    if (isNaN(numero) || numero < 1 || numero > data.opciones.length) {
      await sendWhatsAppMessage(phone, "❌ Número inválido. Escribí el número del potrero.")
      return
    }
    
    const potreroSeleccionado = data.opciones[numero - 1]
    
    // Llamar a handleTacto nuevamente con el potrero específico
    const { handleTacto } = await import("./tactoHandler")
    await handleTacto(phone, {
      potrero: potreroSeleccionado.nombre,
      cantidad: data.cantidad,
      preñadas: data.preñadas,
      _potreroId: potreroSeleccionado.id
    })
    
    return
  }

  // 🆕 Manejar selección de potrero para TRATAMIENTO
  if (data.tipo === "ELEGIR_POTRERO_TRATAMIENTO") {
    const numero = parseInt(respuesta.trim())
    
    if (isNaN(numero) || numero < 1 || numero > data.opciones.length) {
      await sendWhatsAppMessage(phone, "❌ Número inválido. Escribí el número del potrero.")
      return
    }
    
    const potreroSeleccionado = data.opciones[numero - 1]
    
    // Llamar a handleTratamiento nuevamente con el potrero específico
    const { handleTratamiento } = await import("./tratamientoHandler")
    await handleTratamiento(phone, {
      producto: data.producto,
      cantidad: data.cantidad,
      categoria: data.categoria,
      potrero: potreroSeleccionado.nombre,
      _potreroId: potreroSeleccionado.id
    })
    
    return
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
    respuesta === "btn_confirmar" ||
    respuesta === "confirmar_dao" ||
    respuesta === "confirmar_tacto" ||
    respuesta === "confirmar_tratamiento"
  ) {
    try {
      if (data.tipo === "CAMBIO_POTRERO") {
        await ejecutarCambioPotrero(data)
      } else if (data.tipo === "CAMBIO_POTRERO_MULTIPLE") {
        const { ejecutarCambioPotreroMultiple } = await import("./potreroHandler")
        await ejecutarCambioPotreroMultiple(data)
        await sendWhatsAppMessage(
          phone,
          `✅ Potrero "${data.loteOrigenNombre}" vaciado. Todos los animales fueron movidos a "${data.loteDestinoNombre}".`
        )
        
        // 🔥 IMPORTANTE: Eliminar confirmación y retornar para no mostrar mensaje genérico
        await prisma.pendingConfirmation
          .delete({
            where: { telefono: phone },
          })
          .catch(() => {})
        
        return
      } else if (data.tipo === "MOVER_POTRERO_MODULO") {
        const { handleMoverPotreroModuloConfirmacion } = await import("./moverPotreroModuloHandler")
        await handleMoverPotreroModuloConfirmacion(data)
      } else if (data.tipo === "DAO") {
        await confirmarDAO(phone, data)
        
        // Limpiar confirmación pendiente
        await prisma.pendingConfirmation
          .delete({ where: { telefono: phone } })
          .catch(() => {})
        
        return
      } else if (data.tipo === "TACTO") {
        const { confirmarTacto } = await import("./tactoHandler")
        await confirmarTacto(phone, data)
        
        // Limpiar confirmación pendiente
        await prisma.pendingConfirmation
          .delete({ where: { telefono: phone } })
          .catch(() => {})
        
        return  // 🔥 Salir para NO mostrar mensaje genérico (confirmarTacto ya envía mensaje)
      } else if (data.tipo === "TRATAMIENTO") {
        const { confirmarTratamiento } = await import("./tratamientoHandler")
        await confirmarTratamiento(phone, data)
        
        // Limpiar confirmación pendiente
        await prisma.pendingConfirmation
          .delete({ where: { telefono: phone } })
          .catch(() => {})
        
        return
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
      
      await prisma.pendingConfirmation
        .delete({
          where: { telefono: phone },
        })
        .catch(() => {})
      
      return  // 🔥 IMPORTANTE: return aquí también en caso de error
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
    
    console.log("🍖 CONSUMO DEBUG 1 - Input:", {
      loteId,
      potreroNombre,
      categoria: data.categoria,
      cantidad: cantidadConsumidos,
      campoId: user.campoId
    })

    // 🔍 DEBUG: Ver todos los animales del potrero
    const todosLosAnimales = loteId ? await prisma.animalLote.findMany({
      where: { loteId },
      select: { id: true, categoria: true, cantidad: true, loteId: true }
    }) : []
    
    console.log("🔍 CONSUMO DEBUG 2 - Animales en potrero:", JSON.stringify(todosLosAnimales, null, 2))

    // 🔍 DEBUG: Ver con filtro de campo
    const animalesConCampo = loteId ? await prisma.animalLote.findMany({
      where: { 
        loteId,
        lote: { campoId: user.campoId } 
      },
      select: { id: true, categoria: true, cantidad: true }
    }) : []
    
    console.log("🔍 CONSUMO DEBUG 3 - Animales con filtro campo:", JSON.stringify(animalesConCampo, null, 2))

    // Búsqueda flexible con contains
    const animalLote = loteId ? await prisma.animalLote.findFirst({
      where: { 
        loteId, 
        categoria: { 
          contains: data.categoria, 
          mode: 'insensitive' 
        },
        lote: { campoId: user.campoId } 
      },
    }) : null

    console.log("🔍 CONSUMO DEBUG 4 - AnimalLote encontrado:", animalLote ? animalLote.id : 'NULL')

    if (!animalLote) {
      throw new Error(`No se encontraron animales con categoría que contenga "${data.categoria}" en el potrero ${potreroNombre}. Disponibles: ${animalesConCampo.map(a => a.categoria).join(', ') || 'ninguno'}`)
    }

    if (animalLote.cantidad < cantidadConsumidos) {
      throw new Error(`Solo hay ${animalLote.cantidad} ${animalLote.categoria} disponibles`)
    }

    // Determinar tipo de animal usando la categoría real de la BD
    const categoriaLower = animalLote.categoria.toLowerCase()
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
          descripcion: `Consumo de ${cantidadConsumidos} ${animalLote.categoria}${potreroNombre ? ` en potrero ${potreroNombre}` : ''}`,
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