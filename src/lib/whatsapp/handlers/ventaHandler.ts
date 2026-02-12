// src/lib/whatsapp/handlers/ventaHandler.ts

import { prisma } from "@/lib/prisma"
import { processVentaImage, mapearCategoriaVenta } from "@/lib/vision-venta-parser"
import { buscarPotrerosConCategoria } from "@/lib/potrero-helpers"
import { sendWhatsAppMessage, sendCustomButtons } from "../services/messageService"
import { convertirAUYU, obtenerTasaCambio } from "@/lib/currency"
import type { ParsedVentaGanado, ParsedVentaLana, ParsedVentaGranos } from "@/lib/vision-venta-parser"

/**
 * Procesa una imagen de factura de VENTA
 */
export async function handleVentaImage(
  phoneNumber: string,
  imageUrl: string,
  imageName: string,
  campoId: string,
  caption: string,
  userId?: string
) {
  try {
    // Si no viene userId, buscarlo por teléfono
    let userIdToUse = userId
    if (!userIdToUse) {
      const user = await prisma.user.findUnique({
        where: { telefono: phoneNumber },
        select: { id: true }
      })
      userIdToUse = user?.id
    }

    const ventaData = await processVentaImage(imageUrl, campoId, userIdToUse)
    if (!ventaData || !ventaData.renglones?.length) {
      await sendWhatsAppMessage(phoneNumber, "No pude leer la factura de venta. ¿La imagen está clara?")
      return
    }

    await prisma.pendingConfirmation.upsert({
      where: { telefono: phoneNumber },
      create: { 
        telefono: phoneNumber, 
        data: JSON.stringify({ 
          tipo: "VENTA", 
          ventaData, 
          imageUrl, 
          imageName, 
          campoId 
        }) 
      },
      update: { 
        data: JSON.stringify({ 
          tipo: "VENTA", 
          ventaData, 
          imageUrl, 
          imageName, 
          campoId 
        }) 
      },
    })

    await sendVentaConfirmation(phoneNumber, ventaData)
  } catch (error) {
    console.error("Error en handleVentaImage:", error)
    await sendWhatsAppMessage(phoneNumber, "Error procesando la factura de venta.")
  }
}

/**
 * Envía confirmación de venta con botones
 */
async function sendVentaConfirmation(phoneNumber: string, data: any) {
  const esLana = data.tipoProducto === "LANA"
  const esGranos = data.tipoProducto === "GRANOS"
  
  let renglonesText: string
  let headerText: string
  let totalesText: string
  
  if (esGranos) {
    // GRANOS
    renglonesText = data.renglones
      .map((r: any, i: number) => 
        `${i + 1}. ${r.tipoCultivoNombre}: ${r.cantidadToneladas}ton @ $${r.precioToneladaUSD?.toFixed(2)}/ton = $${r.importeBrutoUSD?.toFixed(2)}`
      )
      .join("\n")
    
    headerText = `*VENTA DE GRANOS*\n\n`
    totalesText = `${data.renglones[0].cantidadToneladas} ton totales\n`
  } else if (esLana) {
    // LANA
    renglonesText = data.renglones
      .map((r: any, i: number) => 
        `${i + 1}. ${r.categoria} - ${r.pesoKg}kg @ $${r.precioKgUSD?.toFixed(2)}/kg = $${r.importeBrutoUSD?.toFixed(2)}`
      )
      .join("\n")
    
    headerText = `*VENTA DE LANA*\n\n`
    totalesText = `${data.pesoTotalKg} kg totales\n`
  } else {
    // GANADO
    renglonesText = data.renglones
      .map((r: any, i: number) => {
        if (r.esBonificacion) {
          // Bonificación/Descuento
          return `${i + 1}. 🎁 ${r.categoria} = +$${r.importeBrutoUSD?.toFixed(2) || 0}`
        } else {
          // Animal normal
          return `${i + 1}. ${r.cantidad} ${r.categoria}${r.raza ? ` ${r.raza}` : ''} - ${r.pesoPromedio?.toFixed(1) || 0}kg @ $${r.precioKgUSD?.toFixed(2) || 0}/kg = $${r.importeBrutoUSD?.toFixed(2) || 0}`
        }
      })
      .join("\n")

    headerText = `*VENTA DE HACIENDA*\n\n`
    totalesText = `${data.cantidadTotal} animales, ${data.pesoTotalKg?.toFixed(1) || 0} kg\n`
  }

  const bodyText =
    headerText +
    `${data.fecha}\n` +
    `*${data.comprador}*\n` +
    `${data.productor}\n` +
    (data.nroFactura ? `Fact: ${data.nroFactura}\n` : "") +
    (data.nroLiquidacion ? `Liq: ${data.nroLiquidacion}\n` : "") +
    (data.nroTropa ? `Tropa: ${data.nroTropa}\n` : "") +
    `\n*Detalle:*\n${renglonesText}\n\n` +
    totalesText +
    `Subtotal: $${data.subtotalUSD?.toFixed(2) || 0}\n` +
    (esGranos ? `Servicios: -$${data.totalServiciosUSD?.toFixed(2) || 0}\n` : "") +
    `Impuestos: -$${data.totalImpuestosUSD?.toFixed(2) || 0}\n` +
    `*TOTAL: $${data.totalNetoUSD?.toFixed(2) || 0} USD*\n\n` +
    `¿Guardar?`

  await sendCustomButtons(phoneNumber, bodyText, [
    { id: "venta_confirm", title: "Confirmar" },
    { id: "venta_cancel", title: "Cancelar" },
  ])
}

/**
 * Maneja respuesta a botones de venta
 */
