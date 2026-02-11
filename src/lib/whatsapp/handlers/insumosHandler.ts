// src/lib/whatsapp/handlers/insumosHandler.ts
// Handler para eventos de insumos: INGRESO_INSUMO, USO_INSUMO

import { prisma } from "@/lib/prisma"
import { sendWhatsAppMessage, sendWhatsAppButtons } from "@/lib/whatsapp/sendMessage"

type InsumoItem = {
  nombre: string
  cantidad: number
  unidad?: string
}

type InsumosData = {
  tipo: 'INGRESO_INSUMO' | 'USO_INSUMO'
  insumos: InsumoItem[]
  potrero?: string
}

/**
 * Maneja eventos de insumos - solicita confirmación al usuario
 */
export async function handleInsumos(from: string, data: InsumosData) {
  try {
    // Obtener usuario y campo
    const usuario = await prisma.user.findUnique({
      where: { telefono: from },
      select: { id: true, campoId: true }
    })

    if (!usuario?.campoId) {
      await sendWhatsAppMessage(from, "❌ No tenés un campo configurado.")
      return
    }

    // Buscar los insumos en la BD
    const insumosEncontrados: Array<{
      id: string
      nombre: string
      unidad: string
      stock: number
      cantidad: number
    }> = []

    const insumosNoEncontrados: string[] = []

    for (const insumoData of data.insumos) {
      const insumo = await prisma.insumo.findFirst({
        where: {
          campoId: usuario.campoId,
          nombre: { contains: insumoData.nombre, mode: 'insensitive' }
        },
        select: { id: true, nombre: true, unidad: true, stock: true }
      })

      if (insumo) {
        insumosEncontrados.push({
          ...insumo,
          cantidad: insumoData.cantidad
        })
      } else {
        insumosNoEncontrados.push(insumoData.nombre)
      }
    }

    // Si no se encontró ningún insumo
    if (insumosEncontrados.length === 0) {
      const insumosDisponibles = await prisma.insumo.findMany({
        where: { campoId: usuario.campoId },
        select: { nombre: true },
        take: 10
      })

      const nombresInsumos = insumosDisponibles.map(i => i.nombre).join(', ')
      await sendWhatsAppMessage(
        from,
        `❌ No encontré los insumos mencionados.\n\n` +
        (nombresInsumos
          ? `📦 Insumos disponibles: ${nombresInsumos}`
          : `No tenés insumos cargados. Podés crearlos desde la web en Preferencias > Insumos.`)
      )
      return
    }

    // Buscar potrero si se especificó
    let potreroInfo: { id: string; nombre: string } | null = null
    if (data.potrero) {
      const potrero = await prisma.lote.findFirst({
        where: {
          campoId: usuario.campoId,
          nombre: { equals: data.potrero, mode: 'insensitive' }
        },
        select: { id: true, nombre: true }
      })
      if (potrero) {
        potreroInfo = potrero
      }
    }

    // Para USO_INSUMO, validar stock
    if (data.tipo === 'USO_INSUMO') {
      for (const insumo of insumosEncontrados) {
        if (insumo.cantidad > insumo.stock) {
          await sendWhatsAppMessage(
            from,
            `❌ No hay suficiente stock de *${insumo.nombre}*.\n\n` +
            `📊 Stock disponible: ${insumo.stock} ${insumo.unidad}\n` +
            `📦 Cantidad solicitada: ${insumo.cantidad} ${insumo.unidad}`
          )
          return
        }
      }
    }

    // Construir mensaje de confirmación
    const emoji = data.tipo === 'INGRESO_INSUMO' ? '📥' : '📤'
    const titulo = data.tipo === 'INGRESO_INSUMO' ? 'Ingreso de Insumos' : 'Uso de Insumos'

    let mensaje = `${emoji} *${titulo}*\n\n`

    insumosEncontrados.forEach((insumo, i) => {
      mensaje += `${i + 1}. ${insumo.nombre}: ${insumo.cantidad} ${insumo.unidad}`
      if (data.tipo === 'USO_INSUMO') {
        mensaje += ` (stock: ${insumo.stock})`
      }
      mensaje += '\n'
    })

    if (potreroInfo) {
      mensaje += `\n📍 Potrero: ${potreroInfo.nombre}`
    }

    if (insumosNoEncontrados.length > 0) {
      mensaje += `\n\n⚠️ No encontrados: ${insumosNoEncontrados.join(', ')}`
    }

    mensaje += `\n\n¿Confirmar?`

    // Guardar en confirmación pendiente
    await prisma.pendingConfirmation.upsert({
      where: { telefono: from },
      create: {
        telefono: from,
        data: JSON.stringify({
          tipo: data.tipo,
          insumos: insumosEncontrados,
          loteId: potreroInfo?.id || null,
          loteNombre: potreroInfo?.nombre || null
        })
      },
      update: {
        data: JSON.stringify({
          tipo: data.tipo,
          insumos: insumosEncontrados,
          loteId: potreroInfo?.id || null,
          loteNombre: potreroInfo?.nombre || null
        })
      }
    })

    // Enviar botones de confirmación
    await sendWhatsAppButtons(from, mensaje, [
      { id: "insumo_confirm", title: "✅ Confirmar" },
      { id: "insumo_cancel", title: "❌ Cancelar" }
    ])

  } catch (error) {
    console.error("Error en handleInsumos:", error)
    await sendWhatsAppMessage(from, "❌ Hubo un error procesando tu solicitud.")
  }
}

