// src/lib/whatsapp/handlers/pagoHandler.ts
// Handler para procesar estados de cuenta y registrar pagos

import { prisma } from "@/lib/prisma"
import { sendWhatsAppMessage, sendCustomButtons } from "../services/messageService"
import OpenAI from "openai"
import { trackOpenAIChat } from "@/lib/ai-usage-tracker"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

interface DatosEstadoCuenta {
  proveedor: string
  saldoActual: number
  moneda: "USD" | "UYU"
  fechaVencimiento?: string
}

/**
 * Extrae datos básicos de un estado de cuenta
 */
async function extraerDatosEstadoCuenta(imageUrl: string, userId?: string): Promise<DatosEstadoCuenta | null> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `Extrae los datos de este estado de cuenta.

BUSCAR:
1. Nombre del proveedor/empresa (en el encabezado)
2. Saldo actual o saldo a pagar (el monto pendiente)
3. Moneda (USD o UYU)
4. Fecha de vencimiento (si existe)

RESPONDE EN JSON:
{
  "proveedor": "Nombre de la empresa",
  "saldoActual": 450.47,
  "moneda": "USD" o "UYU",
  "fechaVencimiento": "2025-07-15" o null
}

Si no puedes extraer los datos, responde: {"error": "No pude leer el estado de cuenta"}`
        },
        {
          role: "user",
          content: [{ type: "image_url", image_url: { url: imageUrl, detail: "high" } }]
        }
      ],
      max_tokens: 200,
      temperature: 0
    })

    // Trackear uso
    if (userId) {
      trackOpenAIChat(userId, 'PAGO_PARSER', response)
    }

    const content = response.choices[0].message.content || ""
    const jsonStr = content.replace(/```json/g, "").replace(/```/g, "").trim()
    const data = JSON.parse(jsonStr)

    if (data.error) {
      console.log("Error extrayendo estado de cuenta:", data.error)
      return null
    }

    return data as DatosEstadoCuenta
  } catch (error) {
    console.error("Error en extraerDatosEstadoCuenta:", error)
    return null
  }
}

/**
 * Busca gastos pendientes de un proveedor
 */
async function buscarGastosPendientes(
  campoId: string,
  proveedor: string
): Promise<Array<{id: string, descripcion: string, monto: number, moneda: string, fecha: Date}>> {
  // Normalizar nombre del proveedor para búsqueda
  const palabrasProveedor = proveedor
    .toLowerCase()
    .split(/\s+/)
    .filter(p => p.length > 2)

  // Buscar gastos no pagados que coincidan con el proveedor
  const gastosPendientes = await prisma.gasto.findMany({
    where: {
      campoId,
      pagado: false,
      tipo: "GASTO",
      OR: palabrasProveedor.map(palabra => ({
        proveedor: { contains: palabra, mode: 'insensitive' as const }
      }))
    },
    orderBy: { fecha: 'asc' },
    select: {
      id: true,
      descripcion: true,
      montoOriginal: true,
      moneda: true,
      fecha: true,
      proveedor: true,
    }
  })

  return gastosPendientes.map(g => ({
    id: g.id,
    descripcion: g.descripcion || g.proveedor || "Sin descripción",
    monto: g.montoOriginal,
    moneda: g.moneda,
    fecha: g.fecha,
  }))
}

/**
 * Maneja un estado de cuenta recibido
 */
