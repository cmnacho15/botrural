// 📁 /app/api/whatsapp/flow-endpoint/route.ts

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getUSDToUYU } from "@/lib/currency"
import crypto from "crypto"

/**
 * 🔐 Verificar firma de WhatsApp (seguridad)
 */
function verifySignature(
  payload: string,
  signature: string | null
): boolean {
  if (!signature) return false

  const appSecret = process.env.WHATSAPP_APP_SECRET
  if (!appSecret) {
    console.warn("⚠️ WHATSAPP_APP_SECRET no configurado")
    return true // En desarrollo, permitir sin validación
  }

  try {
    const expectedSignature = crypto
      .createHmac("sha256", appSecret)
      .update(payload)
      .digest("hex")

    return signature === `sha256=${expectedSignature}`
  } catch (error) {
    console.error("❌ Error verificando firma:", error)
    return false
  }
}

/**
 * 📥 POST - Recibir datos del Flow
 */
export async function POST(request: Request) {
  try {
    const rawBody = await request.text()
    const signature = request.headers.get("x-hub-signature-256")

    // Verificar firma de seguridad
    if (!verifySignature(rawBody, signature)) {
      console.error("❌ Firma inválida en Flow endpoint")
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 401 }
      )
    }

    const body = JSON.parse(rawBody)
    
    console.log("📥 Datos del Flow:", JSON.stringify(body, null, 2))

    // WhatsApp envía diferentes tipos de requests
    const { action, flow_token, screen, data } = body

    // 🔄 INICIALIZACIÓN DEL FLOW
    if (action === "ping") {
      return NextResponse.json({
        version: "3.0",
        data: {
          status: "active"
        }
      })
    }

    // 📊 REQUEST DE DATA (cuando el Flow se abre)
    if (action === "data_exchange") {
      // Acá podrías cargar datos iniciales si los necesitás
      return NextResponse.json({
        version: "3.0",
        screen: screen || "EDIT_INVOICE",
        data: data || {}
      })
    }

    // ✅ USUARIO COMPLETÓ EL FORMULARIO
    if (action === "COMPLETE" || action === "complete") {
      const formData = data

      console.log("✅ Formulario completado:", formData)

      // Extraer teléfono del flow_token si lo guardaste ahí
      // O buscar usuario activo en pendingConfirmation
      const phoneNumber = formData.phone_number || await getPhoneFromToken(flow_token)

      if (!phoneNumber) {
        console.error("❌ No se encontró teléfono asociado")
        return NextResponse.json({
          version: "3.0",
          screen: "ERROR",
          data: {
            error: "Usuario no encontrado"
          }
        })
      }

      // Buscar usuario y campo
      const user = await prisma.user.findUnique({
        where: { telefono: phoneNumber },
        select: { id: true, campoId: true }
      })

      if (!user || !user.campoId) {
        console.error("❌ Usuario no encontrado:", phoneNumber)
        return NextResponse.json({
          version: "3.0",
          screen: "ERROR",
          data: {
            error: "Usuario no registrado"
          }
        })
      }

      // Calcular montos
      const precioSinIva = parseFloat(formData.item_precio || "0")
      const ivaPorc = parseFloat(formData.item_iva || "0")
      const montoIva = precioSinIva * (ivaPorc / 100)
      const precioFinal = precioSinIva + montoIva
      const moneda = formData.moneda || "UYU"

      // Obtener tasa de cambio si es USD
      let tasaCambio = null
      let montoEnUYU = precioFinal

      if (moneda === "USD") {
        try {
          tasaCambio = await getUSDToUYU()
          montoEnUYU = precioFinal * tasaCambio
        } catch (error) {
          console.error("Error obteniendo tasa:", error)
          tasaCambio = 40 // fallback
          montoEnUYU = precioFinal * 40
        }
      }

      // Obtener datos de la imagen si existen en pendingConfirmation
      const pendingData = await prisma.pendingConfirmation.findUnique({
        where: { telefono: phoneNumber }
      })

      let imageUrl = null
      let imageName = null

      if (pendingData) {
        try {
          const savedData = JSON.parse(pendingData.data)
          imageUrl = savedData.imageUrl
          imageName = savedData.imageName
        } catch (e) {
          console.log("No hay imagen asociada")
        }
      }

      // Guardar en BD
await prisma.gasto.create({
  data: {
    tipo: "GASTO",
    fecha: new Date(formData.fecha),
    descripcion: formData.item_nombre,
    categoria: formData.item_categoria,
    proveedor: formData.proveedor || null,
    metodoPago: "Contado", 
    pagado: true,
    diasPlazo: null,
    iva: ivaPorc,
    campoId: user.campoId,
    imageUrl,
    imageName,
    
    // 💵 Campos de moneda (para que coincida con tu nuevo modelo)
    moneda,
    montoOriginal: precioFinal,
    tasaCambio,
    montoEnUYU,
    monto: montoEnUYU
  }
})

      // Limpiar confirmación pendiente
      if (pendingData) {
        await prisma.pendingConfirmation.delete({
          where: { telefono: phoneNumber }
        }).catch(() => {})
      }

      console.log("✅ Gasto guardado desde Flow")

      // Enviar confirmación por WhatsApp
      await sendWhatsAppConfirmation(phoneNumber, formData, montoEnUYU)

      // Responder al Flow con éxito
      return NextResponse.json({
        version: "3.0",
        screen: "SUCCESS",
        data: {
          extension_message_response: {
            params: {
              flow_token,
              some_param_name: "Guardado exitosamente"
            }
          }
        }
      })
    }

    // Request no reconocido
    console.log("⚠️ Action no reconocido:", action)
    return NextResponse.json({
      version: "3.0",
      data: {}
    })

  } catch (error) {
    console.error("💥 Error en flow-endpoint:", error)
    return NextResponse.json(
      { 
        version: "3.0",
        screen: "ERROR",
        data: {
          error: "Error interno del servidor"
        }
      },
      { status: 500 }
    )
  }
}

/**
 * 📞 Obtener teléfono desde el flow_token
 * (guardás phone en un Map temporal o en Redis)
 */
async function getPhoneFromToken(token: string): Promise<string | null> {
  // Opción 1: Buscar en pendingConfirmation
  const pending = await prisma.pendingConfirmation.findFirst({
    where: {
      data: {
        contains: token
      }
    }
  })

  if (pending) {
    return pending.telefono
  }

  // Opción 2: Si guardaste en memoria (no recomendado en producción)
  // return flowTokenMap.get(token) || null

  return null
}

/**
 * 📤 Enviar confirmación por WhatsApp
 */
async function sendWhatsAppConfirmation(
  phoneNumber: string,
  formData: any,
  montoTotal: number
) {
  try {
    const message = 
      `✅ *¡Gasto guardado correctamente!*\n\n` +
      `📄 *Detalle:*\n` +
      `• Item: ${formData.item_nombre}\n` +
      `• Categoría: ${formData.item_categoria}\n` +
      `• Precio: $${montoTotal.toFixed(2)}\n` +
      `• Fecha: ${formData.fecha}`

    await fetch(
      `https://graph.facebook.com/v18.0/${process.env.WHATSAPP_PHONE_ID}/messages`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.WHATSAPP_TOKEN}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: phoneNumber,
          type: "text",
          text: { body: message }
        })
      }
    )
  } catch (error) {
    console.error("Error enviando confirmación:", error)
  }
}