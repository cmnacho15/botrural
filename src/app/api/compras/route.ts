import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth, canAccessFinanzas, canWriteFinanzas } from "@/lib/auth-helpers"

/**
 * GET /api/compras
 * Lista compras + resumen tipo Excel
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

    const compras = await prisma.compra.findMany({
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
      },
      orderBy: { fecha: "desc" },
    })

    // ==========================================
    // 📊 CALCULAR RESUMEN TIPO EXCEL
    // ==========================================
    const resumenBovino: any = {}
    const resumenOvino: any = {}

    compras.forEach(compra => {
      compra.renglones.forEach(renglon => {
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
    const totalGeneral = totalBovino + totalOvino

    const totalKgBovino = resumenBovinoArray.reduce((sum, r) => sum + r.pesoTotal, 0)
    const totalKgOvino = resumenOvinoArray.reduce((sum, r) => sum + r.pesoTotal, 0)
    const totalKgGeneral = totalKgBovino + totalKgOvino

    const totalCantidadBovino = resumenBovinoArray.reduce((sum, r) => sum + r.cantidad, 0)
    const totalCantidadOvino = resumenOvinoArray.reduce((sum, r) => sum + r.cantidad, 0)
    const totalCantidadGeneral = totalCantidadBovino + totalCantidadOvino

    return NextResponse.json({
      compras,
      resumen: {
        bovino: resumenBovinoArray,
        ovino: resumenOvinoArray,
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
    console.error("Error obteniendo compras:", error)
    return NextResponse.json(
      { error: "Error obteniendo compras" },
      { status: 500 }
    )
  }
}

/**
 * POST /api/compras
 * Crear nueva compra + renglones
 * Acceso: ADMIN_GENERAL + COLABORADOR con finanzas
 */
export async function POST(request: Request) {
  try {
    const { error, user } = await requireAuth()
    if (error) return error

    if (!canWriteFinanzas(user!)) {
      return NextResponse.json(
        { error: "No tienes permisos para crear compras" },
        { status: 403 }
      )
    }

    const body = await request.json()
    const {
      fecha,
      proveedor,
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
      renglones,
    } = body

    if (!fecha || !proveedor || !renglones || renglones.length === 0) {
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

    // Crear compra + renglones en transacción
    const compra = await prisma.$transaction(async (tx) => {
      // 1. Crear la compra
      const nuevaCompra = await tx.compra.create({
        data: {
          campoId: user!.campoId!,
          fecha: new Date(fechaISO),
          proveedor: proveedor.trim(),
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
          tipoAnimal,
          categoria,
          raza,
          cantidad,
          pesoPromedio,
          precioKgUSD,
          agregarAlStock,
          animalLoteId,
        } = renglon

        const pesoTotal = Number(cantidad) * Number(pesoPromedio)
        const precioAnimal = Number(pesoPromedio) * Number(precioKgUSD)
        const importeBruto = pesoTotal * Number(precioKgUSD)

        await tx.compraRenglon.create({
          data: {
            compraId: nuevaCompra.id,
            tipoAnimal,
            categoria,
            raza: raza || null,
            cantidad: Number(cantidad),
            pesoPromedio: Number(pesoPromedio),
            precioKgUSD: Number(precioKgUSD),
            precioAnimalUSD: Number(precioAnimal.toFixed(2)),
            pesoTotalKg: Number(pesoTotal.toFixed(2)),
            importeBrutoUSD: Number(importeBruto.toFixed(2)),
            agregarAlStock: agregarAlStock || false,
            animalLoteId: (agregarAlStock && animalLoteId) ? animalLoteId : null,
            fechaIngreso: agregarAlStock ? new Date() : null,
          },
        })

        // 3. Agregar stock si corresponde
        if (agregarAlStock && animalLoteId) {
          const animalLote = await tx.animalLote.findUnique({
            where: { id: animalLoteId },
          })

          if (!animalLote) {
            throw new Error(`AnimalLote ${animalLoteId} no encontrado`)
          }

          // SUMAR cantidad (en vez de restar)
          await tx.animalLote.update({
            where: { id: animalLoteId },
            data: { cantidad: animalLote.cantidad + Number(cantidad) },
          })
        } else if (agregarAlStock) {
          // Si no hay animalLoteId pero quiere agregar, buscar o crear el lote
          // Este caso lo manejamos en el frontend pidiendo siempre el loteId
          throw new Error("Debe seleccionar un potrero para agregar al stock")
        }
      }

      return nuevaCompra
    })

    return NextResponse.json(compra, { status: 201 })
  } catch (error: any) {
    console.error("Error creando compra:", error)
    return NextResponse.json(
      { error: error.message || "Error creando compra" },
      { status: 500 }
    )
  }
}