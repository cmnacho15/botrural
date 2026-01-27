import { NextResponse } from 'next/server'
import { requireMegaAdmin } from '@/lib/admin-auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const { error } = await requireMegaAdmin()
  if (error) return error

  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

    // Eventos por tipo (uso de funcionalidades)
    const eventosPorTipo = await prisma.evento.groupBy({
      by: ['tipo'],
      _count: true,
      orderBy: { _count: { tipo: 'desc' } }
    })

    // Eventos últimos 30 días por tipo
    const eventosRecientesPorTipo = await prisma.evento.groupBy({
      by: ['tipo'],
      where: { createdAt: { gte: thirtyDaysAgo } },
      _count: true,
      orderBy: { _count: { tipo: 'desc' } }
    })

    // Usuarios únicos por tipo de evento (últimos 30 días)
    const usuariosPorTipoEvento = await prisma.$queryRaw<Array<{ tipo: string, usuarios: bigint }>>`
      SELECT tipo, COUNT(DISTINCT "usuarioId") as usuarios
      FROM "Evento"
      WHERE "createdAt" >= ${thirtyDaysAgo}
        AND "usuarioId" IS NOT NULL
      GROUP BY tipo
      ORDER BY usuarios DESC
    `

    // Uso de módulos financieros
    const [totalVentas, ventasRecientes, totalGastos, gastosRecientes, totalCompras, comprasRecientes] = await Promise.all([
      prisma.venta.count(),
      prisma.venta.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
      prisma.gasto.count(),
      prisma.gasto.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
      prisma.compra.count(),
      prisma.compra.count({ where: { createdAt: { gte: thirtyDaysAgo } } })
    ])

    // Campos usando cada módulo
    const camposConVentas = await prisma.venta.groupBy({
      by: ['campoId'],
      _count: true
    })

    const camposConGastos = await prisma.gasto.groupBy({
      by: ['campoId'],
      _count: true
    })

    const camposConEventos = await prisma.evento.groupBy({
      by: ['campoId'],
      _count: true
    })

    // SNIG usage
    const [totalSnigAnimales, camposConSnig] = await Promise.all([
      prisma.snigAnimal.count(),
      prisma.snigAnimal.groupBy({
        by: ['campoId'],
        _count: true
      })
    ])

    // Calendario usage
    const [totalActividades, actividadesRecientes] = await Promise.all([
      prisma.actividadCalendario.count(),
      prisma.actividadCalendario.count({ where: { createdAt: { gte: thirtyDaysAgo } } })
    ])

    // Insumos usage
    const [totalMovInsumos, movInsumosRecientes] = await Promise.all([
      prisma.movimientoInsumo.count(),
      prisma.movimientoInsumo.count({ where: { createdAt: { gte: thirtyDaysAgo } } })
    ])

    // Traslados
    const [totalTraslados, trasladosRecientes] = await Promise.all([
      prisma.traslado.count(),
      prisma.traslado.count({ where: { createdAt: { gte: thirtyDaysAgo } } })
    ])

    // Módulos de pastoreo
    const totalModulosPastoreo = await prisma.moduloPastoreo.count()

    // Mapear tipos de evento a nombres legibles
    const tipoEventoLabels: Record<string, string> = {
      TRATAMIENTO: 'Tratamientos',
      CAMBIO_POTRERO: 'Cambios de Potrero',
      NACIMIENTO: 'Nacimientos',
      MORTANDAD: 'Mortandades',
      VENTA: 'Ventas (evento)',
      COMPRA: 'Compras (evento)',
      TACTO: 'Tactos',
      LLUVIA: 'Lluvias',
      HELADA: 'Heladas',
      GASTO: 'Gastos (evento)',
      RECATEGORIZACION: 'Recategorizaciones',
      SIEMBRA: 'Siembras',
      COSECHA: 'Cosechas',
      PULVERIZACION: 'Pulverizaciones',
      DAO: 'DAO',
      CONSUMO: 'Consumos',
      DESTETE: 'Destetes',
      ABORTO: 'Abortos'
    }

    return NextResponse.json({
      resumen: {
        totalEventos: eventosPorTipo.reduce((sum, e) => sum + e._count, 0),
        eventosUltimos30Dias: eventosRecientesPorTipo.reduce((sum, e) => sum + e._count, 0),
        camposActivos: camposConEventos.length,
        modulosFinancieros: {
          ventas: { total: totalVentas, recientes: ventasRecientes, campos: camposConVentas.length },
          gastos: { total: totalGastos, recientes: gastosRecientes, campos: camposConGastos.length },
          compras: { total: totalCompras, recientes: comprasRecientes }
        }
      },
      eventosPorTipo: eventosPorTipo.map(e => ({
        tipo: e.tipo,
        label: tipoEventoLabels[e.tipo] || e.tipo,
        total: e._count,
        recientes: eventosRecientesPorTipo.find(r => r.tipo === e.tipo)?._count || 0,
        usuariosUnicos: Number(usuariosPorTipoEvento.find(u => u.tipo === e.tipo)?.usuarios || 0)
      })),
      modulos: [
        {
          nombre: 'Ventas',
          icono: '💰',
          total: totalVentas,
          recientes: ventasRecientes,
          camposUsando: camposConVentas.length
        },
        {
          nombre: 'Gastos/Finanzas',
          icono: '💸',
          total: totalGastos,
          recientes: gastosRecientes,
          camposUsando: camposConGastos.length
        },
        {
          nombre: 'Compras',
          icono: '🛒',
          total: totalCompras,
          recientes: comprasRecientes,
          camposUsando: 0 // TODO: calcular
        },
        {
          nombre: 'SNIG',
          icono: '🏷️',
          total: totalSnigAnimales,
          recientes: 0,
          camposUsando: camposConSnig.length
        },
        {
          nombre: 'Calendario',
          icono: '📅',
          total: totalActividades,
          recientes: actividadesRecientes,
          camposUsando: 0
        },
        {
          nombre: 'Insumos',
          icono: '📦',
          total: totalMovInsumos,
          recientes: movInsumosRecientes,
          camposUsando: 0
        },
        {
          nombre: 'Traslados',
          icono: '🚚',
          total: totalTraslados,
          recientes: trasladosRecientes,
          camposUsando: 0
        },
        {
          nombre: 'Pastoreo Rotativo',
          icono: '🔄',
          total: totalModulosPastoreo,
          recientes: 0,
          camposUsando: 0
        }
      ]
    })
  } catch (error) {
    console.error('Error fetching features usage:', error)
    return NextResponse.json(
      { error: 'Error obteniendo uso de funcionalidades' },
      { status: 500 }
    )
  }
}
