import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../auth/[...nextauth]/route'

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const usuario = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { campoId: true },
    })

    if (!usuario?.campoId) {
      return NextResponse.json({ error: 'Usuario sin campo' }, { status: 400 })
    }

    const { searchParams } = new URL(request.url)
    const moduloId = searchParams.get('moduloId')
    const fechaDesde = searchParams.get('fechaDesde')
    const fechaHasta = searchParams.get('fechaHasta')

    if (!moduloId) {
      return NextResponse.json({ error: 'Debe seleccionar un módulo' }, { status: 400 })
    }

    // Obtener módulo
    const modulo = await prisma.moduloPastoreo.findFirst({
      where: {
        id: moduloId,
        campoId: usuario.campoId,
      },
    })

    if (!modulo) {
      return NextResponse.json({ error: 'Módulo no encontrado' }, { status: 404 })
    }

    // Obtener potreros del módulo
const potreros = await prisma.lote.findMany({
  where: {
    moduloPastoreoId: moduloId,
    campoId: usuario.campoId,
  },
  select: {
    id: true,
    nombre: true,
    hectareas: true,
    ultimoCambio: true,
  },
})

    const potrerosIds = potreros.map(p => p.id)

    if (potrerosIds.length === 0) {
      return NextResponse.json({ 
        modulo: modulo.nombre,
        registros: [] 
      })
    }

    // Construir filtro de fechas
    const filtroFechas: any = {}
    if (fechaDesde) {
      filtroFechas.gte = new Date(fechaDesde)
    }
    if (fechaHasta) {
      filtroFechas.lte = new Date(fechaHasta)
    }

    // 🔥 OBTENER ENTRADAS: eventos donde loteDestinoId está en los potreros del módulo
    const entradas = await prisma.evento.findMany({
      where: {
        tipo: 'CAMBIO_POTRERO',
        campoId: usuario.campoId,
        loteDestinoId: { in: potrerosIds },
        ...(Object.keys(filtroFechas).length > 0 && { fecha: filtroFechas }),
      },
      orderBy: { fecha: 'asc' },
    })

    // 🔥 OBTENER SALIDAS: eventos donde loteId (origen) está en los potreros del módulo
    const salidas = await prisma.evento.findMany({
      where: {
        tipo: 'CAMBIO_POTRERO',
        campoId: usuario.campoId,
        loteId: { in: potrerosIds },
        ...(Object.keys(filtroFechas).length > 0 && { fecha: filtroFechas }),
      },
      orderBy: { fecha: 'asc' },
    })

    // Crear mapa de salidas por potrero (para buscar rápido)
    const salidasPorPotrero = new Map<string, typeof salidas>()
    salidas.forEach(salida => {
      if (!salida.loteId) return
      if (!salidasPorPotrero.has(salida.loteId)) {
        salidasPorPotrero.set(salida.loteId, [])
      }
      salidasPorPotrero.get(salida.loteId)!.push(salida)
    })

    // Crear mapa de entradas por potrero (para calcular descanso)
    const entradasPorPotrero = new Map<string, typeof entradas>()
    entradas.forEach(entrada => {
      if (!entrada.loteDestinoId) return
      if (!entradasPorPotrero.has(entrada.loteDestinoId)) {
        entradasPorPotrero.set(entrada.loteDestinoId, [])
      }
      entradasPorPotrero.get(entrada.loteDestinoId)!.push(entrada)
    })

    const hoy = new Date()
    const registros: any[] = []

    // Procesar cada entrada
    entradas.forEach(entrada => {
      const potreroId = entrada.loteDestinoId
      if (!potreroId) return

      const potrero = potreros.find(p => p.id === potreroId)
      if (!potrero) return

      const fechaEntrada = new Date(entrada.fecha)

      // 🔥 BUSCAR SALIDA: el próximo evento donde salieron de este potrero DESPUÉS de esta entrada
      const salidasDelPotrero = salidasPorPotrero.get(potreroId) || []
      const salidaCorrespondiente = salidasDelPotrero.find(
        s => new Date(s.fecha) > fechaEntrada
      )

      const fechaSalida = salidaCorrespondiente ? new Date(salidaCorrespondiente.fecha) : null

      // Calcular días de pastoreo
      let diasPastoreo = 0
      if (fechaSalida) {
        diasPastoreo = Math.ceil((fechaSalida.getTime() - fechaEntrada.getTime()) / (1000 * 60 * 60 * 24))
      } else {
        // Sin salida aún → días hasta hoy o hasta fecha filtro
        const fechaLimite = fechaHasta ? new Date(fechaHasta) : hoy
        diasPastoreo = Math.ceil((fechaLimite.getTime() - fechaEntrada.getTime()) / (1000 * 60 * 60 * 24))
      }

      // 🔥 CALCULAR DÍAS DE DESCANSO
      // = desde que SALIERON hasta la PRÓXIMA ENTRADA al mismo potrero
      let diasDescanso = 0
      if (fechaSalida) {
        const entradasDelPotrero = entradasPorPotrero.get(potreroId) || []
        const proximaEntrada = entradasDelPotrero.find(
          e => new Date(e.fecha) > fechaSalida
        )

        if (proximaEntrada) {
          diasDescanso = Math.ceil((new Date(proximaEntrada.fecha).getTime() - fechaSalida.getTime()) / (1000 * 60 * 60 * 24))
        } else {
          // Sin próxima entrada → días desde salida hasta hoy o fecha filtro
          const fechaLimite = fechaHasta ? new Date(fechaHasta) : hoy
          diasDescanso = Math.ceil((fechaLimite.getTime() - fechaSalida.getTime()) / (1000 * 60 * 60 * 24))
        }
      }

      registros.push({
        potrero: potrero.nombre,
        fechaEntrada: fechaEntrada.toISOString().split('T')[0],
        dias: diasPastoreo,
        fechaSalida: fechaSalida ? fechaSalida.toISOString().split('T')[0] : '-',
        diasDescanso,
        hectareas: Math.round((potrero.hectareas || 0) * 100) / 100,
        comentarios: entrada.categoria || entrada.descripcion || '-',
      })
    })

    // Ordenar por fecha de entrada descendente (más recientes primero)
    registros.sort((a, b) => new Date(b.fechaEntrada).getTime() - new Date(a.fechaEntrada).getTime())

    return NextResponse.json({
      modulo: modulo.nombre,
      registros,
    })

  } catch (error) {
    console.error('Error en reporte de pastoreo:', error)
    return NextResponse.json(
      { error: 'Error generando reporte' },
      { status: 500 }
    )
  }
}