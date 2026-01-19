// 📁 src/lib/whatsapp/handlers/tactoHandler.ts

import { prisma } from "@/lib/prisma"
import { sendWhatsAppMessage, sendWhatsAppButtons } from "../sendMessage"
import { buscarPotreroConModulos } from "@/lib/potrero-helpers"

/**
 * 🤚 Solicitar confirmación para registrar tacto
 */
export async function handleTacto(
  telefono: string,
  parsedData: {
    potrero: string
    cantidad: number
    preñadas: number
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

    let potrero

    // 🔥 Si viene ID explícito (desde selección de módulos), usarlo directamente
    if (parsedData._potreroId) {
      console.log("🎯 Usando ID explícito de potrero para TACTO:", parsedData._potreroId)
      potrero = await prisma.lote.findUnique({
        where: { id: parsedData._potreroId },
        select: { id: true, nombre: true }
      })
      
      if (!potrero) {
        await sendWhatsAppMessage(telefono, "❌ Error: potrero no encontrado")
        return
      }
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
            `\n\n¿En cuál hiciste el tacto? Respondé con el número.`
          
          await sendWhatsAppMessage(telefono, mensaje)
          
          // Guardar estado pendiente
          await prisma.pendingConfirmation.upsert({
            where: { telefono },
            create: {
              telefono,
              data: JSON.stringify({
                tipo: "ELEGIR_POTRERO_TACTO",
                opciones: resultadoPotrero.opciones,
                cantidad: parsedData.cantidad,
                preñadas: parsedData.preñadas
              }),
            },
            update: {
              data: JSON.stringify({
                tipo: "ELEGIR_POTRERO_TACTO",
                opciones: resultadoPotrero.opciones,
                cantidad: parsedData.cantidad,
                preñadas: parsedData.preñadas
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
    }

    // Validar datos
    if (parsedData.preñadas > parsedData.cantidad) {
      await sendWhatsAppMessage(
        telefono,
        `❌ Las preñadas (${parsedData.preñadas}) no pueden ser más que las tactadas (${parsedData.cantidad})`
      )
      return
    }

    // Calcular porcentaje
    const porcentaje = Math.round((parsedData.preñadas / parsedData.cantidad) * 100)
    const falladas = parsedData.cantidad - parsedData.preñadas

    // Guardar en pending confirmation
    await prisma.pendingConfirmation.upsert({
      where: { telefono },
      create: {
        telefono,
        data: JSON.stringify({
          tipo: 'TACTO',
          potrero: potrero.nombre,
          potreroId: potrero.id,
          cantidad: parsedData.cantidad,
          preñadas: parsedData.preñadas,
          falladas: falladas,
          porcentaje: porcentaje,
          campoId: user.campoId,
          usuarioId: user.id
        })
      },
      update: {
        data: JSON.stringify({
          tipo: 'TACTO',
          potrero: potrero.nombre,
          potreroId: potrero.id,
          cantidad: parsedData.cantidad,
          preñadas: parsedData.preñadas,
          falladas: falladas,
          porcentaje: porcentaje,
          campoId: user.campoId,
          usuarioId: user.id
        })
      }
    })

    // Enviar mensaje con botones
    const mensaje = 
      `🤚 *Tacto - Confirmá los datos*\n\n` +
      `📍 Potrero: ${potrero.nombre}\n` +
      `🤚 Tactadas: ${parsedData.cantidad}\n` +
      `✅ Preñadas: ${parsedData.preñadas} (${porcentaje}%)\n` +
      `❌ Falladas: ${falladas}\n\n` +
      `_Escribí "editar" para modificar o clickeá confirmar_`

    await sendWhatsAppButtons(
      telefono,
      mensaje,
      [
        { id: 'confirmar_tacto', title: '✅ Confirmar' },
        { id: 'cancelar', title: '❌ Cancelar' }
      ]
    )

    console.log("✅ Solicitud de confirmación tacto enviada")

  } catch (error) {
    console.error("❌ Error solicitando confirmación tacto:", error)
    await sendWhatsAppMessage(
      telefono,
      "❌ Error al procesar el tacto. Intentá de nuevo."
    )
  }
}

/**
 * 🤚 Confirmar y registrar el tacto
 */
export async function confirmarTacto(telefono: string, data: any) {
  try {
    const { potreroId, potrero, cantidad, preñadas, falladas, porcentaje, campoId, usuarioId } = data

    // 🔍 Obtener el potrero con módulo
    const potreroCompleto = await prisma.lote.findUnique({
      where: { id: potreroId },
      select: { 
        nombre: true,
        moduloPastoreo: {
          select: { nombre: true }
        }
      }
    })

    const nombrePotreroConModulo = potreroCompleto?.moduloPastoreo?.nombre
      ? `${potreroCompleto.nombre} (${potreroCompleto.moduloPastoreo.nombre})`
      : potreroCompleto?.nombre || potrero

    // Crear evento con módulo en descripción
    await prisma.evento.create({
      data: {
        campoId,
        tipo: 'TACTO',
        fecha: new Date(),
        descripcion: `Tacto en potrero ${nombrePotreroConModulo}: ${cantidad} animales tactados, ${preñadas} preñados (${porcentaje}% de preñez)`,
        loteId: potreroId,
        cantidad: cantidad,
        notas: `${preñadas} preñadas, ${falladas} falladas`,
        usuarioId
      }
    })

    // Mensaje de confirmación con módulo
    await sendWhatsAppMessage(
      telefono,
      `✅ *Tacto registrado correctamente*\n\n` +
      `📍 Potrero: ${nombrePotreroConModulo}\n` +
      `🤚 Tactadas: ${cantidad}\n` +
      `📊 Preñez: ${porcentaje}%`
    )

    console.log("✅ Tacto registrado:", nombrePotreroConModulo, porcentaje + "%")

  } catch (error) {
    console.error("❌ Error confirmando tacto:", error)
    await sendWhatsAppMessage(
      telefono,
      "❌ Error al registrar el tacto. Intentá de nuevo."
    )
  }
}