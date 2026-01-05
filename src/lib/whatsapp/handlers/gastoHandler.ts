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
 * Verifica si el campo tiene grupo y retorna los campos del mismo
 */
async function obtenerCamposDelGrupo(campoId: string) {
  try {
    const campoActual = await prisma.campo.findUnique({
      where: { id: campoId },
      select: { id: true, nombre: true, grupoId: true }
    })

    if (!campoActual?.grupoId) {
      return null // Campo sin grupo
    }

    // Obtener TODOS los campos del mismo grupo
    const camposDelGrupo = await prisma.campo.findMany({
      where: { grupoId: campoActual.grupoId },
      select: {
        id: true,
        nombre: true,
        lotes: {
          select: { hectareas: true }
        }
      }
    })

    if (camposDelGrupo.length <= 1) {
      return null // Solo tiene 1 campo en el grupo
    }

    // Calcular hectáreas totales de cada campo
    const camposConHectareas = camposDelGrupo.map(campo => ({
      id: campo.id,
      nombre: campo.nombre,
      hectareas: campo.lotes.reduce((sum, l) => sum + l.hectareas, 0)
    }))

    return {
      grupoId: campoActual.grupoId,
      campos: camposConHectareas
    }
  } catch (error) {
    console.error('Error obteniendo campos del grupo:', error)
    return null
  }
}

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

    const flowSent = await sendInvoiceFlowMessage(phoneNumber, invoiceData)
    if (!flowSent) {
      // Si falla el flow, usar botones con soporte de multicampo
      await sendInvoiceConfirmation(phoneNumber, invoiceData, campoId)
    }
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
      return false
    }

    console.log("Flow enviado correctamente")
    return true

  } catch (error) {
    console.error("Error en sendInvoiceFlowMessage:", error)
    return false
  }
}

/**
 * Envía confirmación con botones (fallback cuando no hay flow)
 */