export async function handleVentaButtonResponse(phoneNumber: string, buttonId: string) {
  console.log("🔵 handleVentaButtonResponse INICIADO")
  console.log("🔵 phoneNumber:", phoneNumber)
  console.log("🔵 buttonId:", buttonId)
  
  const pending = await prisma.pendingConfirmation.findUnique({ 
    where: { telefono: phoneNumber } 
  })
  
  console.log("🔵 pending encontrado:", pending ? "SÍ" : "NO")
  
  if (!pending) {
    console.log("🔴 NO HAY PENDING - enviando mensaje de error")
    await sendWhatsAppMessage(phoneNumber, "No hay venta pendiente.")
    return
  }

  const savedData = JSON.parse(pending.data)
  console.log("🔵 savedData.tipo:", savedData.tipo)
  
  if (savedData.tipo !== "VENTA") {
    console.log("🔴 TIPO INCORRECTO - tipo era:", savedData.tipo)
    await sendWhatsAppMessage(phoneNumber, "Usá los botones de la factura.")
    return
  }

  const action = buttonId.replace("venta_", "")
  console.log("🔵 action extraída:", action)

  if (action === "confirm") {
    console.log("🟢 CONFIRMADO - limpiando pending antes de guardar")
    // Limpiar pending ANTES de guardar para evitar conflictos con descuento de stock
    await prisma.pendingConfirmation.delete({ where: { telefono: phoneNumber } }).catch(() => {})

    console.log("🟢 Llamando a guardarVentaEnBD")
    await guardarVentaEnBD(savedData, phoneNumber)
  } else {
    console.log("🟡 CANCELADO")
    await sendWhatsAppMessage(phoneNumber, "Venta cancelada.")
    await prisma.pendingConfirmation.delete({ where: { telefono: phoneNumber } })
  }
}

/**
 * Guarda la venta en la base de datos
 */
