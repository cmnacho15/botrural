import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth, canAccessFinanzas, canWriteFinanzas } from "@/lib/auth-helpers"

/**
 * GET /api/ventas
 * Lista ventas + resumen tipo Excel
 * Acceso: ADMIN_GENERAL, COLABORADOR con finanzas, CONTADOR
 */
export async function GET(request: Request) {
  try {
    const { error, user } = await requireAuth()
    if (error) return error

    if (!canAccessFinanzas(user!)) {
      return NextResponse.json(
        { error: "No tienes acceso a información financiera" },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const fechaInicio = searchParams.get("fechaInicio")
    const fechaFin = searchParams.get("fechaFin")

    const where: any = {
      campoId: user!.campoId!,
    }

    // Filtro por rango de fechas
    if (fechaInicio && fechaFin) {
      where.fecha = {
        gte: new Date(fechaInicio),
        lte: new Date(fechaFin),
      }
    }

    const ventas = await prisma.venta.findMany({
  where,
  include: {
    renglones: {
      include: {
        animalLote: {
          select: {
            id: true,
            categoria: true,
            lote: {
              select: {
                nombre: true,
              },
            },
          },
        },
      },
    },
    firma: true,  // ← AGREGAR ESTA LÍNEA
  },
  orderBy: { fecha: "desc" },
})

    // ==========================================
    // 📊 CALCULAR RESUMEN TIPO EXCEL
    // ==========================================
    const resumenBovino: any = {}
    const resumenOvino: any = {}
    let resumenLana: any = null

    ventas.forEach(venta => {
      venta.renglones.forEach(renglon => {
        if (renglon.esVentaLana) {
          // Lana (lo dejamos para después)
          if (!resumenLana) {
            resumenLana = {
              cantidad: 0,
              pesoTotal: 0,
              importeBruto: 0,
            }
          }
          resumenLana.cantidad += renglon.numeroEsquilados || 0
          resumenLana.pesoTotal += renglon.pesoTotalKg
          resumenLana.importeBruto += renglon.importeBrutoUSD
        } else {
          // Ganado
          const resumen = renglon.tipoAnimal === "BOVINO" ? resumenBovino : resumenOvino

          if (!resumen[renglon.categoria]) {
            resumen[renglon.categoria] = {
              cantidad: 0,
              pesoTotal: 0,
              importeBruto: 0,
            }
          }

          resumen[renglon.categoria].cantidad += renglon.cantidad
          resumen[renglon.categoria].pesoTotal += renglon.pesoTotalKg
          resumen[renglon.categoria].importeBruto += renglon.importeBrutoUSD
        }
      })
    })

    // Calcular promedios
    const calcularPromedios = (resumen: any) => {
      return Object.entries(resumen).map(([categoria, datos]: [string, any]) => {
        const precioKg = datos.pesoTotal > 0 ? datos.importeBruto / datos.pesoTotal : 0
        const pesoPromedio = datos.cantidad > 0 ? datos.pesoTotal / datos.cantidad : 0
        const precioAnimal = datos.cantidad > 0 ? datos.importeBruto / datos.cantidad : 0

        return {
          categoria,
          cantidad: datos.cantidad,
          precioKg: parseFloat(precioKg.toFixed(2)),
          pesoPromedio: parseFloat(pesoPromedio.toFixed(2)),
          precioAnimal: parseFloat(precioAnimal.toFixed(2)),
          pesoTotal: parseFloat(datos.pesoTotal.toFixed(2)),
          importeBruto: parseFloat(datos.importeBruto.toFixed(2)),
        }
      })
    }

    const resumenBovinoArray = calcularPromedios(resumenBovino)
    const resumenOvinoArray = calcularPromedios(resumenOvino)

    // Totales
    const totalBovino = resumenBovinoArray.reduce((sum, r) => sum + r.importeBruto, 0)
    const totalOvino = resumenOvinoArray.reduce((sum, r) => sum + r.importeBruto, 0)
    const totalLana = resumenLana?.importeBruto || 0
    const totalGeneral = totalBovino + totalOvino + totalLana

    const totalKgBovino = resumenBovinoArray.reduce((sum, r) => sum + r.pesoTotal, 0)
    const totalKgOvino = resumenOvinoArray.reduce((sum, r) => sum + r.pesoTotal, 0)
    const totalKgLana = resumenLana?.pesoTotal || 0
    const totalKgGeneral = totalKgBovino + totalKgOvino + totalKgLana

    const totalCantidadBovino = resumenBovinoArray.reduce((sum, r) => sum + r.cantidad, 0)
    const totalCantidadOvino = resumenOvinoArray.reduce((sum, r) => sum + r.cantidad, 0)
    const totalCantidadLana = resumenLana?.cantidad || 0
    const totalCantidadGeneral = totalCantidadBovino + totalCantidadOvino + totalCantidadLana

    return NextResponse.json({
      ventas,
      resumen: {
        bovino: resumenBovinoArray,
        ovino: resumenOvinoArray,
        lana: resumenLana ? {
          cantidad: resumenLana.cantidad,
          precioKg: resumenLana.pesoTotal > 0 ? parseFloat((resumenLana.importeBruto / resumenLana.pesoTotal).toFixed(2)) : 0,
          pesoPromedio: resumenLana.cantidad > 0 ? parseFloat((resumenLana.pesoTotal / resumenLana.cantidad).toFixed(2)) : 0,
          precioAnimal: resumenLana.cantidad > 0 ? parseFloat((resumenLana.importeBruto / resumenLana.cantidad).toFixed(2)) : 0,
          pesoTotal: parseFloat(resumenLana.pesoTotal.toFixed(2)),
          importeBruto: parseFloat(resumenLana.importeBruto.toFixed(2)),
        } : null,
        totales: {
          bovino: {
            cantidad: totalCantidadBovino,
            pesoTotal: parseFloat(totalKgBovino.toFixed(2)),
            importeBruto: parseFloat(totalBovino.toFixed(2)),
            precioKg: totalKgBovino > 0 ? parseFloat((totalBovino / totalKgBovino).toFixed(2)) : 0,
            pesoPromedio: totalCantidadBovino > 0 ? parseFloat((totalKgBovino / totalCantidadBovino).toFixed(2)) : 0,
            precioAnimal: totalCantidadBovino > 0 ? parseFloat((totalBovino / totalCantidadBovino).toFixed(2)) : 0,
          },
          ovino: {
            cantidad: totalCantidadOvino,
            pesoTotal: parseFloat(totalKgOvino.toFixed(2)),
            importeBruto: parseFloat(totalOvino.toFixed(2)),
            precioKg: totalKgOvino > 0 ? parseFloat((totalOvino / totalKgOvino).toFixed(2)) : 0,
            pesoPromedio: totalCantidadOvino > 0 ? parseFloat((totalKgOvino / totalCantidadOvino).toFixed(2)) : 0,
            precioAnimal: totalCantidadOvino > 0 ? parseFloat((totalOvino / totalCantidadOvino).toFixed(2)) : 0,
          },
          general: {
            cantidad: totalCantidadGeneral,
            pesoTotal: parseFloat(totalKgGeneral.toFixed(2)),
            importeBruto: parseFloat(totalGeneral.toFixed(2)),
          },
        },
      },
    })
  } catch (error) {
    console.error("Error obteniendo ventas:", error)
    return NextResponse.json(
      { error: "Error obteniendo ventas" },
      { status: 500 }
    )
  }
}

/**
 * POST /api/ventas
 * Crear nueva venta + renglones
 * Acceso: ADMIN_GENERAL + COLABORADOR con finanzas
 */
export async function POST(request: Request) {
  try {
    const { error, user } = await requireAuth()
    if (error) return error

    if (!canWriteFinanzas(user!)) {
      return NextResponse.json(
        { error: "No tienes permisos para crear ventas" },
        { status: 403 }
      )
    }

    const body = await request.json()
    const {
      fecha,
      comprador,
      firmaId,
      consignatario,
      nroTropa,
      nroFactura,
      metodoPago,
      diasPlazo,
      fechaVencimiento,
      pagado,
      moneda,
      tasaCambio,
      subtotalUSD,
      totalImpuestosUSD,
      totalNetoUSD,
      impuestos,
      imageUrl,
      imageName,
      notas,
      renglones, // array de renglones
    } = body

    if (!fecha || !comprador || !renglones || renglones.length === 0) {
      return NextResponse.json(
        { error: "Faltan campos requeridos" },
        { status: 400 }
      )
    }

    // Corregir fecha
    const fechaISO = fecha.includes('T') ? fecha : `${fecha}T12:00:00.000Z`
    const fechaVencimientoISO = fechaVencimiento 
      ? (fechaVencimiento.includes('T') ? fechaVencimiento : `${fechaVencimiento}T12:00:00.000Z`)
      : null

    // Crear venta + renglones en transacción
    const venta = await prisma.$transaction(async (tx) => {
      // 1. Crear la venta
      const nuevaVenta = await tx.venta.create({
        data: {
          campoId: user!.campoId!,
          firmaId: firmaId || null,
          fecha: new Date(fechaISO),
          comprador: comprador.trim(),
          consignatario: consignatario?.trim() || null,
          nroTropa: nroTropa?.trim() || null,
          nroFactura: nroFactura?.trim() || null,
          metodoPago: metodoPago || "Contado",
          diasPlazo: diasPlazo ? Number(diasPlazo) : null,
          fechaVencimiento: fechaVencimientoISO ? new Date(fechaVencimientoISO) : null,
          pagado: pagado ?? (metodoPago === "Contado"),
          moneda: moneda || "USD",
          tasaCambio: tasaCambio ? Number(tasaCambio) : null,
          subtotalUSD: Number(subtotalUSD),
          totalImpuestosUSD: Number(totalImpuestosUSD) || 0,
          totalNetoUSD: Number(totalNetoUSD),
          impuestos: impuestos || null,
          imageUrl: imageUrl || null,
          imageName: imageName || null,
          notas: notas?.trim() || null,
        },
      })

      // 2. Crear los renglones
      for (const renglon of renglones) {
        const {
          tipo,
          tipoAnimal,
          categoria,
          raza,
          cantidad,
          pesoPromedio,
          precioKgUSD,
          descontarStock,
          animalLoteId,
        } = renglon

        const pesoTotal = Number(cantidad) * Number(pesoPromedio)
        const precioAnimal = Number(pesoPromedio) * Number(precioKgUSD)
        const importeBruto = pesoTotal * Number(precioKgUSD)

        await tx.ventaRenglon.create({
          data: {
            ventaId: nuevaVenta.id,
            tipo: tipo || "GANADO",
            tipoAnimal,
            categoria,
            raza: raza || null,
            cantidad: Number(cantidad),
            pesoPromedio: Number(pesoPromedio),
            precioKgUSD: Number(precioKgUSD),
            precioAnimalUSD: Number(precioAnimal.toFixed(2)),
            pesoTotalKg: Number(pesoTotal.toFixed(2)),
            importeBrutoUSD: Number(importeBruto.toFixed(2)),
            descontadoDeStock: descontarStock || false,
            animalLoteId: (descontarStock && animalLoteId) ? animalLoteId : null,
            fechaDescuento: descontarStock ? new Date() : null,
          },
        })

        // 3. Descontar stock si corresponde
        if (descontarStock && animalLoteId) {
          const animalLote = await tx.animalLote.findUnique({
            where: { id: animalLoteId },
          })

          if (!animalLote) {
            throw new Error(`AnimalLote ${animalLoteId} no encontrado`)
          }

          const nuevaCantidad = animalLote.cantidad - Number(cantidad)

          if (nuevaCantidad < 0) {
            throw new Error(`Stock insuficiente en el potrero. Disponible: ${animalLote.cantidad}, Necesario: ${cantidad}`)
          }

          if (nuevaCantidad === 0) {
            // Borrar el registro si llega a 0
            await tx.animalLote.delete({
              where: { id: animalLoteId },
            })
          } else {
            // Actualizar cantidad
            await tx.animalLote.update({
              where: { id: animalLoteId },
              data: { cantidad: nuevaCantidad },
            })
          }
        }
      }

      // 4. Crear evento para /datos
      const cantidadTotal = renglones.reduce((sum: number, r: any) => sum + Number(r.cantidad), 0)
      
      await tx.evento.create({
        data: {
          tipo: "VENTA",
          descripcion: `Venta a ${comprador.trim()}: ${cantidadTotal} animales`,
          fecha: new Date(fechaISO),
          cantidad: cantidadTotal,
          monto: Number(totalNetoUSD),
          comprador: comprador.trim(),
          campoId: user!.campoId!,
          usuarioId: user!.id,
        },
      })

      return nuevaVenta
    })

    return NextResponse.json(venta, { status: 201 })
  } catch (error: any) {
    console.error("Error creando venta:", error)
    return NextResponse.json(
      { error: error.message || "Error creando venta" },
      { status: 500 }
    )
  }
} 


//holaaa