// src/lib/whatsapp/handlers/agriculturaHandler.ts
// Handler para eventos de agricultura: SIEMBRA, COSECHA, PULVERIZACION, REFERTILIZACION, RIEGO, MONITOREO

import { prisma } from "@/lib/prisma"
import { sendWhatsAppMessage, sendWhatsAppButtons } from "@/lib/whatsapp/sendMessage"

type AgriculturaData = {
  tipo: 'SIEMBRA' | 'COSECHA' | 'PULVERIZACION' | 'REFERTILIZACION' | 'RIEGO' | 'MONITOREO' | 'OTROS_LABORES'
  potrero: string
  cultivo: string
  hectareas?: number
  // COSECHA
  rendimiento?: number
  unidadRendimiento?: string
  humedad?: number
  // PULVERIZACION
  productos?: Array<{ nombre: string; dosis: number; unidad: string }>
  // REFERTILIZACION
  fertilizantes?: Array<{ fuente: string; dosis: number; unidad: string }>
  // RIEGO
  lamina?: number
  metodo?: string
  duracion?: number
  // MONITOREO
  estado?: string
  plagas?: string
  observaciones?: string
  requiereAccion?: boolean
  // OTROS_LABORES
  labor?: string
}

/**
 * Maneja eventos de agricultura - solicita confirmación al usuario
 */
export async function handleAgricultura(from: string, data: AgriculturaData) {
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

    // Buscar el potrero
    const potrero = await prisma.lote.findFirst({
      where: {
        campoId: usuario.campoId,
        nombre: { equals: data.potrero, mode: 'insensitive' }
      },
      select: { id: true, nombre: true, hectareas: true }
    })

    if (!potrero) {
      // Listar potreros disponibles
      const potreros = await prisma.lote.findMany({
        where: { campoId: usuario.campoId },
        select: { nombre: true },
        orderBy: { nombre: 'asc' }
      })
      const nombresPotreros = potreros.map(p => p.nombre).join(', ')
      await sendWhatsAppMessage(
        from,
        `❌ No encontré el potrero "${data.potrero}".\n\n📍 Tus potreros son: ${nombresPotreros}`
      )
      return
    }

    // Construir mensaje de confirmación según el tipo
    let mensaje = ''
    const hectareas = data.hectareas || potrero.hectareas

    switch (data.tipo) {
      case 'SIEMBRA':
        mensaje = `🌱 *Siembra*\n\n` +
          `📍 Potrero: ${potrero.nombre}\n` +
          `🌾 Cultivo: ${data.cultivo}\n` +
          `📐 Hectáreas: ${hectareas} ha\n\n` +
          `¿Confirmar siembra?`
        break

      case 'COSECHA':
        mensaje = `🌾 *Cosecha*\n\n` +
          `📍 Potrero: ${potrero.nombre}\n` +
          `🌱 Cultivo: ${data.cultivo}\n` +
          `📐 Hectáreas: ${hectareas} ha`
        if (data.rendimiento) {
          mensaje += `\n📊 Rendimiento: ${data.rendimiento} ${data.unidadRendimiento || 'kg'}`
        }
        if (data.humedad) {
          mensaje += `\n💧 Humedad: ${data.humedad}%`
        }
        mensaje += `\n\n¿Confirmar cosecha?`
        break

      case 'PULVERIZACION':
        mensaje = `💦 *Pulverización*\n\n` +
          `📍 Potrero: ${potrero.nombre}\n` +
          `🌱 Cultivo: ${data.cultivo}\n` +
          `📐 Hectáreas: ${hectareas} ha`
        if (data.productos && data.productos.length > 0) {
          mensaje += `\n\n🧪 Productos:`
          data.productos.forEach((p, i) => {
            mensaje += `\n${i + 1}. ${p.nombre}: ${p.dosis} ${p.unidad}`
          })
        }
        mensaje += `\n\n¿Confirmar pulverización?`
        break

      case 'REFERTILIZACION':
        mensaje = `🌿 *Refertilización*\n\n` +
          `📍 Potrero: ${potrero.nombre}\n` +
          `🌱 Cultivo: ${data.cultivo}\n` +
          `📐 Hectáreas: ${hectareas} ha`
        if (data.fertilizantes && data.fertilizantes.length > 0) {
          mensaje += `\n\n🧴 Fertilizantes:`
          data.fertilizantes.forEach((f, i) => {
            mensaje += `\n${i + 1}. ${f.fuente}: ${f.dosis} ${f.unidad}`
          })
        }
        mensaje += `\n\n¿Confirmar refertilización?`
        break

      case 'RIEGO':
        mensaje = `💧 *Riego*\n\n` +
          `📍 Potrero: ${potrero.nombre}\n` +
          `🌱 Cultivo: ${data.cultivo}\n` +
          `📐 Hectáreas: ${hectareas} ha\n` +
          `🌊 Lámina: ${data.lamina} mm`
        if (data.metodo) {
          mensaje += `\n⚙️ Método: ${data.metodo}`
        }
        if (data.duracion) {
          mensaje += `\n⏱️ Duración: ${data.duracion} horas`
        }
        mensaje += `\n\n¿Confirmar riego?`
        break

      case 'MONITOREO':
        mensaje = `🔍 *Monitoreo*\n\n` +
          `📍 Potrero: ${potrero.nombre}\n` +
          `🌱 Cultivo: ${data.cultivo}`
        if (data.estado) {
          const emojis: Record<string, string> = {
            'Excelente': '🟢',
            'Bueno': '🟡',
            'Regular': '🟠',
            'Malo': '🔴',
            'Crítico': '⚫'
          }
          mensaje += `\n📊 Estado: ${emojis[data.estado] || ''} ${data.estado}`
        }
        if (data.plagas) {
          mensaje += `\n🐛 Plagas/Enfermedades: ${data.plagas}`
        }
        if (data.observaciones) {
          mensaje += `\n📝 Observaciones: ${data.observaciones}`
        }
        if (data.requiereAccion) {
          mensaje += `\n⚠️ Requiere acción inmediata`
        }
        mensaje += `\n\n¿Confirmar monitoreo?`
        break

      case 'OTROS_LABORES':
        mensaje = `🔧 *Otros Labores*\n\n` +
          `📍 Potrero: ${potrero.nombre}\n` +
          `🌱 Cultivo: ${data.cultivo}\n` +
          `🛠️ Labor: ${data.labor || 'Labor agrícola'}`
        if (hectareas) {
          mensaje += `\n📐 Hectáreas: ${hectareas} ha`
        }
        mensaje += `\n\n¿Confirmar labor?`
        break
    }

    // Guardar en confirmación pendiente
    await prisma.pendingConfirmation.upsert({
      where: { telefono: from },
      create: {
        telefono: from,
        data: JSON.stringify({
          ...data,
          loteId: potrero.id,
          loteNombre: potrero.nombre,
          hectareasFinal: hectareas
        })
      },
      update: {
        data: JSON.stringify({
          ...data,
          loteId: potrero.id,
          loteNombre: potrero.nombre,
          hectareasFinal: hectareas
        })
      }
    })

    // Enviar botones de confirmación
    await sendWhatsAppButtons(from, mensaje, [
      { id: "agri_confirm", title: "✅ Confirmar" },
      { id: "agri_cancel", title: "❌ Cancelar" }
    ])

  } catch (error) {
    console.error("Error en handleAgricultura:", error)
    await sendWhatsAppMessage(from, "❌ Hubo un error procesando tu solicitud.")
  }
}

