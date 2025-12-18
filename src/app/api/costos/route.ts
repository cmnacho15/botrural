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
    const usarSPG = searchParams.get("usarSPG") === "true"

    
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
    // 2️⃣ Calcular UG por especie y SPG
    // ---------------------------------------------------------
    const estadisticas = calcularEstadisticasCampo(lotes)
    const { ugTotalesCampo, desglosePorTipo, totalHectareas } = estadisticas
    
    // Calcular SPG (solo lotes pastoreables)
    const lotesPastoreables = lotes.filter(l => l.esPastoreable !== false)
    const spg = lotesPastoreables.reduce((sum, l) => sum + l.hectareas, 0)
    
    // Determinar qué superficie usar para los cálculos
    const superficieParaCalculo = usarSPG ? spg : totalHectareas

    

console.log('API COSTOS - usarSPG recibido:', searchParams.get("usarSPG"))
console.log('API COSTOS - usarSPG parseado:', usarSPG)
console.log('API COSTOS - totalHectareas:', totalHectareas)
console.log('API COSTOS - spg:', spg)
console.log('API COSTOS - superficieParaCalculo:', superficieParaCalculo)

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
      vacunos: (superficieParaCalculo * porcentajes.vacunos) / 100,
      ovinos: (superficieParaCalculo * porcentajes.ovinos) / 100,
      equinos: (superficieParaCalculo * porcentajes.equinos) / 100,
      total: superficieParaCalculo,
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
    // Si no hay gastos en el período, devolver todo en cero
    if (gastos.length === 0) {
      return NextResponse.json({
        distribucion: {
          ug: { vacunos: 0, ovinos: 0, equinos: 0, total: 0 },
          porcentajes: { vacunos: 0, ovinos: 0, equinos: 0 },
          hectareas: { vacunos: 0, ovinos: 0, equinos: 0, total: 0 },
        },
        costosVariables: {
          totalUSD: 0,
          porEspecie: { vacunos: 0, ovinos: 0, equinos: 0, sinAsignar: 0 },
          detalle: [],
        },
        costosFijos: {
          totalUSD: 0,
          porEspecie: { vacunos: 0, ovinos: 0, equinos: 0 },
          detalle: [],
        },
        totales: { vacunos: 0, ovinos: 0, equinos: 0, general: 0 },
        usdPorHectarea: { vacunos: 0, ovinos: 0, equinos: 0, general: 0 },
        periodo: {
          desde: fechaDesde.toISOString().split('T')[0],
          hasta: fechaHasta.toISOString().split('T')[0],
        },
        advertencia: "No hay gastos registrados en este período.",
      })
    }
    
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
    // 5️⃣ Calcular Costos Variables Directos (asignación 100% por especie)
    // ---------------------------------------------------------
    const costosVariablesPorEspecie = {
      vacunos: 0,
      ovinos: 0,
      equinos: 0,
      sinAsignar: 0,
    }

    // Agrupar por categoría
    const variablesDetalle: Record<string, any> = {}
    
    gastosVariables.forEach(gasto => {
      const cat = gasto.categoria
      
      if (!variablesDetalle[cat]) {
        variablesDetalle[cat] = {
          categoria: cat,
          totalUSD: 0,
          vacunos: 0,
          ovinos: 0,
          equinos: 0,
          sinAsignar: 0,
        }
      }
      
      variablesDetalle[cat].totalUSD += gasto.montoEnUSD
      
      // Asignación 100% directa según especie
      if (gasto.especie === 'VACUNOS') {
        variablesDetalle[cat].vacunos += gasto.montoEnUSD
        costosVariablesPorEspecie.vacunos += gasto.montoEnUSD
      } else if (gasto.especie === 'OVINOS') {
        variablesDetalle[cat].ovinos += gasto.montoEnUSD
        costosVariablesPorEspecie.ovinos += gasto.montoEnUSD
      } else if (gasto.especie === 'EQUINOS') {
        variablesDetalle[cat].equinos += gasto.montoEnUSD
        costosVariablesPorEspecie.equinos += gasto.montoEnUSD
      } else {
        variablesDetalle[cat].sinAsignar += gasto.montoEnUSD
        costosVariablesPorEspecie.sinAsignar += gasto.montoEnUSD
      }
    })

    const totalVariablesUSD = gastosVariables.reduce(
      (sum, g) => sum + g.montoEnUSD, 
      0
    )

    // ---------------------------------------------------------
    // 6️⃣ Calcular Costos Fijos (distribución automática por % UG)
    // ---------------------------------------------------------
    const totalFijosUSD = gastosFijos.reduce(
      (sum, g) => sum + g.montoEnUSD, 
      0
    )
    
    const costosFijosPorEspecie = {
      vacunos: (totalFijosUSD * porcentajes.vacunos) / 100,
      ovinos: (totalFijosUSD * porcentajes.ovinos) / 100,
      equinos: (totalFijosUSD * porcentajes.equinos) / 100,
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
        }
      }

      fijosDetalle[gasto.categoria].totalUSD += gasto.montoEnUSD
      
      // Distribución automática por % UG
      fijosDetalle[gasto.categoria].vacunos += (gasto.montoEnUSD * porcentajes.vacunos) / 100
      fijosDetalle[gasto.categoria].ovinos += (gasto.montoEnUSD * porcentajes.ovinos) / 100
      fijosDetalle[gasto.categoria].equinos += (gasto.montoEnUSD * porcentajes.equinos) / 100
    })

    // ---------------------------------------------------------
    // 7️⃣ Calcular Totales
    // ---------------------------------------------------------
    const totales = {
      vacunos: costosVariablesPorEspecie.vacunos + costosFijosPorEspecie.vacunos,
      ovinos: costosVariablesPorEspecie.ovinos + costosFijosPorEspecie.ovinos,
      equinos: costosVariablesPorEspecie.equinos + costosFijosPorEspecie.equinos,
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
          sinAsignar: Math.round(costosVariablesPorEspecie.sinAsignar * 100) / 100,
        },
        detalle: Object.values(variablesDetalle).map(d => ({
          categoria: d.categoria,
          totalUSD: Math.round(d.totalUSD * 100) / 100,
          vacunos: Math.round(d.vacunos * 100) / 100,
          ovinos: Math.round(d.ovinos * 100) / 100,
          equinos: Math.round(d.equinos * 100) / 100,
          sinAsignar: Math.round(d.sinAsignar * 100) / 100,
        })),
      },

      costosFijos: {
        totalUSD: Math.round(totalFijosUSD * 100) / 100,
        porEspecie: {
          vacunos: Math.round(costosFijosPorEspecie.vacunos * 100) / 100,
          ovinos: Math.round(costosFijosPorEspecie.ovinos * 100) / 100,
          equinos: Math.round(costosFijosPorEspecie.equinos * 100) / 100,
        },
        detalle: Object.values(fijosDetalle).map(d => ({
          categoria: d.categoria,
          totalUSD: Math.round(d.totalUSD * 100) / 100,
          vacunos: Math.round(d.vacunos * 100) / 100,
          ovinos: Math.round(d.ovinos * 100) / 100,
          equinos: Math.round(d.equinos * 100) / 100,
        })),
      },

      totales: {
        vacunos: Math.round(totales.vacunos * 100) / 100,
        ovinos: Math.round(totales.ovinos * 100) / 100,
        equinos: Math.round(totales.equinos * 100) / 100,
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