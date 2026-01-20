// src/lib/whatsapp/handlers/ventaHandler.ts

import { prisma } from "@/lib/prisma"
import { processVentaImage, mapearCategoriaVenta } from "@/lib/vision-venta-parser"
import { buscarPotrerosConCategoria } from "@/lib/potrero-helpers"
import { sendWhatsAppMessage, sendCustomButtons } from "../services/messageService"
import { convertirAUYU, obtenerTasaCambio } from "@/lib/currency"
import type { ParsedVentaGanado, ParsedVentaLana } from "@/lib/vision-venta-parser"

/**
 * Procesa una imagen de factura de VENTA
 */
export async function handleVentaImage(
  phoneNumber: string,
  imageUrl: string,
  imageName: string,
  campoId: string,
  caption: string
) {
  try {
    const ventaData = await processVentaImage(imageUrl, campoId)
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
  const renglonesText = data.renglones
    .map((r: any, i: number) => 
      `${i + 1}. ${r.cantidad} ${r.categoria} - ${r.pesoPromedio?.toFixed(1) || 0}kg @ $${r.precioKgUSD?.toFixed(2) || 0}/kg = $${r.importeBrutoUSD?.toFixed(2) || 0}`
    )
    .join("\n")

  const bodyText =
    `*VENTA DE HACIENDA*\n\n` +
    `${data.fecha}\n` +
    `*${data.comprador}*\n` +
    `${data.productor}\n` +
    (data.nroFactura ? `Fact: ${data.nroFactura}\n` : "") +
    (data.nroTropa ? `Tropa: ${data.nroTropa}\n` : "") +
    `\n*Detalle:*\n${renglonesText}\n\n` +
    `${data.cantidadTotal} animales, ${data.pesoTotalKg?.toFixed(1) || 0} kg\n` +
    `Subtotal: $${data.subtotalUSD?.toFixed(2) || 0}\n` +
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
    console.log("🟢 CONFIRMADO - llamando a guardarVentaEnBD")
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
  
  // Detectar si es GANADO o LANA
  const esVentaLana = ventaData.tipoProducto === "LANA"
  
  console.log(`📊 Tipo de venta: ${esVentaLana ? "LANA 🧶" : "GANADO 🐄"}`)

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
  esLana: esVentaLana
})

    try {
      venta = await prisma.venta.create({
        data: {
          campoId,
          firmaId,
          fecha: new Date(ventaData.fecha),
          comprador: ventaData.comprador,
          consignatario: ventaData.consignatario || null,
          nroTropa: ventaData.nroTropa || null,
          nroFactura: ventaData.nroFactura || null,
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

    if (esVentaLana) {
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
        
        const pesoPromedio = r.pesoPromedio || (r.pesoTotalKg / r.cantidad);
        const precioAnimalUSD = pesoPromedio * r.precioKgUSD;
        
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

    if (esVentaLana) {
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
        categoria: esVentaLana ? "Venta de Lana" : "Venta de Ganado",
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
    
    console.log(`  ✅ Ingreso consolidado creado: ${esVentaLana ? ventaData.pesoTotalKg + 'kg lana' : ventaData.cantidadTotal + ' animales'} - $${ventaData.totalNetoUSD.toFixed(2)} USD`)

    await prisma.evento.create({
      data: {
        tipo: "VENTA",
        descripcion: esVentaLana 
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

    const mensajeConfirmacion = esVentaLana
      ? `✅ *Venta de lana guardada!*\n\n${ventaData.pesoTotalKg}kg de lana\n$${ventaData.totalNetoUSD?.toFixed(2)} USD`
      : `✅ *Venta guardada!*\n\n${ventaData.cantidadTotal} animales\n$${ventaData.totalNetoUSD?.toFixed(2)} USD`

    await sendWhatsAppMessage(phoneNumber, mensajeConfirmacion)

    // Descuento de stock
    if (esVentaLana) {
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
  await prisma.pendingConfirmation.upsert({
    where: { telefono: phoneNumber },
    create: {
      telefono: phoneNumber,
      data: JSON.stringify({
        tipo: "DESCUENTO_STOCK",
        ventaId,
        renglonId: renglon.id,
        categoria: renglon.categoria,
        cantidadVendida: renglon.cantidad,
        potreros,
        campoId,
        renglonesPendientes: renglones.slice(1),
      }),
    },
    update: {
      data: JSON.stringify({
        tipo: "DESCUENTO_STOCK",
        ventaId,
        renglonId: renglon.id,
        categoria: renglon.categoria,
        cantidadVendida: renglon.cantidad,
        potreros,
        campoId,
        renglonesPendientes: renglones.slice(1),
      }),
    },
  })

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
export async function handleStockButtonResponse(phoneNumber: string, buttonId: string) {
  const pending = await prisma.pendingConfirmation.findUnique({ 
    where: { telefono: phoneNumber } 
  })
  
  if (!pending) {
    await sendWhatsAppMessage(phoneNumber, "No hay operación pendiente.")
    return
  }

  const data = JSON.parse(pending.data)
  if (data.tipo !== "DESCUENTO_STOCK") {
    await sendWhatsAppMessage(phoneNumber, "Usá los botones correspondientes.")
    return
  }

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

  try {
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