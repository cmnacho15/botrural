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
    producto: string
    cantidad?: number
    categoria?: string
    potrero?: string
    _potreroId?: string
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

    let potrero = null
    let potreroNombre = null

    // Solo buscar potrero si se especificó
    if (parsedData.potrero) {
      // 🔥 Si viene ID explícito (desde selección de módulos), usarlo directamente
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
        // 🔍 Buscar potrero considerando módulos
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
                  categoria: parsedData.categoria
                }),
              },
              update: {
                data: JSON.stringify({
                  tipo: "ELEGIR_POTRERO_TRATAMIENTO",
                  opciones: resultadoPotrero.opciones,
                  producto: parsedData.producto,
                  cantidad: parsedData.cantidad,
                  categoria: parsedData.categoria
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
    
    if (parsedData.cantidad && parsedData.categoria) {
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

  } catch (error) {
    console.error("❌ Error solicitando confirmación tratamiento:", error)
    await sendWhatsAppMessage(
      telefono,
      "❌ Error al procesar el tratamiento. Intentá de nuevo."
    )
  }
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
    
    if (cantidad && categoria) {
      descripcion += ` aplicado a ${cantidad} ${categoria}`
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
    
    if (cantidad && categoria) {
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