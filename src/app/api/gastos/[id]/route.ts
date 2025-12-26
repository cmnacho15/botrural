//src/app/api/gastos/id/route.ts
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth, canWriteFinanzas } from "@/lib/auth-helpers"
import { getUSDToUYU } from "@/lib/currency"

/**
 * ✏️ PUT - Actualizar gasto (compatible con USD / UYU)
 */
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { error, user } = await requireAuth()
    if (error) return error

    if (!canWriteFinanzas(user!)) {
      return NextResponse.json(
        { error: "No tienes permisos para modificar gastos" },
        { status: 403 }
      )
    }

    const body = await request.json()
    const {
      monto,
      fecha,
      descripcion,
      categoria,
      metodoPago,
      iva,
      pagado,
      diasPlazo,
      proveedor,
      moneda,
      especie, // ✅ NUEVO CAMPO
    } = body

    // Verificar existencia
    const gastoExistente = await prisma.gasto.findUnique({
      where: { id: params.id },
    })

    if (!gastoExistente || gastoExistente.campoId !== user!.campoId) {
      return NextResponse.json(
        { error: "Gasto no encontrado" },
        { status: 404 }
      )
    }

    // ✅ Validar especie si se proporciona
    if (especie && !['VACUNOS', 'OVINOS', 'EQUINOS'].includes(especie)) {
      return NextResponse.json(
        { error: "Especie inválida. Debe ser VACUNOS, OVINOS o EQUINOS" },
        { status: 400 }
      )
    }

    // ---------------------------------------------------------
    // 💵 Conversión de moneda
    // ---------------------------------------------------------
    const montoFloat = parseFloat(monto)
    const monedaFinal = moneda || gastoExistente.moneda || "UYU"
    
    let tasaCambio: number
    let montoEnUYU: number
    let montoEnUSD: number

    // Obtener tasa de cambio del día
    try {
      tasaCambio = await getUSDToUYU()
    } catch (err) {
      console.log("Error obteniendo dólar → uso 40 por defecto")
      tasaCambio = 40
    }

    if (monedaFinal === "USD") {
      // Gasto en dólares
      montoEnUSD = montoFloat
      montoEnUYU = montoFloat * tasaCambio
    } else {
      // Gasto en pesos uruguayos
      montoEnUYU = montoFloat
      montoEnUSD = montoFloat / tasaCambio
    }

    // ---------------------------------------------------------
    // 🧱 Data para actualizar
    // ---------------------------------------------------------
    const dataToUpdate: any = {
      monto: montoEnUYU,          // deprecated pero lo mantenemos
      montoOriginal: montoFloat,
      moneda: monedaFinal,
      montoEnUYU,
      montoEnUSD,                 // ✅ NUEVO
      tasaCambio,
      especie: especie !== undefined ? especie : gastoExistente.especie, // ✅ NUEVO

      fecha: fecha 
        ? new Date(fecha.includes('T') ? fecha : `${fecha}T12:00:00.000Z`) 
        : gastoExistente.fecha,
      descripcion: descripcion !== undefined ? descripcion : gastoExistente.descripcion,
      categoria: categoria !== undefined ? categoria : gastoExistente.categoria,
      metodoPago: metodoPago !== undefined ? metodoPago : gastoExistente.metodoPago,
      iva: iva !== undefined ? parseFloat(String(iva)) : gastoExistente.iva,
      diasPlazo: diasPlazo !== undefined ? (diasPlazo ? parseInt(diasPlazo) : null) : gastoExistente.diasPlazo,
      pagado: pagado !== undefined ? pagado : gastoExistente.pagado,
      proveedor: proveedor !== undefined ? (proveedor?.trim() || null) : gastoExistente.proveedor,
    }

    const gastoActualizado = await prisma.gasto.update({
      where: { id: params.id },
      data: dataToUpdate,
    })

    return NextResponse.json(gastoActualizado)
  } catch (error) {
    console.error("💥 Error actualizando gasto:", error)
    return NextResponse.json(
      { error: "Error actualizando gasto" },
      { status: 500 }
    )
  }
}

/**
 * ❌ DELETE - Eliminar gasto
 */
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { error, user } = await requireAuth()
    if (error) return error

    if (!canWriteFinanzas(user!)) {
      return NextResponse.json(
        { error: "No tienes permisos para eliminar gastos" },
        { status: 403 }
      )
    }

    const gastoExistente = await prisma.gasto.findUnique({
      where: { id: params.id },
    })

    if (!gastoExistente || gastoExistente.campoId !== user!.campoId) {
      return NextResponse.json(
        { error: "Gasto no encontrado" },
        { status: 404 }
      )
    }

    await prisma.gasto.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("💥 Error eliminando gasto:", error)
    return NextResponse.json(
      { error: "Error eliminando gasto" },
      { status: 500 }
    )
  }
}

/**
 * ✅ PATCH - Actualización parcial (solo campos enviados, sin reconvertir montos)
 */
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { error, user } = await requireAuth()
    if (error) return error

    if (!canWriteFinanzas(user!)) {
      return NextResponse.json(
        { error: "No tienes permisos para modificar gastos" },
        { status: 403 }
      )
    }

    const body = await request.json()

    const gastoExistente = await prisma.gasto.findUnique({
      where: { id: params.id },
    })

    if (!gastoExistente || gastoExistente.campoId !== user!.campoId) {
      return NextResponse.json(
        { error: "Gasto no encontrado" },
        { status: 404 }
      )
    }

    const gastoActualizado = await prisma.gasto.update({
      where: { id: params.id },
      data: body,
    })

    return NextResponse.json(gastoActualizado)
  } catch (error) {
    console.error("💥 Error en PATCH gasto:", error)
    return NextResponse.json(
      { error: "Error actualizando gasto" },
      { status: 500 }
    )
  }
}