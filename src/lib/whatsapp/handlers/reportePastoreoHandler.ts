// src/lib/whatsapp/handlers/reportePastoreoHandler.ts

import { prisma } from "@/lib/prisma"
import { sendWhatsAppMessage, sendWhatsAppDocument } from "../sendMessage"
import { sendWhatsAppButtons } from "../sendMessage"
import { createClient } from "@supabase/supabase-js"

// Función para obtener cliente Supabase (lazy init)
function getSupabaseClient() {
  return createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

/**
 * Handler principal: muestra los módulos disponibles para elegir
 */
export async function handleReportePastoreo(telefono: string) {
  try {
    const usuario = await prisma.user.findUnique({
      where: { telefono },
      select: { campoId: true }
    })

    if (!usuario?.campoId) {
      await sendWhatsAppMessage(
        telefono,
        "❌ No tenés un campo configurado."
      )
      return
    }

    // Obtener módulos que tienen potreros asignados
    const modulos = await prisma.moduloPastoreo.findMany({
      where: { campoId: usuario.campoId },
      include: {
        _count: { select: { lotes: true } }
      },
      orderBy: { nombre: 'asc' }
    })

    const modulosConPotreros = modulos.filter(m => m._count.lotes > 0)

    if (modulosConPotreros.length === 0) {
      await sendWhatsAppMessage(
        telefono,
        "❌ No tenés módulos de pastoreo configurados.\n\n" +
        "Podés crearlos desde la web en la sección de Potreros."
      )
      return
    }

    // Si hay solo 1 módulo, generar directo sin preguntar
    if (modulosConPotreros.length === 1) {
      await generarYEnviarReportePastoreo(telefono, modulosConPotreros[0].id, modulosConPotreros[0].nombre)
      return
    }

    // Si hay más de 3 módulos, WhatsApp no soporta más de 3 botones
    // Enviar los primeros 3 como botones
    const modulosParaBotones = modulosConPotreros.slice(0, 3)

    const buttons = modulosParaBotones.map(m => ({
      id: `pastoreo_${m.id}`,
      title: m.nombre.substring(0, 20) // WhatsApp limita a 20 caracteres
    }))

    await sendWhatsAppButtons(
      telefono,
      "📊 *Reporte de Pastoreo Rotativo*\n\n¿De qué módulo querés el reporte?",
      buttons
    )

    // Guardar en pendingConfirmation para saber que está eligiendo módulo
    await prisma.pendingConfirmation.upsert({
      where: { telefono },
      create: {
        telefono,
        data: JSON.stringify({ tipo: "REPORTE_PASTOREO_SELECCION" })
      },
      update: {
        data: JSON.stringify({ tipo: "REPORTE_PASTOREO_SELECCION" })
      }
    })

  } catch (error) {
    console.error("❌ Error en handleReportePastoreo:", error)
    await sendWhatsAppMessage(
      telefono,
      "❌ Error obteniendo los módulos. Intentá de nuevo."
    )
  }
}

/**
 * Handler para cuando el usuario elige un módulo (botón clickeado)
 */
export async function handleReportePastoreoButtonResponse(telefono: string, buttonId: string) {
  try {
    // buttonId tiene formato: pastoreo_<moduloId>
    const moduloId = buttonId.replace('pastoreo_', '')

    const modulo = await prisma.moduloPastoreo.findUnique({
      where: { id: moduloId },
      select: { id: true, nombre: true }
    })

    if (!modulo) {
      await sendWhatsAppMessage(telefono, "❌ Módulo no encontrado.")
      return
    }

    // Limpiar pendingConfirmation
    await prisma.pendingConfirmation.deleteMany({
      where: { telefono }
    })

    await generarYEnviarReportePastoreo(telefono, modulo.id, modulo.nombre)

  } catch (error) {
    console.error("❌ Error en handleReportePastoreoButtonResponse:", error)
    await sendWhatsAppMessage(
      telefono,
      "❌ Error generando el reporte. Intentá de nuevo."
    )
  }
}

/**
 * Genera el PDF del reporte de pastoreo y lo envía por WhatsApp
 */
async function generarYEnviarReportePastoreo(telefono: string, moduloId: string, moduloNombre: string) {
  try {
    await sendWhatsAppMessage(
      telefono,
      `⏳ Generando reporte de pastoreo para *${moduloNombre}*... Un momento.`
    )

    const usuario = await prisma.user.findUnique({
      where: { telefono },
      include: { campo: true }
    })

    if (!usuario?.campoId || !usuario.campo) {
      await sendWhatsAppMessage(telefono, "❌ Error: campo no encontrado.")
      return
    }

    // Obtener datos del reporte (misma lógica que el API)
    const reporteData = await obtenerDatosReportePastoreo(usuario.campoId, moduloId)

    if (!reporteData || reporteData.registros.length === 0) {
      await sendWhatsAppMessage(
        telefono,
        `📊 El módulo *${moduloNombre}* no tiene registros de pastoreo aún.`
      )
      return
    }

    // Generar PDF
    const pdfBuffer = await generarPDFPastoreo(reporteData, usuario.campo.nombre)

    if (!pdfBuffer) {
      await sendWhatsAppMessage(telefono, "❌ Error generando el PDF.")
      return
    }

    // Subir a Supabase
    const pdfUrl = await subirPDFaSupabase(pdfBuffer, moduloNombre)

    if (!pdfUrl) {
      await sendWhatsAppMessage(telefono, "❌ Error subiendo el archivo.")
      return
    }

    // Enviar por WhatsApp
    const fecha = new Date().toLocaleDateString('es-UY', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })

    const nombreArchivo = `Pastoreo_${moduloNombre.replace(/\s+/g, '_')}_${fecha.replace(/\//g, '-')}.pdf`

    await sendWhatsAppDocument(
      telefono,
      pdfUrl,
      nombreArchivo,
      `📊 Reporte de Pastoreo - ${moduloNombre}\n📅 ${fecha}`
    )

    console.log(`✅ PDF de pastoreo enviado a ${telefono}`)

  } catch (error) {
    console.error("❌ Error en generarYEnviarReportePastoreo:", error)
    await sendWhatsAppMessage(
      telefono,
      "❌ Error generando el reporte. Intentá de nuevo."
    )
  }
}