export async function handleEstadoDeCuenta(
  phoneNumber: string,
  imageUrl: string,
  imageName: string,
  campoId: string
) {
  try {
    // Extraer datos del estado de cuenta
    const datos = await extraerDatosEstadoCuenta(imageUrl)

    if (!datos) {
      await sendWhatsAppMessage(
        phoneNumber,
        "No pude leer el estado de cuenta. Si querés registrar un pago, escribí:\n\n*pago [proveedor] [monto]*\n\nEjemplo: pago Bortagaray 450"
      )
      return
    }

    console.log("📋 Estado de cuenta detectado:", datos)

    // Buscar gastos pendientes del proveedor
    const gastosPendientes = await buscarGastosPendientes(campoId, datos.proveedor)

    if (gastosPendientes.length === 0) {
      // No hay gastos pendientes
      if (datos.saldoActual === 0) {
        await sendWhatsAppMessage(
          phoneNumber,
          `📋 *Estado de cuenta de ${datos.proveedor}*\n\n` +
          `Saldo: $0 - Todo pagado\n\n` +
          `No hay nada que registrar.`
        )
      } else {
        await sendWhatsAppMessage(
          phoneNumber,
          `📋 *Estado de cuenta de ${datos.proveedor}*\n\n` +
          `Saldo pendiente: $${datos.saldoActual.toFixed(2)} ${datos.moneda}\n\n` +
          `No encontré gastos pendientes de este proveedor en el sistema.\n` +
          `Si falta registrar algún gasto, enviá la factura original.`
        )
      }
      return
    }

    // Hay gastos pendientes - preguntar si marcar como pagados
    const totalPendiente = gastosPendientes.reduce((sum, g) => sum + g.monto, 0)

    let mensaje = `📋 *Estado de cuenta de ${datos.proveedor}*\n\n`
    mensaje += `Saldo según estado: $${datos.saldoActual.toFixed(2)} ${datos.moneda}\n\n`
    mensaje += `📝 *Gastos pendientes encontrados:*\n`

    gastosPendientes.forEach((g, i) => {
      const fechaStr = g.fecha.toLocaleDateString('es-UY', { day: '2-digit', month: '2-digit' })
      mensaje += `${i + 1}. $${g.monto.toFixed(2)} - ${g.descripcion} (${fechaStr})\n`
    })

    mensaje += `\n*Total pendiente:* $${totalPendiente.toFixed(2)}\n\n`

    // Guardar en pending para procesar respuesta
    await prisma.pendingConfirmation.upsert({
      where: { telefono: phoneNumber },
      create: {
        telefono: phoneNumber,
        data: JSON.stringify({
          tipo: "ESTADO_CUENTA_PAGO",
          proveedor: datos.proveedor,
          saldoEstado: datos.saldoActual,
          moneda: datos.moneda,
          gastosPendientes: gastosPendientes,
          campoId,
        })
      },
      update: {
        data: JSON.stringify({
          tipo: "ESTADO_CUENTA_PAGO",
          proveedor: datos.proveedor,
          saldoEstado: datos.saldoActual,
          moneda: datos.moneda,
          gastosPendientes: gastosPendientes,
          campoId,
        })
      }
    })

    if (gastosPendientes.length === 1) {
      mensaje += `¿Marcar como pagado?`
      await sendCustomButtons(phoneNumber, mensaje, [
        { id: "pago_confirm_all", title: "Marcar pagado" },
        { id: "pago_cancel", title: "Cancelar" },
      ])
    } else {
      mensaje += `¿Qué querés hacer?`
      await sendCustomButtons(phoneNumber, mensaje, [
        { id: "pago_confirm_all", title: "Pagar todos" },
        { id: "pago_select", title: "Elegir cuáles" },
        { id: "pago_cancel", title: "Cancelar" },
      ])
    }

  } catch (error) {
    console.error("Error en handleEstadoDeCuenta:", error)
    await sendWhatsAppMessage(phoneNumber, "Error procesando el estado de cuenta.")
  }
}

/**
 * Maneja respuesta a botones de pago
 */
export async function handlePagoButtonResponse(phoneNumber: string, buttonId: string) {
  try {
    const pending = await prisma.pendingConfirmation.findUnique({
      where: { telefono: phoneNumber }
    })

    if (!pending) {
      await sendWhatsAppMessage(phoneNumber, "No hay operación pendiente.")
      return
    }

    const data = JSON.parse(pending.data)

    if (data.tipo !== "ESTADO_CUENTA_PAGO") {
      return // No es para nosotros
    }

    // CANCELAR
    if (buttonId === "pago_cancel") {
      await sendWhatsAppMessage(phoneNumber, "Operación cancelada.")
      await prisma.pendingConfirmation.delete({ where: { telefono: phoneNumber } })
      return
    }

    // MARCAR TODOS COMO PAGADOS
    if (buttonId === "pago_confirm_all") {
      const gastosIds = data.gastosPendientes.map((g: any) => g.id)

      await prisma.gasto.updateMany({
        where: { id: { in: gastosIds } },
        data: {
          pagado: true,
          fechaPago: new Date(),
        }
      })

      const total = data.gastosPendientes.reduce((sum: number, g: any) => sum + g.monto, 0)

      await sendWhatsAppMessage(
        phoneNumber,
        `✅ *${data.gastosPendientes.length} gasto(s) marcado(s) como pagado(s)*\n\n` +
        `Proveedor: ${data.proveedor}\n` +
        `Total: $${total.toFixed(2)} ${data.moneda}`
      )

      await prisma.pendingConfirmation.delete({ where: { telefono: phoneNumber } })
      return
    }

    // ELEGIR CUÁLES PAGAR
    if (buttonId === "pago_select") {
      let mensaje = `Respondé con los números de los gastos a marcar como pagados.\n\n`
      mensaje += `Ejemplo: *1, 3* para pagar el primero y tercero\n`
      mensaje += `O *todos* para pagar todos\n\n`

      data.gastosPendientes.forEach((g: any, i: number) => {
        const fecha = new Date(g.fecha).toLocaleDateString('es-UY', { day: '2-digit', month: '2-digit' })
        mensaje += `${i + 1}. $${g.monto.toFixed(2)} - ${g.descripcion} (${fecha})\n`
      })

      await sendWhatsAppMessage(phoneNumber, mensaje)
      return
    }

    // Manejar selección específica (pago_1, pago_2, etc.)
    if (buttonId.startsWith("pago_")) {
      const index = parseInt(buttonId.replace("pago_", "")) - 1
      if (index >= 0 && index < data.gastosPendientes.length) {
        const gasto = data.gastosPendientes[index]

        await prisma.gasto.update({
          where: { id: gasto.id },
          data: {
            pagado: true,
            fechaPago: new Date(),
          }
        })

        await sendWhatsAppMessage(
          phoneNumber,
          `✅ Gasto marcado como pagado:\n$${gasto.monto.toFixed(2)} - ${gasto.descripcion}`
        )

        await prisma.pendingConfirmation.delete({ where: { telefono: phoneNumber } })
      }
    }

  } catch (error) {
    console.error("Error en handlePagoButtonResponse:", error)
    await sendWhatsAppMessage(phoneNumber, "Error procesando el pago.")
  }
}

