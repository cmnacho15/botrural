// 📁 src/lib/whatsapp/handlers/tratamientoHandler.ts

import { prisma } from "@/lib/prisma"
import { sendWhatsAppMessage, sendWhatsAppButtons } from "../sendMessage"
import { buscarPotreroConModulos } from "@/lib/potrero-helpers"

/**
 * 💉 Solicitar confirmación para registrar tratamiento
 */
export async function handleTratamiento(
  telefono: string,
  parsedData: {
    producto?: string
    cantidad?: number
    categoria?: string
    categorias?: string[]
    potrero?: string
    _potreroId?: string
    todoElCampo?: boolean
    tratamientos?: Array<{
      producto: string
      cantidad?: number
      categoria?: string
      categorias?: string[]
      potrero?: string
    }>
  }
) {
  try {
    const user = await prisma.user.findUnique({
      where: { telefono },
      select: { id: true, campoId: true }
    })

    if (!user || !user.campoId) {
      await sendWhatsAppMessage(
        telefono,
        "❌ No estás registrado en ningún campo. Contactá al administrador."
      )
      return
    }

    // 🔥 CASO 1: MÚLTIPLES TRATAMIENTOS
    if (parsedData.tratamientos && parsedData.tratamientos.length > 0) {
      await handleTratamientosMultiples(telefono, user, parsedData.tratamientos)
      return
    }

    // 🔥 CASO 2: TODO EL CAMPO
    if (parsedData.todoElCampo) {
      await handleTratamientoTodoElCampo(telefono, user, parsedData)
      return
    }

    // 🔥 CASO 3: TRATAMIENTO SIMPLE (lógica original)
    await handleTratamientoSimple(telefono, user, parsedData)

  } catch (error) {
    console.error("❌ Error en handleTratamiento:", error)
    await sendWhatsAppMessage(
      telefono,
      "❌ Error al procesar el tratamiento. Intentá de nuevo."
    )
  }
}


/**
 * 🔥 Manejar tratamiento simple (un solo tratamiento)
 */
