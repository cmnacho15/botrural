import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth, canAccessFinanzas } from "@/lib/auth-helpers"
import { calcularEstadisticasCampo } from "@/lib/ugCalculator"
import { getEquivalenciasUG } from "@/lib/getEquivalenciasUG"
import { esCategoriaVariable, esCategoriaFija, esCategoriaFinanciera, esCategoriaMixta } from "@/lib/costos/categoriasCostos"
import { CATEGORIAS_GASTOS_DEFAULT } from "@/lib/constants"

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
        cultivos: {
          select: {
            tipoCultivo: true,
            hectareas: true,
          }
        }
      },
    })

    // ---------------------------------------------------------
    // 2️⃣ Calcular UG por especie y SPG
    // ---------------------------------------------------------
    // Obtener equivalencias personalizadas del campo
    const pesosPersonalizados = await getEquivalenciasUG(campoId)
    
    const estadisticas = calcularEstadisticasCampo(lotes, pesosPersonalizados)
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
    // 🌾 CALCULAR HECTÁREAS DE AGRICULTURA
    // ---------------------------------------------------------
    const lotesAgricolas = lotes.filter(l => l.esPastoreable === false)
    const hectareasAgricultura = lotesAgricolas.reduce((sum, l) => sum + l.hectareas, 0)
    
    const hectareasTotales = superficieParaCalculo + hectareasAgricultura
    
    // Porcentajes de distribución mixta
    const pctGanaderia = hectareasTotales > 0 ? (superficieParaCalculo / hectareasTotales) * 100 : 100
    const pctAgricultura = hectareasTotales > 0 ? (hectareasAgricultura / hectareasTotales) * 100 : 0
    
    console.log('📊 Distribución de superficie:', {
      ganaderia: superficieParaCalculo,
      agricultura: hectareasAgricultura,
      total: hectareasTotales,
      pctGanaderia: pctGanaderia.toFixed(1) + '%',
      pctAgricultura: pctAgricultura.toFixed(1) + '%'
    })

    // ---------------------------------------------------------
    // 3️⃣ Obtener gastos del período
    // ---------------------------------------------------------
    const gastos = await prisma.gasto.findMany({
      where: {
        campoId,
        tipo: "GASTO",  // ✅ Solo gastos, NO ingresos
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
        loteId: true,  // 🆕 NUEVO
        lote: {        // 🆕 NUEVO - Incluir info del lote
          select: {
            nombre: true,
            hectareas: true,
            cultivos: {
              select: {
                tipoCultivo: true,
                hectareas: true,
              }
            }
          }
        }
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
          ganaderia: [],
          agricultura: [],
          mixtos: [],
          automaticos: [],
          detalle: [],
        },
        costosFijos: {
          totalUSD: 0,
          porEspecie: { vacunos: 0, ovinos: 0, equinos: 0 },
          puros: [],
          asignables: [],
          detalle: [],
        },
        costosFinancieros: {
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
    
    // 🔧 FUNCIÓN AUXILIAR
    const getSubtipo = (categoria: string) => {
      const config = CATEGORIAS_GASTOS_DEFAULT.find(c => c.nombre === categoria)
      return config?.subtipo || 'OTRO'
    }
    
    // ---------------------------------------------------------
    // 4️⃣ Separar gastos en Variables, Fijos, Financieros y Mixtos
    // ---------------------------------------------------------
    const gastosVariables = gastos.filter(g => esCategoriaVariable(g.categoria))
    const gastosFijos = gastos.filter(g => esCategoriaFija(g.categoria) && !esCategoriaMixta(g.categoria))
    const gastosMixtos = gastos.filter(g => esCategoriaMixta(g.categoria))
    const gastosFinancieros = gastos.filter(g => esCategoriaFinanciera(g.categoria) && !esCategoriaMixta(g.categoria))

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
      
      // 🔥 DETECTAR SI TIENE MÚLTIPLES ESPECIES
      const especies = gasto.especie ? gasto.especie.split(',') : []
      
      if (especies.length > 1) {
        // 🎯 DISTRIBUCIÓN PROPORCIONAL según % UG
        const montoVacunos = especies.includes('VACUNOS') 
          ? (gasto.montoEnUSD * porcentajes.vacunos) / 100 
          : 0
        const montoOvinos = especies.includes('OVINOS') 
          ? (gasto.montoEnUSD * porcentajes.ovinos) / 100 
          : 0
        const montoEquinos = especies.includes('EQUINOS') 
          ? (gasto.montoEnUSD * porcentajes.equinos) / 100 
          : 0
        
        // Normalizar para que la suma sea exactamente el monto original
        const sumaEspecies = montoVacunos + montoOvinos + montoEquinos
        const factor = sumaEspecies > 0 ? gasto.montoEnUSD / sumaEspecies : 0
        
        variablesDetalle[cat].vacunos += montoVacunos * factor
        variablesDetalle[cat].ovinos += montoOvinos * factor
        variablesDetalle[cat].equinos += montoEquinos * factor
        
        costosVariablesPorEspecie.vacunos += montoVacunos * factor
        costosVariablesPorEspecie.ovinos += montoOvinos * factor
        costosVariablesPorEspecie.equinos += montoEquinos * factor
        
      } else if (especies.length === 1) {
        // 🎯 ASIGNACIÓN 100% a una sola especie
        const especieUnica = especies[0]
        
        if (especieUnica === 'VACUNOS') {
          variablesDetalle[cat].vacunos += gasto.montoEnUSD
          costosVariablesPorEspecie.vacunos += gasto.montoEnUSD
        } else if (especieUnica === 'OVINOS') {
          variablesDetalle[cat].ovinos += gasto.montoEnUSD
          costosVariablesPorEspecie.ovinos += gasto.montoEnUSD
        } else if (especieUnica === 'EQUINOS') {
          variablesDetalle[cat].equinos += gasto.montoEnUSD
          costosVariablesPorEspecie.equinos += gasto.montoEnUSD
        }
        
      } else {
        // 🎯 SIN ESPECIE ASIGNADA (pero solo si NO es agricultura)
        if (getSubtipo(gasto.categoria) !== 'AGRICULTURA') {
          variablesDetalle[cat].sinAsignar += gasto.montoEnUSD
          costosVariablesPorEspecie.sinAsignar += gasto.montoEnUSD
        }
      }
    })

    const totalVariablesUSD = gastosVariables.reduce(
      (sum, g) => sum + g.montoEnUSD, 
      0
    )

    // ---------------------------------------------------------
    // 5️⃣ SUBDIVIDIR COSTOS VARIABLES POR SUBTIPO
    // ---------------------------------------------------------
    

    const variablesGanaderia = variablesDetalle
      ? Object.values(variablesDetalle).filter(d => getSubtipo(d.categoria) === 'GANADERIA')
      : []
    
    // 🌾 Agricultura - Agrupar por cultivo
    const agriculturaPorCultivo: Record<string, {
      cultivo: string
      totalUSD: number
      hectareas: number
      gastos: number
    }> = {}

    const gastosAgricultura = gastosVariables.filter(g => 
      getSubtipo(g.categoria) === 'AGRICULTURA'
    )

    gastosAgricultura.forEach(gasto => {
      if (gasto.lote && gasto.lote.cultivos && gasto.lote.cultivos.length > 0) {
        // Agrupar por cada cultivo del lote
        gasto.lote.cultivos.forEach(cultivo => {
          const key = cultivo.tipoCultivo
          
          if (!agriculturaPorCultivo[key]) {
            agriculturaPorCultivo[key] = {
              cultivo: cultivo.tipoCultivo,
              totalUSD: 0,
              hectareas: cultivo.hectareas,
              gastos: 0,
            }
          }
          
          agriculturaPorCultivo[key].totalUSD += gasto.montoEnUSD
          agriculturaPorCultivo[key].gastos += 1
        })
      }
    })

    // 🌾 CALCULAR COSTOS MIXTOS (Ganadería + Agricultura)
    // ---------------------------------------------------------
    const totalMixtosUSD = gastosMixtos.reduce((sum, g) => sum + g.montoEnUSD, 0)
    
    // Dividir costos mixtos entre ganadería y agricultura
    const mixtos_ganaderia = (totalMixtosUSD * pctGanaderia) / 100
    const mixtos_agricultura = (totalMixtosUSD * pctAgricultura) / 100
    
    console.log('💰 Costos MIXTOS:', {
      total: totalMixtosUSD,
      ganaderia: mixtos_ganaderia,
      agricultura: mixtos_agricultura
    })
    
    // Distribuir parte de ganadería por % UG
    const costosMixtosPorEspecie = {
      vacunos: (mixtos_ganaderia * porcentajes.vacunos) / 100,
      ovinos: (mixtos_ganaderia * porcentajes.ovinos) / 100,
      equinos: (mixtos_ganaderia * porcentajes.equinos) / 100,
    }
    
    // Detalle de costos mixtos por categoría
    const mixtosDetalle: Record<string, any> = {}
    
    gastosMixtos.forEach(gasto => {
      if (!mixtosDetalle[gasto.categoria]) {
        mixtosDetalle[gasto.categoria] = {
          categoria: gasto.categoria,
          totalUSD: 0,
          ganaderia: 0,
          agricultura: 0,
          vacunos: 0,
          ovinos: 0,
          equinos: 0,
        }
      }
      
      const montoGanaderia = (gasto.montoEnUSD * pctGanaderia) / 100
      const montoAgricultura = (gasto.montoEnUSD * pctAgricultura) / 100
      
      mixtosDetalle[gasto.categoria].totalUSD += gasto.montoEnUSD
      mixtosDetalle[gasto.categoria].ganaderia += montoGanaderia
      mixtosDetalle[gasto.categoria].agricultura += montoAgricultura
      
      // Distribución por especie (solo parte de ganadería)
      mixtosDetalle[gasto.categoria].vacunos += (montoGanaderia * porcentajes.vacunos) / 100
      mixtosDetalle[gasto.categoria].ovinos += (montoGanaderia * porcentajes.ovinos) / 100
      mixtosDetalle[gasto.categoria].equinos += (montoGanaderia * porcentajes.equinos) / 100
    })
    
    // 🌾 Distribuir parte de agricultura entre cultivos por hectáreas
    const mixtos_porCultivo: Record<string, number> = {}
    
    if (hectareasAgricultura > 0) {
      for (const lote of lotesAgricolas) {
        for (const cultivo of lote.cultivos) {
          const key = cultivo.tipoCultivo
          const pctCultivo = (cultivo.hectareas / hectareasAgricultura) * 100
          const montoCultivo = (mixtos_agricultura * pctCultivo) / 100
          
          if (!mixtos_porCultivo[key]) {
            mixtos_porCultivo[key] = 0
          }
          mixtos_porCultivo[key] += montoCultivo
        }
      }
    }

    // 🌾 AGRICULTURA: Variables + parte proporcional de mixtos
    const agriculturaPorCultivoFinal: Record<string, {
      cultivo: string
      totalUSD: number
      hectareas: number
      gastos: number
      costosFijos: number
    }> = {}
    
    // Primero agregar variables
    Object.entries(agriculturaPorCultivo).forEach(([key, c]) => {
      agriculturaPorCultivoFinal[key] = {
        cultivo: c.cultivo,
        totalUSD: c.totalUSD,
        hectareas: c.hectareas,
        gastos: c.gastos,
        costosFijos: 0
      }
    })
    
    // Agregar parte proporcional de costos mixtos
    Object.entries(mixtos_porCultivo).forEach(([cultivo, monto]) => {
      if (!agriculturaPorCultivoFinal[cultivo]) {
        // Si no tiene gastos variables, crear entrada solo con fijos
        const hectareasCultivo = lotesAgricolas
          .flatMap(l => l.cultivos)
          .filter(c => c.tipoCultivo === cultivo)
          .reduce((sum, c) => sum + c.hectareas, 0)
        
        agriculturaPorCultivoFinal[cultivo] = {
          cultivo,
          totalUSD: 0,
          hectareas: hectareasCultivo,
          gastos: 0,
          costosFijos: 0
        }
      }
      
      agriculturaPorCultivoFinal[cultivo].costosFijos = monto
      agriculturaPorCultivoFinal[cultivo].totalUSD += monto
    })
    
    const variablesAgricultura = Object.values(agriculturaPorCultivoFinal).map(c => ({
      cultivo: c.cultivo,
      totalUSD: Math.round(c.totalUSD * 100) / 100,
      hectareas: Math.round(c.hectareas * 100) / 100,
      usdPorHa: c.hectareas > 0 ? Math.round((c.totalUSD / c.hectareas) * 100) / 100 : 0,
      gastos: c.gastos,
      costosFijos: Math.round(c.costosFijos * 100) / 100,
    }))
    
    const variablesMixtos = variablesDetalle
      ? Object.values(variablesDetalle).filter(d => getSubtipo(d.categoria) === 'MIXTO')
      : []
    
    const variablesAutomaticos = variablesDetalle
      ? Object.values(variablesDetalle).filter(d => getSubtipo(d.categoria) === 'AUTOMATICO')
      : []

    // ---------------------------------------------------------
    // 7 Calcular Costos Fijos (distribución automática por % UG)
    // ---------------------------------------------------------
    const totalFijosPurosUSD = gastosFijos.reduce(
      (sum, g) => sum + g.montoEnUSD, 
      0
    )
    
    // Total de fijos INCLUYENDO mixtos (para ganadería)
    const totalFijosUSD = totalFijosPurosUSD + mixtos_ganaderia
    
    // ---------------------------------------------------------
    // 6️⃣ SUBDIVIDIR COSTOS FIJOS POR SUBTIPO
    // ---------------------------------------------------------
    

    const costosFijosPorEspecie = {
      vacunos: (totalFijosPurosUSD * porcentajes.vacunos) / 100 + costosMixtosPorEspecie.vacunos,
      ovinos: (totalFijosPurosUSD * porcentajes.ovinos) / 100 + costosMixtosPorEspecie.ovinos,
      equinos: (totalFijosPurosUSD * porcentajes.equinos) / 100 + costosMixtosPorEspecie.equinos,
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

    // Agregar costos mixtos al detalle de fijos
    Object.values(mixtosDetalle).forEach((mixto: any) => {
      if (!fijosDetalle[mixto.categoria]) {
        fijosDetalle[mixto.categoria] = {
          categoria: mixto.categoria,
          totalUSD: 0,
          vacunos: 0,
          ovinos: 0,
          equinos: 0,
        }
      }
      
      fijosDetalle[mixto.categoria].totalUSD += mixto.ganaderia
      fijosDetalle[mixto.categoria].vacunos += mixto.vacunos
      fijosDetalle[mixto.categoria].ovinos += mixto.ovinos
      fijosDetalle[mixto.categoria].equinos += mixto.equinos
    })

    // ---------------------------------------------------------
    // 🔧 PREPARAR SUBDIVISIONES PARA RESPUESTA
    // ---------------------------------------------------------
    const fijosPuros: Array<{
      categoria: string
      totalUSD: number
      vacunos: number
      ovinos: number
      equinos: number
    }> = Object.values(fijosDetalle).filter(d => getSubtipo(d.categoria) === 'PURO')
    
    const fijosAsignables: Array<{
      categoria: string
      totalUSD: number
      vacunos: number
      ovinos: number
      equinos: number
    }> = Object.values(fijosDetalle).filter(d => getSubtipo(d.categoria) === 'ASIGNABLE')

    // ---------------------------------------------------------
    // 8️⃣ Calcular Costos Financieros
    // ---------------------------------------------------------
    const totalFinancierosUSD = gastosFinancieros.reduce(
      (sum, g) => sum + g.montoEnUSD, 
      0
    )
    
    const costosFinancierosPorEspecie = {
      vacunos: (totalFinancierosUSD * porcentajes.vacunos) / 100,
      ovinos: (totalFinancierosUSD * porcentajes.ovinos) / 100,
      equinos: (totalFinancierosUSD * porcentajes.equinos) / 100,
    }

    const financierosDetalle: Record<string, any> = {}

    gastosFinancieros.forEach(gasto => {
      if (!financierosDetalle[gasto.categoria]) {
        financierosDetalle[gasto.categoria] = {
          categoria: gasto.categoria,
          totalUSD: 0,
          vacunos: 0,
          ovinos: 0,
          equinos: 0,
        }
      }

      financierosDetalle[gasto.categoria].totalUSD += gasto.montoEnUSD
      
      // Distribución automática por % UG
      financierosDetalle[gasto.categoria].vacunos += (gasto.montoEnUSD * porcentajes.vacunos) / 100
      financierosDetalle[gasto.categoria].ovinos += (gasto.montoEnUSD * porcentajes.ovinos) / 100
      financierosDetalle[gasto.categoria].equinos += (gasto.montoEnUSD * porcentajes.equinos) / 100
    })

    // ---------------------------------------------------------
    // 9️⃣ Calcular Totales
    // ---------------------------------------------------------
    const totales = {
      vacunos: costosVariablesPorEspecie.vacunos + costosFijosPorEspecie.vacunos + costosFinancierosPorEspecie.vacunos,
      ovinos: costosVariablesPorEspecie.ovinos + costosFijosPorEspecie.ovinos + costosFinancierosPorEspecie.ovinos,
      equinos: costosVariablesPorEspecie.equinos + costosFijosPorEspecie.equinos + costosFinancierosPorEspecie.equinos,
      general: totalVariablesUSD + totalFijosUSD + totalFinancierosUSD,
    }

    // ---------------------------------------------------------
    // 🔟 Calcular USD/ha
    // ---------------------------------------------------------
    const usdPorHectarea = {
      vacunos: hectareas.vacunos > 0 ? totales.vacunos / hectareas.vacunos : 0,
      ovinos: hectareas.ovinos > 0 ? totales.ovinos / hectareas.ovinos : 0,
      equinos: hectareas.equinos > 0 ? totales.equinos / hectareas.equinos : 0,
      general: hectareas.total > 0 ? totales.general / hectareas.total : 0,
    }

    // ---------------------------------------------------------
    // 1️⃣1️⃣ Respuesta final
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
      // 🆕 AGREGAR ADVERTENCIA SOLO SI HAY GASTOS SIN ASIGNAR DE GANADERÍA
      ...(costosVariablesPorEspecie.sinAsignar > 0 && {
        advertenciaSinEspecie: `Hay ${costosVariablesPorEspecie.sinAsignar.toFixed(2)} en costos variables de ganadería sin especie asignada.`
      }),
        // Subdivisión por subtipo
        ganaderia: variablesGanaderia.map(d => ({
          categoria: d.categoria,
          totalUSD: Math.round(d.totalUSD * 100) / 100,
          vacunos: Math.round(d.vacunos * 100) / 100,
          ovinos: Math.round(d.ovinos * 100) / 100,
          equinos: Math.round(d.equinos * 100) / 100,
          sinAsignar: Math.round(d.sinAsignar * 100) / 100,
        })),
        agricultura: variablesAgricultura.map(d => ({
          cultivo: d.cultivo,
          totalUSD: d.totalUSD,
          hectareas: d.hectareas,
          usdPorHa: d.usdPorHa,
          gastos: d.gastos,
          costosFijos: d.costosFijos,
        })),
        mixtos: variablesMixtos.map(d => ({
          categoria: d.categoria,
          totalUSD: Math.round(d.totalUSD * 100) / 100,
          vacunos: Math.round(d.vacunos * 100) / 100,
          ovinos: Math.round(d.ovinos * 100) / 100,
          equinos: Math.round(d.equinos * 100) / 100,
          sinAsignar: Math.round(d.sinAsignar * 100) / 100,
        })),
        automaticos: variablesAutomaticos.map(d => ({
          categoria: d.categoria,
          totalUSD: Math.round(d.totalUSD * 100) / 100,
          vacunos: Math.round(d.vacunos * 100) / 100,
          ovinos: Math.round(d.ovinos * 100) / 100,
          equinos: Math.round(d.equinos * 100) / 100,
          sinAsignar: Math.round(d.sinAsignar * 100) / 100,
        })),
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
        // Subdivisión por subtipo
        puros: fijosPuros.map(d => ({
          categoria: d.categoria,
          totalUSD: Math.round(d.totalUSD * 100) / 100,
          vacunos: Math.round(d.vacunos * 100) / 100,
          ovinos: Math.round(d.ovinos * 100) / 100,
          equinos: Math.round(d.equinos * 100) / 100,
        })),
        asignables: fijosAsignables.map(d => ({
          categoria: d.categoria,
          totalUSD: Math.round(d.totalUSD * 100) / 100,
          vacunos: Math.round(d.vacunos * 100) / 100,
          ovinos: Math.round(d.ovinos * 100) / 100,
          equinos: Math.round(d.equinos * 100) / 100,
        })),
        detalle: Object.values(fijosDetalle).map(d => ({
          categoria: d.categoria,
          totalUSD: Math.round(d.totalUSD * 100) / 100,
          vacunos: Math.round(d.vacunos * 100) / 100,
          ovinos: Math.round(d.ovinos * 100) / 100,
          equinos: Math.round(d.equinos * 100) / 100,
        })),
      },

      costosFinancieros: {
        totalUSD: Math.round(totalFinancierosUSD * 100) / 100,
        porEspecie: {
          vacunos: Math.round(costosFinancierosPorEspecie.vacunos * 100) / 100,
          ovinos: Math.round(costosFinancierosPorEspecie.ovinos * 100) / 100,
          equinos: Math.round(costosFinancierosPorEspecie.equinos * 100) / 100,
        },
        detalle: Object.values(financierosDetalle).map(d => ({
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

      // 🌾 Info de agricultura
      agriculturaInfo: {
        hectareas: Math.round(hectareasAgricultura * 10) / 10,
        pctDelTotal: Math.round(pctAgricultura * 10) / 10,
        costosFijos: Math.round(mixtos_agricultura * 100) / 100,
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