async function guardarVentaEnBD(savedData: any, phoneNumber: string) {
  const { ventaData, imageUrl, imageName, campoId } = savedData
  
  // Detectar tipo de venta
  const esVentaLana = ventaData.tipoProducto === "LANA"
  const esVentaGranos = ventaData.tipoProducto === "GRANOS"
  
  console.log(`📊 Tipo de venta: ${esVentaGranos ? "GRANOS 🌾" : esVentaLana ? "LANA 🧶" : "GANADO 🐄"}`)

  console.log("🔍 DEBUG 1: Buscando usuario...")

  try {
    console.log("ventaData recibida:", JSON.stringify(ventaData, null, 2))

    const user = await prisma.user.findUnique({ 
      where: { telefono: phoneNumber }, 
      select: { id: true } 
    })

    console.log("🔍 DEBUG 2: Usuario encontrado:", user?.id)
    console.log("🔍 DEBUG 3: Buscando firma...")
    
    // Detectar firma automáticamente por RUT O por nombre del productor
    let firmaId = null

    if (ventaData.productor || ventaData.productorRut) {
      // 1. Buscar por RUT exacto (si existe y no es del consignatario)
      if (ventaData.productorRut && ventaData.productorRut !== ventaData.rutEmisor) {
        const firmaPorRut = await prisma.firma.findFirst({
          where: { 
            campoId,
            rut: ventaData.productorRut
          }
        })
        
        if (firmaPorRut) {
          firmaId = firmaPorRut.id
          console.log(`✅ Firma detectada por RUT: ${firmaPorRut.razonSocial} (${firmaPorRut.rut})`)
        }
      }
      
      // 2. Si no encontró por RUT, buscar por nombre
      if (!firmaId && ventaData.productor) {
        // Traer todas las firmas del campo
        const todasLasFirmas = await prisma.firma.findMany({
          where: { campoId }
        })
        
        if (todasLasFirmas.length > 0) {
          const nombreBuscado = ventaData.productor.trim().toUpperCase()
          
          // Calcular score de coincidencia para cada firma
          const firmasConScore = todasLasFirmas.map(firma => {
            const razonSocial = firma.razonSocial.toUpperCase()
            
            // Match exacto = score 100
            if (razonSocial === nombreBuscado) {
              return { firma, score: 100 }
            }
            
            // Contiene el nombre completo = score 80
            if (razonSocial.includes(nombreBuscado)) {
              return { firma, score: 80 }
            }
            
            // Contar palabras en común (mínimo 2 palabras para considerar)
            const palabrasBuscadas = nombreBuscado.split(/\s+/).filter(p => p.length > 2)
            const palabrasFirma = razonSocial.split(/\s+/).filter(p => p.length > 2)
            
            if (palabrasBuscadas.length < 2) {
              return { firma, score: 0 } // No buscar si es una sola palabra
            }
            
            const palabrasCoincidentes = palabrasBuscadas.filter(p => 
              palabrasFirma.includes(p)
            ).length
            
            // Score proporcional a coincidencias (mínimo 2 palabras)
            if (palabrasCoincidentes >= 2) {
              const score = (palabrasCoincidentes / palabrasBuscadas.length) * 60
              return { firma, score }
            }
            
            return { firma, score: 0 }
          })
          
          // Ordenar por score y tomar la mejor
          const mejorMatch = firmasConScore
            .filter(f => f.score > 0)
            .sort((a, b) => b.score - a.score)[0]
          
          if (mejorMatch) {
            firmaId = mejorMatch.firma.id
            console.log(`✅ Firma detectada por nombre (score: ${mejorMatch.score}): ${mejorMatch.firma.razonSocial}`)
          } else {
            console.log(`⚠️ Productor "${ventaData.productor}" no encontrado en firmas configuradas`)
          }
        }
      }
    }

    let venta

    console.log("🔍 DEBUG 4: Creando venta en BD...")
    console.log("🔍 DEBUG 5: Datos de venta:", {
      comprador: ventaData.comprador,
      fecha: ventaData.fecha,
      subtotal: ventaData.subtotalUSD,
      esLana: esVentaLana,
      esGranos: esVentaGranos
    })

    try {
      venta = await prisma.venta.create({
        data: {
          campoId,
          tipoProducto: ventaData.tipoProducto || null,
          firmaId,
          fecha: new Date(ventaData.fecha),
          comprador: ventaData.comprador,
          consignatario: ventaData.consignatario || null,
          nroTropa: ventaData.nroTropa || null,
          nroFactura: ventaData.nroFactura || ventaData.nroLiquidacion || null,
          metodoPago: ventaData.metodoPago || "Contado",
          diasPlazo: ventaData.diasPlazo || null,
          fechaVencimiento: ventaData.fechaVencimiento 
            ? new Date(ventaData.fechaVencimiento + 'T12:00:00Z') 
            : null,
          pagado: ventaData.metodoPago === "Contado",
          moneda: "USD",
          tasaCambio: ventaData.tipoCambio || null,
          subtotalUSD: ventaData.subtotalUSD,
          totalImpuestosUSD: ventaData.totalImpuestosUSD || 0,
          totalNetoUSD: ventaData.totalNetoUSD,
          imageUrl,
          imageName,
          impuestos: ventaData.impuestos || null,
          notas: "Venta desde WhatsApp",
        },
      })
      console.log("✅ VENTA CREADA EN BD - ID:", venta.id)
    } catch (error: any) {
      console.error("❌ ERROR AL CREAR VENTA:", error.message)
      console.error("❌ Error completo:", error)
      throw error
    }

    console.log("🔍 DEBUG 6: Venta creada exitosamente, ID:", venta.id)
    console.log("🔍 DEBUG 7: Creando renglones...")

    // Crear renglones
    const renglonesCreados: Array<{ id: string; categoria: string; cantidad?: number; pesoKg?: number }> = []

    if (esVentaGranos) {
      // GRANOS: renglones con toneladas, sin cantidad de animales
      for (const r of ventaData.renglones) {
        const renglon = await prisma.ventaRenglon.create({
          data: {
            ventaId: venta.id,
            tipo: "GRANOS",
            tipoAnimal: "OTRO",
            categoria: r.tipoCultivoNombre, // "Trigo", "Soja", etc.
            raza: null,
            cantidad: 0,
            pesoPromedio: 0,
            precioKgUSD: r.precioToneladaUSD / 1000, // convertir a precio por kg
            precioAnimalUSD: 0,
            pesoTotalKg: r.kgNetosLiquidar,
            importeBrutoUSD: r.importeBrutoUSD,
            descontadoDeStock: false,
            
            // Campos específicos de granos
            tipoCultivoNombre: r.tipoCultivoNombre,
            cantidadToneladas: r.cantidadToneladas,
            precioToneladaUSD: r.precioToneladaUSD,
            kgRecibidos: r.kgRecibidos,
            kgDescuentos: r.kgDescuentos,
            kgNetosLiquidar: r.kgNetosLiquidar,
          },
        })
        
        console.log(`  ✅ Renglón GRANOS guardado:`, {
          cultivo: r.tipoCultivoNombre,
          toneladas: r.cantidadToneladas + ' ton',
          precioTon: r.precioToneladaUSD.toFixed(2) + ' USD/ton',
          importeBruto: r.importeBrutoUSD.toFixed(2) + ' USD'
        })
        
        renglonesCreados.push({ 
          id: renglon.id, 
          categoria: r.tipoCultivoNombre
        })
      }
      
      // NO guardar servicios de granos todavía
      // Se guardarán después cuando el usuario indique de qué lote(s) salió la cosecha
      console.log(`  ⏳ Esperando desglose de lotes para guardar servicios de granos...`)
    } else if (esVentaLana) {
      // LANA: renglones con peso, sin cantidad de animales
      for (const r of ventaData.renglones) {
        const renglon = await prisma.ventaRenglon.create({
          data: {
            ventaId: venta.id,
            tipo: "LANA",
            tipoAnimal: "OVINO",
            categoria: r.categoria, // Vellón, Barriga, etc.
            raza: null,
            cantidad: 0, // No hay cantidad de animales
            pesoPromedio: 0,
            precioKgUSD: r.precioKgUSD,
            precioAnimalUSD: 0,
            pesoTotalKg: r.pesoKg,
            importeBrutoUSD: r.importeBrutoUSD,
            descontadoDeStock: false,
            
            // Campos específicos de lana
            esVentaLana: true,
            kgVellon: r.categoria === "Vellón" ? r.pesoKg : null,
            kgBarriga: r.categoria === "Barriga" ? r.pesoKg : null,
            precioKgVellon: r.categoria === "Vellón" ? r.precioKgUSD : null,
            precioKgBarriga: r.categoria === "Barriga" ? r.precioKgUSD : null,
          },
        })
        
        console.log(`  ✅ Renglón LANA guardado:`, {
          categoria: r.categoria,
          pesoKg: r.pesoKg + ' kg',
          precioKg: r.precioKgUSD.toFixed(2) + ' USD/kg',
          importeBruto: r.importeBrutoUSD.toFixed(2) + ' USD'
        })
        
        renglonesCreados.push({ 
          id: renglon.id, 
          categoria: r.categoria,
          pesoKg: r.pesoKg
        })
      }
    } else {
      // GANADO: renglones con cantidad de animales (código original)
      for (const r of ventaData.renglones) {
        const mapped = mapearCategoriaVenta(r.categoria)
        
        // Evitar división por cero cuando cantidad es 0 (ej: "Compensación Kilos")
        const pesoPromedio = r.cantidad > 0
          ? (r.pesoPromedio || (r.pesoTotalKg / r.cantidad))
          : 0;
        const precioAnimalUSD = r.cantidad > 0
          ? (pesoPromedio * r.precioKgUSD)
          : 0;
        
        const renglon = await prisma.ventaRenglon.create({
          data: {
            ventaId: venta.id,
            tipo: "GANADO",
            tipoAnimal: r.tipoAnimal || mapped.tipoAnimal,
            categoria: mapped.categoria,
            raza: r.raza || null,
            cantidad: r.cantidad,
            pesoPromedio: pesoPromedio,
            precioKgUSD: r.precioKgUSD,
            precioAnimalUSD: precioAnimalUSD,
            pesoTotalKg: r.pesoTotalKg,
            importeBrutoUSD: r.importeBrutoUSD,
            descontadoDeStock: false,
          },
        })
        
        console.log(`  ✅ Renglón GANADO guardado:`, {
          categoria: mapped.categoria,
          cantidad: r.cantidad,
          pesoPromedio: pesoPromedio.toFixed(2) + ' kg',
          precioKg: r.precioKgUSD.toFixed(4) + ' USD/kg',
          importeBruto: r.importeBrutoUSD.toFixed(2) + ' USD'
        })
        
        renglonesCreados.push({ 
          id: renglon.id, 
          categoria: mapped.categoria, 
          cantidad: r.cantidad 
        })
      }
    }
    
    // 💰 CREAR UN SOLO INGRESO CONSOLIDADO (para que aparezca en Finanzas)
    console.log("💰 Creando ingreso consolidado en tabla Gasto...")
    
    const tasaCambio = await obtenerTasaCambio("USD")
    const montoEnUYU = await convertirAUYU(ventaData.totalNetoUSD, "USD")
    
    // Generar descripción con todas las categorías
    let descripcionCategorias: string
    let descripcion: string

    if (esVentaGranos) {
      descripcionCategorias = ventaData.renglones
        .map((r: any) => `${r.cantidadToneladas}ton ${r.tipoCultivoNombre}`)
        .join(', ')
      descripcion = `Venta de granos (${descripcionCategorias})`
    } else if (esVentaLana) {
      descripcionCategorias = ventaData.renglones
        .map((r: any) => `${r.pesoKg}kg ${r.categoria}`)
        .join(', ')
      descripcion = `Venta de lana (${descripcionCategorias})`
    } else {
      descripcionCategorias = ventaData.renglones
        .map((r: any) => {
          const mapped = mapearCategoriaVenta(r.categoria)
          return `${r.cantidad} ${mapped.categoria}${r.cantidad > 1 ? 's' : ''}`
        })
        .join(', ')
      descripcion = `Venta de ${ventaData.cantidadTotal} animales (${descripcionCategorias})`
    }
    
    await prisma.gasto.create({
      data: {
        tipo: "INGRESO",
        fecha: new Date(ventaData.fecha),
        descripcion: descripcion,
        categoria: esVentaGranos ? "Venta de Granos" : esVentaLana ? "Venta de Lana" : "Venta de Ganado",
        comprador: ventaData.comprador,
        proveedor: null,
        metodoPago: ventaData.metodoPago || "Contado",
        diasPlazo: ventaData.diasPlazo || null,
        pagado: ventaData.metodoPago === "Contado",
        monto: montoEnUYU,
        montoOriginal: ventaData.totalNetoUSD,
        moneda: "USD",
        montoEnUYU: montoEnUYU,
        montoEnUSD: ventaData.totalNetoUSD,
        tasaCambio: tasaCambio,
        imageUrl: imageUrl,
        imageName: imageName,
        iva: null,
        campo: {
          connect: { id: campoId }
        },
        especie: null,
      },
    })
    
    console.log(`  ✅ Ingreso consolidado creado: ${esVentaGranos ? ventaData.renglones[0].cantidadToneladas + 'ton granos' : esVentaLana ? ventaData.pesoTotalKg + 'kg lana' : ventaData.cantidadTotal + ' animales'} - $${ventaData.totalNetoUSD.toFixed(2)} USD`)

    await prisma.evento.create({
      data: {
        tipo: "VENTA",
        descripcion: esVentaGranos
          ? `Venta de ${ventaData.renglones[0].tipoCultivoNombre} a ${ventaData.comprador}: ${ventaData.renglones[0].cantidadToneladas}ton`
          : esVentaLana 
          ? `Venta de lana a ${ventaData.comprador}: ${ventaData.pesoTotalKg}kg`
          : `Venta a ${ventaData.comprador}: ${ventaData.cantidadTotal} animales`,
        fecha: new Date(ventaData.fecha),
        cantidad: ventaData.cantidadTotal,
        monto: ventaData.totalNetoUSD,
        comprador: ventaData.comprador,
        campoId,
        usuarioId: user?.id || null,
        origenSnig: "BOT",
      },
    })

    const mensajeConfirmacion = esVentaGranos
      ? `✅ *Venta de granos guardada!*\n\n${ventaData.renglones[0].cantidadToneladas}ton de ${ventaData.renglones[0].tipoCultivoNombre}\n$${ventaData.totalNetoUSD?.toFixed(2)} USD`
      : esVentaLana
      ? `✅ *Venta de lana guardada!*\n\n${ventaData.pesoTotalKg}kg de lana\n$${ventaData.totalNetoUSD?.toFixed(2)} USD`
      : `✅ *Venta guardada!*\n\n${ventaData.cantidadTotal} animales\n$${ventaData.totalNetoUSD?.toFixed(2)} USD`

    await sendWhatsAppMessage(phoneNumber, mensajeConfirmacion)

    // Descuento de stock / Asignación de lotes
    if (esVentaGranos) {
      // GRANOS: preguntar de qué lote(s) salió
      await preguntarLotesGranos(phoneNumber, campoId, ventaData, venta.id)
    } else if (esVentaLana) {
      // LANA: descuento automático FIFO del stock de esquilas
      await descontarStockLanaAutomatico(renglonesCreados, campoId, phoneNumber)
      // Limpiar pending
      await prisma.pendingConfirmation.delete({ where: { telefono: phoneNumber } }).catch(() => {})
    } else {
      // GANADO: preguntar de qué potrero descontar
      await preguntarDescuentoStock(phoneNumber, campoId, renglonesCreados, venta.id)
    }

  } catch (error) {
    console.error("Error guardando venta:", error)
    await sendWhatsAppMessage(phoneNumber, "Error guardando la venta.")
  }
}

