import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "../auth/[...nextauth]/route"
import { prisma } from "@/lib/prisma"

const categoriaPorTipo: Record<string, string> = {
  MOVIMIENTO: 'animales',
  CAMBIO_POTRERO: 'animales',
  TRATAMIENTO: 'animales',
  VENTA: 'animales',
  COMPRA: 'animales',
  TRASLADO: 'animales',
  NACIMIENTO: 'animales',
  MORTANDAD: 'animales',
  CONSUMO: 'animales',
  ABORTO: 'animales',
  DESTETE: 'animales',
  TACTO: 'animales',
  RECATEGORIZACION: 'animales',
  SIEMBRA: 'agricultura',
  PULVERIZACION: 'agricultura',
  REFERTILIZACION: 'agricultura',
  RIEGO: 'agricultura',
  MONITOREO: 'agricultura',
  COSECHA: 'agricultura',
  OTROS_LABORES: 'agricultura',
  LLUVIA: 'clima',
  HELADA: 'clima',
  GASTO: 'finanzas',
  INGRESO: 'finanzas',
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }

    const usuario = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { campoId: true }
    })

    if (!usuario?.campoId) {
      return NextResponse.json({ error: "Usuario sin campo" }, { status: 400 })
    }

    // 1. OBTENER NOMBRE DEL CAMPO
    const campo = await prisma.campo.findUnique({
      where: { id: usuario.campoId },
      select: { nombre: true }
    })

    // 2. OBTENER POTREROS CON ANIMALES Y CULTIVOS
    const potreros = await prisma.lote.findMany({
      where: { campoId: usuario.campoId },
      include: {
        animalesLote: {
          select: {
            categoria: true,
            cantidad: true
          }
        },
        cultivos: {
          select: {
            tipoCultivo: true,
            hectareas: true
          }
        }
      }
    })

    // Mapear potreros para el mapa
    const potrerosParaMapa = potreros.map(potrero => ({
      id: potrero.id,
      nombre: potrero.nombre,
      hectareas: potrero.hectareas,
      coordinates: potrero.poligono ? (potrero.poligono as any) : [],
      color: '#10b981',
      info: {
        hectareas: potrero.hectareas,
        animales: potrero.animalesLote.map(a => ({
          categoria: a.categoria,
          cantidad: a.cantidad
        })),
        cultivos: potrero.cultivos.map(c => ({
          tipo: c.tipoCultivo,
          hectareas: c.hectareas
        }))
      }
    }))

    // 3. CALCULAR GASTOS DEL MES ACTUAL
    const inicioMes = new Date()
    inicioMes.setDate(1)
    inicioMes.setHours(0, 0, 0, 0)

    const gastosDelMes = await prisma.gasto.aggregate({
      where: {
        campoId: usuario.campoId,
        tipo: "GASTO",
        fecha: {
          gte: inicioMes
        }
      },
      _sum: {
        montoEnUYU: true
      }
    })

    // 4. CONTAR INSUMOS
    const totalInsumos = await prisma.insumo.count({
      where: { campoId: usuario.campoId }
    })

    // 5. CONTAR DATOS REGISTRADOS (eventos del mes)
    const datosRegistrados = await prisma.evento.count({
      where: {
        campoId: usuario.campoId,
        fecha: {
          gte: inicioMes
        }
      }
    })

    // 6. OBTENER LLUVIAS DE LOS ÚLTIMOS 12 MESES
    const hace12Meses = new Date()
    hace12Meses.setMonth(hace12Meses.getMonth() - 12)

    const eventosLluvia = await prisma.evento.findMany({
      where: {
        campoId: usuario.campoId,
        tipo: "LLUVIA",
        fecha: {
          gte: hace12Meses
        }
      },
      select: {
        fecha: true,
        cantidad: true
      },
      orderBy: {
        fecha: 'asc'
      }
    })

    // Agrupar lluvias por mes
    const lluviaPorMes: { [key: string]: number } = {}
    const mesesOrdenados: string[] = []

    // Generar array de últimos 12 meses
    for (let i = 11; i >= 0; i--) {
      const fecha = new Date()
      fecha.setMonth(fecha.getMonth() - i)
      const mesKey = fecha.toLocaleDateString('es-UY', { month: 'short', year: '2-digit' })
      mesesOrdenados.push(mesKey)
      lluviaPorMes[mesKey] = 0
    }

    // Sumar lluvias por mes
    eventosLluvia.forEach(evento => {
      const mesKey = new Date(evento.fecha).toLocaleDateString('es-UY', { 
        month: 'short', 
        year: '2-digit' 
      })
      if (lluviaPorMes[mesKey] !== undefined) {
        lluviaPorMes[mesKey] += evento.cantidad || 0
      }
    })

    const lluvia12Meses = mesesOrdenados.map(mes => ({
      mes: mes,
      mm: lluviaPorMes[mes]
    }))

    // 7. OBTENER ÚLTIMOS 8 DATOS (EVENTOS + GASTOS/INGRESOS)
    const iconoPorTipo: Record<string, string> = {
      MOVIMIENTO: '🔄',
      CAMBIO_POTRERO: '⊞',
      TRATAMIENTO: '💉',
      VENTA: '🐄',
      COMPRA: '🛒',
      TRASLADO: '🚛',
      NACIMIENTO: '➕',
      MORTANDAD: '➖',
      CONSUMO: '🍖',
      ABORTO: '❌',
      DESTETE: '🔀',
      TACTO: '✋',
      RECATEGORIZACION: '🏷️',
      SIEMBRA: '🌱',
      PULVERIZACION: '💦',
      REFERTILIZACION: '🌿',
      RIEGO: '💧',
      MONITOREO: '🔍',
      COSECHA: '🌾',
      OTROS_LABORES: '🔧',
      LLUVIA: '🌧️',
      HELADA: '❄️',
      GASTO: '💸',
      INGRESO: '💰',
    }

    // Obtener eventos (sin GASTO porque viene de tabla Gasto)
    const ultimosEventos = await prisma.evento.findMany({
      where: {
        campoId: usuario.campoId,
        tipo: {
          not: 'GASTO'
        }
      },
      include: {
        usuario: { select: { name: true } },
        lote: { select: { nombre: true } },
        rodeo: { select: { nombre: true } }
      },
      orderBy: [
        { fecha: 'desc' },
        { createdAt: 'desc' }
      ],
      take: 20 // Traer más para luego filtrar los 8 más recientes
    })

    // Obtener gastos e ingresos de la tabla Gasto
    const gastosIngresos = await prisma.gasto.findMany({
      where: {
        campoId: usuario.campoId
      },
      include: {
        lote: { select: { nombre: true } }
      },
      orderBy: [
        { fecha: 'desc' },
        { createdAt: 'desc' }
      ],
      take: 20
    })

    // Unificar todos los datos
    const datosUnificados: any[] = []

    // Agregar eventos
    ultimosEventos.forEach(evento => {
      datosUnificados.push({
        id: evento.id,
        fecha: evento.fecha,
        createdAt: evento.createdAt,
        tipo: evento.tipo,
        categoria: categoriaPorTipo[evento.tipo as keyof typeof categoriaPorTipo] || 'otros',
        icono: iconoPorTipo[evento.tipo as keyof typeof iconoPorTipo] || '📌',
        descripcion: evento.descripcion,
        usuario: evento.usuario?.name || null,
        lote: evento.lote?.nombre || null,
        rodeo: evento.rodeo?.nombre || null,
        // ✅ Campos directos:
        cantidad: evento.cantidad,
        monto: evento.monto,
        notas: evento.notas && typeof evento.notas === 'string' && evento.notas.trim() !== '' ? evento.notas : null,
      })
    })

    // Agregar gastos e ingresos
    gastosIngresos.forEach(gasto => {
      const esIngreso = gasto.tipo === 'INGRESO'
      
      datosUnificados.push({
        id: gasto.id,
        fecha: gasto.fecha,
        createdAt: gasto.createdAt,
        tipo: gasto.tipo,
        categoria: 'finanzas',
        descripcion: gasto.descripcion,
        icono: esIngreso ? '💰' : '💸',
        usuario: null,
        lote: gasto.lote?.nombre || null,
        // ✅ Campos directos:
        monto: gasto.monto ? parseFloat(gasto.monto.toString()) : null,
        moneda: gasto.moneda || 'UYU',
        cantidad: gasto.cantidadVendida,
        proveedor: gasto.proveedor,
        comprador: gasto.comprador,
        metodoPago: gasto.metodoPago,
        iva: gasto.iva ? parseFloat(gasto.iva.toString()) : null,
        diasPlazo: gasto.diasPlazo,
        pagado: gasto.pagado,
      })
    })

    // Ordenar por fecha y createdAt, luego tomar los 8 más recientes
    datosUnificados.sort((a, b) => {
      const fechaA = new Date(a.fecha).getTime()
      const fechaB = new Date(b.fecha).getTime()
      if (fechaB !== fechaA) return fechaB - fechaA
      const creadoA = a.createdAt ? new Date(a.createdAt).getTime() : 0
      const creadoB = b.createdAt ? new Date(b.createdAt).getTime() : 0
      return creadoB - creadoA
    })

    const ultimosDatos = datosUnificados.slice(0, 8).map(dato => ({
      id: dato.id,
      fecha: dato.fecha.toISOString(),
      tipo: dato.tipo,
      categoria: dato.categoria,
      icono: dato.icono,
      descripcion: dato.descripcion,
      usuario: dato.usuario,
      lote: dato.lote,
      rodeo: dato.rodeo || null,
      // ✅ Incluir todos los campos:
      cantidad: dato.cantidad || null,
      monto: dato.monto || null,
      moneda: dato.moneda || null,
      notas: dato.notas || null,
      proveedor: dato.proveedor || null,
      comprador: dato.comprador || null,
      metodoPago: dato.metodoPago || null,
      iva: dato.iva || null,
      diasPlazo: dato.diasPlazo || null,
      pagado: dato.pagado || null,
    }))

    // 8. CONSTRUIR RESPUESTA
    const dashboardData = {
      nombreCampo: campo?.nombre || "Campo Sin Nombre",
      potreros: potrerosParaMapa,
      resumen: {
        totalPotreros: potreros.length,
        totalGastosMes: gastosDelMes._sum.montoEnUYU || 0,
        totalInsumos: totalInsumos,
        totalDatos: datosRegistrados
      },
      lluvia12Meses: lluvia12Meses,
      ultimosDatos: ultimosDatos
    }

    return NextResponse.json(dashboardData)

  } catch (error) {
    console.error("Error en /api/dashboard-data:", error)
    return NextResponse.json(
      { 
        error: "Error obteniendo datos del dashboard",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    )
  }
}