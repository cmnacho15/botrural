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

    // Obtener potreros del módulo CON sus animales actuales
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
        animalesLote: {
          select: {
            categoria: true,
            cantidad: true,
          }
        }
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
  const fecha = new Date(fechaHasta)
  fecha.setHours(23, 59, 59, 999)
  filtroFechas.lte = fecha
}

    // OBTENER ENTRADAS: eventos donde loteDestinoId está en los potreros del módulo
    const entradas = await prisma.evento.findMany({
      where: {
        tipo: 'CAMBIO_POTRERO',
        campoId: usuario.campoId,
        loteDestinoId: { in: potrerosIds },
        ...(Object.keys(filtroFechas).length > 0 && { fecha: filtroFechas }),
      },
      orderBy: { fecha: 'asc' },
    })

    // OBTENER SALIDAS: eventos donde loteId (origen) está en los potreros del módulo
    const salidas = await prisma.evento.findMany({
      where: {
        tipo: 'CAMBIO_POTRERO',
        campoId: usuario.campoId,
        loteId: { in: potrerosIds },
        ...(Object.keys(filtroFechas).length > 0 && { fecha: filtroFechas }),
      },
      orderBy: { fecha: 'asc' },
    })

    // Crear mapa de salidas por potrero
    const salidasPorPotrero = new Map<string, typeof salidas>()
    salidas.forEach(salida => {
      if (!salida.loteId) return
      if (!salidasPorPotrero.has(salida.loteId)) {
        salidasPorPotrero.set(salida.loteId, [])
      }
      salidasPorPotrero.get(salida.loteId)!.push(salida)
    })

    // Crear mapa de entradas por potrero
    const entradasPorPotrero = new Map<string, typeof entradas>()
    entradas.forEach(entrada => {
      if (!entrada.loteDestinoId) return
      if (!entradasPorPotrero.has(entrada.loteDestinoId)) {
        entradasPorPotrero.set(entrada.loteDestinoId, [])
      }
      entradasPorPotrero.get(entrada.loteDestinoId)!.push(entrada)
    })

    const hoy = new Date()
    const fechaLimite = fechaHasta ? new Date(fechaHasta) : hoy
    const registros: any[] = []

    // 🔥 PASO 1: Agregar entradas desde eventos CAMBIO_POTRERO
    entradas.forEach(entrada => {
      const potreroId = entrada.loteDestinoId
      if (!potreroId) return

      const potrero = potreros.find(p => p.id === potreroId)
      if (!potrero) return

      const fechaEntrada = new Date(entrada.fecha)

      // Buscar salida correspondiente
      const salidasDelPotrero = salidasPorPotrero.get(potreroId) || []
      const salidaCorrespondiente = salidasDelPotrero.find(
        s => new Date(s.fecha) > fechaEntrada
      )

      const fechaSalida = salidaCorrespondiente ? new Date(salidaCorrespondiente.fecha) : null

      // Calcular días de pastoreo
      let diasPastoreo = 0
      if (fechaSalida) {
        diasPastoreo = Math.floor((fechaSalida.getTime() - fechaEntrada.getTime()) / (1000 * 60 * 60 * 24))
      } else {
        diasPastoreo = Math.floor((fechaLimite.getTime() - fechaEntrada.getTime()) / (1000 * 60 * 60 * 24))
      }

      // Calcular días de descanso
      let diasDescanso: number | null = null
      if (fechaSalida) {
        const entradasDelPotrero = entradasPorPotrero.get(potreroId) || []
        const proximaEntrada = entradasDelPotrero.find(
          e => new Date(e.fecha) > fechaSalida
        )

        if (proximaEntrada) {
  diasDescanso = Math.floor((new Date(proximaEntrada.fecha).getTime() - fechaSalida.getTime()) / (1000 * 60 * 60 * 24))
} else {
  diasDescanso = Math.floor((fechaLimite.getTime() - fechaSalida.getTime()) / (1000 * 60 * 60 * 24))
}
      }

      registros.push({
        potrero: potrero.nombre,
        fechaEntrada: fechaEntrada.toLocaleDateString('es-UY'),
        dias: diasPastoreo,
        fechaSalida: fechaSalida ? fechaSalida.toLocaleDateString('es-UY') : '-',
        diasDescanso: diasDescanso !== null ? diasDescanso : '-',
        hectareas: Math.round((potrero.hectareas || 0) * 100) / 100,
        comentarios: entrada.categoria || entrada.descripcion || '-',
      })
    })

    // 🔥 PASO 2: Agregar carga inicial desde ultimoCambio para potreros sin eventos de entrada
    for (const potrero of potreros) {
      const tieneEntradasRegistradas = entradasPorPotrero.has(potrero.id)
      const tieneAnimalesActualmente = potrero.animalesLote.length > 0

      // Si NO tiene eventos de entrada pero SÍ tiene animales, usar ultimoCambio como entrada inicial
      if (!tieneEntradasRegistradas && tieneAnimalesActualmente && potrero.ultimoCambio) {
        const fechaEntrada = new Date(potrero.ultimoCambio)

        // Verificar que esté dentro del rango de fechas
        if (fechaDesde && fechaEntrada < new Date(fechaDesde)) continue
        if (fechaHasta && fechaEntrada > new Date(fechaHasta)) continue

        // Buscar si hay salida registrada
        const salidasDelPotrero = salidasPorPotrero.get(potrero.id) || []
        const salidaCorrespondiente = salidasDelPotrero.find(
          s => new Date(s.fecha) > fechaEntrada
        )

        const fechaSalida = salidaCorrespondiente ? new Date(salidaCorrespondiente.fecha) : null

        // Calcular días de pastoreo
        let diasPastoreo = 0
        if (fechaSalida) {
          diasPastoreo = Math.floor((fechaSalida.getTime() - fechaEntrada.getTime()) / (1000 * 60 * 60 * 24))
        } else {
          diasPastoreo = Math.floor((fechaLimite.getTime() - fechaEntrada.getTime()) / (1000 * 60 * 60 * 24))
        }

        // Armar comentario con las categorías actuales
        const comentario = potrero.animalesLote
          .map(a => `${a.cantidad} ${a.categoria}`)
          .join(', ') || 'Carga inicial'

        registros.push({
          potrero: potrero.nombre,
          fechaEntrada: fechaEntrada.toLocaleDateString('es-UY'),
          dias: diasPastoreo,
          fechaSalida: fechaSalida ? fechaSalida.toLocaleDateString('es-UY') : '-',
          diasDescanso: '-',
          hectareas: Math.round((potrero.hectareas || 0) * 100) / 100,
          comentarios: comentario,
        })
      }

      // Si NO tiene eventos de entrada y NO tiene animales, verificar si está en descanso
      if (!tieneEntradasRegistradas && !tieneAnimalesActualmente && potrero.ultimoCambio) {
        const fechaUltimoCambio = new Date(potrero.ultimoCambio)

        // Verificar que esté dentro del rango de fechas
        if (fechaDesde && fechaUltimoCambio < new Date(fechaDesde)) continue
        if (fechaHasta && fechaUltimoCambio > new Date(fechaHasta)) continue

        // Calcular días de descanso desde ultimoCambio hasta hoy
        const diasDescanso = Math.floor((fechaLimite.getTime() - fechaUltimoCambio.getTime()) / (1000 * 60 * 60 * 24))

        registros.push({
          potrero: potrero.nombre,
          fechaEntrada: '-',
          dias: '-',
          fechaSalida: fechaUltimoCambio.toLocaleDateString('es-UY'),
          diasDescanso: diasDescanso,
          hectareas: Math.round((potrero.hectareas || 0) * 100) / 100,
          comentarios: 'En descanso (sin historial)',
        })
      }
    }

    // Ordenar por fecha de entrada ascendente (más viejos arriba, más recientes abajo)
    registros.sort((a, b) => {
      // Manejar casos donde fechaEntrada es '-'
      if (a.fechaEntrada === '-' && b.fechaEntrada === '-') return 0
      if (a.fechaEntrada === '-') return 1
      if (b.fechaEntrada === '-') return 1
      
      // Parsear fechas en formato dd/mm/yyyy
      const parseDate = (dateStr: string) => {
        const parts = dateStr.split('/')
        return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]))
      }
      
      return parseDate(a.fechaEntrada).getTime() - parseDate(b.fechaEntrada).getTime()
    })

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