/**
 * Pregunta de qué potrero descontar animales vendidos
 */
async function preguntarDescuentoStock(
  phoneNumber: string,
  campoId: string,
  renglones: Array<{ id: string; categoria: string; cantidad?: number }>,
  ventaId: string
) {
  // Tomar el primer renglón pendiente
  const renglon = renglones[0]
  if (!renglon || !renglon.cantidad) return

  const potreros = await buscarPotrerosConCategoria(renglon.categoria, campoId)

  if (potreros.length === 0) {
    await sendWhatsAppMessage(
      phoneNumber,
      `No encontré ${renglon.categoria} en ningún potrero. Descontá manualmente desde la web.`
    )
    if (renglones.length > 1) {
      await preguntarDescuentoStock(phoneNumber, campoId, renglones.slice(1), ventaId)
    }
    return
  }

  const totalDisponible = potreros.reduce((sum, p) => sum + p.cantidad, 0)

  if (totalDisponible < renglon.cantidad) {
    await sendWhatsAppMessage(
      phoneNumber,
      `Solo hay ${totalDisponible} ${renglon.categoria} en total, pero vendiste ${renglon.cantidad}. Revisá el stock en la web.`
    )
    if (renglones.length > 1) {
      await preguntarDescuentoStock(phoneNumber, campoId, renglones.slice(1), ventaId)
    }
    return
  }

  // Guardar estado pendiente
  console.log("💾 [STOCK] Guardando pending con tipo DESCUENTO_STOCK...")
  const pendingData = {
    tipo: "DESCUENTO_STOCK",
    ventaId,
    renglonId: renglon.id,
    categoria: renglon.categoria,
    cantidadVendida: renglon.cantidad,
    potreros,
    campoId,
    renglonesPendientes: renglones.slice(1),
  }

  await prisma.pendingConfirmation.upsert({
    where: { telefono: phoneNumber },
    create: {
      telefono: phoneNumber,
      data: JSON.stringify(pendingData),
    },
    update: {
      data: JSON.stringify(pendingData),
    },
  })

  console.log("✅ [STOCK] Pending guardado exitosamente con tipo:", pendingData.tipo)

  if (potreros.length === 1) {
    const p = potreros[0]
    await sendCustomButtons(
      phoneNumber,
      `*Descontar ${renglon.cantidad} ${renglon.categoria}*\n\nDel potrero *${p.loteNombre}* (tiene ${p.cantidad})\n\n¿Confirmar?`,
      [
        { id: `stock_confirm_${p.loteId}`, title: "Confirmar" },
        { id: "stock_skip", title: "Omitir" },
      ]
    )
  } else {
    const botones = potreros.slice(0, 3).map(p => ({
      id: `stock_confirm_${p.loteId}`,
      title: `${p.loteNombre} (${p.cantidad})`.slice(0, 20),
    }))

    const mensaje =
      `*Descontar ${renglon.cantidad} ${renglon.categoria}*\n\n` +
      `¿De qué potrero?\n` +
      potreros.map(p => `• ${p.loteNombre}: ${p.cantidad}`).join('\n') +
      `\n\nElegí uno:`

    await sendCustomButtons(phoneNumber, mensaje, botones)
  }
}