async function handleTratamientoSimple(
  telefono: string,
  user: { id: string; campoId: string },
  parsedData: any
) {
  let potrero = null
  let potreroNombre = null

  // Solo buscar potrero si se especificó
  if (parsedData.potrero) {
    // Si viene ID explícito (desde selección de módulos), usarlo directamente
    if (parsedData._potreroId) {
      console.log("🎯 Usando ID explícito de potrero para TRATAMIENTO:", parsedData._potreroId)
      potrero = await prisma.lote.findUnique({
        where: { id: parsedData._potreroId },
        select: { id: true, nombre: true }
      })
      
      if (!potrero) {
        await sendWhatsAppMessage(telefono, "❌ Error: potrero no encontrado")
        return
      }
      potreroNombre = potrero.nombre
    } else {
      // Buscar potrero considerando módulos
      const resultadoPotrero = await buscarPotreroConModulos(parsedData.potrero, user.campoId)

      if (!resultadoPotrero.unico) {
        if (resultadoPotrero.opciones && resultadoPotrero.opciones.length > 1) {
          // HAY DUPLICADOS CON MÓDULOS
          const mensaje = `Encontré varios "${parsedData.potrero}":\n\n` +
            resultadoPotrero.opciones.map((opt, i) => 
              `${i + 1}️⃣ ${opt.nombre}${opt.moduloNombre ? ` (${opt.moduloNombre})` : ''}`
            ).join('\n') +
            `\n\n¿En cuál aplicaste el tratamiento? Respondé con el número.`
          
          await sendWhatsAppMessage(telefono, mensaje)
          
          // Guardar estado pendiente
          await prisma.pendingConfirmation.upsert({
            where: { telefono },
            create: {
              telefono,
              data: JSON.stringify({
                tipo: "ELEGIR_POTRERO_TRATAMIENTO",
                opciones: resultadoPotrero.opciones,
                producto: parsedData.producto,
                cantidad: parsedData.cantidad,
                categoria: parsedData.categoria,
                categorias: parsedData.categorias
              }),
            },
            update: {
              data: JSON.stringify({
                tipo: "ELEGIR_POTRERO_TRATAMIENTO",
                opciones: resultadoPotrero.opciones,
                producto: parsedData.producto,
                cantidad: parsedData.cantidad,
                categoria: parsedData.categoria,
                categorias: parsedData.categorias
              }),
            },
          })
          return
        }

        // No encontrado
        const potrerosDisponibles = await prisma.lote.findMany({
          where: { campoId: user.campoId },
          select: { nombre: true }
        })
        const nombres = potrerosDisponibles.map(p => p.nombre).join(', ')
        
        await sendWhatsAppMessage(
          telefono,
          `❌ Potrero "${parsedData.potrero}" no encontrado.\n\n` +
          `📍 Tus potreros son: ${nombres}`
        )
        return
      }

      potrero = resultadoPotrero.lote!
      potreroNombre = potrero.nombre
    }
  }

  // Guardar en pending confirmation
  await prisma.pendingConfirmation.upsert({
    where: { telefono },
    create: {
      telefono,
      data: JSON.stringify({
        tipo: 'TRATAMIENTO',
        producto: parsedData.producto,
        cantidad: parsedData.cantidad || null,
        categoria: parsedData.categoria || null,
        categorias: parsedData.categorias || null,
        potrero: potreroNombre,
        potreroId: potrero?.id || null,
        campoId: user.campoId,
        usuarioId: user.id,
        telefono: telefono
      })
    },
    update: {
      data: JSON.stringify({
        tipo: 'TRATAMIENTO',
        producto: parsedData.producto,
        cantidad: parsedData.cantidad || null,
        categoria: parsedData.categoria || null,
        categorias: parsedData.categorias || null,
        potrero: potreroNombre,
        potreroId: potrero?.id || null,
        campoId: user.campoId,
        usuarioId: user.id,
        telefono: telefono
      })
    }
  })

  // Construir mensaje de confirmación
  let mensaje = `💉 *Tratamiento - Confirmá los datos*\n\n`
  mensaje += `💊 Producto: ${parsedData.producto}\n`
  
  // Manejar múltiples categorías
  if (parsedData.categorias && parsedData.categorias.length > 0) {
    mensaje += `🐄 Aplicado a: ${parsedData.categorias.join(', ')}\n`
  } else if (parsedData.cantidad && parsedData.categoria) {
    mensaje += `🐄 Aplicado a: ${parsedData.cantidad} ${parsedData.categoria}\n`
  } else if (parsedData.categoria) {
    mensaje += `🐄 Aplicado a: ${parsedData.categoria}\n`
  } else if (parsedData.cantidad) {
    mensaje += `🐄 Aplicado a: ${parsedData.cantidad} animales\n`
  }
  
  if (potreroNombre) {
    mensaje += `📍 Potrero: ${potreroNombre}\n`
  }
  
  mensaje += `\n_Escribí "editar" para modificar o clickeá confirmar_`

  await sendWhatsAppButtons(
    telefono,
    mensaje,
    [
      { id: 'confirmar_tratamiento', title: '✅ Confirmar' },
      { id: 'cancelar', title: '❌ Cancelar' }
    ]
  )

  console.log("✅ Solicitud de confirmación tratamiento enviada")
}

/**
 * 🔥 Manejar múltiples tratamientos
 */