/**
 * Maneja respuesta de texto para selección de pagos
 */
export async function handlePagoTextResponse(phoneNumber: string, mensaje: string): Promise<boolean> {
  try {
    const pending = await prisma.pendingConfirmation.findUnique({
      where: { telefono: phoneNumber }
    })

    if (!pending) return false

    const data = JSON.parse(pending.data)

    if (data.tipo !== "ESTADO_CUENTA_PAGO") return false

    const mensajeLower = mensaje.toLowerCase().trim()

    // "todos" - pagar todos
    if (mensajeLower === "todos" || mensajeLower === "all") {
      const gastosIds = data.gastosPendientes.map((g: any) => g.id)

      await prisma.gasto.updateMany({
        where: { id: { in: gastosIds } },
        data: {
          pagado: true,
          fechaPago: new Date(),
        }
      })

      const total = data.gastosPendientes.reduce((sum: number, g: any) => sum + g.monto, 0)

      await sendWhatsAppMessage(
        phoneNumber,
        `✅ *${data.gastosPendientes.length} gasto(s) marcado(s) como pagado(s)*\n\n` +
        `Total: $${total.toFixed(2)} ${data.moneda}`
      )

      await prisma.pendingConfirmation.delete({ where: { telefono: phoneNumber } })
      return true
    }

    // "cancelar"
    if (mensajeLower === "cancelar" || mensajeLower === "no") {
      await sendWhatsAppMessage(phoneNumber, "Operación cancelada.")
      await prisma.pendingConfirmation.delete({ where: { telefono: phoneNumber } })
      return true
    }

    // Parsear números separados por coma: "1, 3" o "1,3" o "1 3"
    const numeros = mensaje
      .split(/[,\s]+/)
      .map(n => parseInt(n.trim()))
      .filter(n => !isNaN(n) && n > 0 && n <= data.gastosPendientes.length)

    if (numeros.length === 0) {
      await sendWhatsAppMessage(
        phoneNumber,
        "No entendí. Escribí los números separados por coma (ej: 1, 3) o 'todos' o 'cancelar'"
      )
      return true
    }

    // Marcar los seleccionados como pagados
    const gastosAPagar = numeros.map(n => data.gastosPendientes[n - 1])
    const ids = gastosAPagar.map((g: any) => g.id)

    await prisma.gasto.updateMany({
      where: { id: { in: ids } },
      data: {
        pagado: true,
        fechaPago: new Date(),
      }
    })

    const total = gastosAPagar.reduce((sum: number, g: any) => sum + g.monto, 0)

    await sendWhatsAppMessage(
      phoneNumber,
      `✅ *${gastosAPagar.length} gasto(s) marcado(s) como pagado(s)*\n\n` +
      gastosAPagar.map((g: any) => `• $${g.monto.toFixed(2)} - ${g.descripcion}`).join('\n') +
      `\n\nTotal: $${total.toFixed(2)}`
    )

    await prisma.pendingConfirmation.delete({ where: { telefono: phoneNumber } })
    return true

  } catch (error) {
    console.error("Error en handlePagoTextResponse:", error)
    return false
  }
}
