// src/lib/whatsapp/handlers/gastoHandler.ts

import { prisma } from "@/lib/prisma"
import { processInvoiceImage } from "@/lib/vision-parser"
import { getUSDToUYU } from "@/lib/currency"
import { sendWhatsAppMessage, sendCustomButtons } from "../services/messageService"
import crypto from "crypto"

const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN
const WHATSAPP_PHONE_ID = process.env.WHATSAPP_PHONE_ID
const FLOW_GASTO_ID = process.env.FLOW_GASTO_ID

/**
 * Procesa una imagen de factura de GASTO
 */
export async function handleGastoImage(
  phoneNumber: string,
  imageUrl: string,
  imageName: string,
  campoId: string,
  caption: string
) {
  try {
    const invoiceData = await processInvoiceImage(imageUrl)

    if (!invoiceData || !invoiceData.items || invoiceData.items.length === 0) {
      await sendWhatsAppMessage(phoneNumber, "No pude leer la factura de gasto. ¿La imagen está clara?")
      return
    }

    await prisma.pendingConfirmation.upsert({
      where: { telefono: phoneNumber },
      create: {
        telefono: phoneNumber,
        data: JSON.stringify({
          tipo: "INVOICE",
          invoiceData,
          imageUrl,
          imageName,
          campoId,
          telefono: phoneNumber,
          caption,
        }),
      },
      update: {
        data: JSON.stringify({
          tipo: "INVOICE",
          invoiceData,
          imageUrl,
          imageName,
          campoId,
          telefono: phoneNumber,
          caption,
        }),
      },
    })

    await sendInvoiceFlowMessage(phoneNumber, invoiceData)
  } catch (error) {
    console.error("Error en handleGastoImage:", error)
    await sendWhatsAppMessage(phoneNumber, "Error procesando la factura de gasto.")
  }
}

/**
 * Envía un WhatsApp Flow para editar factura
 * Si falla, usa botones tradicionales
 */
export async function sendInvoiceFlowMessage(
  phoneNumber: string,
  invoiceData: any
) {
  try {
    if (!FLOW_GASTO_ID) {
      console.error("FLOW_GASTO_ID no configurado")
      await sendInvoiceConfirmation(phoneNumber, invoiceData)
      return false
    }

    const flowToken = crypto.randomBytes(16).toString('hex')

    await prisma.pendingConfirmation.upsert({
      where: { telefono: phoneNumber },
      create: {
        telefono: phoneNumber,
        data: JSON.stringify({
          tipo: "INVOICE_FLOW",
          flowToken,
          invoiceData
        })
      },
      update: {
        data: JSON.stringify({
          tipo: "INVOICE_FLOW",
          flowToken,
          invoiceData
        })
      }
    })

    const response = await fetch(
      `https://graph.facebook.com/v18.0/${WHATSAPP_PHONE_ID}/messages`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${WHATSAPP_TOKEN}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: phoneNumber,
          type: "interactive",
          interactive: {
            type: "flow",
            header: {
              type: "text",
              text: "Factura Procesada"
            },
            body: {
              text: `Detecté estos datos:\n\n` +
                    `• Proveedor: ${invoiceData.proveedor || 'N/A'}\n` +
                    `• Fecha: ${invoiceData.fecha}\n` +
                    `• Total: $${invoiceData.montoTotal?.toFixed(2) || '0.00'}\n\n` +
                    `Tocá "Ver menú" para revisar y editar:`
            },
            footer: {
              text: "FieldData"
            },
            action: {
              name: "flow",
              parameters: {
                flow_message_version: "3",
                flow_token: flowToken,
                flow_id: FLOW_GASTO_ID,
                flow_cta: "Ver menú",
                flow_action: "navigate",
                flow_action_payload: {
                  screen: "EDIT_INVOICE",
                  data: {
                    phone_number: phoneNumber,
                    proveedor: invoiceData.proveedor || "",
                    fecha: invoiceData.fecha || new Date().toISOString().split('T')[0],
                    moneda: invoiceData.moneda || "UYU",
                    item_nombre: invoiceData.items?.[0]?.descripcion || "",
                    item_categoria: invoiceData.items?.[0]?.categoria || "Otros",
                    item_precio: invoiceData.items?.[0]?.precioSinIva?.toString() || "0",
                    item_iva: invoiceData.items?.[0]?.iva?.toString() || "0"
                  }
                }
              }
            }
          }
        })
      }
    )

    if (!response.ok) {
      const error = await response.json()
      console.error("Error enviando Flow:", error)
      await sendInvoiceConfirmation(phoneNumber, invoiceData)
      return false
    }

    console.log("Flow enviado correctamente")
    return true

  } catch (error) {
    console.error("Error en sendInvoiceFlowMessage:", error)
    await sendInvoiceConfirmation(phoneNumber, invoiceData)
    return false
  }
}

