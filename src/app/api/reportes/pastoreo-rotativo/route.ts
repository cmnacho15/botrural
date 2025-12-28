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

    // IMPORTANTE: Obtener TODOS los eventos sin filtro de fecha
    // porque necesitamos el historial completo para armar los ciclos
    const eventos = await prisma.evento.findMany({
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
      },
      orderBy: { fecha: 'asc' },
    })

    const hoy = new Date()
    const fechaLimite = fechaHasta ? new Date(fechaHasta) : hoy
    const registros: any[] = []

    // Procesar cada potrero
    for (const potrero of potreros) {
      // Separar entradas y salidas de este potrero
      const entradasPotrero = eventos.filter(e => e.loteDestinoId === potrero.id)
      const salidasPotrero = eventos.filter(e => e.loteId === potrero.id)

      // Si tiene animales actualmente pero no hay eventos de entrada, agregar carga inicial
      if (potrero.animalesLote.length > 0 && entradasPotrero.length === 0 && potrero.ultimoCambio) {
        const fechaInicial = new Date(potrero.ultimoCambio)
        const comentario = potrero.animalesLote
          .map(a => `${a.cantidad} ${a.categoria}`)
          .join(', ')
        
        entradasPotrero.unshift({
          id: 'inicial-' + potrero.id,
          fecha: potrero.ultimoCambio,
          loteId: null,
          loteDestinoId: potrero.id,
          categoria: null,
          cantidad: null,
          descripcion: comentario,
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
            dias: '-',
            fechaSalida: fechaUltimoCambio.toLocaleDateString('es-UY'),
            diasDescanso: diasDescanso,
            hectareas: Math.round((potrero.hectareas || 0) * 100) / 100,
            comentarios: 'En descanso (sin historial)',
            comentariosHtml: 'En descanso (sin historial)',
          })
        }
        continue
      }

      // Agrupar por ciclos de ocupación (entrada -> salida COMPLETA -> nueva entrada)
      const ciclos: any[] = []
      let cicloActual: any = null

      // Ordenar todos los eventos por fecha
      const todosEventos = [...entradasPotrero, ...salidasPotrero]
        .sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime())

      let animalesEnPotrero = 0

      for (const evento of todosEventos) {
        const esEntrada = evento.loteDestinoId === potrero.id
        const esSalida = evento.loteId === potrero.id

        if (esEntrada) {
          const cantidadEntra = evento.cantidad || 0
          animalesEnPotrero += cantidadEntra

          if (!cicloActual) {
            // Iniciar nuevo ciclo
            cicloActual = {
              fechaInicio: new Date(evento.fecha),
              entradas: [],
              fechaFin: null,
            }
            ciclos.push(cicloActual)
          }

          // Agregar entrada al ciclo actual
          cicloActual.entradas.push({
            fecha: new Date(evento.fecha),
            cantidad: evento.cantidad,
            categoria: evento.categoria || evento.descripcion || 'Sin categoría',
          })
        }

        if (esSalida) {
          const cantidadSale = evento.cantidad || 0
          animalesEnPotrero -= cantidadSale

          // Si el potrero queda vacío, cerrar ciclo
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

        // Aplicar filtro de fechas AQUÍ (después de construir los ciclos)
        // Solo excluir si el ciclo está completamente fuera del rango
        if (fechaDesde) {
          const limiteDesde = new Date(fechaDesde)
          // Si el ciclo terminó antes de la fecha desde, no lo incluir
          if (fechaSalida && fechaSalida < limiteDesde) {
            continue
          }
        }

        if (fechaHasta) {
          const limiteHasta = new Date(fechaHasta)
          limiteHasta.setHours(23, 59, 59, 999)
          // Si el ciclo empezó después de la fecha hasta, no lo incluir
          if (fechaEntrada > limiteHasta) {
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

        // Construir comentarios con HTML
        const comentariosPartes = ciclo.entradas.map((entrada: any, idx: number) => {
          const cantidadTexto = entrada.cantidad ? `${entrada.cantidad} ` : ''
          const fechaCorta = entrada.fecha.toLocaleDateString('es-UY', { day: '2-digit', month: '2-digit' })
          
          if (idx === 0) {
            return `<span style="background-color: #93C5FD; padding: 2px 6px; border-radius: 4px; font-weight: 500;">${cantidadTexto}${entrada.categoria} (${fechaCorta})</span>`
          } else {
            return `${cantidadTexto}${entrada.categoria} (${fechaCorta})`
          }
        })

        const comentariosHtml = comentariosPartes.join(' + ')
        
        const comentariosTexto = ciclo.entradas.map((entrada: any) => {
          const cantidadTexto = entrada.cantidad ? `${entrada.cantidad} ` : ''
          const fechaCorta = entrada.fecha.toLocaleDateString('es-UY', { day: '2-digit', month: '2-digit' })
          return `${cantidadTexto}${entrada.categoria} (${fechaCorta})`
        }).join(' + ')

        registros.push({
          potrero: potrero.nombre,
          fechaEntrada: fechaEntrada.toLocaleDateString('es-UY'),
          dias: diasPastoreo,
          fechaSalida: fechaSalida ? fechaSalida.toLocaleDateString('es-UY') : '-',
          diasDescanso: diasDescanso,
          hectareas: Math.round((potrero.hectareas || 0) * 100) / 100,
          comentarios: comentariosTexto,
          comentariosHtml: comentariosHtml,
        })
      }
    }

    // Ordenar por fecha de entrada
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