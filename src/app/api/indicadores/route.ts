import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth, canAccessFinanzas } from "@/lib/auth-helpers"
import { calcularEstadisticasCampo, calcularRelacionLanarVacuno } from "@/lib/ugCalculator"
import { getEquivalenciasUG } from "@/lib/getEquivalenciasUG"
import { CATEGORIAS_VARIABLES } from "@/lib/costos/categoriasCostos"

/**
 * GET /api/indicadores
 * Calcula todos los indicadores productivos y económicos del ejercicio
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

    // ---------------------------------------------------------
    // CALCULAR EJERCICIO FISCAL (1 julio - 30 junio)
    // ---------------------------------------------------------
    const now = new Date()
    const mes = now.getMonth() // 0-11
    const anio = now.getFullYear()

    // Si estamos entre enero y junio, el ejercicio empezó el año anterior
    const anioInicio = mes < 6 ? anio - 1 : anio
    const anioFin = anioInicio + 1

    // Permitir override por parámetros
    const paramAnioInicio = searchParams.get("anioInicio")
    const paramAnioFin = searchParams.get("anioFin")
    const usarSPG = searchParams.get("usarSPG") === "true" 

    const ejercicioInicio = paramAnioInicio ? parseInt(paramAnioInicio) : anioInicio
    const ejercicioFin = paramAnioFin ? parseInt(paramAnioFin) : anioFin

    const fechaDesde = new Date(`${ejercicioInicio}-07-01T00:00:00.000Z`)
    const fechaHasta = new Date(`${ejercicioFin}-06-30T23:59:59.999Z`)

    // Fechas para inventario (formato YYYY-MM-DD)
    const fechaInvInicio = `${ejercicioInicio}-07-01`
    const fechaInvFin = `${ejercicioFin}-06-30`

    // ---------------------------------------------------------
    // 1 OBTENER LOTES Y CALCULAR UG/HECTÁREAS
    // ---------------------------------------------------------
    const lotes = await prisma.lote.findMany({
  where: { campoId },
  select: {  // 🆕 CAMBIAR include por select
    id: true,
    nombre: true,
    hectareas: true,
    esPastoreable: true,  // 🆕 NUEVO
    animalesLote: {
      select: {
        categoria: true,
        cantidad: true,
      },
    },
  },
})

    // Obtener equivalencias personalizadas del campo
    const pesosPersonalizados = await getEquivalenciasUG(campoId)
    
    const estadisticas = calcularEstadisticasCampo(lotes, pesosPersonalizados)
    const { ugTotalesCampo, desglosePorTipo, totalHectareas } = estadisticas
    
    const { relacion: relacionLanarVacuno } = calcularRelacionLanarVacuno(lotes)
    
    // 🆕 CALCULAR SPG (solo potreros pastoreables)
const lotesPastoreables = lotes.filter(l => l.esPastoreable)
const spg = lotesPastoreables.reduce((sum, l) => sum + l.hectareas, 0)

// 🆕 CALCULAR SUPERFICIE MEJORADA (pastoreables con cultivos)
const lotesConCultivos = await prisma.lote.findMany({
  where: {
    campoId,
    esPastoreable: true,
  },
  include: {
    cultivos: {
      where: {
        fechaSiembra: {
          gte: fechaDesde,
          lte: fechaHasta,
        }
      }
    }
  }
})

const superficieMejorada = lotesConCultivos
  .filter(lote => lote.cultivos.length > 0)
  .reduce((sum, lote) => sum + lote.hectareas, 0)

// 🆕 DECIDIR QUÉ SUPERFICIE USAR
const superficieParaCalculos = usarSPG ? spg : totalHectareas

    // Calcular hectáreas por especie (proporcional a % UG)
    let porcentajesUG = { vacunos: 0, ovinos: 0, equinos: 0 }
    if (ugTotalesCampo > 0) {
      porcentajesUG = {
        vacunos: (desglosePorTipo.vacunos / ugTotalesCampo) * 100,
        ovinos: (desglosePorTipo.ovinos / ugTotalesCampo) * 100,
        equinos: (desglosePorTipo.yeguarizos / ugTotalesCampo) * 100,
      }
    }

    const hectareasPorEspecie = {
  vacunos: (superficieParaCalculos * porcentajesUG.vacunos) / 100,  // 🆕 CAMBIO
  ovinos: (superficieParaCalculos * porcentajesUG.ovinos) / 100,    // 🆕 CAMBIO
  equinos: (superficieParaCalculos * porcentajesUG.equinos) / 100,  // 🆕 CAMBIO
  total: superficieParaCalculos,  // 🆕 CAMBIO
}

    // Carga (UG/ha)
    const carga = {
  global: superficieParaCalculos > 0 ? ugTotalesCampo / superficieParaCalculos : 0,
  vacunos: superficieParaCalculos > 0 ? desglosePorTipo.vacunos / superficieParaCalculos : 0,
  ovinos: superficieParaCalculos > 0 ? desglosePorTipo.ovinos / superficieParaCalculos : 0,
  equinos: superficieParaCalculos > 0 ? desglosePorTipo.yeguarizos / superficieParaCalculos : 0,
}

// 🆕 Carga en kg de peso vivo (UG × 380)
const cargaKgPV = {
  global: carga.global * 380,
  vacunos: carga.vacunos * 380,
  ovinos: carga.ovinos * 380,
  equinos: carga.equinos * 380,
}
    // ---------------------------------------------------------
    // 2 OBTENER VENTAS DEL EJERCICIO
    // ---------------------------------------------------------
    const ventas = await prisma.venta.findMany({
      where: {
        campoId,
        fecha: { gte: fechaDesde, lte: fechaHasta },
      },
      include: {
        renglones: true,
      },
    })

    // Agrupar ventas por tipo de animal
    const ventasPorTipo = {
      BOVINO: { cantidad: 0, pesoTotalKg: 0, importeBrutoUSD: 0 },
      OVINO: { cantidad: 0, pesoTotalKg: 0, importeBrutoUSD: 0 },
      EQUINO: { cantidad: 0, pesoTotalKg: 0, importeBrutoUSD: 0 },
    }

    ventas.forEach(venta => {
      venta.renglones.forEach(renglon => {
        if (!renglon.esVentaLana) {
          const tipo = renglon.tipoAnimal as keyof typeof ventasPorTipo
          if (ventasPorTipo[tipo]) {
            ventasPorTipo[tipo].cantidad += renglon.cantidad
            ventasPorTipo[tipo].pesoTotalKg += renglon.pesoTotalKg
            ventasPorTipo[tipo].importeBrutoUSD += renglon.importeBrutoUSD
          }
        }
      })
    })

    const ventasTotales = {
      cantidad: ventasPorTipo.BOVINO.cantidad + ventasPorTipo.OVINO.cantidad + ventasPorTipo.EQUINO.cantidad,
      pesoTotalKg: ventasPorTipo.BOVINO.pesoTotalKg + ventasPorTipo.OVINO.pesoTotalKg + ventasPorTipo.EQUINO.pesoTotalKg,
      importeBrutoUSD: ventasPorTipo.BOVINO.importeBrutoUSD + ventasPorTipo.OVINO.importeBrutoUSD + ventasPorTipo.EQUINO.importeBrutoUSD,
    }

    // ---------------------------------------------------------
    // 3 OBTENER COMPRAS DEL EJERCICIO
    // ---------------------------------------------------------
    const compras = await prisma.compra.findMany({
      where: {
        campoId,
        fecha: { gte: fechaDesde, lte: fechaHasta },
      },
      include: {
        renglones: true,
      },
    })

    const comprasPorTipo = {
      BOVINO: { cantidad: 0, pesoTotalKg: 0, importeBrutoUSD: 0 },
      OVINO: { cantidad: 0, pesoTotalKg: 0, importeBrutoUSD: 0 },
      EQUINO: { cantidad: 0, pesoTotalKg: 0, importeBrutoUSD: 0 },
    }

    compras.forEach(compra => {
      compra.renglones.forEach(renglon => {
        const tipo = renglon.tipoAnimal as keyof typeof comprasPorTipo
        if (comprasPorTipo[tipo]) {
          comprasPorTipo[tipo].cantidad += renglon.cantidad
          comprasPorTipo[tipo].pesoTotalKg += renglon.pesoTotalKg
          comprasPorTipo[tipo].importeBrutoUSD += renglon.importeBrutoUSD
        }
      })
    })

    const comprasTotales = {
      cantidad: comprasPorTipo.BOVINO.cantidad + comprasPorTipo.OVINO.cantidad + comprasPorTipo.EQUINO.cantidad,
      pesoTotalKg: comprasPorTipo.BOVINO.pesoTotalKg + comprasPorTipo.OVINO.pesoTotalKg + comprasPorTipo.EQUINO.pesoTotalKg,
      importeBrutoUSD: comprasPorTipo.BOVINO.importeBrutoUSD + comprasPorTipo.OVINO.importeBrutoUSD + comprasPorTipo.EQUINO.importeBrutoUSD,
    }
    

    // ---------------------------------------------------------
// 3.5 OBTENER LANA DEL EJERCICIO (Esquilas + Ventas)
// ---------------------------------------------------------

// 1️⃣ Obtener esquilas (lana en stock)
const esquilas = await prisma.esquila.findMany({
  where: {
    campoId,
    fecha: { gte: fechaDesde, lte: fechaHasta },
  },
  include: {
    categorias: true,
  },
})

let totalKgLanaEsquilas = 0
let totalUSDLanaEsquilas = 0

esquilas.forEach(esquila => {
  esquila.categorias.forEach(cat => {
    totalKgLanaEsquilas += Number(cat.pesoKg)
    totalUSDLanaEsquilas += Number(cat.pesoKg) * Number(cat.precioUSD)
  })
})

// 2️⃣ Obtener ventas de lana
const ventasLana = await prisma.venta.findMany({
  where: {
    campoId,
    fecha: { gte: fechaDesde, lte: fechaHasta },
    tipoProducto: "LANA",
  },
  include: {
    renglones: {
      where: {
        tipo: "LANA"
      }
    }
  }
})

let totalKgLanaVendida = 0
let totalUSDLanaVendida = 0

ventasLana.forEach(venta => {
  venta.renglones.forEach(renglon => {
    const kgLana = Number(renglon.pesoTotalKg) || 0
    totalKgLanaVendida += kgLana
    totalUSDLanaVendida += Number(renglon.importeBrutoUSD) || 0
  })
})

// 3️⃣ TOTALES DE LANA (esquilas + ventas)
const totalKgLana = totalKgLanaEsquilas + totalKgLanaVendida
const totalUSDLana = totalUSDLanaEsquilas + totalUSDLanaVendida

console.log(`🧶 LANA - Esquilas: ${totalKgLanaEsquilas}kg ($${totalUSDLanaEsquilas})`)
console.log(`🧶 LANA - Ventas: ${totalKgLanaVendida}kg ($${totalUSDLanaVendida})`)
console.log(`🧶 LANA - TOTAL: ${totalKgLana}kg ($${totalUSDLana})`)

// Conversión lana a equivalente carne (kg lana × 2.48)
const lanaEquivCarne = totalKgLana * 2.48

    // ---------------------------------------------------------
    // 4 OBTENER CONSUMOS DEL EJERCICIO
    // ---------------------------------------------------------
    const consumos = await prisma.consumo.findMany({
      where: {
        campoId,
        fecha: { gte: fechaDesde, lte: fechaHasta },
      },
      include: {
        renglones: true,
      },
    })

    const consumosPorTipo = {
      BOVINO: { cantidad: 0, pesoTotalKg: 0, valorTotalUSD: 0 },
      OVINO: { cantidad: 0, pesoTotalKg: 0, valorTotalUSD: 0 },
      EQUINO: { cantidad: 0, pesoTotalKg: 0, valorTotalUSD: 0 },
    }

    consumos.forEach(consumo => {
      consumo.renglones.forEach(renglon => {
        const tipo = renglon.tipoAnimal as keyof typeof consumosPorTipo
        if (consumosPorTipo[tipo]) {
          consumosPorTipo[tipo].cantidad += renglon.cantidad
          consumosPorTipo[tipo].pesoTotalKg += renglon.pesoTotalKg || 0
          consumosPorTipo[tipo].valorTotalUSD += renglon.valorTotalUSD || 0
        }
      })
    })

    const consumosTotales = {
      cantidad: consumosPorTipo.BOVINO.cantidad + consumosPorTipo.OVINO.cantidad + consumosPorTipo.EQUINO.cantidad,
      pesoTotalKg: consumosPorTipo.BOVINO.pesoTotalKg + consumosPorTipo.OVINO.pesoTotalKg + consumosPorTipo.EQUINO.pesoTotalKg,
      valorTotalUSD: consumosPorTipo.BOVINO.valorTotalUSD + consumosPorTipo.OVINO.valorTotalUSD + consumosPorTipo.EQUINO.valorTotalUSD,
    }

    // ---------------------------------------------------------
    // 5 OBTENER DIFERENCIA DE INVENTARIO
    // ---------------------------------------------------------
    const invInicio = await prisma.inventario.findMany({
      where: {
        campoId,
        fecha: new Date(fechaInvInicio),
      },
    })

    const invFin = await prisma.inventario.findMany({
      where: {
        campoId,
        fecha: new Date(fechaInvFin),
      },
    })

    // Función para determinar tipo de animal por categoría
    function getTipoAnimal(categoria: string): 'BOVINO' | 'OVINO' | 'EQUINO' | 'OTRO' {
      const cat = categoria.toLowerCase()
      if (cat.includes('vaca') || cat.includes('toro') || cat.includes('novillo') || 
          cat.includes('vaquillona') || cat.includes('ternero') || cat.includes('ternera')) {
        return 'BOVINO'
      }
      if (cat.includes('oveja') || cat.includes('carnero') || cat.includes('cordero') || 
          cat.includes('capón') || cat.includes('borrego')) {
        return 'OVINO'
      }
      if (cat.includes('caballo') || cat.includes('yegua') || cat.includes('potro') || 
          cat.includes('potrillo')) {
        return 'EQUINO'
      }
      return 'OTRO'
    }

    // Calcular diferencia de inventario por tipo
    const difInventarioPorTipo = {
      BOVINO: { difKg: 0, difUSD: 0 },
      OVINO: { difKg: 0, difUSD: 0 },
      EQUINO: { difKg: 0, difUSD: 0 },
    }

    // Crear mapa de inventario inicio
    const invInicioMap = new Map<string, any>()
    invInicio.forEach(item => {
      invInicioMap.set(item.categoria, item)
    })

    // Calcular diferencias
    const categoriasProcessed = new Set<string>()

    invFin.forEach(itemFin => {
      const itemInicio = invInicioMap.get(itemFin.categoria)
      const tipo = getTipoAnimal(itemFin.categoria)
      
      if (tipo !== 'OTRO' && difInventarioPorTipo[tipo]) {
        const cantInicio = itemInicio?.cantidad || 0
        const cantFin = itemFin.cantidad
        const peso = itemFin.peso || 0
        const precioInicio = itemInicio?.precioKg || 0
        const precioFin = itemFin.precioKgFin || 0

        const kgInicio = cantInicio * peso
        const kgFin = cantFin * peso
        const usdInicio = kgInicio * precioInicio
        const usdFin = kgFin * precioFin

        difInventarioPorTipo[tipo].difKg += (kgFin - kgInicio)
        difInventarioPorTipo[tipo].difUSD += (usdFin - usdInicio)
      }
      categoriasProcessed.add(itemFin.categoria)
    })

    // Procesar categorías que solo están en inicio
    invInicio.forEach(itemInicio => {
      if (!categoriasProcessed.has(itemInicio.categoria)) {
        const tipo = getTipoAnimal(itemInicio.categoria)
        if (tipo !== 'OTRO' && difInventarioPorTipo[tipo]) {
          const kgInicio = itemInicio.cantidad * (itemInicio.peso || 0)
          const usdInicio = kgInicio * (itemInicio.precioKg || 0)
          
          difInventarioPorTipo[tipo].difKg -= kgInicio
          difInventarioPorTipo[tipo].difUSD -= usdInicio
        }
      }
    })

    const difInventarioTotales = {
      difKg: difInventarioPorTipo.BOVINO.difKg + difInventarioPorTipo.OVINO.difKg + difInventarioPorTipo.EQUINO.difKg,
      difUSD: difInventarioPorTipo.BOVINO.difUSD + difInventarioPorTipo.OVINO.difUSD + difInventarioPorTipo.EQUINO.difUSD,
    }

    // ---------------------------------------------------------
    // 5.5 CALCULAR STOCK EN KG PARA TASA DE EXTRACCIÓN
    // ---------------------------------------------------------
    const stockInicioPorTipo = { BOVINO: 0, OVINO: 0, EQUINO: 0 }
    const stockFinPorTipo = { BOVINO: 0, OVINO: 0, EQUINO: 0 }

    invInicio.forEach(item => {
      const tipo = getTipoAnimal(item.categoria)
      if (tipo !== 'OTRO') {
        stockInicioPorTipo[tipo] += item.cantidad * (item.peso || 0)
      }
    })

    invFin.forEach(item => {
      const tipo = getTipoAnimal(item.categoria)
      if (tipo !== 'OTRO') {
        stockFinPorTipo[tipo] += item.cantidad * (item.peso || 0)
      }
    })

    const stockInicioTotal = stockInicioPorTipo.BOVINO + stockInicioPorTipo.OVINO + stockInicioPorTipo.EQUINO
    const stockFinTotal = stockFinPorTipo.BOVINO + stockFinPorTipo.OVINO + stockFinPorTipo.EQUINO

    // Tasa extracción = Kg vendidos / ((Kg stock inicio + Kg stock fin) / 2) × 100
    const calcTasaExtraccion = (kgVendidos: number, kgInicio: number, kgFin: number) => {
      const stockPromedio = (kgInicio + kgFin) / 2
      return stockPromedio > 0 ? (kgVendidos / stockPromedio) * 100 : 0
    }

    const tasaExtraccion = {
      global: calcTasaExtraccion(ventasTotales.pesoTotalKg, stockInicioTotal, stockFinTotal),
      vacunos: calcTasaExtraccion(ventasPorTipo.BOVINO.pesoTotalKg, stockInicioPorTipo.BOVINO, stockFinPorTipo.BOVINO),
      ovinos: calcTasaExtraccion(ventasPorTipo.OVINO.pesoTotalKg, stockInicioPorTipo.OVINO, stockFinPorTipo.OVINO),
      equinos: calcTasaExtraccion(ventasPorTipo.EQUINO.pesoTotalKg, stockInicioPorTipo.EQUINO, stockFinPorTipo.EQUINO),
    }

    // ---------------------------------------------------------
    // 6 OBTENER COSTOS DEL EJERCICIO
    // ---------------------------------------------------------
    const gastos = await prisma.gasto.findMany({
  where: {
    campoId,
    fecha: { gte: fechaDesde, lte: fechaHasta },
    tipo: "GASTO",  // 🔥 AGREGAR ESTA LÍNEA
  },
  select: {
    categoria: true,
    montoEnUSD: true,
    especie: true,
  },
})

    // Separar en fijos, variables y RENTA
    const gastosVariables = gastos.filter(g => CATEGORIAS_VARIABLES.includes(g.categoria as any))
    const gastosRenta = gastos.filter(g => g.categoria === 'Renta')
    const gastosFijos = gastos.filter(g => !CATEGORIAS_VARIABLES.includes(g.categoria as any) && g.categoria !== 'Renta')

    // Costos variables por especie (asignación directa)
    const costosVariablesPorEspecie = {
      vacunos: 0,
      ovinos: 0,
      equinos: 0,
      sinAsignar: 0,
    }

    gastosVariables.forEach(gasto => {
      if (gasto.especie === 'VACUNOS') {
        costosVariablesPorEspecie.vacunos += gasto.montoEnUSD
      } else if (gasto.especie === 'OVINOS') {
        costosVariablesPorEspecie.ovinos += gasto.montoEnUSD
      } else if (gasto.especie === 'EQUINOS') {
        costosVariablesPorEspecie.equinos += gasto.montoEnUSD
      } else {
        costosVariablesPorEspecie.sinAsignar += gasto.montoEnUSD
      }
    })

    const totalVariables = gastosVariables.reduce((sum, g) => sum + g.montoEnUSD, 0)

    // Costos fijos (distribución por % UG)
    const totalFijos = gastosFijos.reduce((sum, g) => sum + g.montoEnUSD, 0)

    const costosFijosPorEspecie = {
      vacunos: (totalFijos * porcentajesUG.vacunos) / 100,
      ovinos: (totalFijos * porcentajesUG.ovinos) / 100,
      equinos: (totalFijos * porcentajesUG.equinos) / 100,
    }

    // Costos de Renta (distribución por % UG)
    const totalRenta = gastosRenta.reduce((sum, g) => sum + g.montoEnUSD, 0)

    const costosRentaPorEspecie = {
      vacunos: (totalRenta * porcentajesUG.vacunos) / 100,
      ovinos: (totalRenta * porcentajesUG.ovinos) / 100,
      equinos: (totalRenta * porcentajesUG.equinos) / 100,
    }

    // Costos totales por especie (CON renta)
    const costosTotalesPorEspecie = {
      vacunos: costosVariablesPorEspecie.vacunos + costosFijosPorEspecie.vacunos + costosRentaPorEspecie.vacunos,
      ovinos: costosVariablesPorEspecie.ovinos + costosFijosPorEspecie.ovinos + costosRentaPorEspecie.ovinos,
      equinos: costosVariablesPorEspecie.equinos + costosFijosPorEspecie.equinos + costosRentaPorEspecie.equinos,
    }

    const costosTotalesGeneral = totalVariables + totalFijos + totalRenta

    // Costos SIN renta (para IK)
    const costosSinRentaPorEspecie = {
      vacunos: costosVariablesPorEspecie.vacunos + costosFijosPorEspecie.vacunos,
      ovinos: costosVariablesPorEspecie.ovinos + costosFijosPorEspecie.ovinos,
      equinos: costosVariablesPorEspecie.equinos + costosFijosPorEspecie.equinos,
    }

    const costosSinRentaGeneral = totalVariables + totalFijos

    // ---------------------------------------------------------
    // 7 CALCULAR INDICADORES
    // ---------------------------------------------------------

    // Producción de carne (kg) = Ventas + Consumo - Compras +/- Dif Inventario + Lana equiv
    const produccionCarne = {
      global: ventasTotales.pesoTotalKg + consumosTotales.pesoTotalKg - comprasTotales.pesoTotalKg + difInventarioTotales.difKg + lanaEquivCarne,
      vacunos: ventasPorTipo.BOVINO.pesoTotalKg + consumosPorTipo.BOVINO.pesoTotalKg - comprasPorTipo.BOVINO.pesoTotalKg + difInventarioPorTipo.BOVINO.difKg,
      ovinos: ventasPorTipo.OVINO.pesoTotalKg + consumosPorTipo.OVINO.pesoTotalKg - comprasPorTipo.OVINO.pesoTotalKg + difInventarioPorTipo.OVINO.difKg + lanaEquivCarne,
      equinos: ventasPorTipo.EQUINO.pesoTotalKg + consumosPorTipo.EQUINO.pesoTotalKg - comprasPorTipo.EQUINO.pesoTotalKg + difInventarioPorTipo.EQUINO.difKg,
    }

    // Producto Bruto (U$S) = Ventas + Consumo - Compras +/- Dif Inventario + Valor lana
    const productoBruto = {
      global: ventasTotales.importeBrutoUSD + consumosTotales.valorTotalUSD - comprasTotales.importeBrutoUSD + difInventarioTotales.difUSD + totalUSDLana,
      vacunos: ventasPorTipo.BOVINO.importeBrutoUSD + consumosPorTipo.BOVINO.valorTotalUSD - comprasPorTipo.BOVINO.importeBrutoUSD + difInventarioPorTipo.BOVINO.difUSD,
      ovinos: ventasPorTipo.OVINO.importeBrutoUSD + consumosPorTipo.OVINO.valorTotalUSD - comprasPorTipo.OVINO.importeBrutoUSD + difInventarioPorTipo.OVINO.difUSD + totalUSDLana,
      equinos: ventasPorTipo.EQUINO.importeBrutoUSD + consumosPorTipo.EQUINO.valorTotalUSD - comprasPorTipo.EQUINO.importeBrutoUSD + difInventarioPorTipo.EQUINO.difUSD,
    }

    // Ingreso Bruto = Ventas totales
    const ingresoBruto = {
      global: ventasTotales.importeBrutoUSD,
      vacunos: ventasPorTipo.BOVINO.importeBrutoUSD,
      ovinos: ventasPorTipo.OVINO.importeBrutoUSD,
      equinos: ventasPorTipo.EQUINO.importeBrutoUSD,
    }

    // IK = Producto Bruto - Costos (SIN renta)
    const ik = {
      global: productoBruto.global - costosSinRentaGeneral,
      vacunos: productoBruto.vacunos - costosSinRentaPorEspecie.vacunos,
      ovinos: productoBruto.ovinos - costosSinRentaPorEspecie.ovinos,
      equinos: productoBruto.equinos - costosSinRentaPorEspecie.equinos,
    }

    // IKP = Producto Bruto - Costos Totales (CON renta)
    const ikp = {
      global: productoBruto.global - costosTotalesGeneral,
      vacunos: productoBruto.vacunos - costosTotalesPorEspecie.vacunos,
      ovinos: productoBruto.ovinos - costosTotalesPorEspecie.ovinos,
      equinos: productoBruto.equinos - costosTotalesPorEspecie.equinos,
    }

    // Ingreso Efectivo = Ingreso Bruto - Costos Totales
    const ingresoEfectivo = {
      global: ingresoBruto.global - costosTotalesGeneral,
      vacunos: ingresoBruto.vacunos - costosTotalesPorEspecie.vacunos,
      ovinos: ingresoBruto.ovinos - costosTotalesPorEspecie.ovinos,
      equinos: ingresoBruto.equinos - costosTotalesPorEspecie.equinos,
    }

    // Peso promedio venta
    const pesoPromedioVenta = {
      global: ventasTotales.cantidad > 0 ? ventasTotales.pesoTotalKg / ventasTotales.cantidad : 0,
      vacunos: ventasPorTipo.BOVINO.cantidad > 0 ? ventasPorTipo.BOVINO.pesoTotalKg / ventasPorTipo.BOVINO.cantidad : 0,
      ovinos: ventasPorTipo.OVINO.cantidad > 0 ? ventasPorTipo.OVINO.pesoTotalKg / ventasPorTipo.OVINO.cantidad : 0,
      equinos: ventasPorTipo.EQUINO.cantidad > 0 ? ventasPorTipo.EQUINO.pesoTotalKg / ventasPorTipo.EQUINO.cantidad : 0,
    }

    // Precio promedio venta (U$S/animal)
    const precioPromedioVenta = {
      global: ventasTotales.cantidad > 0 ? ventasTotales.importeBrutoUSD / ventasTotales.cantidad : 0,
      vacunos: ventasPorTipo.BOVINO.cantidad > 0 ? ventasPorTipo.BOVINO.importeBrutoUSD / ventasPorTipo.BOVINO.cantidad : 0,
      ovinos: ventasPorTipo.OVINO.cantidad > 0 ? ventasPorTipo.OVINO.importeBrutoUSD / ventasPorTipo.OVINO.cantidad : 0,
      equinos: ventasPorTipo.EQUINO.cantidad > 0 ? ventasPorTipo.EQUINO.importeBrutoUSD / ventasPorTipo.EQUINO.cantidad : 0,
    }

    // U$S por kg producido
    const usdPorKgProducido = {
      global: produccionCarne.global > 0 ? productoBruto.global / produccionCarne.global : 0,
      vacunos: produccionCarne.vacunos > 0 ? productoBruto.vacunos / produccionCarne.vacunos : 0,
      ovinos: produccionCarne.ovinos > 0 ? productoBruto.ovinos / produccionCarne.ovinos : 0,
      equinos: produccionCarne.equinos > 0 ? productoBruto.equinos / produccionCarne.equinos : 0,
    }

    // Costo por kg producido
    const costoPorKgProducido = {
      global: produccionCarne.global > 0 ? costosTotalesGeneral / produccionCarne.global : 0,
      vacunos: produccionCarne.vacunos > 0 ? costosTotalesPorEspecie.vacunos / produccionCarne.vacunos : 0,
      ovinos: produccionCarne.ovinos > 0 ? costosTotalesPorEspecie.ovinos / produccionCarne.ovinos : 0,
      equinos: produccionCarne.equinos > 0 ? costosTotalesPorEspecie.equinos / produccionCarne.equinos : 0,
    }

    // Margen por kg
    const margenPorKg = {
      global: usdPorKgProducido.global - costoPorKgProducido.global,
      vacunos: usdPorKgProducido.vacunos - costoPorKgProducido.vacunos,
      ovinos: usdPorKgProducido.ovinos - costoPorKgProducido.ovinos,
      equinos: usdPorKgProducido.equinos - costoPorKgProducido.equinos,
    }
    
    
// Relación Insumo Producto = Costos (sin renta) / Producto Bruto
const relacionInsumoProducto = {
  global: productoBruto.global > 0 ? costosSinRentaGeneral / productoBruto.global : 0,
  vacunos: productoBruto.vacunos > 0 ? costosSinRentaPorEspecie.vacunos / productoBruto.vacunos : 0,
  ovinos: productoBruto.ovinos > 0 ? costosSinRentaPorEspecie.ovinos / productoBruto.ovinos : 0,
  equinos: productoBruto.equinos > 0 ? costosSinRentaPorEspecie.equinos / productoBruto.equinos : 0,
}
    // ---------------------------------------------------------
    // 8 CALCULAR "POR HA" PARA CADA INDICADOR
    // ---------------------------------------------------------
    const porHa = (valor: number, ha: number) => ha > 0 ? valor / ha : 0

    // ---------------------------------------------------------
    // 9 RESPUESTA FINAL
    // ---------------------------------------------------------
    return NextResponse.json({
      ejercicio: {
        anioInicio: ejercicioInicio,
        anioFin: ejercicioFin,
        fechaDesde: fechaDesde.toISOString().split('T')[0],
        fechaHasta: fechaHasta.toISOString().split('T')[0],
      },
     
      // 🆕 AGREGAR ESTA SECCIÓN
  superficie: {
  total: totalHectareas,
  spg: spg,
  mejorada: superficieMejorada,  // 🆕 AGREGAR ESTA LÍNEA
  usandoSPG: usarSPG,
},
      // Indicadores de eficiencia técnica
      eficienciaTecnica: {
        superficieTotal: {
          global: totalHectareas,
          vacunos: hectareasPorEspecie.vacunos,
          ovinos: hectareasPorEspecie.ovinos,
          equinos: hectareasPorEspecie.equinos,
        },
        relacionLanarVacuno: relacionLanarVacuno || 0,
      },

      // Indicadores de la ganadería
      ganaderia: {
        carga: {
          global: Math.round(carga.global * 100) / 100,
          vacunos: Math.round(carga.vacunos * 100) / 100,
          ovinos: Math.round(carga.ovinos * 100) / 100,
          equinos: Math.round(carga.equinos * 100) / 100,
        },
        cargaKgPV: {
    global: Math.round(cargaKgPV.global),
    vacunos: Math.round(cargaKgPV.vacunos),
    ovinos: Math.round(cargaKgPV.ovinos),
    equinos: Math.round(cargaKgPV.equinos),
  },
        mortandad: {
          // TODO: Implementar cuando se conecte con eventos MORTANDAD
          global: 0,
          vacunos: 0,
          ovinos: 0,
          equinos: 0,
        },
        tasaExtraccion: {
          global: Math.round(tasaExtraccion.global * 10) / 10,
          vacunos: Math.round(tasaExtraccion.vacunos * 10) / 10,
          ovinos: Math.round(tasaExtraccion.ovinos * 10) / 10,
          equinos: Math.round(tasaExtraccion.equinos * 10) / 10,
        },
        lana: {
          // TODO: Implementar cuando se complete ventas de lana
          totalKg: 0,
          kgPorAnimal: 0,
          usdTotal: 0,
          usdPorKg: 0,
        },
        pesoPromedioVenta: {
          global: Math.round(pesoPromedioVenta.global),
          vacunos: Math.round(pesoPromedioVenta.vacunos),
          ovinos: Math.round(pesoPromedioVenta.ovinos),
          equinos: Math.round(pesoPromedioVenta.equinos),
        },
        precioPromedioVenta: {
          global: Math.round(precioPromedioVenta.global),
          vacunos: Math.round(precioPromedioVenta.vacunos),
          ovinos: Math.round(precioPromedioVenta.ovinos),
          equinos: Math.round(precioPromedioVenta.equinos),
        },
        produccionCarne: {
          total: {
            global: Math.round(produccionCarne.global),
            vacunos: Math.round(produccionCarne.vacunos),
            ovinos: Math.round(produccionCarne.ovinos),
            equinos: Math.round(produccionCarne.equinos),
          },
          porHa: {
            global: Math.round(porHa(produccionCarne.global, superficieParaCalculos)),
            vacunos: Math.round(porHa(produccionCarne.vacunos, hectareasPorEspecie.vacunos)),
            ovinos: Math.round(porHa(produccionCarne.ovinos, hectareasPorEspecie.ovinos)),
            equinos: Math.round(porHa(produccionCarne.equinos, hectareasPorEspecie.equinos)),
          },
        },
      },

      // Indicadores económicos
      economicos: {
        productoBruto: {
          total: {
            global: Math.round(productoBruto.global),
            vacunos: Math.round(productoBruto.vacunos),
            ovinos: Math.round(productoBruto.ovinos),
            equinos: Math.round(productoBruto.equinos),
          },
          porHa: {
            global: Math.round(porHa(productoBruto.global, superficieParaCalculos)),
            vacunos: Math.round(porHa(productoBruto.vacunos, hectareasPorEspecie.vacunos)),
            ovinos: Math.round(porHa(productoBruto.ovinos, hectareasPorEspecie.ovinos)),
            equinos: Math.round(porHa(productoBruto.equinos, hectareasPorEspecie.equinos)),
          },
        },
        ingresoBruto: {
          total: {
            global: Math.round(ingresoBruto.global),
            vacunos: Math.round(ingresoBruto.vacunos),
            ovinos: Math.round(ingresoBruto.ovinos),
            equinos: Math.round(ingresoBruto.equinos),
          },
          porHa: {
            global: Math.round(porHa(ingresoBruto.global, superficieParaCalculos)),
            vacunos: Math.round(porHa(ingresoBruto.vacunos, hectareasPorEspecie.vacunos)),
            ovinos: Math.round(porHa(ingresoBruto.ovinos, hectareasPorEspecie.ovinos)),
            equinos: Math.round(porHa(ingresoBruto.equinos, hectareasPorEspecie.equinos)),
          },
        },
        costosTotales: {
          total: {
            global: Math.round(costosTotalesGeneral),
            vacunos: Math.round(costosTotalesPorEspecie.vacunos),
            ovinos: Math.round(costosTotalesPorEspecie.ovinos),
            equinos: Math.round(costosTotalesPorEspecie.equinos),
          },
          porHa: {
            global: Math.round(porHa(costosTotalesGeneral, superficieParaCalculos)),
            vacunos: Math.round(porHa(costosTotalesPorEspecie.vacunos, hectareasPorEspecie.vacunos)),
            ovinos: Math.round(porHa(costosTotalesPorEspecie.ovinos, hectareasPorEspecie.ovinos)),
            equinos: Math.round(porHa(costosTotalesPorEspecie.equinos, hectareasPorEspecie.equinos)),
          },
        },
        costosFijos: {
          total: {
            global: Math.round(totalFijos),
            vacunos: Math.round(costosFijosPorEspecie.vacunos),
            ovinos: Math.round(costosFijosPorEspecie.ovinos),
            equinos: Math.round(costosFijosPorEspecie.equinos),
          },
          porHa: {
            global: Math.round(porHa(totalFijos, superficieParaCalculos)),
            vacunos: Math.round(porHa(costosFijosPorEspecie.vacunos, hectareasPorEspecie.vacunos)),
            ovinos: Math.round(porHa(costosFijosPorEspecie.ovinos, hectareasPorEspecie.ovinos)),
            equinos: Math.round(porHa(costosFijosPorEspecie.equinos, hectareasPorEspecie.equinos)),
          },
        },
        costosVariables: {
          total: {
            global: Math.round(totalVariables),
            vacunos: Math.round(costosVariablesPorEspecie.vacunos),
            ovinos: Math.round(costosVariablesPorEspecie.ovinos),
            equinos: Math.round(costosVariablesPorEspecie.equinos),
          },
          porHa: {
            global: Math.round(porHa(totalVariables, superficieParaCalculos)),
            vacunos: Math.round(porHa(costosVariablesPorEspecie.vacunos, hectareasPorEspecie.vacunos)),
            ovinos: Math.round(porHa(costosVariablesPorEspecie.ovinos, hectareasPorEspecie.ovinos)),
            equinos: Math.round(porHa(costosVariablesPorEspecie.equinos, hectareasPorEspecie.equinos)),
          },
        },
        costosRenta: {
          total: {
            global: Math.round(totalRenta),
            vacunos: Math.round(costosRentaPorEspecie.vacunos),
            ovinos: Math.round(costosRentaPorEspecie.ovinos),
            equinos: Math.round(costosRentaPorEspecie.equinos),
          },
          porHa: {
            global: Math.round(porHa(totalRenta, superficieParaCalculos)),
            vacunos: Math.round(porHa(costosRentaPorEspecie.vacunos, hectareasPorEspecie.vacunos)),
            ovinos: Math.round(porHa(costosRentaPorEspecie.ovinos, hectareasPorEspecie.ovinos)),
            equinos: Math.round(porHa(costosRentaPorEspecie.equinos, hectareasPorEspecie.equinos)),
          },
        },
        ik: {
          total: {
            global: Math.round(ik.global),
            vacunos: Math.round(ik.vacunos),
            ovinos: Math.round(ik.ovinos),
            equinos: Math.round(ik.equinos),
          },
          porHa: {
            global: Math.round(porHa(ik.global, superficieParaCalculos)),
            vacunos: Math.round(porHa(ik.vacunos, hectareasPorEspecie.vacunos)),
            ovinos: Math.round(porHa(ik.ovinos, hectareasPorEspecie.ovinos)),
            equinos: Math.round(porHa(ik.equinos, hectareasPorEspecie.equinos)),
          },
        },
        ikp: {
          total: {
            global: Math.round(ikp.global),
            vacunos: Math.round(ikp.vacunos),
            ovinos: Math.round(ikp.ovinos),
            equinos: Math.round(ikp.equinos),
          },
          porHa: {
            global: Math.round(porHa(ikp.global, superficieParaCalculos)),
            vacunos: Math.round(porHa(ikp.vacunos, hectareasPorEspecie.vacunos)),
            ovinos: Math.round(porHa(ikp.ovinos, hectareasPorEspecie.ovinos)),
            equinos: Math.round(porHa(ikp.equinos, hectareasPorEspecie.equinos)),
          },
        },
        ingresoEfectivo: {
          total: {
            global: Math.round(ingresoEfectivo.global),
            vacunos: Math.round(ingresoEfectivo.vacunos),
            ovinos: Math.round(ingresoEfectivo.ovinos),
            equinos: Math.round(ingresoEfectivo.equinos),
          },
          porHa: {
            global: Math.round(porHa(ingresoEfectivo.global, superficieParaCalculos)),
            vacunos: Math.round(porHa(ingresoEfectivo.vacunos, hectareasPorEspecie.vacunos)),
            ovinos: Math.round(porHa(ingresoEfectivo.ovinos, hectareasPorEspecie.ovinos)),
            equinos: Math.round(porHa(ingresoEfectivo.equinos, hectareasPorEspecie.equinos)),
          },
        },
        usdPorKgProducido: {
          global: Math.round(usdPorKgProducido.global * 100) / 100,
          vacunos: Math.round(usdPorKgProducido.vacunos * 100) / 100,
          ovinos: Math.round(usdPorKgProducido.ovinos * 100) / 100,
          equinos: Math.round(usdPorKgProducido.equinos * 100) / 100,
        },
        costoPorKgProducido: {
          global: Math.round(costoPorKgProducido.global * 100) / 100,
          vacunos: Math.round(costoPorKgProducido.vacunos * 100) / 100,
          ovinos: Math.round(costoPorKgProducido.ovinos * 100) / 100,
          equinos: Math.round(costoPorKgProducido.equinos * 100) / 100,
        },
        margenPorKg: {
          global: Math.round(margenPorKg.global * 100) / 100,
          vacunos: Math.round(margenPorKg.vacunos * 100) / 100,
          ovinos: Math.round(margenPorKg.ovinos * 100) / 100,
          equinos: Math.round(margenPorKg.equinos * 100) / 100,
        },

        relacionInsumoProducto: {
  global: Math.round(relacionInsumoProducto.global * 100) / 100,
  vacunos: Math.round(relacionInsumoProducto.vacunos * 100) / 100,
  ovinos: Math.round(relacionInsumoProducto.ovinos * 100) / 100,
  equinos: Math.round(relacionInsumoProducto.equinos * 100) / 100,
},
      },
      
      // Datos crudos para debugging
      _debug: {
  ventas: ventasTotales,
  ventasPorTipo,
  compras: comprasTotales,
  comprasPorTipo,
  consumos: consumosTotales,
  consumosPorTipo,
  difInventario: difInventarioTotales,
  difInventarioPorTipo,
        costosVariables: totalVariables,
        costosFijos: totalFijos,
        costosRenta: totalRenta,
        lana: {
          totalKgLana,
          totalUSDLana,
          lanaEquivCarne,
        },
      },
    })

  } catch (error) {
    console.error("Error calculando indicadores:", error)
    return NextResponse.json(
      { error: "Error calculando indicadores" },
      { status: 500 }
    )
  }
}