import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth, canAccessFinanzas } from "@/lib/auth-helpers"

/**
 * GET /api/ventas/resumen-por-firma
 * Resumen de ventas agrupadas por firma
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

    // Obtener todas las ventas con firmas
    const ventas = await prisma.venta.findMany({
      where,
      include: {
        firma: true,
      },
    })

    // Agrupar por firma
    const resumenPorFirma: Record<string, {
      firmaId: string | null
      razonSocial: string
      rut: string
      cantidadVentas: number
      totalUSD: number
      ventas: {
        id: string
        fecha: Date
        nroFactura: string | null
        comprador: string
        tipoProducto: string | null
        subtotalUSD: number
        totalImpuestosUSD: number
        totalNetoUSD: number
        pagado: boolean
      }[]
    }> = {}

    ventas.forEach(venta => {
      const key = venta.firmaId || 'sin-asignar'

      if (!resumenPorFirma[key]) {
        resumenPorFirma[key] = {
          firmaId: venta.firmaId,
          razonSocial: venta.firma?.razonSocial || 'Sin asignar',
          rut: venta.firma?.rut || '-',
          cantidadVentas: 0,
          totalUSD: 0,
          ventas: [],
        }
      }

      resumenPorFirma[key].cantidadVentas += 1
      resumenPorFirma[key].totalUSD += venta.totalNetoUSD
      resumenPorFirma[key].ventas.push({
        id: venta.id,
        fecha: venta.fecha,
        nroFactura: venta.nroFactura,
        comprador: venta.comprador,
        tipoProducto: venta.tipoProducto,
        subtotalUSD: venta.subtotalUSD,
        totalImpuestosUSD: venta.totalImpuestosUSD,
        totalNetoUSD: venta.totalNetoUSD,
        pagado: venta.pagado,
      })
    })

    // Convertir a array, ordenar ventas por fecha y ordenar firmas por total descendente
    const resumenArray = Object.values(resumenPorFirma)
      .map(firma => ({
        ...firma,
        ventas: firma.ventas.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
      }))
      .sort((a, b) => b.totalUSD - a.totalUSD)

    // Calcular total general
    const totalGeneral = resumenArray.reduce((sum, item) => sum + item.totalUSD, 0)

    return NextResponse.json({
      resumen: resumenArray,
      totalGeneral,
    })
  } catch (error) {
    console.error("Error obteniendo resumen por firma:", error)
    return NextResponse.json(
      { error: "Error obteniendo resumen" },
      { status: 500 }
    )
  }
}