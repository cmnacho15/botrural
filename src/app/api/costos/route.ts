import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth, canAccessFinanzas } from "@/lib/auth-helpers"
import { calcularEstadisticasCampo } from "@/lib/ugCalculator"
import { CATEGORIAS_VARIABLES } from "@/lib/costos/categoriasCostos"

/**
 * GET /api/costos
 * Calcula distribución de costos por especie
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
    const campoId = user!.campoId!
    
    // Parámetros de fecha
    const fechaDesdeParam = searchParams.get("fechaDesde")
    const fechaHastaParam = searchParams.get("fechaHasta")
    
    const now = new Date()
    const inicioAnio = new Date(now.getFullYear(), 0, 1)
    const finAnio = new Date(now.getFullYear(), 11, 31, 23, 59, 59)
    
    const fechaDesde = fechaDesdeParam ? new Date(fechaDesdeParam) : inicioAnio
    const fechaHasta = fechaHastaParam ? new Date(fechaHastaParam) : finAnio

    // ---------------------------------------------------------
    // 1️⃣ Obtener lotes con animales actuales
    // ---------------------------------------------------------
    const lotes = await prisma.lote.findMany({
      where: { campoId },
      include: {
        animalesLote: {
          select: {
            categoria: true,
            cantidad: true,
          },
        },
      },
    })

    // ---------------------------------------------------------
    // 2️⃣ Calcular UG por especie
    // ---------------------------------------------------------
    const estadisticas = calcularEstadisticasCampo(lotes)
    const { ugTotalesCampo, desglosePorTipo, totalHectareas } = estadisticas

    // Calcular porcentajes
    let porcentajes = {
      vacunos: 0,
      ovinos: 0,
      equinos: 0,
    }

    if (ugTotalesCampo > 0) {
      porcentajes = {
        vacunos: (desglosePorTipo.vacunos / ugTotalesCampo) * 100,
        ovinos: (desglosePorTipo.ovinos / ugTotalesCampo) * 100,
        equinos: (desglosePorTipo.yeguarizos / ugTotalesCampo) * 100,
      }
    }

    // Calcular hectáreas por especie (proporcional a % UG)
    const hectareas = {
      vacunos: (totalHectareas * porcentajes.vacunos) / 100,
      ovinos: (totalHectareas * porcentajes.ovinos) / 100,
      equinos: (totalHectareas * porcentajes.equinos) / 100,
      total: totalHectareas,
    }

    // ---------------------------------------------------------
    // 3️⃣ Obtener gastos del período
    // ---------------------------------------------------------
    const gastos = await prisma.gasto.findMany({
      where: {
        campoId,
        fecha: {
          gte: fechaDesde,
          lte: fechaHasta,
        },
      },
      select: {
        id: true,
        categoria: true,
        montoEnUSD: true,
        fecha: true,
        descripcion: true,
        especie: true,
      },
      orderBy: { fecha: 'asc' },
    })

    // ---------------------------------------------------------
    // 4️⃣ Separar gastos en Variables y Fijos
    // ---------------------------------------------------------
    const gastosVariables = gastos.filter(g => 
      CATEGORIAS_VARIABLES.includes(g.categoria as any)
    )
    
    const gastosFijos = gastos.filter(g => 
      !CATEGORIAS_VARIABLES.includes(g.categoria as any)
    )

    // ---------------------------------------------------------
    // 5️⃣ Calcular Costos Variables (distribución automática)
    // ---------------------------------------------------------
    const totalVariablesUSD = gastosVariables.reduce(
      (sum, g) => sum + g.montoEnUSD, 
      0
    )

    const costosVariablesPorEspecie = {
      vacunos: (totalVariablesUSD * porcentajes.vacunos) / 100,
      ovinos: (totalVariablesUSD * porcentajes.ovinos) / 100,
      equinos: (totalVariablesUSD * porcentajes.equinos) / 100,
    }

    // Agrupar por categoría
    const variablesDetalle: Record<string, any> = {}
    
    CATEGORIAS_VARIABLES.forEach(cat => {
      const gastosCategoria = gastosVariables.filter(g => g.categoria === cat)
      const totalCat = gastosCategoria.reduce((sum, g) => sum + g.montoEnUSD, 0)
      
      if (totalCat > 0) {
        variablesDetalle[cat] = {
          categoria: cat,
          totalUSD: totalCat,
          vacunos: (totalCat * porcentajes.vacunos) / 100,
          ovinos: (totalCat * porcentajes.ovinos) / 100,
          equinos: (totalCat * porcentajes.equinos) / 100,
        }
      }
    })

    // ---------------------------------------------------------
    // 6️⃣ Calcular Costos Fijos (asignación manual)
    // ---------------------------------------------------------
    const costosFijosPorEspecie = {
      vacunos: 0,
      ovinos: 0,
      equinos: 0,
      global: 0,
    }

    const fijosDetalle: Record<string, any> = {}

    gastosFijos.forEach(gasto => {
      if (!fijosDetalle[gasto.categoria]) {
        fijosDetalle[gasto.categoria] = {
          categoria: gasto.categoria,
          totalUSD: 0,
          vacunos: 0,
          ovinos: 0,
          equinos: 0,
          global: 0,
        }
      }

      fijosDetalle[gasto.categoria].totalUSD += gasto.montoEnUSD

      if (gasto.especie === 'VACUNOS') {
        fijosDetalle[gasto.categoria].vacunos += gasto.montoEnUSD
        costosFijosPorEspecie.vacunos += gasto.montoEnUSD
      } else if (gasto.especie === 'OVINOS') {
        fijosDetalle[gasto.categoria].ovinos += gasto.montoEnUSD
        costosFijosPorEspecie.ovinos += gasto.montoEnUSD
      } else if (gasto.especie === 'EQUINOS') {
        fijosDetalle[gasto.categoria].equinos += gasto.montoEnUSD
        costosFijosPorEspecie.equinos += gasto.montoEnUSD
      } else {
        fijosDetalle[gasto.categoria].global += gasto.montoEnUSD
        costosFijosPorEspecie.global += gasto.montoEnUSD
      }
    })

    const totalFijosUSD = gastosFijos.reduce(
      (sum, g) => sum + g.montoEnUSD, 
      0
    )

    // ---------------------------------------------------------
    // 7️⃣ Calcular Totales
    // ---------------------------------------------------------
    const totales = {
      vacunos: costosVariablesPorEspecie.vacunos + costosFijosPorEspecie.vacunos,
      ovinos: costosVariablesPorEspecie.ovinos + costosFijosPorEspecie.ovinos,
      equinos: costosVariablesPorEspecie.equinos + costosFijosPorEspecie.equinos,
      global: costosFijosPorEspecie.global,
      general: totalVariablesUSD + totalFijosUSD,
    }

    // ---------------------------------------------------------
    // 8️⃣ Calcular USD/ha
    // ---------------------------------------------------------
    const usdPorHectarea = {
      vacunos: hectareas.vacunos > 0 ? totales.vacunos / hectareas.vacunos : 0,
      ovinos: hectareas.ovinos > 0 ? totales.ovinos / hectareas.ovinos : 0,
      equinos: hectareas.equinos > 0 ? totales.equinos / hectareas.equinos : 0,
      general: hectareas.total > 0 ? totales.general / hectareas.total : 0,
    }

    // ---------------------------------------------------------
    // 9️⃣ Respuesta final
    // ---------------------------------------------------------
    return NextResponse.json({
      distribucion: {
        ug: {
          vacunos: Math.round(desglosePorTipo.vacunos * 10) / 10,
          ovinos: Math.round(desglosePorTipo.ovinos * 10) / 10,
          equinos: Math.round(desglosePorTipo.yeguarizos * 10) / 10,
          total: Math.round(ugTotalesCampo * 10) / 10,
        },
        porcentajes: {
          vacunos: Math.round(porcentajes.vacunos * 10) / 10,
          ovinos: Math.round(porcentajes.ovinos * 10) / 10,
          equinos: Math.round(porcentajes.equinos * 10) / 10,
        },
        hectareas: {
          vacunos: Math.round(hectareas.vacunos * 10) / 10,
          ovinos: Math.round(hectareas.ovinos * 10) / 10,
          equinos: Math.round(hectareas.equinos * 10) / 10,
          total: Math.round(hectareas.total * 10) / 10,
        },
      },

      costosVariables: {
        totalUSD: Math.round(totalVariablesUSD * 100) / 100,
        porEspecie: {
          vacunos: Math.round(costosVariablesPorEspecie.vacunos * 100) / 100,
          ovinos: Math.round(costosVariablesPorEspecie.ovinos * 100) / 100,
          equinos: Math.round(costosVariablesPorEspecie.equinos * 100) / 100,
        },
        detalle: Object.values(variablesDetalle).map(d => ({
          categoria: d.categoria,
          totalUSD: Math.round(d.totalUSD * 100) / 100,
          vacunos: Math.round(d.vacunos * 100) / 100,
          ovinos: Math.round(d.ovinos * 100) / 100,
          equinos: Math.round(d.equinos * 100) / 100,
        })),
      },

      costosFijos: {
        totalUSD: Math.round(totalFijosUSD * 100) / 100,
        porEspecie: {
          vacunos: Math.round(costosFijosPorEspecie.vacunos * 100) / 100,
          ovinos: Math.round(costosFijosPorEspecie.ovinos * 100) / 100,
          equinos: Math.round(costosFijosPorEspecie.equinos * 100) / 100,
          global: Math.round(costosFijosPorEspecie.global * 100) / 100,
        },
        detalle: Object.values(fijosDetalle).map(d => ({
          categoria: d.categoria,
          totalUSD: Math.round(d.totalUSD * 100) / 100,
          vacunos: Math.round(d.vacunos * 100) / 100,
          ovinos: Math.round(d.ovinos * 100) / 100,
          equinos: Math.round(d.equinos * 100) / 100,
          global: Math.round(d.global * 100) / 100,
        })),
      },

      totales: {
        vacunos: Math.round(totales.vacunos * 100) / 100,
        ovinos: Math.round(totales.ovinos * 100) / 100,
        equinos: Math.round(totales.equinos * 100) / 100,
        global: Math.round(totales.global * 100) / 100,
        general: Math.round(totales.general * 100) / 100,
      },

      usdPorHectarea: {
        vacunos: Math.round(usdPorHectarea.vacunos * 100) / 100,
        ovinos: Math.round(usdPorHectarea.ovinos * 100) / 100,
        equinos: Math.round(usdPorHectarea.equinos * 100) / 100,
        general: Math.round(usdPorHectarea.general * 100) / 100,
      },

      periodo: {
        desde: fechaDesde.toISOString().split('T')[0],
        hasta: fechaHasta.toISOString().split('T')[0],
      },

      // Mensaje si no hay animales
      ...(ugTotalesCampo === 0 && {
        advertencia: "No hay animales en el campo. Los costos variables no se pueden distribuir.",
      }),
    })

  } catch (error) {
    console.error("Error calculando costos:", error)
    return NextResponse.json(
      { error: "Error calculando costos" },
      { status: 500 }
    )
  }
}