/**
 * Maneja respuesta a botones de descuento de stock
 */
export async function handleVentaStockButtonResponse(phoneNumber: string, buttonId: string) {
  console.log("🔵 [VENTA_STOCK] handleVentaStockButtonResponse INICIADO")
  console.log("🔵 [VENTA_STOCK] phoneNumber:", phoneNumber)
  console.log("🔵 [VENTA_STOCK] buttonId:", buttonId)

  try {
    const pending = await prisma.pendingConfirmation.findUnique({
      where: { telefono: phoneNumber }
    })

    console.log("🔵 [VENTA_STOCK] pending encontrado:", pending ? "SÍ" : "NO")
    if (pending) {
      const previewData = JSON.parse(pending.data)
      console.log("🔵 [VENTA_STOCK] pending.data.tipo:", previewData.tipo)
    }

    if (!pending) {
      await sendWhatsAppMessage(phoneNumber, "No hay operación pendiente.")
      return
    }

    const data = JSON.parse(pending.data)
    console.log("🟡 [VENTA_STOCK] Tipo del pending:", data.tipo)
    console.log("🟡 [VENTA_STOCK] Se esperaba: DESCUENTO_STOCK")
    console.log("🟡 [VENTA_STOCK] Son iguales?:", data.tipo === "DESCUENTO_STOCK")

    if (data.tipo !== "DESCUENTO_STOCK") {
      console.log("🔴 [VENTA_STOCK] TIPO INCORRECTO - tipo era:", data.tipo)
      // Enviar mensaje con el tipo al PRINCIPIO para asegurar que se vea
      await sendWhatsAppMessage(phoneNumber, `❌ ERROR: pending tipo=${data.tipo} esperado=DESCUENTO_STOCK\n\nUsá los botones correspondientes.`)
      return
    }

    console.log("✅ [VENTA_STOCK] Tipo correcto! Continuando...")

    if (buttonId === "stock_skip") {
      await sendWhatsAppMessage(
        phoneNumber,
        `Omitido. Descontá ${data.categoria} desde la web.`
      )
      await prisma.pendingConfirmation.delete({ where: { telefono: phoneNumber } })

      if (data.renglonesPendientes?.length > 0) {
        await preguntarDescuentoStock(
          phoneNumber,
          data.campoId,
          data.renglonesPendientes,
          data.ventaId
        )
      }
      return
    }

    const loteId = buttonId.replace("stock_confirm_", "")
    const potrero = data.potreros.find((p: any) => p.loteId === loteId)

    if (!potrero) {
      await sendWhatsAppMessage(phoneNumber, "Potrero no encontrado.")
      return
    }

    const animalLote = await prisma.animalLote.findFirst({
      where: { loteId, categoria: potrero.categoria },
    })

    if (!animalLote || animalLote.cantidad < data.cantidadVendida) {
      await sendWhatsAppMessage(
        phoneNumber, 
        `No hay suficientes ${data.categoria} en ${potrero.loteNombre}.`
      )
      return
    }

    const nuevaCantidad = animalLote.cantidad - data.cantidadVendida

    if (nuevaCantidad === 0) {
      await prisma.animalLote.delete({ where: { id: animalLote.id } })
    } else {
      await prisma.animalLote.update({
        where: { id: animalLote.id },
        data: { cantidad: nuevaCantidad },
      })
    }

    await prisma.ventaRenglon.update({
      where: { id: data.renglonId },
      data: { descontadoDeStock: true, animalLoteId: animalLote.id },
    })

    await sendWhatsAppMessage(
      phoneNumber,
      `✅ Descontado: ${data.cantidadVendida} ${data.categoria} de *${potrero.loteNombre}*\n(Quedan ${nuevaCantidad})`
    )

    await prisma.pendingConfirmation.delete({ where: { telefono: phoneNumber } })

    if (data.renglonesPendientes?.length > 0) {
      await preguntarDescuentoStock(
        phoneNumber, 
        data.campoId, 
        data.renglonesPendientes, 
        data.ventaId
      )
    }

  } catch (error) {
    console.error("Error descontando stock:", error)
    await sendWhatsAppMessage(phoneNumber, "Error descontando del stock.")
  }
}

/**
 * Descuenta automáticamente del stock de lana usando FIFO
 */
