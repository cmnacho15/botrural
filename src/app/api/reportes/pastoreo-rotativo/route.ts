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
        tipo: 'CAMBIO_POTRERO',
        campoId: usuario.campoId,
        loteDestinoId: { in: potrerosIds },
        ...(Object.keys(filtroFechas).length > 0 && { fecha: filtroFechas }),
      },
      include: {
        lote: { select: { nombre: true } }, // potrero origen
      },
      orderBy: [
        { loteDestinoId: 'asc' },
        { fecha: 'asc' },
      ],
    })

    // Procesar eventos para calcular datos de la tabla
    const registros: any[] = []
    const hoy = new Date()

    for (let i = 0; i < eventos.length; i++) {
      const evento = eventos[i]
      
      // Buscar el siguiente evento en el MISMO potrero
      const siguienteEvento = eventos.find(
        (e, idx) => idx > i && e.loteDestinoId === evento.loteDestinoId
      )

      const potrero = potreros.find(p => p.id === evento.loteDestinoId)
      
      const fechaEntrada = new Date(evento.fecha)
      const fechaSalida = siguienteEvento ? new Date(siguienteEvento.fecha) : null
      
      // Calcular días en el potrero
      const dias = fechaSalida 
        ? Math.ceil((fechaSalida.getTime() - fechaEntrada.getTime()) / (1000 * 60 * 60 * 24))
        : 0

      // Calcular días de descanso (hasta el siguiente evento en ese potrero)
      const descanso = siguienteEvento 
        ? Math.ceil((new Date(siguienteEvento.fecha).getTime() - fechaSalida!.getTime()) / (1000 * 60 * 60 * 24))
        : 0

      // Días desde hoy
      const diasDesdeHoy = Math.ceil((hoy.getTime() - fechaEntrada.getTime()) / (1000 * 60 * 60 * 24))

      registros.push({
        diasDesdeHoy,
        potrero: potrero?.nombre || 'Desconocido',
        fechaEntrada: fechaEntrada.toISOString().split('T')[0],
        dias,
        fechaSalida: fechaSalida ? fechaSalida.toISOString().split('T')[0] : '-',
        descanso,
        hectareas: potrero?.hectareas || 0,
        comentarios: evento.categoria || evento.descripcion || '-',
      })
    }

    // Ordenar por fecha de entrada descendente (más recientes primero)
    registros.sort((a, b) => b.diasDesdeHoy - a.diasDesdeHoy)

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