/**
 * Envía confirmación con botones (fallback cuando no hay flow)
 */
async function sendInvoiceConfirmation(phoneNumber: string, data: any) {
  const itemsList = data.items
    .map(
      (item: any, i: number) =>
        `${i + 1}. ${item.descripcion} - $${item.precioFinal.toFixed(
          2
        )} (${item.categoria})`
    )
    .join("\n")

  const bodyText =
    `*Factura procesada:*\n\n` +
    `Proveedor: ${data.proveedor}\n` +
    `Fecha: ${data.fecha}\n` +
    `Total: $${data.montoTotal.toFixed(2)}\n` +
    `Pago: ${data.metodoPago}${
      data.diasPlazo ? ` (${data.diasPlazo} días)` : ""
    }\n\n` +
    `*Ítems:*\n${itemsList}\n\n` +
    `¿Todo correcto?`

  await sendCustomButtons(phoneNumber, bodyText, [
    { id: "invoice_confirm", title: "Confirmar" },
    { id: "invoice_edit", title: "Editar" },
    { id: "invoice_cancel", title: "Cancelar" },
  ])
}

/**
 * Maneja la respuesta a los botones de factura
 */
export async function handleInvoiceButtonResponse(
  phoneNumber: string,
  buttonId: string
) {
  try {
    const confirmacionPendiente = await prisma.pendingConfirmation.findUnique({
      where: { telefono: phoneNumber },
    })

    if (!confirmacionPendiente) {
      await sendWhatsAppMessage(
        phoneNumber,
        "No hay ninguna factura pendiente de confirmación."
      )
      return
    }

    const savedData = JSON.parse(confirmacionPendiente.data)

    if (savedData.tipo !== "INVOICE") {
      await sendWhatsAppMessage(
        phoneNumber,
        "Error: esta confirmación no corresponde a una factura."
      )
      return
    }

    const action = buttonId.replace("invoice_", "")

    if (action === "confirm") {
      const { invoiceData, imageUrl, imageName, campoId } = savedData

      const monedaFactura = invoiceData.moneda === "USD" ? "USD" : "UYU"

      let tasaCambio = null

      if (monedaFactura === "USD") {
        try {
          tasaCambio = await getUSDToUYU()
        } catch (err) {
          console.log("Error obteniendo dólar → uso 40")
          tasaCambio = 40
        }
      }

      console.log("📋 DATOS ANTES DE GUARDAR:")
      console.log("  Proveedor original:", invoiceData.proveedor)
      console.log("  Proveedor normalizado:", invoiceData.proveedor?.trim().toLowerCase() || null)
      
      for (const item of invoiceData.items) {
        const montoOriginal = item.precioFinal
        const montoEnUYU =
          monedaFactura === "USD" ? montoOriginal * tasaCambio : montoOriginal
        
        const montoEnUSD =
          monedaFactura === "USD" 
            ? montoOriginal 
            : montoOriginal / (tasaCambio || 40)

        await prisma.gasto.create({
          data: {
            tipo: invoiceData.tipo,
            fecha: new Date(invoiceData.fecha),
            descripcion: item.descripcion,
            categoria: item.categoria || "Otros",
            proveedor: invoiceData.proveedor?.trim().toLowerCase() || null,
            metodoPago: invoiceData.metodoPago,
            pagado: invoiceData.pagado,
            diasPlazo: invoiceData.diasPlazo || null,
            iva: item.iva,
            campoId,
            imageUrl,
            imageName,
            moneda: monedaFactura,
            montoOriginal,
            tasaCambio,
            montoEnUYU,
            montoEnUSD,
            especie: null,
            monto: montoEnUYU,
          },
        })
        console.log("✅ GASTO GUARDADO CON PROVEEDOR:", invoiceData.proveedor?.trim().toLowerCase() || null)
      }

      

      await sendWhatsAppMessage(
        phoneNumber,
        "¡Factura confirmada y guardada correctamente!"
      )

      await prisma.pendingConfirmation.delete({
        where: { telefono: phoneNumber },
      })

      return
    }

    if (action === "cancel") {
      await sendWhatsAppMessage(
        phoneNumber,
        "Factura cancelada. No se guardó nada."
      )

      await prisma.pendingConfirmation.delete({
        where: { telefono: phoneNumber },
      })
      return
    }

    if (action === "edit") {
      await sendWhatsAppMessage(
        phoneNumber,
        "Ok, enviame los datos corregidos o reenviá otra foto."
      )

      await prisma.pendingConfirmation.delete({
        where: { telefono: phoneNumber },
      })
      return
    }
  } catch (error) {
    console.error("Error en handleInvoiceButtonResponse:", error)
    await sendWhatsAppMessage(
      phoneNumber,
      "Error procesando tu respuesta."
    )
  }
}