async function descontarStockLanaAutomatico(
  renglones: Array<{ id: string; categoria: string; pesoKg?: number }>,
  campoId: string,
  phoneNumber: string
) {
  console.log("🧶 Iniciando descuento automático de stock de lana (FIFO)...")
  
  for (const renglon of renglones) {
    if (!renglon.pesoKg) continue
    
    try {
      // Buscar esquilas con stock disponible de esta categoría (FIFO: más antiguas primero)
      const esquilasConStock = await prisma.esquila.findMany({
        where: { campoId },
        include: {
          categorias: {
            where: {
              categoria: renglon.categoria,
            },
          },
        },
        orderBy: { fecha: 'asc' }, // FIFO: más antiguas primero
      })
      
      let kgPorDescontar = renglon.pesoKg
      const desgloseDescuento: string[] = []
      
      for (const esquila of esquilasConStock) {
        if (kgPorDescontar <= 0) break
        
        const categoria = esquila.categorias.find(c => c.categoria === renglon.categoria)
        if (!categoria) continue
        
        const disponible = Number(categoria.pesoKg) - Number(categoria.pesoVendido)
        if (disponible <= 0) continue
        
        const aDescontar = Math.min(kgPorDescontar, disponible)
        
        // Actualizar pesoVendido
        await prisma.esquilaCategoria.update({
          where: { id: categoria.id },
          data: {
            pesoVendido: Number(categoria.pesoVendido) + aDescontar,
          },
        })
        
        kgPorDescontar -= aDescontar
        desgloseDescuento.push(
          `${aDescontar.toFixed(0)}kg de esquila del ${new Date(esquila.fecha).toLocaleDateString('es-UY')}`
        )
        
        console.log(`  ✅ Descontado ${aDescontar}kg de ${renglon.categoria} de esquila ${esquila.id}`)
      }
      
      // Marcar renglón como descontado
      await prisma.ventaRenglon.update({
        where: { id: renglon.id },
        data: { descontadoDeStock: true },
      })
      
      if (kgPorDescontar > 0) {
        await sendWhatsAppMessage(
          phoneNumber,
          `⚠️ ${renglon.categoria}: Solo había ${renglon.pesoKg - kgPorDescontar}kg en stock, faltaron ${kgPorDescontar}kg`
        )
      } else {
        await sendWhatsAppMessage(
          phoneNumber,
          `✅ ${renglon.categoria}: ${renglon.pesoKg}kg descontados\n${desgloseDescuento.join('\n')}`
        )
      }
      
    } catch (error) {
      console.error(`Error descontando stock de ${renglon.categoria}:`, error)
      await sendWhatsAppMessage(
        phoneNumber,
        `❌ Error descontando ${renglon.categoria} del stock`
      )
    }
  }
  
  console.log("✅ Descuento automático de lana completado")
}

/**
 * Pregunta de qué lote(s) salió la venta de granos
 */
async function preguntarLotesGranos(
  phoneNumber: string,
  campoId: string,
  ventaData: ParsedVentaGranos,
  ventaId: string
) {
  try {
    const cultivoVendido = ventaData.renglones[0].tipoCultivoNombre // "Trigo", "Soja", etc.
    const toneladasTotales = ventaData.renglones[0].cantidadToneladas
    
    console.log(`🌾 Buscando lotes con ${cultivoVendido}...`)
    
    // 1. Buscar lotes con ese cultivo actualmente
    const lotesConCultivo = await prisma.lote.findMany({
      where: {
        campoId,
        cultivos: {
          some: {
            tipoCultivo: cultivoVendido
          }
        }
      },
      include: {
        cultivos: {
          where: {
            tipoCultivo: cultivoVendido
          }
        }
      },
      orderBy: { nombre: 'asc' }
    })
    
    console.log(`  📍 Encontrados ${lotesConCultivo.length} lotes con ${cultivoVendido}`)
    
    // 2. Si NO encuentra → Buscar todos los lotes no pastoreables
    let lotesDisponibles: Array<{ id: string; nombre: string; hectareas: number }> = lotesConCultivo.map(l => ({
      id: l.id,
      nombre: l.nombre,
      hectareas: l.cultivos[0]?.hectareas || l.hectareas
    }))
    let mensajeDeteccion = ""
    
    if (lotesConCultivo.length === 0) {
      console.log(`  ⚠️ No se encontró ${cultivoVendido} en ningún lote, buscando lotes no pastoreables...`)
      
      const todosLotesAgricolas = await prisma.lote.findMany({
        where: {
          campoId,
          esPastoreable: false
        },
        orderBy: { nombre: 'asc' }
      })
      
      lotesDisponibles = todosLotesAgricolas.map(l => ({
        id: l.id,
        nombre: l.nombre,
        hectareas: l.hectareas
      }))
      mensajeDeteccion = `⚠️ No encontré ${cultivoVendido} registrado.\n\n`
      
      console.log(`  📍 Mostrando ${todosLotesAgricolas.length} lotes no pastoreables`)
    } else {
      mensajeDeteccion = `📍 Detecté ${cultivoVendido} en:\n`
      lotesConCultivo.forEach(lote => {
        const hectareas = lote.cultivos[0]?.hectareas || lote.hectareas
        mensajeDeteccion += `• ${lote.nombre} (${hectareas.toFixed(0)} ha)\n`
      })
      mensajeDeteccion += `\n`
    }
    
    // 3. Si no hay lotes disponibles
    if (lotesDisponibles.length === 0) {
      await sendWhatsAppMessage(
        phoneNumber,
        `⚠️ No encontré lotes agrícolas en el campo. Completá manualmente desde la web.`
      )
      await prisma.pendingConfirmation.delete({ where: { telefono: phoneNumber } }).catch(() => {})
      return
    }
    
    // 4. Guardar estado pendiente
    await prisma.pendingConfirmation.upsert({
      where: { telefono: phoneNumber },
      create: {
        telefono: phoneNumber,
        data: JSON.stringify({
          tipo: "LOTES_GRANOS",
          ventaId,
          cultivoVendido,
          toneladasTotales,
          precioTonelada: ventaData.renglones[0].precioToneladaUSD,
          importeBruto: ventaData.renglones[0].importeBrutoUSD,
          servicios: ventaData.servicios || [],
          lotesDisponibles: lotesDisponibles.map(l => ({
            id: l.id,
            nombre: l.nombre,
            hectareas: l.hectareas
          })),
          campoId
        }),
      },
      update: {
        data: JSON.stringify({
          tipo: "LOTES_GRANOS",
          ventaId,
          cultivoVendido,
          toneladasTotales,
          precioTonelada: ventaData.renglones[0].precioToneladaUSD,
          importeBruto: ventaData.renglones[0].importeBrutoUSD,
          servicios: ventaData.servicios || [],
          lotesDisponibles: lotesDisponibles.map(l => ({
            id: l.id,
            nombre: l.nombre,
            hectareas: l.hectareas
          })),
          campoId
        }),
      },
    })
    
    // 5. Construir mensaje
    let mensaje = mensajeDeteccion
    mensaje += `🌾 *${toneladasTotales}ton de ${cultivoVendido}*\n\n`
    
    if (lotesDisponibles.length === 1) {
      // Solo hay 1 lote
      const lote = lotesDisponibles[0]
      const hectareas = lote.hectareas
      mensaje += `¿Todo salió del lote *${lote.nombre}* (${hectareas.toFixed(0)} ha)?\n\n`
      mensaje += `Respondé:\n`
      mensaje += `• "si" o "confirmar"\n`
      mensaje += `• "no" para elegir otro lote\n`
      mensaje += `• "omitir" para completar después`
    } else {
      // Múltiples lotes
      mensaje += `📍 Lotes disponibles:\n`
      lotesDisponibles.forEach(lote => {
        const hectareas = lote.hectareas
        mensaje += `• ${lote.nombre} (${hectareas.toFixed(0)} ha)\n`
      })
      mensaje += `\nRespondé así:\n`
      mensaje += `*"${lotesDisponibles[0].nombre} ${toneladasTotales}"*\n\n`
      mensaje += `O si salió de varios lotes:\n`
      mensaje += `*"${lotesDisponibles[0].nombre} 200, ${lotesDisponibles.length > 1 ? lotesDisponibles[1].nombre : 'Lote2'} 255"*\n\n`
      mensaje += `O escribí "omitir"`
    }
    
    await sendWhatsAppMessage(phoneNumber, mensaje)
    
  } catch (error) {
    console.error("❌ Error preguntando lotes de granos:", error)
    await sendWhatsAppMessage(phoneNumber, "Error procesando la venta. Completá los lotes desde la web.")
    await prisma.pendingConfirmation.delete({ where: { telefono: phoneNumber } }).catch(() => {})
  }
}