async function sendInvoiceConfirmation(phoneNumber: string, data: any, campoId?: string) {
  const itemsList = data.items
    .map(
      (item: any, i: number) =>
        `${i + 1}. ${item.descripcion} - $${item.precioFinal.toFixed(
          2
        )} (${item.categoria})`
    )
    .join("\n")

  let bodyText =
    `*Factura procesada:*\n\n` +
    `Proveedor: ${data.proveedor}\n` +
    `Fecha: ${data.fecha}\n` +
    `Total: $${data.montoTotal.toFixed(2)}\n` +
    `Pago: ${data.metodoPago}${
      data.diasPlazo ? ` (${data.diasPlazo} días)` : ""
    }\n\n` +
    `*Ítems:*\n${itemsList}\n\n`

  // 🏢 Verificar si hay multicampo
  let grupoInfo = null
  if (campoId) {
    grupoInfo = await obtenerCamposDelGrupo(campoId)
  }

  if (grupoInfo) {
    // Mostrar opción de gasto compartido
    const totalHectareas = grupoInfo.campos.reduce((sum, c) => sum + c.hectareas, 0)
    
    bodyText += `🏢 *Detectamos ${grupoInfo.campos.length} campos en el grupo*\n\n`
    bodyText += `¿Es un gasto compartido?\n\n`

    await sendCustomButtons(phoneNumber, bodyText, [
      { id: "invoice_shared", title: "🏢 Compartir" },
      { id: "invoice_single", title: "📍 Solo este campo" },
      { id: "invoice_cancel", title: "❌ Cancelar" },
    ])
  } else {
    // Sin multicampo, confirmación normal
    bodyText += `¿Todo correcto?`
    
    await sendCustomButtons(phoneNumber, bodyText, [
      { id: "invoice_confirm", title: "✅ Confirmar" },
      { id: "invoice_edit", title: "✏️ Editar" },
      { id: "invoice_cancel", title: "❌ Cancelar" },
    ])
  }
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

    const { invoiceData, imageUrl, imageName, campoId } = savedData

    // 🏢 MANEJO DE GASTO COMPARTIDO
    if (buttonId === "invoice_shared") {
      const grupoInfo = await obtenerCamposDelGrupo(campoId)
      
      if (!grupoInfo) {
        await sendWhatsAppMessage(phoneNumber, "Error: no se pudo obtener información del grupo.")
        return
      }

      const totalHectareas = grupoInfo.campos.reduce((sum, c) => sum + c.hectareas, 0)
      
      // Mostrar distribución
      let mensaje = `📊 *Distribución del gasto:*\n\n`
      
      grupoInfo.campos.forEach(campo => {
        const porcentaje = (campo.hectareas / totalHectareas) * 100
        const montoAsignado = invoiceData.montoTotal * (porcentaje / 100)
        mensaje += `• ${campo.nombre} (${campo.hectareas.toFixed(1)} ha)\n`
        mensaje += `  ${porcentaje.toFixed(1)}% = $${montoAsignado.toFixed(2)}\n\n`
      })
      
      mensaje += `¿Confirmar distribución?`
      
      // Guardar info de grupo en confirmación
      await prisma.pendingConfirmation.update({
        where: { telefono: phoneNumber },
        data: {
          data: JSON.stringify({
            ...savedData,
            esGastoCompartido: true,
            grupoInfo
          })
        }
      })
      
      await sendCustomButtons(phoneNumber, mensaje, [
        { id: "invoice_confirm_shared", title: "✅ Confirmar" },
        { id: "invoice_cancel", title: "❌ Cancelar" },
      ])
      return
    }

    // 📍 GASTO SOLO PARA ESTE CAMPO
    if (buttonId === "invoice_single") {
      await prisma.pendingConfirmation.update({
        where: { telefono: phoneNumber },
        data: {
          data: JSON.stringify({
            ...savedData,
            esGastoCompartido: false
          })
        }
      })
      
      await sendCustomButtons(phoneNumber, "¿Confirmar gasto solo para este campo?", [
        { id: "invoice_confirm", title: "✅ Confirmar" },
        { id: "invoice_cancel", title: "❌ Cancelar" },
      ])
      return
    }

    // ✅ CONFIRMAR GASTO COMPARTIDO
    if (buttonId === "invoice_confirm_shared") {
      if (!savedData.esGastoCompartido || !savedData.grupoInfo) {
        await sendWhatsAppMessage(phoneNumber, "Error: falta información del gasto compartido.")
        return
      }

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

      const totalHectareas = savedData.grupoInfo.campos.reduce((sum: number, c: any) => sum + c.hectareas, 0)

      // Crear gasto para cada campo del grupo
      for (const campo of savedData.grupoInfo.campos) {
        const porcentaje = (campo.hectareas / totalHectareas) * 100
        
        for (const item of invoiceData.items) {
          const montoOriginalItem = item.precioFinal
          const montoAsignadoCampo = montoOriginalItem * (porcentaje / 100)
          
          const montoEnUYU = monedaFactura === "USD" 
            ? montoAsignadoCampo * tasaCambio 
            : montoAsignadoCampo
          
          const montoEnUSD = monedaFactura === "USD" 
            ? montoAsignadoCampo 
            : montoAsignadoCampo / (tasaCambio || 40)

          await prisma.gasto.create({
            data: {
              tipo: invoiceData.tipo,
              fecha: new Date(invoiceData.fecha),
              descripcion: item.descripcion,
              categoria: item.categoria || "Otros",
              proveedor: invoiceData.proveedor?.trim() || null,
              metodoPago: invoiceData.metodoPago,
              pagado: invoiceData.pagado,
              diasPlazo: invoiceData.diasPlazo || null,
              iva: item.iva,
              campoId: campo.id,
              imageUrl,
              imageName,
              moneda: monedaFactura,
              montoOriginal: montoAsignadoCampo,
              tasaCambio,
              montoEnUYU,
              montoEnUSD,
              especie: null,
              monto: montoEnUYU,
              // 🏢 Metadata de gasto compartido
              esGastoGrupo: true,
              grupoId: savedData.grupoInfo.grupoId,
              montoTotalGrupo: montoOriginalItem,
              porcentajeDistribuido: porcentaje,
            },
          })
        }
      }

      await sendWhatsAppMessage(
        phoneNumber,
        `✅ ¡Gasto compartido registrado!\n\nSe distribuyó entre ${savedData.grupoInfo.campos.length} campos según hectáreas.`
      )

      await prisma.pendingConfirmation.delete({
        where: { telefono: phoneNumber },
      })
      return
    }

    // ✅ CONFIRMAR GASTO NORMAL (un solo campo)
    if (buttonId === "invoice_confirm") {
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
            proveedor: invoiceData.proveedor?.trim() || null,
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
            // Normal (sin compartir)
            esGastoGrupo: false,
            grupoId: null,
            montoTotalGrupo: null,
            porcentajeDistribuido: null,
          },
        })
        console.log("✅ GASTO GUARDADO CON PROVEEDOR:", invoiceData.proveedor?.trim().toLowerCase() || null)
      }

      await sendWhatsAppMessage(
        phoneNumber,
        "✅ ¡Factura confirmada y guardada correctamente!"
      )

      await prisma.pendingConfirmation.delete({
        where: { telefono: phoneNumber },
      })
      return
    }

    // ❌ CANCELAR
    if (buttonId === "invoice_cancel") {
      await sendWhatsAppMessage(
        phoneNumber,
        "❌ Factura cancelada. No se guardó nada."
      )

      await prisma.pendingConfirmation.delete({
        where: { telefono: phoneNumber },
      })
      return
    }

    // ✏️ EDITAR
    if (buttonId === "invoice_edit") {
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
      "❌ Error procesando tu respuesta."
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
      return null
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