/**
 * Confirma y guarda el movimiento de insumos
 */
export async function confirmarInsumos(from: string) {
  try {
    const confirmacion = await prisma.pendingConfirmation.findUnique({
      where: { telefono: from }
    })

    if (!confirmacion) {
      await sendWhatsAppMessage(from, "❌ No hay operación pendiente para confirmar.")
      return
    }

    const data = JSON.parse(confirmacion.data)

    // Verificar que sea un tipo de insumo
    if (data.tipo !== 'INGRESO_INSUMO' && data.tipo !== 'USO_INSUMO') {
      await sendWhatsAppMessage(from, "❌ Operación no válida.")
      return
    }

    // Obtener usuario
    const usuario = await prisma.user.findUnique({
      where: { telefono: from },
      select: { id: true, campoId: true }
    })

    if (!usuario?.campoId) {
      await sendWhatsAppMessage(from, "❌ No tenés un campo configurado.")
      return
    }

    const tipoMovimiento = data.tipo === 'INGRESO_INSUMO' ? 'INGRESO' : 'USO'

    // Construir descripción
    const descripcionInsumos = data.insumos
      .map((i: any) => `${i.nombre} (${i.cantidad} ${i.unidad})`)
      .join(', ')

    let descripcion = descripcionInsumos
    if (data.loteNombre) {
      descripcion += ` en potrero "${data.loteNombre}"`
    }

    // Guardar cada movimiento de insumo
    for (const insumo of data.insumos) {
      await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/insumos/movimientos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: tipoMovimiento,
          fecha: new Date().toISOString(),
          insumoId: insumo.id,
          cantidad: insumo.cantidad,
          loteId: data.loteId || null,
          notas: descripcion,
          usuarioId: usuario.id
        })
      })
    }

    // Limpiar confirmación pendiente
    await prisma.pendingConfirmation.delete({
      where: { telefono: from }
    })

    // Enviar confirmación
    const emoji = data.tipo === 'INGRESO_INSUMO' ? '📥' : '📤'
    const accion = data.tipo === 'INGRESO_INSUMO' ? 'ingresados' : 'registrado uso'

    await sendWhatsAppMessage(
      from,
      `${emoji} Insumos ${accion} correctamente:\n\n` +
      data.insumos.map((i: any) => `• ${i.nombre}: ${i.cantidad} ${i.unidad}`).join('\n')
    )

    console.log(`✅ Movimiento de insumos registrado: ${data.tipo}`)

  } catch (error) {
    console.error("Error en confirmarInsumos:", error)
    await sendWhatsAppMessage(from, "❌ Hubo un error guardando el registro.")
  }
}

/**
 * Cancela el movimiento de insumos pendiente
 */
export async function cancelarInsumos(from: string) {
  try {
    await prisma.pendingConfirmation.delete({
      where: { telefono: from }
    })
    await sendWhatsAppMessage(from, "❌ Operación cancelada.")
  } catch (error) {
    console.error("Error cancelando insumos:", error)
  }
}
