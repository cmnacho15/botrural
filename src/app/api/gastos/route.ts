import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth, canAccessFinanzas, canWriteFinanzas } from "@/lib/auth-helpers"
import { getUSDToUYU } from "@/lib/currency" // Agregado nuevo import

/**
 * Listar gastos
 * Acceso: ADMIN_GENERAL, COLABORADOR con finanzas, CONTADOR
 */
export async function GET(request: Request) {
  try {
    const { error, user } = await requireAuth()
    if (error) return error

    // Acceso lectura
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

    // Acceso escritura
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
      moneda, // nuevo campo
    } = body

    if (!tipo || !monto || !fecha) {
      return NextResponse.json(
        { error: "Faltan campos requeridos" },
        { status: 400 }
      )
    }

    // Manejar moneda y conversión
    const monedaGasto = moneda === "USD" ? "USD" : "UYU"
    const montoOriginal = parseFloat(monto)
    let tasaCambio: number | null = null
    let montoEnUYU = montoOriginal

    if (monedaGasto === "USD") {
      try {
        tasaCambio = await getUSDToUYU()
      } catch (err) {
        console.log("Error obteniendo dólar → uso 40 por defecto")
        tasaCambio = 40
      }
      montoEnUYU = montoOriginal * tasaCambio
    }

    const gasto = await prisma.gasto.create({
      data: {
        tipo,
        fecha: new Date(fecha),
        descripcion,
        categoria,
        proveedor: proveedor?.trim().toLowerCase() || null,
        comprador: comprador?.trim().toLowerCase() || null,
        metodoPago: metodoPago || "Contado",
        diasPlazo: diasPlazo ? Number(diasPlazo) : null,
        pagado: pagado ?? metodoPago === "Contado",
        iva: iva ? Number(iva) : null,
        loteId: loteId || null,
        campoId: user!.campoId!,
        
        // Nuevos campos obligatorios
        moneda: monedaGasto,
        montoOriginal,
        tasaCambio,
        montoEnUYU,
        monto: montoEnUYU, // Para compatibilidad con vistas antiguas
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