/**
 * Confirma y guarda el evento de agricultura
 */
export async function confirmarAgricultura(from: string) {
  try {
    const confirmacion = await prisma.pendingConfirmation.findUnique({
      where: { telefono: from }
    })

    if (!confirmacion) {
      await sendWhatsAppMessage(from, "❌ No hay operación pendiente para confirmar.")
      return
    }

    const data = JSON.parse(confirmacion.data)

    // Obtener usuario
    const usuario = await prisma.user.findUnique({
      where: { telefono: from },
      select: { id: true, campoId: true }
    })

    if (!usuario?.campoId) {
      await sendWhatsAppMessage(from, "❌ No tenés un campo configurado.")
      return
    }

    // Construir descripción para el evento
    let descripcion = ''
    let notas = ''

    switch (data.tipo) {
      case 'SIEMBRA':
        descripcion = `Siembra de ${data.cultivo} en potrero ${data.loteNombre} - ${data.hectareasFinal} ha`
        break

      case 'COSECHA':
        descripcion = `Cosecha de ${data.cultivo} en potrero ${data.loteNombre} - ${data.hectareasFinal} ha`
        if (data.rendimiento) {
          descripcion += ` - Rendimiento: ${data.rendimiento} ${data.unidadRendimiento || 'kg'}`
        }
        if (data.humedad) {
          descripcion += ` - Humedad: ${data.humedad}%`
        }
        break

      case 'PULVERIZACION':
        descripcion = `Pulverización de ${data.cultivo} en potrero ${data.loteNombre} - ${data.hectareasFinal} ha`
        if (data.productos && data.productos.length > 0) {
          notas = 'Productos aplicados:\n'
          data.productos.forEach((p: any, i: number) => {
            notas += `${i + 1}. ${p.nombre}: ${p.dosis} ${p.unidad}\n`
          })
        }
        break

      case 'REFERTILIZACION':
        descripcion = `Refertilización de ${data.cultivo} en potrero ${data.loteNombre} - ${data.hectareasFinal} ha`
        if (data.fertilizantes && data.fertilizantes.length > 0) {
          notas = 'Fertilizantes aplicados:\n'
          data.fertilizantes.forEach((f: any, i: number) => {
            notas += `${i + 1}. ${f.fuente}: ${f.dosis} ${f.unidad}\n`
          })
        }
        break

      case 'RIEGO':
        descripcion = `Riego de ${data.cultivo} en potrero ${data.loteNombre} - ${data.hectareasFinal} ha - Lámina: ${data.lamina} mm`
        if (data.metodo) {
          descripcion += ` - Método: ${data.metodo}`
        }
        if (data.duracion) {
          descripcion += ` - Duración: ${data.duracion} horas`
        }
        break

      case 'MONITOREO':
        descripcion = `Monitoreo de ${data.cultivo} en potrero ${data.loteNombre}`
        if (data.estado) {
          descripcion += ` - Estado: ${data.estado}`
        }
        if (data.plagas) {
          descripcion += ` - Plagas/Enfermedades: ${data.plagas}`
        }
        if (data.requiereAccion) {
          descripcion += ` - ⚠️ Requiere acción`
        }
        if (data.observaciones) {
          notas = `Observaciones: ${data.observaciones}`
        }
        break

      case 'OTROS_LABORES':
        descripcion = `${data.labor || 'Labor agrícola'} en cultivo de ${data.cultivo}, potrero "${data.loteNombre}"`
        if (data.hectareasFinal) {
          descripcion += ` (${data.hectareasFinal} hectáreas)`
        }
        break
    }

    // Crear evento en la base de datos
    const evento = await prisma.evento.create({
      data: {
        tipo: data.tipo,
        fecha: new Date(),
        descripcion,
        campoId: usuario.campoId,
        loteId: data.loteId,
        usuarioId: usuario.id,
        cantidad: data.hectareasFinal,
        notas: notas || null
      }
    })

    // Si es SIEMBRA, crear también el registro de cultivo
    if (data.tipo === 'SIEMBRA') {
      await prisma.cultivo.create({
        data: {
          tipoCultivo: data.cultivo,
          hectareas: data.hectareasFinal,
          fechaSiembra: new Date(),
          loteId: data.loteId
        }
      })
    }

    // Limpiar confirmación pendiente
    await prisma.pendingConfirmation.delete({
      where: { telefono: from }
    })

    // Enviar confirmación
    const emojis: Record<string, string> = {
      'SIEMBRA': '🌱',
      'COSECHA': '🌾',
      'PULVERIZACION': '💦',
      'REFERTILIZACION': '🌿',
      'RIEGO': '💧',
      'MONITOREO': '🔍',
      'OTROS_LABORES': '🔧'
    }

    await sendWhatsAppMessage(
      from,
      `${emojis[data.tipo] || '✅'} ${data.tipo.charAt(0) + data.tipo.slice(1).toLowerCase()} registrada correctamente.\n\n` +
      `📍 ${data.loteNombre}\n` +
      `🌱 ${data.cultivo}` +
      (data.hectareasFinal ? `\n📐 ${data.hectareasFinal} ha` : '')
    )

    console.log(`✅ Evento de agricultura registrado: ${data.tipo} en ${data.loteNombre}`)

  } catch (error) {
    console.error("Error en confirmarAgricultura:", error)
    await sendWhatsAppMessage(from, "❌ Hubo un error guardando el registro.")
  }
}

/**
 * Cancela el evento de agricultura pendiente
 */
export async function cancelarAgricultura(from: string) {
  try {
    await prisma.pendingConfirmation.delete({
      where: { telefono: from }
    })
    await sendWhatsAppMessage(from, "❌ Operación cancelada.")
  } catch (error) {
    console.error("Error cancelando agricultura:", error)
  }
}
