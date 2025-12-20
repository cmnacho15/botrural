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

    // Validar que se haya seleccionado un módulo
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

    // Obtener eventos de CAMBIO_POTRERO hacia estos potreros
    const eventos = await prisma.evento.findMany({
      where: {
        tipo: { in: ['CAMBIO_POTRERO', 'AJUSTE'] },
        campoId: usuario.campoId,
        loteDestinoId: { in: potrerosIds },
        ...(Object.keys(filtroFechas).length > 0 && { fecha: filtroFechas }),
      },
      include: {
        lote: { select: { nombre: true } },
      },
      orderBy: [
        { loteDestinoId: 'asc' },
        { fecha: 'asc' },
      ],
    })

    // Agrupar eventos por potrero + fecha (mismo día, mismo potrero)
    const eventosPorGrupo = new Map<string, typeof eventos>()
    
    eventos.forEach(evento => {
      const fechaStr = new Date(evento.fecha).toISOString().split('T')[0]
      const key = `${evento.loteDestinoId}-${fechaStr}`
      
      if (!eventosPorGrupo.has(key)) {
        eventosPorGrupo.set(key, [])
      }
      eventosPorGrupo.get(key)!.push(evento)
    })

    // Procesar cada grupo
    const registros: any[] = []
    const hoy = new Date()
    const gruposArray = Array.from(eventosPorGrupo.entries())

    gruposArray.forEach(([key, grupo], index) => {
      const primerEvento = grupo[0]
      
      // Combinar categorías
      const categorias = grupo
        .map(e => e.categoria)
        .filter(Boolean)
        .join(', ') || grupo[0].descripcion || '-'
      
      // Buscar el siguiente grupo en el MISMO potrero
      const potreroId = primerEvento.loteDestinoId
      const siguienteGrupo = gruposArray
        .slice(index + 1)
        .find(([k, g]) => g[0].loteDestinoId === potreroId)
      
      const potrero = potreros.find(p => p.id === potreroId)
      
      const fechaEntrada = new Date(primerEvento.fecha)
      const fechaSalida = siguienteGrupo ? new Date(siguienteGrupo[1][0].fecha) : null
      
      // Calcular días en el potrero
      const dias = fechaSalida 
        ? Math.ceil((fechaSalida.getTime() - fechaEntrada.getTime()) / (1000 * 60 * 60 * 24))
        : 0

      // Calcular días de descanso
      let diasDescanso = 0
      if (fechaSalida) {
        if (siguienteGrupo) {
          // Hay otra entrada después → días entre salida y nueva entrada
          diasDescanso = Math.ceil((new Date(siguienteGrupo[1][0].fecha).getTime() - fechaSalida.getTime()) / (1000 * 60 * 60 * 24))
        } else {
          // No hay más entradas → días desde salida hasta hoy
          diasDescanso = Math.ceil((hoy.getTime() - fechaSalida.getTime()) / (1000 * 60 * 60 * 24))
        }
      }

      registros.push({
        potrero: potrero?.nombre || 'Desconocido',
        fechaEntrada: fechaEntrada.toISOString().split('T')[0],
        dias,
        fechaSalida: fechaSalida ? fechaSalida.toISOString().split('T')[0] : '-',
        diasDescanso,
        hectareas: Math.round((potrero?.hectareas || 0) * 100) / 100,
        comentarios: categorias,
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