async function handleTratamientosMultiples(
  telefono: string,
  user: { id: string; campoId: string },
  tratamientos: Array<any>
) {
  // Procesar cada tratamiento y resolver potreros
  const tratamientosProcesados = []

  for (const trat of tratamientos) {
    let potreroId = null
    let potreroNombre = null

    if (trat.potrero) {
      const resultadoPotrero = await buscarPotreroConModulos(trat.potrero, user.campoId)
      
      if (resultadoPotrero.unico && resultadoPotrero.lote) {
        potreroId = resultadoPotrero.lote.id
        potreroNombre = resultadoPotrero.lote.nombre
      }
    }

    tratamientosProcesados.push({
      producto: trat.producto,
      cantidad: trat.cantidad || null,
      categoria: trat.categoria || null,
      categorias: trat.categorias || null,
      potreroId,
      potrero: potreroNombre
    })
  }

  // Guardar en pending confirmation
  await prisma.pendingConfirmation.upsert({
    where: { telefono },
    create: {
      telefono,
      data: JSON.stringify({
        tipo: 'TRATAMIENTO_MULTIPLE',
        tratamientos: tratamientosProcesados,
        campoId: user.campoId,
        usuarioId: user.id,
        telefono
      })
    },
    update: {
      data: JSON.stringify({
        tipo: 'TRATAMIENTO_MULTIPLE',
        tratamientos: tratamientosProcesados,
        campoId: user.campoId,
        usuarioId: user.id,
        telefono
      })
    }
  })

  // Construir mensaje de confirmación
  let mensaje = `💉 *Tratamientos - Confirmá los datos*\n\n`
  
  tratamientosProcesados.forEach((trat, index) => {
    mensaje += `${index + 1}. ${trat.producto}\n`
    
    if (trat.categorias && trat.categorias.length > 0) {
      mensaje += `   🐄 Aplicado a: ${trat.categorias.join(', ')}\n`
    } else if (trat.cantidad && trat.categoria) {
      mensaje += `   🐄 Aplicado a: ${trat.cantidad} ${trat.categoria}\n`
    } else if (trat.categoria) {
      mensaje += `   🐄 Aplicado a: ${trat.categoria}\n`
    }
    
    if (trat.potrero) {
      mensaje += `   📍 Potrero: ${trat.potrero}\n`
    }
    mensaje += `\n`
  })
  
  mensaje += `\n_Escribí "editar" para modificar o clickeá confirmar_`

  await sendWhatsAppButtons(
    telefono,
    mensaje,
    [
      { id: 'confirmar_tratamiento', title: '✅ Confirmar' },
      { id: 'cancelar', title: '❌ Cancelar' }
    ]
  )

  console.log("✅ Solicitud de confirmación múltiples tratamientos enviada")
}

/**
 * 🔥 Manejar tratamiento a todo el campo
 */
async function handleTratamientoTodoElCampo(
  telefono: string,
  user: { id: string; campoId: string },
  parsedData: any
) {
  // Obtener todos los potreros del campo
  const potreros = await prisma.lote.findMany({
    where: { campoId: user.campoId },
    select: { id: true, nombre: true }
  })

  if (potreros.length === 0) {
    await sendWhatsAppMessage(
      telefono,
      "❌ No tenés potreros creados en el campo."
    )
    return
  }

  // Guardar en pending confirmation
  await prisma.pendingConfirmation.upsert({
    where: { telefono },
    create: {
      telefono,
      data: JSON.stringify({
        tipo: 'TRATAMIENTO_TODO_CAMPO',
        producto: parsedData.producto,
        cantidad: parsedData.cantidad || null,
        categoria: parsedData.categoria || null,
        categorias: parsedData.categorias || null,
        potreros: potreros.map(p => ({ id: p.id, nombre: p.nombre })),
        campoId: user.campoId,
        usuarioId: user.id,
        telefono
      })
    },
    update: {
      data: JSON.stringify({
        tipo: 'TRATAMIENTO_TODO_CAMPO',
        producto: parsedData.producto,
        cantidad: parsedData.cantidad || null,
        categoria: parsedData.categoria || null,
        categorias: parsedData.categorias || null,
        potreros: potreros.map(p => ({ id: p.id, nombre: p.nombre })),
        campoId: user.campoId,
        usuarioId: user.id,
        telefono
      })
    }
  })

  // Construir mensaje de confirmación
  let mensaje = `💉 *Tratamiento a TODO EL CAMPO*\n\n`
  mensaje += `💊 Producto: ${parsedData.producto}\n`
  
  if (parsedData.categorias && parsedData.categorias.length > 0) {
    mensaje += `🐄 Aplicado a: ${parsedData.categorias.join(', ')}\n`
  } else if (parsedData.cantidad && parsedData.categoria) {
    mensaje += `🐄 Aplicado a: ${parsedData.cantidad} ${parsedData.categoria}\n`
  } else if (parsedData.categoria) {
    mensaje += `🐄 Aplicado a: ${parsedData.categoria}\n`
  }
  
  mensaje += `📍 En todos los potreros: ${potreros.map(p => p.nombre).join(', ')}\n`
  mensaje += `\n_Escribí "editar" para modificar o clickeá confirmar_`

  await sendWhatsAppButtons(
    telefono,
    mensaje,
    [
      { id: 'confirmar_tratamiento', title: '✅ Confirmar' },
      { id: 'cancelar', title: '❌ Cancelar' }
    ]
  )

  console.log("✅ Solicitud de confirmación tratamiento todo el campo enviada")
}