/**
 * Maneja la respuesta del usuario sobre lotes de granos
 */
export async function handleLotesGranosResponse(phoneNumber: string, mensaje: string) {
  try {
    const pending = await prisma.pendingConfirmation.findUnique({
      where: { telefono: phoneNumber }
    })
    
    if (!pending) {
      await sendWhatsAppMessage(phoneNumber, "No hay operación pendiente.")
      return
    }
    
    const data = JSON.parse(pending.data)
    
    if (data.tipo !== "LOTES_GRANOS") {
      return // No es para nosotros
    }
    
    const mensajeLower = mensaje.toLowerCase().trim()
    
    // CASO 1: Usuario quiere omitir
    if (mensajeLower === "omitir" || mensajeLower === "skip") {
      await sendWhatsAppMessage(
        phoneNumber,
        `⏭️ Omitido. Completá los lotes de la venta desde la web.`
      )
      await prisma.pendingConfirmation.delete({ where: { telefono: phoneNumber } })
      return
    }
    
    // CASO 2: Solo hay 1 lote y confirmó
    if (data.lotesDisponibles.length === 1 && (mensajeLower === "si" || mensajeLower === "confirmar" || mensajeLower === "confirmo")) {
      const lote = data.lotesDisponibles[0]
      
      await prisma.servicioGrano.create({
        data: {
          ventaId: data.ventaId,
          cultivo: data.cultivoVendido,
          loteId: lote.id,
          loteNombre: lote.nombre,
          hectareas: lote.hectareas,
          toneladas: data.toneladasTotales,
          precioTonelada: data.precioTonelada,
          precioTotalUSD: data.importeBruto,
        }
      })
      
      // Guardar servicios ahora que sabemos el lote
      if (data.servicios && data.servicios.length > 0) {
        for (const servicio of data.servicios) {
          await prisma.ventaGranoServicio.create({
            data: {
              ventaId: data.ventaId,
              concepto: servicio.concepto,
              importeUSD: Math.abs(servicio.importeUSD),
            },
          })
        }
      }
      
      const tonPorHa = data.toneladasTotales / lote.hectareas
      
      await sendWhatsAppMessage(
        phoneNumber,
        `✅ Venta asignada:\n\n` +
        `📍 ${lote.nombre}: ${data.toneladasTotales}ton (${lote.hectareas}ha)\n` +
        `→ Rendimiento: ${tonPorHa.toFixed(2)} ton/ha`
      )
      
      await prisma.pendingConfirmation.delete({ where: { telefono: phoneNumber } })
      return
    }
    
    // CASO 3: Usuario dijo "no" al único lote
if (data.lotesDisponibles.length === 1 && mensajeLower === "no") {
  // Buscar TODOS los lotes no pastoreables
  const todosLotesAgricolas = await prisma.lote.findMany({
    where: {
      campoId: data.campoId,
      esPastoreable: false
    },
    orderBy: { nombre: 'asc' }
  })
  
  if (todosLotesAgricolas.length <= 1) {
    await sendWhatsAppMessage(
      phoneNumber,
      `No hay otros lotes agrícolas. Escribí "omitir" para completar después desde la web.`
    )
    return
  }
  
  const lotesActualizados = todosLotesAgricolas.map(l => ({
    id: l.id,
    nombre: l.nombre,
    hectareas: l.hectareas
  }))
  
  // Actualizar pending con todos los lotes
  await prisma.pendingConfirmation.update({
    where: { telefono: phoneNumber },
    data: {
      data: JSON.stringify({
        ...data,
        lotesDisponibles: lotesActualizados
      })
    }
  })
  
  let mensaje = `📍 Todos los lotes agrícolas:\n`
  lotesActualizados.forEach(lote => {
    mensaje += `• ${lote.nombre} (${lote.hectareas.toFixed(0)} ha)\n`
  })
  mensaje += `\nRespondé así:\n`
  mensaje += `*"${lotesActualizados[0].nombre} ${data.toneladasTotales}"*\n\n`
  mensaje += `O escribí "omitir"`
  
  await sendWhatsAppMessage(phoneNumber, mensaje)
  return
}
    
    // CASO 4: Usuario especificó distribución por lotes
    // Formato esperado: "Norte 200, Sur 255" o "Norte 455"
    const desglose = parsearDesgloseGranos(mensaje, data.lotesDisponibles, data.toneladasTotales)
    
    if (!desglose || desglose.length === 0) {
      await sendWhatsAppMessage(
        phoneNumber,
        `⚠️ No entendí el formato.\n\n` +
        `Escribí así:\n` +
        `"${data.lotesDisponibles[0].nombre} ${data.toneladasTotales}"\n\n` +
        `O para varios lotes:\n` +
        `"${data.lotesDisponibles[0].nombre} 200, ${data.lotesDisponibles.length > 1 ? data.lotesDisponibles[1].nombre : 'Lote2'} 255"`
      )
      return
    }
    
    // Validar que la suma coincida
    const totalDesglosado = desglose.reduce((sum, d) => sum + d.toneladas, 0)
    const diferencia = Math.abs(totalDesglosado - data.toneladasTotales)
    
    if (diferencia > 1) { // tolerancia de 1 tonelada
      await sendWhatsAppMessage(
        phoneNumber,
        `⚠️ La suma no coincide:\n` +
        `Desglosaste: ${totalDesglosado.toFixed(1)}ton\n` +
        `Total vendido: ${data.toneladasTotales}ton\n\n` +
        `Intentá de nuevo o escribí "omitir"`
      )
      return
    }
    
    // Guardar desglose en BD
    for (const item of desglose) {
      await prisma.servicioGrano.create({
        data: {
          ventaId: data.ventaId,
          cultivo: data.cultivoVendido,
          loteId: item.loteId,
          loteNombre: item.loteNombre,
          hectareas: item.hectareas,
          toneladas: item.toneladas,
          precioTonelada: data.precioTonelada,
          precioTotalUSD: item.toneladas * data.precioTonelada,
        }
      })
    }
    
    // Guardar servicios ahora que sabemos los lotes
    if (data.servicios && data.servicios.length > 0) {
      for (const servicio of data.servicios) {
        await prisma.ventaGranoServicio.create({
          data: {
            ventaId: data.ventaId,
            concepto: servicio.concepto,
            importeUSD: Math.abs(servicio.importeUSD),
          },
        })
      }
    }
    
    // Mensaje de confirmación
    let confirmacion = `✅ Venta desglosada:\n\n`
    for (const item of desglose) {
      const tonPorHa = item.toneladas / item.hectareas
      confirmacion += `📍 ${item.loteNombre}: ${item.toneladas}ton (${item.hectareas}ha) → ${tonPorHa.toFixed(2)} ton/ha\n`
    }
    
    await sendWhatsAppMessage(phoneNumber, confirmacion)
    await prisma.pendingConfirmation.delete({ where: { telefono: phoneNumber } })
    
  } catch (error) {
    console.error("❌ Error procesando respuesta de lotes de granos:", error)
    await sendWhatsAppMessage(phoneNumber, "Error procesando la respuesta. Intentá de nuevo.")
  }
}

