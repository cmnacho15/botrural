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

    const modulo = await prisma.moduloPastoreo.findFirst({
      where: {
        id: moduloId,
        campoId: usuario.campoId,
      },
    })

    if (!modulo) {
      return NextResponse.json({ error: 'Módulo no encontrado' }, { status: 404 })
    }

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

    // ✅ Obtener eventos CAMBIO_POTRERO
    const eventosCambio = await prisma.evento.findMany({
      where: {
        tipo: 'CAMBIO_POTRERO',
        campoId: usuario.campoId,
        OR: [
          { loteDestinoId: { in: potrerosIds } },
          { loteId: { in: potrerosIds } }
        ],
      },
      select: {
        id: true,
        fecha: true,
        loteId: true,
        loteDestinoId: true,
        categoria: true,
        cantidad: true,
        descripcion: true,
        createdAt: true,
      },
      orderBy: { fecha: 'asc' },
    })

    // ✅ Obtener eventos AJUSTE (entradas/salidas por edición de potrero)
    const eventosAjuste = await prisma.evento.findMany({
      where: {
        tipo: 'AJUSTE',
        campoId: usuario.campoId,
        loteId: { in: potrerosIds },
      },
      select: {
        id: true,
        fecha: true,
        loteId: true,
        categoria: true,
        cantidad: true,
        descripcion: true,
        createdAt: true,
      },
      orderBy: { fecha: 'asc' },
    })

    const hoy = new Date()
    const fechaLimite = fechaHasta ? new Date(fechaHasta) : hoy
    const registros: any[] = []

    // Procesar cada potrero
    for (const potrero of potreros) {
      // ✅ Entradas por CAMBIO_POTRERO (destino)
      const entradasCambio = eventosCambio
        .filter(e => e.loteDestinoId === potrero.id)
        .map(e => ({
          ...e,
          tipoEvento: 'CAMBIO_POTRERO',
          esEntrada: true,
        }))

      // ✅ Salidas por CAMBIO_POTRERO (origen)
      const salidasCambio = eventosCambio
        .filter(e => e.loteId === potrero.id)
        .map(e => ({
          ...e,
          tipoEvento: 'CAMBIO_POTRERO',
          esEntrada: false,
        }))

      // ✅ Salidas por AJUSTE negativo (detectar primero las salidas)
      const salidasAjuste = eventosAjuste
        .filter(e => e.loteId === potrero.id && (e.descripcion?.includes('negativo') || e.descripcion?.includes('eliminaron')))
        .map(e => ({
          ...e,
          tipoEvento: 'AJUSTE',
          esEntrada: false,
        }))

      // ✅ Entradas por AJUSTE (todo lo que NO sea salida)
      const idsSalidas = new Set(salidasAjuste.map(e => e.id))
      const entradasAjuste = eventosAjuste
        .filter(e => e.loteId === potrero.id && !idsSalidas.has(e.id))
        .map(e => ({
          ...e,
          loteDestinoId: potrero.id,
          tipoEvento: 'AJUSTE',
          esEntrada: true,
        }))

      // ✅ Combinar todas las entradas y salidas
      let entradasPotrero = [...entradasCambio, ...entradasAjuste]
      let salidasPotrero = [...salidasCambio, ...salidasAjuste]

      // ✅ Si no hay eventos de entrada pero hay ultimoCambio Y tiene animales, agregar carga inicial
      if (entradasPotrero.length === 0 && potrero.ultimoCambio && potrero.animalesLote.length > 0) {
        const comentario = potrero.animalesLote
          .map(a => `${a.cantidad} ${a.categoria}`)
          .join(', ')
        const cantidadInicial = potrero.animalesLote.reduce((sum, a) => sum + a.cantidad, 0)
        
        entradasPotrero.unshift({
          id: 'inicial-' + potrero.id,
          fecha: potrero.ultimoCambio,
          loteId: null,
          loteDestinoId: potrero.id,
          categoria: comentario,
          cantidad: cantidadInicial,
          descripcion: comentario,
          tipoEvento: 'INICIAL',
          esEntrada: true,
          createdAt: potrero.ultimoCambio,
        })
      }
      
      // ✅ Si hay salidas pero no hay entradas, crear entrada virtual
      if (entradasPotrero.length === 0 && salidasPotrero.length > 0) {
        const primeraSalida = salidasPotrero[0]
        const comentario = primeraSalida.categoria || primeraSalida.descripcion || 'Animales'
        const cantidadInicial = primeraSalida.cantidad || 0
        
        const fechaEntrada = potrero.ultimoCambio && new Date(potrero.ultimoCambio) < new Date(primeraSalida.fecha)
          ? potrero.ultimoCambio
          : new Date(new Date(primeraSalida.fecha).getTime() - (24 * 60 * 60 * 1000))
        
        entradasPotrero.unshift({
          id: 'inicial-' + potrero.id,
          fecha: fechaEntrada,
          loteId: null,
          loteDestinoId: potrero.id,
          categoria: comentario,
          cantidad: cantidadInicial,
          descripcion: `${cantidadInicial} ${comentario} (carga inicial)`,
          tipoEvento: 'INICIAL',
          esEntrada: true,
          createdAt: fechaEntrada,
        })
      }

      if (entradasPotrero.length === 0 && salidasPotrero.length === 0) {
        // Potrero sin movimientos
        if (potrero.ultimoCambio && potrero.animalesLote.length === 0) {
          const fechaUltimoCambio = new Date(potrero.ultimoCambio)
          const diasDescanso = Math.floor((fechaLimite.getTime() - fechaUltimoCambio.getTime()) / (1000 * 60 * 60 * 24))
          registros.push({
            potrero: potrero.nombre,
            fechaEntrada: '-',
            fechaEntradaDate: null,
            dias: '-',
            fechaSalida: fechaUltimoCambio.toLocaleDateString('es-UY', { timeZone: 'America/Montevideo' }),
            diasDescanso: diasDescanso,
            hectareas: Math.round((potrero.hectareas || 0) * 100) / 100,
            comentarios: 'En descanso (sin historial)',
            comentariosHtml: 'En descanso (sin historial)',
            ordenTimestamp: fechaUltimoCambio.getTime(),
          })
        }
        continue
      }

      // ✅ Ordenar todos los eventos por fecha y luego por createdAt
      const todosEventos = [...entradasPotrero, ...salidasPotrero]
        .sort((a, b) => {
          const fechaDiff = new Date(a.fecha).getTime() - new Date(b.fecha).getTime()
          if (fechaDiff !== 0) return fechaDiff
          // Si misma fecha, ordenar por createdAt
          const createdA = a.createdAt ? new Date(a.createdAt).getTime() : 0
          const createdB = b.createdAt ? new Date(b.createdAt).getTime() : 0
          return createdA - createdB
        })

      // ✅ Agrupar por ciclos de ocupación
      const ciclos: any[] = []
      let cicloActual: any = null
      let animalesEnPotrero = 0

      for (const evento of todosEventos) {
        const esEntrada = evento.esEntrada
        const cantidadEvento = evento.cantidad || 0

        if (esEntrada) {
          animalesEnPotrero += cantidadEvento

          if (!cicloActual) {
            cicloActual = {
              fechaInicio: new Date(evento.fecha),
              entradas: [],
              salidas: [], // ✅ NUEVO: trackear salidas parciales
              fechaFin: null,
              createdAt: evento.createdAt,
            }
            ciclos.push(cicloActual)
          }

          cicloActual.entradas.push({
            fecha: new Date(evento.fecha),
            cantidad: evento.cantidad,
            categoria: evento.categoria || evento.descripcion || 'Sin categoría',
          })
        } else {
          // Es salida
          animalesEnPotrero -= cantidadEvento

          // ✅ NUEVO: Registrar salida parcial si el ciclo sigue abierto
          if (cicloActual && animalesEnPotrero > 0) {
            cicloActual.salidas.push({
              fecha: new Date(evento.fecha),
              cantidad: cantidadEvento,
              categoria: evento.categoria || 'Animales',
            })
          }

          if (animalesEnPotrero <= 0) {
            if (cicloActual) {
              cicloActual.fechaFin = new Date(evento.fecha)
              cicloActual = null
            }
            animalesEnPotrero = 0
          }
        }
      }

      // Convertir ciclos a registros
      for (const ciclo of ciclos) {
        const fechaEntrada = ciclo.fechaInicio
        const fechaSalida = ciclo.fechaFin

        // Aplicar filtro de fechas
        if (fechaDesde || fechaHasta) {
          const limiteDesde = fechaDesde ? new Date(fechaDesde) : new Date(0)
          const limiteHasta = fechaHasta ? new Date(fechaHasta) : hoy
          limiteHasta.setHours(23, 59, 59, 999)
          
          const fechaFinCiclo = fechaSalida || hoy
          
          if (fechaFinCiclo < limiteDesde || fechaEntrada > limiteHasta) {
            continue
          }
        }

        // Calcular días de pastoreo
        let diasPastoreo = 0
        if (fechaSalida) {
          diasPastoreo = Math.floor((fechaSalida.getTime() - fechaEntrada.getTime()) / (1000 * 60 * 60 * 24))
        } else {
          diasPastoreo = Math.floor((fechaLimite.getTime() - fechaEntrada.getTime()) / (1000 * 60 * 60 * 24))
        }

        // Calcular días de descanso
        let diasDescanso: number | string = '-'
        if (fechaSalida) {
          const indiceCicloActual = ciclos.indexOf(ciclo)
          const proximoCiclo = ciclos[indiceCicloActual + 1]
          
          if (proximoCiclo) {
            diasDescanso = Math.floor((proximoCiclo.fechaInicio.getTime() - fechaSalida.getTime()) / (1000 * 60 * 60 * 24))
          } else {
            diasDescanso = Math.floor((fechaLimite.getTime() - fechaSalida.getTime()) / (1000 * 60 * 60 * 24))
          }
        }

        // ✅ Construir comentarios con entradas Y salidas parciales
        const comentariosPartes: string[] = []
        const comentariosPartesHtml: string[] = []
        
        // Agregar entradas
        ciclo.entradas.forEach((entrada: any, idx: number) => {
          const cantidadTexto = entrada.cantidad ? `${entrada.cantidad} ` : ''
          const fechaCorta = entrada.fecha.toLocaleDateString('es-UY', { day: '2-digit', month: '2-digit', timeZone: 'America/Montevideo' })
          
          if (idx === 0) {
            comentariosPartesHtml.push(`<span style="background-color: #93C5FD; padding: 2px 6px; border-radius: 4px; font-weight: 500;">${cantidadTexto}${entrada.categoria} (${fechaCorta})</span>`)
          } else {
            comentariosPartesHtml.push(`+${cantidadTexto}${entrada.categoria} (${fechaCorta})`)
          }
          comentariosPartes.push(`${cantidadTexto}${entrada.categoria} (${fechaCorta})`)
        })

        // ✅ NUEVO: Agregar salidas parciales (si las hay)
        if (ciclo.salidas && ciclo.salidas.length > 0) {
          ciclo.salidas.forEach((salida: any) => {
            const fechaCorta = salida.fecha.toLocaleDateString('es-UY', { day: '2-digit', month: '2-digit', timeZone: 'America/Montevideo' })
            comentariosPartesHtml.push(`<span style="background-color: #FCA5A5; padding: 2px 6px; border-radius: 4px; font-weight: 500;">-${salida.cantidad} (${fechaCorta})</span>`)
            comentariosPartes.push(`-${salida.cantidad} salieron (${fechaCorta})`)
          })
        }

        const comentariosHtml = comentariosPartesHtml.join(' ')
        const comentariosTexto = comentariosPartes.join(' | ')

        registros.push({
          potrero: potrero.nombre,
          fechaEntrada: fechaEntrada.toLocaleDateString('es-UY', { timeZone: 'America/Montevideo' }),
          fechaEntradaDate: fechaEntrada, // ✅ Para ordenar
          dias: diasPastoreo,
          fechaSalida: fechaSalida ? fechaSalida.toLocaleDateString('es-UY', { timeZone: 'America/Montevideo' }) : '-',
          diasDescanso: diasDescanso,
          hectareas: Math.round((potrero.hectareas || 0) * 100) / 100,
          comentarios: comentariosTexto,
          comentariosHtml: comentariosHtml,
          ordenTimestamp: ciclo.createdAt ? new Date(ciclo.createdAt).getTime() : fechaEntrada.getTime(), // ✅ Para ordenar
        })
      }
    }

    // ✅ MEJORADO: Ordenar por fecha de entrada, y si hay empate, por timestamp de creación
    registros.sort((a, b) => {
      if (a.fechaEntrada === '-' && b.fechaEntrada === '-') return 0
      if (a.fechaEntrada === '-') return 1
      if (b.fechaEntrada === '-') return -1
      
      const parseDate = (dateStr: string) => {
        const parts = dateStr.split('/')
        return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]))
      }
      
      const fechaA = parseDate(a.fechaEntrada).getTime()
      const fechaB = parseDate(b.fechaEntrada).getTime()
      
      // Si las fechas son diferentes, ordenar por fecha
      if (fechaA !== fechaB) {
        return fechaA - fechaB
      }
      
      // Si las fechas son iguales, ordenar por timestamp de creación
      return (a.ordenTimestamp || 0) - (b.ordenTimestamp || 0)
    })

    // Limpiar campos auxiliares antes de enviar
    const registrosLimpios = registros.map(r => {
      const { fechaEntradaDate, ordenTimestamp, ...resto } = r
      return resto
    })

    return NextResponse.json({
      modulo: modulo.nombre,
      registros: registrosLimpios,
    })

  } catch (error) {
    console.error('Error en reporte de pastoreo:', error)
    return NextResponse.json(
      { error: 'Error generando reporte' },
      { status: 500 }
    )
  }
}