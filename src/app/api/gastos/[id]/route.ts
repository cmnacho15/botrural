import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth, canWriteFinanzas } from "@/lib/auth-helpers"
import { convertirAUYU, obtenerTasaCambio } from "@/lib/currency"

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
      moneda
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

    // ---------------------------------------------------------
    // 💵 Conversión de moneda
    // ---------------------------------------------------------
    const montoFloat = parseFloat(monto)
    const monedaFinal = moneda || gastoExistente.moneda || "UYU"

    const montoEnUYU = await convertirAUYU(montoFloat, monedaFinal)
    const tasaCambio = await obtenerTasaCambio(monedaFinal)

    // ---------------------------------------------------------
    // 🧱 Data para actualizar
    // ---------------------------------------------------------
    const dataToUpdate: any = {
      monto: montoEnUYU,          // SIEMPRE en UYU
      montoOriginal: montoFloat,   // valor ingresado
      moneda: monedaFinal,
      montoEnUYU: montoEnUYU,
      tasaCambio,

      fecha: fecha ? new Date(fecha.includes('T') ? fecha : `${fecha}T12:00:00.000Z`) : gastoExistente.fecha,
      descripcion,
      categoria,
      metodoPago,
      iva: iva !== undefined ? parseFloat(String(iva)) : gastoExistente.iva,
      diasPlazo: diasPlazo ? parseInt(diasPlazo) : null,
      pagado: pagado ?? gastoExistente.pagado,
      proveedor: proveedor?.trim() || null,
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