/**
 * Handler principal para iniciar el flujo de lotes de granos
 */
export async function handleLotesGranos(phoneNumber: string, parsedData: any) {
  const { campoId, cultivoVendido, toneladasTotales, precioTonelada, importeBruto, servicios, ventaId } = parsedData
  
  await preguntarLotesGranos(
    phoneNumber,
    campoId,
    {
      renglones: [{
        tipoCultivoNombre: cultivoVendido,
        cantidadToneladas: toneladasTotales,
        precioToneladaUSD: precioTonelada,
        importeBrutoUSD: importeBruto,
      }],
      servicios: servicios || [],
    } as ParsedVentaGranos,
    ventaId
  )
}

/**
 * Parsear el desglose de granos que escribe el usuario
 * Ejemplos válidos:
 * - "Norte 200, Sur 255"
 * - "Norte 455"
 * - "lote a 200, lote b 255"
 */
function parsearDesgloseGranos(


  mensaje: string,
  lotesDisponibles: Array<{ id: string; nombre: string; hectareas: number }>,
  toneladasTotales: number
): Array<{ loteId: string; loteNombre: string; hectareas: number; toneladas: number }> | null {
  try {
    const resultado: Array<{ loteId: string; loteNombre: string; hectareas: number; toneladas: number }> = []
    
    // Normalizar mensaje
    const mensajeNorm = mensaje.toLowerCase().trim()
    
    // Separar por comas
    const partes = mensajeNorm.split(',').map(p => p.trim())
    
    for (const parte of partes) {
      // Buscar patrón: "nombre cantidad"
      // Ej: "norte 200" o "lote a 255"
      const tokens = parte.split(/\s+/)
      
      if (tokens.length < 2) continue
      
      // Último token debería ser el número
      const cantidadStr = tokens[tokens.length - 1]
      const cantidad = parseFloat(cantidadStr)
      
      if (isNaN(cantidad) || cantidad <= 0) continue
      
      // Todo lo demás es el nombre del lote
      const nombreBuscado = tokens.slice(0, -1).join(' ')
      
      // Buscar lote que coincida
      const loteEncontrado = lotesDisponibles.find(l => 
        l.nombre.toLowerCase().includes(nombreBuscado) ||
        nombreBuscado.includes(l.nombre.toLowerCase())
      )
      
      if (!loteEncontrado) continue
      
      resultado.push({
        loteId: loteEncontrado.id,
        loteNombre: loteEncontrado.nombre,
        hectareas: loteEncontrado.hectareas,
        toneladas: cantidad
      })
    }
    
    return resultado.length > 0 ? resultado : null
    
  } catch (error) {
    console.error("Error parseando desglose:", error)
    return null
  }
}