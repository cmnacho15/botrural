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
      select: {
        id: true,
        fecha: true,
        loteDestinoId: true,
        categoria: true,
        cantidad: true,
        descripcion: true,
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
      select: {
        id: true,
        fecha: true,
        loteId: true,
        cantidad: true,
      },
      orderBy: { fecha: 'asc' },
    })

    const hoy = new Date()
    const fechaLimite = fechaHasta ? new Date(fechaHasta) : hoy

    // Agrupar por potrero
    const agrupadoPorPotrero = new Map<string, any[]>()

    potreros.forEach(potrero => {
      const entradasPotrero = entradas.filter(e => e.loteDestinoId === potrero.id)
      const salidasPotrero = salidas.filter(s => s.loteId === potrero.id)

      // Añadir carga inicial si existe
      if (potrero.ultimoCambio && potrero.animalesLote.length > 0) {
        const fechaInicial = new Date(potrero.ultimoCambio)
        
        // Verificar si hay entradas antes de ultimoCambio
        const hayEntradasAnteriores = entradasPotrero.some(e => new Date(e.fecha) <= fechaInicial)
        
        if (!hayEntradasAnteriores) {
          const comentario = potrero.animalesLote
            .map(a => `${a.cantidad} ${a.categoria}`)
            .join(', ')
          
          entradasPotrero.unshift({
            id: 'inicial-' + potrero.id,
            fecha: potrero.ultimoCambio,
            loteDestinoId: potrero.id,
            categoria: comentario,
            cantidad: null,
            descripcion: 'Carga inicial',
          })
        }
      }

      if (entradasPotrero.length === 0 && salidasPotrero.length === 0) {
        // Potrero sin movimientos
        if (potrero.ultimoCambio && potrero.animalesLote.length === 0) {
          const fechaUltimoCambio = new Date(potrero.ultimoCambio)
          if ((!fechaDesde || fechaUltimoCambio >= new Date(fechaDesde)) &&
              (!fechaHasta || fechaUltimoCambio <= new Date(fechaHasta))) {
            const diasDescanso = Math.floor((fechaLimite.getTime() - fechaUltimoCambio.getTime()) / (1000 * 60 * 60 * 24))
            agrupadoPorPotrero.set(potrero.id + '-descanso', [{
              potrero: potrero.nombre,
              fechaEntrada: '-',
              dias: '-',
              fechaSalida: fechaUltimoCambio.toLocaleDateString('es-UY'),
              diasDescanso: diasDescanso,
              hectareas: Math.round((potrero.hectareas || 0) * 100) / 100,
              comentarios: 'En descanso (sin historial)',
              comentariosHtml: 'En descanso (sin historial)',
            }])
          }
        }
        return
      }

      // Procesar entradas y salidas
      const ocupaciones: any[] = []
      let ocupacionActual: any = null

      entradasPotrero.forEach(entrada => {
        const fechaEntrada = new Date(entrada.fecha)
        
        // Buscar si hay una salida previa cercana (menos de 1 día)
        const salidaPrevia = salidasPotrero
          .filter(s => new Date(s.fecha) < fechaEntrada)
          .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())[0]
        
        const hayDesocupacion = salidaPrevia && 
          (fechaEntrada.getTime() - new Date(salidaPrevia.fecha).getTime()) > (1000 * 60 * 60 * 24)

        if (!ocupacionActual || hayDesocupacion) {
          // Iniciar nueva ocupación
          ocupacionActual = {
            fechaEntrada: fechaEntrada,
            entradas: [{
              fecha: fechaEntrada,
              categoria: entrada.categoria || entrada.descripcion || 'Sin categoría',
              cantidad: entrada.cantidad,
            }],
            salida: null,
          }
          ocupaciones.push(ocupacionActual)
        } else {
          // Añadir a ocupación actual
          ocupacionActual.entradas.push({
            fecha: fechaEntrada,
            categoria: entrada.categoria || entrada.descripcion || 'Sin categoría',
            cantidad: entrada.cantidad,
          })
        }
      })

      // Asignar salidas a ocupaciones
      ocupaciones.forEach(ocupacion => {
        const salidaPosterior = salidasPotrero.find(
          s => new Date(s.fecha) > ocupacion.fechaEntrada
        )
        if (salidaPosterior) {
          ocupacion.salida = new Date(salidaPosterior.fecha)
        }
      })

      // Convertir ocupaciones a registros
      ocupaciones.forEach(ocupacion => {
        const fechaEntrada = ocupacion.fechaEntrada
        const fechaSalida = ocupacion.salida

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
          // Buscar próxima ocupación
          const proximaOcupacion = ocupaciones.find(o => o.fechaEntrada > fechaSalida)
          if (proximaOcupacion) {
            diasDescanso = Math.floor((proximaOcupacion.fechaEntrada.getTime() - fechaSalida.getTime()) / (1000 * 60 * 60 * 24))
          } else {
            diasDescanso = Math.floor((fechaLimite.getTime() - fechaSalida.getTime()) / (1000 * 60 * 60 * 24))
          }
        }

        // Construir comentarios HTML con primera entrada resaltada
        const comentariosPartes = ocupacion.entradas.map((entrada: any, idx: number) => {
          const cantidadTexto = entrada.cantidad ? `${entrada.cantidad} ` : ''
          const fechaCorta = entrada.fecha.toLocaleDateString('es-UY', { day: '2-digit', month: '2-digit' })
          
          if (idx === 0) {
            // Primera entrada resaltada
            return `<span style="background-color: #93C5FD; padding: 2px 6px; border-radius: 4px; font-weight: 500;">${cantidadTexto}${entrada.categoria} (${fechaCorta})</span>`
          } else {
            // Entradas adicionales sin color
            return `${cantidadTexto}${entrada.categoria} (${fechaCorta})`
          }
        })

        const comentariosHtml = comentariosPartes.join(' + ')
        const comentariosTexto = ocupacion.entradas.map((entrada: any) => {
          const cantidadTexto = entrada.cantidad ? `${entrada.cantidad} ` : ''
          const fechaCorta = entrada.fecha.toLocaleDateString('es-UY', { day: '2-digit', month: '2-digit' })
          return `${cantidadTexto}${entrada.categoria} (${fechaCorta})`
        }).join(' + ')

        const key = potrero.id + '-' + fechaEntrada.getTime()
        if (!agrupadoPorPotrero.has(key)) {
          agrupadoPorPotrero.set(key, [])
        }

        agrupadoPorPotrero.get(key)!.push({
          potrero: potrero.nombre,
          fechaEntrada: fechaEntrada.toLocaleDateString('es-UY'),
          dias: diasPastoreo,
          fechaSalida: fechaSalida ? fechaSalida.toLocaleDateString('es-UY') : '-',
          diasDescanso: diasDescanso !== null ? diasDescanso : '-',
          hectareas: Math.round((potrero.hectareas || 0) * 100) / 100,
          comentarios: comentariosTexto,
          comentariosHtml: comentariosHtml,
        })
      })
    })

    // Aplanar y ordenar
    const registros = Array.from(agrupadoPorPotrero.values()).flat()

    registros.sort((a, b) => {
      if (a.fechaEntrada === '-' && b.fechaEntrada === '-') return 0
      if (a.fechaEntrada === '-') return 1
      if (b.fechaEntrada === '-') return -1
      
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