/**
 * Obtiene los datos del reporte de pastoreo (misma lógica que /api/reportes/pastoreo-rotativo)
 */
async function obtenerDatosReportePastoreo(campoId: string, moduloId: string) {
  try {
    const modulo = await prisma.moduloPastoreo.findFirst({
      where: { id: moduloId, campoId }
    })

    if (!modulo) return null

    const potreros = await prisma.lote.findMany({
      where: { moduloPastoreoId: moduloId, campoId },
      select: {
        id: true,
        nombre: true,
        hectareas: true,
        ultimoCambio: true,
        animalesLote: {
          select: { categoria: true, cantidad: true }
        }
      }
    })

    const potrerosIds = potreros.map(p => p.id)
    if (potrerosIds.length === 0) return { modulo: modulo.nombre, registros: [] }

    // Obtener eventos CAMBIO_POTRERO
    const eventosCambio = await prisma.evento.findMany({
      where: {
        tipo: 'CAMBIO_POTRERO',
        campoId,
        OR: [
          { loteDestinoId: { in: potrerosIds } },
          { loteId: { in: potrerosIds } }
        ]
      },
      select: {
        id: true,
        fecha: true,
        loteId: true,
        loteDestinoId: true,
        categoria: true,
        cantidad: true,
        descripcion: true,
        createdAt: true
      },
      orderBy: { fecha: 'asc' }
    })

    // Obtener eventos AJUSTE
    const eventosAjuste = await prisma.evento.findMany({
      where: {
        tipo: 'AJUSTE',
        campoId,
        loteId: { in: potrerosIds }
      },
      select: {
        id: true,
        fecha: true,
        loteId: true,
        categoria: true,
        cantidad: true,
        descripcion: true,
        createdAt: true
      },
      orderBy: { fecha: 'asc' }
    })

    const hoy = new Date()
    const registros: any[] = []

    for (const potrero of potreros) {
      const entradasCambio = eventosCambio
        .filter(e => e.loteDestinoId === potrero.id)
        .map(e => ({ ...e, tipoEvento: 'CAMBIO_POTRERO', esEntrada: true }))

      const salidasCambio = eventosCambio
        .filter(e => e.loteId === potrero.id)
        .map(e => ({ ...e, tipoEvento: 'CAMBIO_POTRERO', esEntrada: false }))

      const salidasAjuste = eventosAjuste
        .filter(e => e.loteId === potrero.id && (e.descripcion?.includes('negativo') || e.descripcion?.includes('eliminaron')))
        .map(e => ({ ...e, tipoEvento: 'AJUSTE', esEntrada: false }))

      const idsSalidas = new Set(salidasAjuste.map(e => e.id))
      const entradasAjuste = eventosAjuste
        .filter(e => e.loteId === potrero.id && !idsSalidas.has(e.id))
        .map(e => ({ ...e, loteDestinoId: potrero.id, tipoEvento: 'AJUSTE', esEntrada: true }))

      let entradasPotrero = [...entradasCambio, ...entradasAjuste]
      let salidasPotrero = [...salidasCambio, ...salidasAjuste]

      // Entrada inicial si no hay eventos
      if (entradasPotrero.length === 0 && potrero.ultimoCambio && potrero.animalesLote.length > 0) {
        const comentario = potrero.animalesLote.map(a => `${a.cantidad} ${a.categoria}`).join(', ')
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
          createdAt: potrero.ultimoCambio
        })
      }

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
          createdAt: fechaEntrada
        })
      }

      if (entradasPotrero.length === 0 && salidasPotrero.length === 0) {
        if (potrero.ultimoCambio && potrero.animalesLote.length === 0) {
          const fechaUltimoCambio = new Date(potrero.ultimoCambio)
          const diasDescanso = Math.floor((hoy.getTime() - fechaUltimoCambio.getTime()) / (1000 * 60 * 60 * 24))
          registros.push({
            potrero: potrero.nombre,
            fechaEntrada: '-',
            dias: '-',
            fechaSalida: fechaUltimoCambio.toLocaleDateString('es-UY', { timeZone: 'America/Montevideo' }),
            diasDescanso,
            hectareas: Math.round((potrero.hectareas || 0) * 100) / 100,
            comentarios: 'En descanso (sin historial)'
          })
        }
        continue
      }

      const todosEventos = [...entradasPotrero, ...salidasPotrero]
        .sort((a, b) => {
          const fechaDiff = new Date(a.fecha).getTime() - new Date(b.fecha).getTime()
          if (fechaDiff !== 0) return fechaDiff
          const createdA = a.createdAt ? new Date(a.createdAt).getTime() : 0
          const createdB = b.createdAt ? new Date(b.createdAt).getTime() : 0
          return createdA - createdB
        })

      const ciclos: any[] = []
      let cicloActual: any = null
      let animalesEnPotrero = 0

      for (const evento of todosEventos) {
        const esEntrada = evento.esEntrada
        const cantidadEvento = evento.cantidad || 0

        if (esEntrada) {
          animalesEnPotrero += cantidadEvento
          if (!cicloActual) {
            cicloActual = { fechaInicio: new Date(evento.fecha), entradas: [], salidas: [], fechaFin: null, createdAt: evento.createdAt }
            ciclos.push(cicloActual)
          }
          cicloActual.entradas.push({
            fecha: new Date(evento.fecha),
            cantidad: evento.cantidad,
            categoria: evento.categoria || evento.descripcion || 'Sin categoría'
          })
        } else {
          animalesEnPotrero -= cantidadEvento
          if (cicloActual && animalesEnPotrero > 0) {
            cicloActual.salidas.push({
              fecha: new Date(evento.fecha),
              cantidad: cantidadEvento,
              categoria: evento.categoria || 'Animales'
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

      for (const ciclo of ciclos) {
        const fechaEntrada = ciclo.fechaInicio
        const fechaSalida = ciclo.fechaFin

        let diasPastoreo = 0
        if (fechaSalida) {
          diasPastoreo = Math.floor((fechaSalida.getTime() - fechaEntrada.getTime()) / (1000 * 60 * 60 * 24))
        } else {
          diasPastoreo = Math.floor((hoy.getTime() - fechaEntrada.getTime()) / (1000 * 60 * 60 * 24))
        }

        let diasDescanso: number | string = '-'
        if (fechaSalida) {
          const indiceCicloActual = ciclos.indexOf(ciclo)
          const proximoCiclo = ciclos[indiceCicloActual + 1]
          if (proximoCiclo) {
            diasDescanso = Math.floor((proximoCiclo.fechaInicio.getTime() - fechaSalida.getTime()) / (1000 * 60 * 60 * 24))
          } else {
            diasDescanso = Math.floor((hoy.getTime() - fechaSalida.getTime()) / (1000 * 60 * 60 * 24))
          }
        }

        const comentariosPartes: string[] = []
        ciclo.entradas.forEach((entrada: any) => {
          const cantidadTexto = entrada.cantidad ? `${entrada.cantidad} ` : ''
          const fechaCorta = entrada.fecha.toLocaleDateString('es-UY', { day: '2-digit', month: '2-digit', timeZone: 'America/Montevideo' })
          comentariosPartes.push(`${cantidadTexto}${entrada.categoria} (${fechaCorta})`)
        })
        if (ciclo.salidas && ciclo.salidas.length > 0) {
          ciclo.salidas.forEach((salida: any) => {
            const fechaCorta = salida.fecha.toLocaleDateString('es-UY', { day: '2-digit', month: '2-digit', timeZone: 'America/Montevideo' })
            comentariosPartes.push(`-${salida.cantidad} (${fechaCorta})`)
          })
        }

        registros.push({
          potrero: potrero.nombre,
          fechaEntrada: fechaEntrada.toLocaleDateString('es-UY', { timeZone: 'America/Montevideo' }),
          dias: diasPastoreo,
          fechaSalida: fechaSalida ? fechaSalida.toLocaleDateString('es-UY', { timeZone: 'America/Montevideo' }) : '-',
          diasDescanso,
          hectareas: Math.round((potrero.hectareas || 0) * 100) / 100,
          comentarios: comentariosPartes.join(' | '),
          ordenTimestamp: ciclo.createdAt ? new Date(ciclo.createdAt).getTime() : fechaEntrada.getTime()
        })
      }
    }

    // Ordenar
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
      if (fechaA !== fechaB) return fechaA - fechaB
      return (a.ordenTimestamp || 0) - (b.ordenTimestamp || 0)
    })

    return { modulo: modulo.nombre, registros }
  } catch (error) {
    console.error('Error obteniendo datos de pastoreo:', error)
    return null
  }
}

