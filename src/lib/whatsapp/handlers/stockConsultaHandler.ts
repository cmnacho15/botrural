// src/lib/whatsapp/handlers/stockConsultaHandler.ts

import { prisma } from "@/lib/prisma"
import { sendWhatsAppMessage, sendCustomButtons } from "../services/messageService"
import { buscarPotreroEnLista, buscarPotreroConModulos } from "@/lib/potrero-helpers"

/**
 * FASE 1: Usuario pide ver stock de un potrero
 */
export async function handleStockConsulta(
  phoneNumber: string,
  nombrePotrero: string,
  campoId: string
) {
  try {
    // 🔍 Buscar potrero considerando módulos
    const resultado = await buscarPotreroConModulos(nombrePotrero, campoId)

    // Si hay múltiples potreros con el mismo nombre (en diferentes módulos)
    if (!resultado.unico && resultado.opciones && resultado.opciones.length > 1) {
      const mensaje = `Encontré varios "${nombrePotrero}":\n\n` +
        resultado.opciones.map((opt, i) => 
          `${i + 1}️⃣ ${opt.nombre}${opt.moduloNombre ? ` (${opt.moduloNombre})` : ''}`
        ).join('\n') +
        `\n\n¿De cuál querés ver el stock? Respondé con el número.`
      
      await sendWhatsAppMessage(phoneNumber, mensaje)
      
      // Guardar estado pendiente
      await prisma.pendingConfirmation.upsert({
        where: { telefono: phoneNumber },
        create: {
          telefono: phoneNumber,
          data: JSON.stringify({
            tipo: "ELEGIR_POTRERO_STOCK",
            opciones: resultado.opciones,
            accion: "CONSULTA"
          })
        },
        update: {
          data: JSON.stringify({
            tipo: "ELEGIR_POTRERO_STOCK",
            opciones: resultado.opciones,
            accion: "CONSULTA"
          })
        }
      })
      return
    }

    // Si no se encontró ningún potrero
    if (!resultado.unico || !resultado.lote) {
      const potreros = await prisma.lote.findMany({
        where: { campoId },
        select: { nombre: true }
      })
      const nombresDisponibles = potreros.map(p => p.nombre).join(', ')
      await sendWhatsAppMessage(
        phoneNumber,
        `No encontré el potrero "${nombrePotrero}".\n\nTus potreros son: ${nombresDisponibles}`
      )
      return
    }

    const potrero = resultado.lote

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
 * Acepta tanto texto manual como datos parseados por GPT
 */
export async function handleStockEdicion(
  phoneNumber: string,
  input: string | { categoria: string; cantidad: number; potrero?: string; _potreroId?: string }
): Promise<boolean> {
  try {
    // Obtener estado pendiente
    const pending = await prisma.pendingConfirmation.findUnique({
      where: { telefono: phoneNumber }
    })

    // 🔥 CASO 1: Si viene de GPT con potrero específico (primera edición sin consulta previa)
    if (typeof input === 'object' && input.potrero) {
      // Buscar el campo del usuario
      const usuario = await prisma.user.findUnique({
        where: { telefono: phoneNumber },
        select: { campoId: true }
      })

      if (!usuario?.campoId) {
        await sendWhatsAppMessage(phoneNumber, "❌ No tenés un campo configurado.")
        return true
      }

      // 🔍 Buscar potrero considerando módulos
      const resultado = await buscarPotreroConModulos(input.potrero, usuario.campoId)

      // Si hay múltiples potreros con el mismo nombre
      if (!resultado.unico && resultado.opciones && resultado.opciones.length > 1) {
        const mensaje = `Encontré varios "${input.potrero}":\n\n` +
          resultado.opciones.map((opt, i) => 
            `${i + 1}️⃣ ${opt.nombre}${opt.moduloNombre ? ` (${opt.moduloNombre})` : ''}`
          ).join('\n') +
          `\n\n¿En cuál querés hacer el cambio? Respondé con el número.`
        
        await sendWhatsAppMessage(phoneNumber, mensaje)
        
        // Guardar estado pendiente CON los datos de la edición
        await prisma.pendingConfirmation.upsert({
          where: { telefono: phoneNumber },
          create: {
            telefono: phoneNumber,
            data: JSON.stringify({
              tipo: "ELEGIR_POTRERO_STOCK",
              opciones: resultado.opciones,
              accion: "EDICION",
              categoria: input.categoria,
              cantidad: input.cantidad
            })
          },
          update: {
            data: JSON.stringify({
              tipo: "ELEGIR_POTRERO_STOCK",
              opciones: resultado.opciones,
              accion: "EDICION",
              categoria: input.categoria,
              cantidad: input.cantidad
            })
          }
        })
        return true
      }

      // Si no se encontró ningún potrero
      if (!resultado.unico || !resultado.lote) {
        const potreros = await prisma.lote.findMany({
          where: { campoId: usuario.campoId },
          select: { nombre: true }
        })
        const nombresDisponibles = potreros.map(p => p.nombre).join(', ')
        await sendWhatsAppMessage(
          phoneNumber,
          `❌ No encontré el potrero "${input.potrero}".\n\nTus potreros son: ${nombresDisponibles}`
        )
        return true
      }

      const potrero = resultado.lote
      
      // 🎯 Si viene con ID explícito (desde selección de módulos), usarlo
      let potreroId = potrero.id
      if (typeof input === 'object' && input._potreroId) {
        potreroId = input._potreroId
      }

      // Obtener stock actual del potrero
      const stock = await prisma.animalLote.findMany({
        where: { loteId: potreroId },
        orderBy: { categoria: 'asc' }
      })

      // Buscar la categoría en el stock
      const categoriaEncontrada = stock.find(a => 
        a.categoria.toLowerCase() === input.categoria.toLowerCase() ||
        a.categoria.toLowerCase().includes(input.categoria.toLowerCase()) ||
        input.categoria.toLowerCase().includes(a.categoria.toLowerCase())
      )

      if (!categoriaEncontrada) {
        if (stock.length === 0) {
          await sendWhatsAppMessage(
            phoneNumber,
            `⚠️ El potrero *${potrero.nombre}* está vacío.\n\n¿Querés agregarlo ahora? Primero consultá el stock: "stock ${potrero.nombre}"`
          )
        } else {
          await sendWhatsAppMessage(
            phoneNumber,
            `⚠️ "${input.categoria}" no está en el potrero *${potrero.nombre}*.\n\nCategorías disponibles:\n` +
            stock.map(a => `• ${a.categoria}`).join('\n')
          )
        }
        return true
      }

      // Guardar el cambio pendiente
      const cambio = {
        categoria: categoriaEncontrada.categoria,
        cantidadOriginal: categoriaEncontrada.cantidad,
        cantidadNueva: input.cantidad
      }

      await prisma.pendingConfirmation.upsert({
        where: { telefono: phoneNumber },
        create: {
          telefono: phoneNumber,
          data: JSON.stringify({
            tipo: "STOCK_CONSULTA",
            loteId: potreroId,
            loteNombre: potrero.nombre,
            stockActual: stock.map(a => ({
              categoria: a.categoria,
              cantidad: a.cantidad,
              peso: a.peso
            })),
            cambiosPendientes: [cambio]
          })
        },
        update: {
          data: JSON.stringify({
            tipo: "STOCK_CONSULTA",
            loteId: potreroId,                    // ✅ CAMBIADO: era potrero.id
            loteNombre: potrero.nombre,
            stockActual: stock.map(a => ({
              categoria: a.categoria,
              cantidad: a.cantidad,
              peso: a.peso
            })),
            cambiosPendientes: [cambio]
          })
        }
      })

      // Mostrar confirmación
      const cambioTexto = cambio.cantidadNueva === 0 
        ? `• ${cambio.categoria}: ~~${cambio.cantidadOriginal}~~ → **ELIMINAR**`
        : `• ${cambio.categoria}: ${cambio.cantidadOriginal} → **${cambio.cantidadNueva}**`

      const mensaje = 
        `*Cambio en ${potrero.nombre}:*\n\n` +
        `${cambioTexto}\n\n` +
        `¿Confirmar?`

      await sendCustomButtons(phoneNumber, mensaje, [
        { id: "stock_confirm", title: "✅ Confirmar" },
        { id: "stock_cancel", title: "❌ Cancelar" }
      ])

      return true
    }

    // 🔥 CASO 2: Edición manual después de consulta activa (el flujo original)
    if (!pending || typeof input !== 'string') {
      return false // No hay consulta activa o no es texto manual
    }

    const data = JSON.parse(pending.data)

    if (data.tipo !== "STOCK_CONSULTA") {
      return false // No es una consulta de stock
    }

    // Parsear edición manual: "Vacas 12" o "12 Vacas"
    const match = input.match(/^(\d+)\s+(.+)|(.+)\s+(\d+)$/i)

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
 * 🆕 NUEVO: Maneja la selección de potrero cuando hay múltiples opciones
 */
export async function handleSeleccionPotreroStock(
  phoneNumber: string,
  seleccion: string
): Promise<boolean> {
  try {
    const pending = await prisma.pendingConfirmation.findUnique({
      where: { telefono: phoneNumber }
    })

    if (!pending) return false

    const data = JSON.parse(pending.data)

    if (data.tipo !== "ELEGIR_POTRERO_STOCK") return false

    // Validar selección
    const numero = parseInt(seleccion)
    if (isNaN(numero) || numero < 1 || numero > data.opciones.length) {
      await sendWhatsAppMessage(
        phoneNumber,
        `⚠️ Por favor respondé con un número del 1 al ${data.opciones.length}.`
      )
      return true
    }

    const potreroSeleccionado = data.opciones[numero - 1]

    // Según la acción pendiente, ejecutar consulta o edición
    if (data.accion === "CONSULTA") {
      // Ejecutar consulta de stock
      const usuario = await prisma.user.findUnique({
        where: { telefono: phoneNumber },
        select: { campoId: true }
      })

      if (!usuario?.campoId) {
        await sendWhatsAppMessage(phoneNumber, "❌ Error: Campo no encontrado.")
        return true
      }

      // Limpiar estado pendiente
      await prisma.pendingConfirmation.delete({ where: { telefono: phoneNumber } })

      // Llamar a handleStockConsulta pero pasándole directamente el ID
      await handleStockConsultaDirecta(phoneNumber, potreroSeleccionado.id, potreroSeleccionado.nombre)

    } else if (data.accion === "EDICION") {
      // Ejecutar edición de stock
      await prisma.pendingConfirmation.delete({ where: { telefono: phoneNumber } })

      // Llamar a handleStockEdicion con los datos guardados
      await handleStockEdicionDirecta(
        phoneNumber,
        potreroSeleccionado.id,
        potreroSeleccionado.nombre,
        data.categoria,
        data.cantidad
      )
    }

    return true

  } catch (error) {
    console.error("Error en handleSeleccionPotreroStock:", error)
    return false
  }
}

/**
 * Ejecuta consulta de stock directamente con ID de potrero
 */
async function handleStockConsultaDirecta(
  phoneNumber: string,
  potreroId: string,
  potreroNombre: string
) {
  try {
    const stock = await prisma.animalLote.findMany({
      where: { loteId: potreroId },
      orderBy: { categoria: 'asc' }
    })

    if (stock.length === 0) {
      await sendWhatsAppMessage(
        phoneNumber,
        `El potrero *${potreroNombre}* está vacío.\n\nNo hay animales registrados.`
      )
      return
    }

    const stockTexto = stock
      .map(a => {
        const peso = a.peso ? ` (${a.peso.toFixed(0)}kg prom)` : ''
        return `• ${a.cantidad} ${a.categoria}${peso}`
      })
      .join('\n')

    const totalAnimales = stock.reduce((sum, a) => sum + a.cantidad, 0)

    const mensaje = 
      `*Stock de ${potreroNombre}*\n\n` +
      `${stockTexto}\n\n` +
      `Total: *${totalAnimales} animales*\n\n` +
      `Para editar, enviá:\n` +
      `"Vacas 15" (reemplaza la cantidad)\n` +
      `"Novillos 0" (elimina la categoría)`

    await prisma.pendingConfirmation.upsert({
      where: { telefono: phoneNumber },
      create: {
        telefono: phoneNumber,
        data: JSON.stringify({
          tipo: "STOCK_CONSULTA",
          loteId: potreroId,
          loteNombre: potreroNombre,
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
          loteId: potreroId,
          loteNombre: potreroNombre,
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
    console.error("Error en handleStockConsultaDirecta:", error)
    await sendWhatsAppMessage(phoneNumber, "Error consultando el stock.")
  }
}

/**
 * Ejecuta edición de stock directamente con ID de potrero
 */
async function handleStockEdicionDirecta(
  phoneNumber: string,
  potreroId: string,
  potreroNombre: string,
  categoria: string,
  cantidad: number
) {
  try {
    const stock = await prisma.animalLote.findMany({
      where: { loteId: potreroId },
      orderBy: { categoria: 'asc' }
    })

    const categoriaEncontrada = stock.find(a => 
      a.categoria.toLowerCase() === categoria.toLowerCase() ||
      a.categoria.toLowerCase().includes(categoria.toLowerCase()) ||
      categoria.toLowerCase().includes(a.categoria.toLowerCase())
    )

    if (!categoriaEncontrada) {
      if (stock.length === 0) {
        await sendWhatsAppMessage(
          phoneNumber,
          `⚠️ El potrero *${potreroNombre}* está vacío.\n\n¿Querés agregarlo ahora? Primero consultá el stock: "stock ${potreroNombre}"`
        )
      } else {
        await sendWhatsAppMessage(
          phoneNumber,
          `⚠️ "${categoria}" no está en el potrero *${potreroNombre}*.\n\nCategorías disponibles:\n` +
          stock.map(a => `• ${a.categoria}`).join('\n')
        )
      }
      return
    }

    const cambio = {
      categoria: categoriaEncontrada.categoria,
      cantidadOriginal: categoriaEncontrada.cantidad,
      cantidadNueva: cantidad
    }

    await prisma.pendingConfirmation.upsert({
      where: { telefono: phoneNumber },
      create: {
        telefono: phoneNumber,
        data: JSON.stringify({
          tipo: "STOCK_CONSULTA",
          loteId: potreroId,
          loteNombre: potreroNombre,
          stockActual: stock.map(a => ({
            categoria: a.categoria,
            cantidad: a.cantidad,
            peso: a.peso
          })),
          cambiosPendientes: [cambio]
        })
      },
      update: {
        data: JSON.stringify({
          tipo: "STOCK_CONSULTA",
          loteId: potreroId,
          loteNombre: potreroNombre,
          stockActual: stock.map(a => ({
            categoria: a.categoria,
            cantidad: a.cantidad,
            peso: a.peso
          })),
          cambiosPendientes: [cambio]
        })
      }
    })

    const cambioTexto = cambio.cantidadNueva === 0 
      ? `• ${cambio.categoria}: ~~${cambio.cantidadOriginal}~~ → **ELIMINAR**`
      : `• ${cambio.categoria}: ${cambio.cantidadOriginal} → **${cambio.cantidadNueva}**`

    const mensaje = 
      `*Cambio en ${potreroNombre}:*\n\n` +
      `${cambioTexto}\n\n` +
      `¿Confirmar?`

    await sendCustomButtons(phoneNumber, mensaje, [
      { id: "stock_confirm", title: "✅ Confirmar" },
      { id: "stock_cancel", title: "❌ Cancelar" }
    ])

  } catch (error) {
    console.error("Error en handleStockEdicionDirecta:", error)
    await sendWhatsAppMessage(phoneNumber, "Error procesando la edición.")
  }
}

/**
 * FASE 3: Botones de confirmación
 * 🆕 AHORA CREA EVENTOS EN LA TABLA Evento
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
      // 🔍 Obtener información del usuario para los eventos
      const usuario = await prisma.user.findUnique({
        where: { telefono: phoneNumber },
        select: { id: true, campoId: true }
      })

      if (!usuario?.id || !usuario?.campoId) {
        await sendWhatsAppMessage(phoneNumber, "❌ Error: Usuario no encontrado.")
        return
      }

      // 🔍 Obtener información del potrero
      const potrero = await prisma.lote.findUnique({
        where: { id: data.loteId },
        select: { nombre: true, campoId: true }
      })

      if (!potrero) {
        await sendWhatsAppMessage(phoneNumber, "❌ Error: Potrero no encontrado.")
        return
      }

      // ✅ Aplicar cambios Y crear eventos
      await prisma.$transaction(async (tx) => {
        for (const cambio of data.cambiosPendientes) {
          const animalLote = await tx.animalLote.findFirst({
            where: {
              loteId: data.loteId,
              categoria: cambio.categoria
            }
          })

          if (!animalLote) continue

          const diferencia = cambio.cantidadNueva - cambio.cantidadOriginal

          // 🔥 ACTUALIZAR animalLote
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

          // 🆕 CREAR EVENTO DE AJUSTE
          let descripcion = `Se realizaron los siguientes ajustes en ${potrero.nombre}: `
          
          if (diferencia > 0) {
            // Ajuste positivo
            descripcion += `+${diferencia} ${cambio.categoria}`
            if (animalLote.peso) {
              descripcion += ` (${animalLote.peso} kg promedio)`
            }
            descripcion += ` (ajuste positivo vía WhatsApp)`
          } else if (diferencia < 0) {
            // Ajuste negativo
            descripcion += `${diferencia} ${cambio.categoria}`
            if (animalLote.peso) {
              descripcion += ` (${animalLote.peso} kg promedio)`
            }
            descripcion += ` (ajuste negativo vía WhatsApp)`
          }

          // Solo crear evento si hubo cambio real
          if (diferencia !== 0) {
            await tx.evento.create({
              data: {
                tipo: 'AJUSTE',
                fecha: new Date(),
                descripcion,
                campoId: usuario.campoId,
                loteId: data.loteId,
                usuarioId: usuario.id,
                cantidad: Math.abs(diferencia),
                categoria: cambio.categoria,
                notas: 'Ajuste realizado desde WhatsApp'
              }
            })

            console.log(`✅ Evento AJUSTE creado: ${diferencia > 0 ? '+' : ''}${diferencia} ${cambio.categoria} en ${potrero.nombre}`)
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