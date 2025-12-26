import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth, canAccessFinanzas, canWriteFinanzas } from "@/lib/auth-helpers"
import { getUSDToUYU } from "@/lib/currency"

/**
 * Listar gastos
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
    const tipo = searchParams.get("tipo")
    const categoria = searchParams.get("categoria")
    const proveedor = searchParams.get("proveedor")
    const comprador = searchParams.get("comprador")

    const where: any = {
      campoId: user!.campoId!,
    }

    if (tipo) where.tipo = tipo
    if (categoria) where.categoria = categoria
    if (proveedor) where.proveedor = proveedor.trim().toLowerCase()
    if (comprador) where.comprador = comprador.trim().toLowerCase()

    const gastos = await prisma.gasto.findMany({
      where,
      include: {
        lote: { select: { nombre: true } },
      },
      orderBy: { fecha: "desc" },
    })

    return NextResponse.json(gastos)
  } catch (error) {
    console.error("Error obteniendo gastos:", error)
    return NextResponse.json(
      { error: "Error obteniendo gastos" },
      { status: 500 }
    )
  }
}

/**
 * Crear gasto
 * Acceso: ADMIN_GENERAL + COLABORADOR con finanzas
 */
export async function POST(request: Request) {
  try {
    const { error, user } = await requireAuth()
    if (error) return error

    if (!canWriteFinanzas(user!)) {
      return NextResponse.json(
        { error: "No tienes permisos para crear gastos" },
        { status: 403 }
      )
    }

    const body = await request.json()
    const {
      tipo,
      monto,
      fecha,
      descripcion,
      categoria,
      proveedor,
      comprador,
      metodoPago,
      iva,
      diasPlazo,
      pagado,
      loteId,
      moneda,
      especie, // ✅ NUEVO CAMPO
    } = body

    if (!tipo || !monto || !fecha) {
      return NextResponse.json(
        { error: "Faltan campos requeridos" },
        { status: 400 }
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
    const monedaGasto = moneda === "USD" ? "USD" : "UYU"
    const montoOriginal = parseFloat(monto)
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

    if (monedaGasto === "USD") {
      // Gasto en dólares
      montoEnUSD = montoOriginal
      montoEnUYU = montoOriginal * tasaCambio
    } else {
      // Gasto en pesos uruguayos
      montoEnUYU = montoOriginal
      montoEnUSD = montoOriginal / tasaCambio
    }

    // ---------------------------------------------------------
    // 📅 Corregir fecha (evitar cambio de día por zona horaria)
    // ---------------------------------------------------------
    const fechaISO = fecha.includes('T') ? fecha : `${fecha}T12:00:00.000Z`

    const gasto = await prisma.gasto.create({
      data: {
        tipo,
        fecha: new Date(fechaISO),
        descripcion,
        categoria,
        proveedor: proveedor?.trim() || null,
        comprador: comprador?.trim().toLowerCase() || null,
        metodoPago: metodoPago || "Contado",
        diasPlazo: diasPlazo ? Number(diasPlazo) : null,
        pagado: pagado ?? metodoPago === "Contado",
        iva: iva ? Number(iva) : null,
        loteId: loteId || null,
        campoId: user!.campoId!,
        
        // Campos de moneda
        moneda: monedaGasto,
        montoOriginal,
        tasaCambio,
        montoEnUYU,
        montoEnUSD, // ✅ NUEVO
        monto: montoEnUYU, // deprecated pero lo mantenemos
        
        // Campo de especie
        especie: especie || null, // ✅ NUEVO
      },
      include: { lote: true },
    })

    return NextResponse.json(gasto, { status: 201 })
  } catch (error) {
    console.error("Error creando gasto:", error)
    return NextResponse.json(
      { error: "Error creando gasto" },
      { status: 500 }
    )
  }
}