/**
 * Genera el PDF del reporte de pastoreo
 */
async function generarPDFPastoreo(data: any, nombreCampo: string): Promise<Buffer | null> {
  try {
    const { jsPDF } = await import('jspdf')
    const autoTable = (await import('jspdf-autotable')).default

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
    const pageWidth = doc.internal.pageSize.getWidth()
    const margin = 10

    // Header
    doc.setFontSize(16)
    doc.setFont('helvetica', 'bold')
    doc.text(`Reporte de Pastoreo - ${data.modulo}`, margin, 15)

    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text(`Establecimiento: ${nombreCampo}`, margin, 22)

    const fecha = new Date().toLocaleDateString('es-UY', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
    doc.text(`Generado: ${fecha}`, pageWidth - margin - 40, 15)

    // Tabla
    const headers = ['POTRERO', 'FECHA ENTRADA', 'DÍAS PASTOREO', 'FECHA SALIDA', 'DÍAS DESCANSO', 'HECTÁREAS', 'COMENTARIOS']
    const rows = data.registros.map((r: any) => [
      r.potrero,
      r.fechaEntrada,
      r.dias.toString(),
      r.fechaSalida,
      r.diasDescanso.toString(),
      r.hectareas.toFixed(2),
      r.comentarios
    ])

    autoTable(doc, {
      head: [headers],
      body: rows,
      startY: 30,
      theme: 'grid',
      styles: {
        fontSize: 8,
        cellPadding: 2,
        halign: 'center',
        valign: 'middle'
      },
      headStyles: {
        fillColor: [41, 128, 185],
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 7
      },
      columnStyles: {
        0: { halign: 'left', fillColor: [173, 216, 230], cellWidth: 30 },
        1: { cellWidth: 25 },
        2: { cellWidth: 25 },
        3: { cellWidth: 25 },
        4: { cellWidth: 25 },
        5: { cellWidth: 20 },
        6: { halign: 'left', cellWidth: 'auto' }
      },
      margin: { left: margin, right: margin }
    })

    // Footer
    const finalY = (doc as any).lastAutoTable.finalY + 10
    doc.setFontSize(8)
    doc.setTextColor(128, 128, 128)
    doc.text('Generado por Bot Rural - botrural.vercel.app', margin, finalY)

    return Buffer.from(doc.output('arraybuffer'))
  } catch (error) {
    console.error('Error generando PDF de pastoreo:', error)
    return null
  }
}

/**
 * Sube el PDF a Supabase Storage
 */
async function subirPDFaSupabase(pdfBuffer: Buffer, nombreModulo: string): Promise<string | null> {
  try {
    const fecha = new Date().toISOString().split('T')[0]
    const nombreArchivo = `reportes/pastoreo_${nombreModulo.replace(/\s+/g, '_')}_${fecha}_${Date.now()}.pdf`

    const supabase = getSupabaseClient()
    const { error } = await supabase.storage
      .from('invoices')
      .upload(nombreArchivo, pdfBuffer, {
        contentType: 'application/pdf',
        cacheControl: '3600'
      })

    if (error) {
      console.error('Error subiendo PDF:', error)
      return null
    }

    const { data: urlData } = supabase.storage
      .from('invoices')
      .getPublicUrl(nombreArchivo)

    return urlData.publicUrl
  } catch (error) {
    console.error('Error en subirPDFaSupabase:', error)
    return null
  }
}