/**
 * 💉 Confirmar y registrar el tratamiento
 */
export async function confirmarTratamiento(telefono: string, data: any) {
  try {
    const { potreroId, potrero, producto, cantidad, categoria, campoId, usuarioId } = data

    let nombrePotreroConModulo = potrero
    
    // 🔍 Obtener el potrero con módulo si existe
    if (potreroId) {
      const potreroCompleto = await prisma.lote.findUnique({
        where: { id: potreroId },
        select: { 
          nombre: true,
          moduloPastoreo: {
            select: { nombre: true }
          }
        }
      })

      nombrePotreroConModulo = potreroCompleto?.moduloPastoreo?.nombre
        ? `${potreroCompleto.nombre} (${potreroCompleto.moduloPastoreo.nombre})`
        : potreroCompleto?.nombre || potrero
    }

    // Construir descripción
    let descripcion = `Tratamiento: ${producto}`

    const categorias = data.categorias

    if (categorias && categorias.length > 0) {
      descripcion += ` aplicado a ${categorias.join(', ')}`
    } else if (cantidad && categoria) {
      descripcion += ` aplicado a ${cantidad} ${categoria}`
    } else if (categoria) {
      descripcion += ` aplicado a ${categoria}`
    } else if (cantidad) {
      descripcion += ` aplicado a ${cantidad} animales`
    }

    if (nombrePotreroConModulo) {
      descripcion += ` en potrero ${nombrePotreroConModulo}`
    }

    // Crear evento con módulo en descripción
    await prisma.evento.create({
      data: {
        campoId,
        tipo: 'TRATAMIENTO',
        fecha: new Date(),
        descripcion,
        loteId: potreroId || null,
        cantidad: cantidad || null,
        categoria: categoria || null,
        usuarioId
      }
    })

    // Mensaje de confirmación
    let mensajeConfirmacion = `✅ *Tratamiento registrado correctamente*\n\n💊 ${producto}`
    
    const categoriasMsg = data.categorias
    
    if (categoriasMsg && categoriasMsg.length > 0) {
      mensajeConfirmacion += `\n🐄 ${categoriasMsg.join(', ')}`
    } else if (cantidad && categoria) {
      mensajeConfirmacion += `\n🐄 ${cantidad} ${categoria}`
    }
    
    if (nombrePotreroConModulo) {
      mensajeConfirmacion += `\n📍 ${nombrePotreroConModulo}`
    }

    await sendWhatsAppMessage(telefono, mensajeConfirmacion)

    console.log("✅ Tratamiento registrado:", descripcion)

  } catch (error) {
    console.error("❌ Error confirmando tratamiento:", error)
    await sendWhatsAppMessage(
      telefono,
      "❌ Error al registrar el tratamiento. Intentá de nuevo."
    )
  }
}

/**
 * 💉 Confirmar y registrar múltiples tratamientos
 */