/**
 * Solicita confirmación con Flow para gastos de texto/audio
 */
export async function solicitarConfirmacionConFlow(phone: string, data: any) {
  try {
    if (!FLOW_GASTO_ID) {
      console.log("Flow no configurado, usando botones")
      // Esta función se importará desde confirmationHandler
      return null // Por ahora retornamos null, se manejará en route.ts
    }

    const flowToken = crypto.randomBytes(16).toString('hex')

    await prisma.pendingConfirmation.upsert({
      where: { telefono: phone },
      create: {
        telefono: phone,
        data: JSON.stringify({
          tipo: "GASTO_FLOW",
          flowToken,
          gastoData: data
        })
      },
      update: {
        data: JSON.stringify({
          tipo: "GASTO_FLOW",
          flowToken,
          gastoData: data
        })
      }
    })

    const response = await fetch(
      `https://graph.facebook.com/v18.0/${WHATSAPP_PHONE_ID}/messages`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${WHATSAPP_TOKEN}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: phone,
          type: "interactive",
          interactive: {
            type: "flow",
            header: {
              type: "text",
              text: "Gasto Detectado"
            },
            body: {
              text: `Entendí este gasto:\n\n` +
                    `• ${data.descripcion}\n` +
                    `• Monto: $${data.monto}\n` +
                    `• Categoría: ${data.categoria}\n\n` +
                    `Tocá "Ver menú" para revisar y completar:`
            },
            footer: {
              text: "FieldData"
            },
            action: {
              name: "flow",
              parameters: {
                flow_message_version: "3",
                flow_token: flowToken,
                flow_id: FLOW_GASTO_ID,
                flow_cta: "Ver menú",
                flow_action: "navigate",
                flow_action_payload: {
                  screen: "EDIT_INVOICE",
                  data: {
                    phone_number: phone,
                    proveedor: data.proveedor || "",
                    fecha: new Date().toISOString().split('T')[0],
                    moneda: "UYU",
                    item_nombre: data.descripcion || "",
                    item_categoria: data.categoria || "Otros",
                    item_precio: data.monto?.toString() || "0",
                    item_iva: "0"
                  }
                }
              }
            }
          }
        })
      }
    )

    if (!response.ok) {
      const error = await response.json()
      console.error("Error enviando Flow:", error)
      return null
    }

    console.log("Flow de gasto enviado")
    return true

  } catch (error) {
    console.error("Error en solicitarConfirmacionConFlow:", error)
    return null
  }
}