export async function confirmarTratamientoMultiple(telefono: string, data: any) {
  try {
    const { tratamientos, campoId, usuarioId } = data
    
    // Crear eventos individuales para cada tratamiento
    await prisma.$transaction(async (tx) => {
      for (const trat of tratamientos) {
        let descripcion = `Tratamiento: ${trat.producto}`
        
        if (trat.categorias && trat.categorias.length > 0) {
          descripcion += ` aplicado a ${trat.categorias.join(', ')}`
        } else if (trat.cantidad && trat.categoria) {
          descripcion += ` aplicado a ${trat.cantidad} ${trat.categoria}`
        } else if (trat.categoria) {
          descripcion += ` aplicado a ${trat.categoria}`
        } else if (trat.cantidad) {
          descripcion += ` aplicado a ${trat.cantidad} animales`
        }
        
        if (trat.potrero) {
          descripcion += ` en potrero ${trat.potrero}`
        }
        
        await tx.evento.create({
          data: {
            campoId,
            tipo: 'TRATAMIENTO',
            fecha: new Date(),
            descripcion,
            loteId: trat.potreroId || null,
            cantidad: trat.cantidad || null,
            categoria: trat.categoria || null,
            usuarioId
          }
        })
      }
    })
    
    // Mensaje de confirmación
    let mensaje = `✅ *${tratamientos.length} tratamientos registrados correctamente*\n\n`
    
    tratamientos.forEach((trat: any, index: number) => {
      mensaje += `${index + 1}. ${trat.producto}\n`
      
      if (trat.categorias && trat.categorias.length > 0) {
        mensaje += `   🐄 Aplicado a: ${trat.categorias.join(', ')}\n`
      } else if (trat.cantidad && trat.categoria) {
        mensaje += `   🐄 Aplicado a: ${trat.cantidad} ${trat.categoria}\n`
      } else if (trat.categoria) {
        mensaje += `   🐄 Aplicado a: ${trat.categoria}\n`
      }
      
      if (trat.potrero) {
        mensaje += `   📍 Potrero: ${trat.potrero}\n`
      }
      mensaje += `\n`
    })
    
    await sendWhatsAppMessage(telefono, mensaje)
    console.log("✅ Múltiples tratamientos registrados")
    
  } catch (error) {
    console.error("❌ Error confirmando tratamientos múltiples:", error)
    await sendWhatsAppMessage(
      telefono,
      "❌ Error al registrar los tratamientos. Intentá de nuevo."
    )
  }
}

/**
 * 💉 Confirmar y registrar tratamiento a todo el campo
 */
export async function confirmarTratamientoTodoCampo(telefono: string, data: any) {
  try {
    const { producto, cantidad, categoria, potreros, campoId, usuarioId } = data
    
    // 🔥 UN SOLO EVENTO para todo el campo
    let descripcion = `Tratamiento: ${producto}`
    
    const categorias = data.categorias
    
    if (categorias && categorias.length > 0) {
      descripcion += ` aplicado a ${categorias.join(', ')}`
    } else if (cantidad && categoria) {
      descripcion += ` aplicado a ${cantidad} ${categoria}`
    } else if (categoria) {
      descripcion += ` aplicado a ${categoria}`
    } else if (cantidad) {
      descripcion += ` aplicado a ${cantidad} animales`
    }
    
    descripcion += ` en todo el campo (${potreros.length} potreros)`
    
    await prisma.evento.create({
      data: {
        campoId,
        tipo: 'TRATAMIENTO',
        fecha: new Date(),
        descripcion,
        loteId: null, // NULL porque es todo el campo
        cantidad: cantidad || null,
        categoria: categoria || null,
        usuarioId
      }
    })
    
    // Mensaje de confirmación
    let mensaje = `✅ *Tratamiento registrado en TODO EL CAMPO*\n\n`
    mensaje += `💊 ${producto}\n`
    
    if (categorias && categorias.length > 0) {
      mensaje += `🐄 ${categorias.join(', ')}\n`
    } else if (cantidad && categoria) {
      mensaje += `🐄 ${cantidad} ${categoria}\n`
    } else if (categoria) {
      mensaje += `🐄 ${categoria}\n`
    }
    
    mensaje += `📍 Aplicado en: ${potreros.map((p: any) => p.nombre).join(', ')}`
    
    await sendWhatsAppMessage(telefono, mensaje)
    console.log("✅ Tratamiento todo el campo registrado")
    
  } catch (error) {
    console.error("❌ Error confirmando tratamiento todo el campo:", error)
    await sendWhatsAppMessage(
      telefono,
      "❌ Error al registrar el tratamiento. Intentá de nuevo."
    )
  }
}