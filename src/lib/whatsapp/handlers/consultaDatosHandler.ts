// src/lib/whatsapp/handlers/consultaDatosHandler.ts
// Handler para consultas de datos registrados

import { prisma } from "@/lib/prisma"
import { sendWhatsAppMessage, sendWhatsAppDocument, sendWhatsAppImage } from "../sendMessage"
import { createClient } from "@supabase/supabase-js"

// Mapeo de tipos de evento para mostrar
const NOMBRES_TIPO: Record<string, string> = {
  LLUVIA: 'Lluvias',
  TRATAMIENTO: 'Tratamientos',
  MANEJO: 'Manejos',
  NACIMIENTO: 'Nacimientos',
  MORTANDAD: 'Mortandades',
  VENTA: 'Ventas',
  COMPRA: 'Compras',
  TACTO: 'Tactos',
  DESTETE: 'Destetes',
  CONSUMO: 'Consumos',
  DAO: 'DAOs',
  OBSERVACION: 'Observaciones',
  HELADA: 'Heladas',
  CAMBIO_POTRERO: 'Cambios de Potrero',
}

const ICONOS: Record<string, string> = {
  LLUVIA: '🌧️',
  TRATAMIENTO: '💉',
  MANEJO: '⛏️',
  NACIMIENTO: '🐣',
  MORTANDAD: '💀',
  VENTA: '💰',
  COMPRA: '🛒',
  TACTO: '✋',
  DESTETE: '🔀',
  CONSUMO: '🍖',
  DAO: '🔬',
  OBSERVACION: '📸',
  HELADA: '❄️',
  CAMBIO_POTRERO: '🔄',
}

function getSupabaseClient() {
  return createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

/**
 * Maneja consultas de datos registrados (soporta múltiples tipos)
 */
export async function handleConsultaDatos(phoneNumber: string, parsedData: any) {
  console.log("📊 CONSULTA_DATOS:", parsedData)

  try {
    // Obtener usuario y campo
    const usuario = await prisma.user.findUnique({
      where: { telefono: phoneNumber },
      select: { id: true, campoId: true, campo: { select: { nombre: true } } }
    })

    if (!usuario?.campoId) {
      await sendWhatsAppMessage(phoneNumber, "❌ No tenés un campo configurado.")
      return
    }

    // Resolver tipos de evento: soportar tiposEvento (array) y tipoEvento (legacy string)
    let tipos: string[] = []
    if (parsedData.tiposEvento && Array.isArray(parsedData.tiposEvento)) {
      tipos = parsedData.tiposEvento
    } else if (parsedData.tipoEvento) {
      tipos = [parsedData.tipoEvento]
    }

    if (tipos.length === 0) {
      await sendWhatsAppMessage(phoneNumber, "❌ No entendí qué datos querés consultar.")
      return
    }

    // Construir filtro de fechas
    const ahora = new Date()
    let fechaDesde: Date | undefined
    let fechaHasta: Date | undefined

    if (parsedData.diasAtras != null && parsedData.diasAtras >= 0) {
      fechaDesde = new Date()
      fechaDesde.setDate(fechaDesde.getDate() - parsedData.diasAtras)
      fechaDesde.setHours(0, 0, 0, 0)
    } else if (parsedData.mes) {
      const año = parsedData.año || ahora.getFullYear()
      fechaDesde = new Date(año, parsedData.mes - 1, 1)
      fechaHasta = new Date(año, parsedData.mes, 0, 23, 59, 59)
    }

    // Resolver potrero si se especificó
    let loteId: string | undefined
    if (parsedData.potrero) {
      const lote = await prisma.lote.findFirst({
        where: {
          campoId: usuario.campoId,
          nombre: { contains: parsedData.potrero, mode: 'insensitive' }
        }
      })
      if (lote) {
        loteId = lote.id
      }
    }

    // Si pidió TODOS, generar PDF combinado
    if (tipos.includes('TODOS')) {
      await consultarYEnviarTodos(phoneNumber, {
        campoId: usuario.campoId,
        campoNombre: usuario.campo?.nombre || 'Campo',
        fechaDesde,
        fechaHasta,
        loteId,
        categoria: parsedData.categoria,
      })
      return
    }

    // Procesar cada tipo
    for (const tipoEvento of tipos) {
      await consultarYEnviarTipo(phoneNumber, {
        campoId: usuario.campoId,
        campoNombre: usuario.campo?.nombre || 'Campo',
        tipoEvento,
        fechaDesde,
        fechaHasta,
        loteId,
        categoria: parsedData.categoria,
      })
    }

  } catch (error) {
    console.error("Error en handleConsultaDatos:", error)
    await sendWhatsAppMessage(phoneNumber, "❌ Error consultando los datos. Intentá de nuevo.")
  }
}

/**
 * Consulta y envía datos de un tipo específico
 */
async function consultarYEnviarTipo(
  phoneNumber: string,
  params: {
    campoId: string
    campoNombre: string
    tipoEvento: string
    fechaDesde?: Date
    fechaHasta?: Date
    loteId?: string
    categoria?: string
  }
) {
  const { campoId, campoNombre, tipoEvento, fechaDesde, fechaHasta, loteId, categoria } = params

  // Construir query
  const where: any = {
    campoId,
    tipo: tipoEvento,
  }

  if (fechaDesde) {
    where.fecha = { gte: fechaDesde }
    if (fechaHasta) {
      where.fecha = { gte: fechaDesde, lte: fechaHasta }
    }
  }

  if (loteId) {
    where.loteId = loteId
  }

  if (categoria) {
    where.categoria = { contains: categoria, mode: 'insensitive' }
  }

  // Consultar datos
  const eventos = await prisma.evento.findMany({
    where,
    orderBy: { fecha: 'asc' },
    take: 100,
    include: {
      lote: { select: { nombre: true } }
    }
  })

  const icono = ICONOS[tipoEvento] || '📊'
  const tipoNombre = NOMBRES_TIPO[tipoEvento] || tipoEvento

  if (eventos.length === 0) {
    await sendWhatsAppMessage(
      phoneNumber,
      `${icono} No encontré registros de *${tipoNombre}* con esos filtros.`
    )
    return
  }

  // Si son pocos registros, enviar como texto con formato completo
  if (eventos.length <= 10) {
    let mensaje = `${icono} *${tipoNombre}* (${eventos.length} registros)\n\n`

    for (const evento of eventos) {
      mensaje += formatearEvento(evento, tipoEvento)
    }

    await sendWhatsAppMessage(phoneNumber, mensaje)

    // Enviar fotos adjuntas de los eventos que tengan imagen
    await enviarFotosAdjuntas(phoneNumber, eventos, tipoNombre)
    return
  }

  // Si son muchos registros, generar PDF
  await sendWhatsAppMessage(
    phoneNumber,
    `${icono} Encontré *${eventos.length}* registros de ${tipoNombre}. Generando PDF...`
  )

  const pdfBuffer = await generarPDFConsulta(eventos, tipoEvento, campoNombre)

  if (!pdfBuffer) {
    await enviarComoTextoResumido(phoneNumber, eventos, tipoEvento)
    return
  }

  const pdfUrl = await subirPDFaSupabase(pdfBuffer, tipoNombre)

  if (!pdfUrl) {
    await enviarComoTextoResumido(phoneNumber, eventos, tipoEvento)
    return
  }

  const nombreArchivo = `${tipoNombre.toLowerCase()}_${eventos.length}_registros.pdf`
  await sendWhatsAppDocument(phoneNumber, pdfUrl, nombreArchivo, `📊 ${tipoNombre} - ${eventos.length} registros`)

  // Enviar fotos adjuntas después del PDF
  await enviarFotosAdjuntas(phoneNumber, eventos, tipoNombre)
}

/**
 * Consulta TODOS los tipos y genera un PDF combinado
 */
async function consultarYEnviarTodos(
  phoneNumber: string,
  params: {
    campoId: string
    campoNombre: string
    fechaDesde?: Date
    fechaHasta?: Date
    loteId?: string
    categoria?: string
  }
) {
  const { campoId, campoNombre, fechaDesde, fechaHasta, loteId, categoria } = params

  const where: any = { campoId }

  if (fechaDesde) {
    where.fecha = { gte: fechaDesde }
    if (fechaHasta) {
      where.fecha = { gte: fechaDesde, lte: fechaHasta }
    }
  }
  if (loteId) where.loteId = loteId
  if (categoria) where.categoria = { contains: categoria, mode: 'insensitive' }

  const eventos = await prisma.evento.findMany({
    where,
    orderBy: { fecha: 'asc' },
    take: 200,
    include: { lote: { select: { nombre: true } } }
  })

  if (eventos.length === 0) {
    await sendWhatsAppMessage(phoneNumber, "📊 No encontré registros con esos filtros.")
    return
  }

  // Describir el período
  let periodoTexto = ''
  if (fechaDesde) {
    const desde = fechaDesde.toLocaleDateString('es-UY', { day: '2-digit', month: '2-digit', year: '2-digit' })
    periodoTexto = ` desde ${desde}`
  }

  await sendWhatsAppMessage(
    phoneNumber,
    `📊 Encontré *${eventos.length}* registros${periodoTexto}. Generando PDF...`
  )

  // Agrupar por tipo
  const eventosPorTipo: Record<string, any[]> = {}
  for (const evento of eventos) {
    const tipo = evento.tipo as string
    if (!eventosPorTipo[tipo]) eventosPorTipo[tipo] = []
    eventosPorTipo[tipo].push(evento)
  }

  // Generar PDF combinado
  const pdfBuffer = await generarPDFCombinado(eventosPorTipo, campoNombre, periodoTexto)

  if (!pdfBuffer) {
    // Fallback: enviar resumen por texto
    let mensaje = `📊 *Resumen de registros* (${eventos.length} total)${periodoTexto}\n\n`
    for (const [tipo, evs] of Object.entries(eventosPorTipo)) {
      const icono = ICONOS[tipo] || '📊'
      const nombre = NOMBRES_TIPO[tipo] || tipo
      mensaje += `${icono} *${nombre}:* ${evs.length}\n`
    }
    await sendWhatsAppMessage(phoneNumber, mensaje)
    return
  }

  const pdfUrl = await subirPDFaSupabase(pdfBuffer, 'registros')
  if (!pdfUrl) {
    let mensaje = `📊 *Resumen de registros* (${eventos.length} total)${periodoTexto}\n\n`
    for (const [tipo, evs] of Object.entries(eventosPorTipo)) {
      const icono = ICONOS[tipo] || '📊'
      const nombre = NOMBRES_TIPO[tipo] || tipo
      mensaje += `${icono} *${nombre}:* ${evs.length}\n`
    }
    await sendWhatsAppMessage(phoneNumber, mensaje)
    return
  }

  await sendWhatsAppDocument(
    phoneNumber,
    pdfUrl,
    `registros_${eventos.length}.pdf`,
    `📊 Registros - ${eventos.length} total`
  )

  // Enviar fotos adjuntas después del PDF
  await enviarFotosAdjuntas(phoneNumber, eventos, 'Registros')
}

/**
 * Genera un PDF con todos los tipos agrupados por secciones
 */
async function generarPDFCombinado(
  eventosPorTipo: Record<string, any[]>,
  campoNombre: string,
  periodoTexto: string
): Promise<Buffer | null> {
  try {
    const { jsPDF } = await import('jspdf')
    const autoTable = (await import('jspdf-autotable')).default

    const doc = new jsPDF()

    // Título
    doc.setFontSize(18)
    doc.setFont('helvetica', 'bold')
    doc.text('Registros del Campo', 14, 20)

    // Subtítulo
    doc.setFontSize(11)
    doc.setFont('helvetica', 'normal')
    const totalEventos = Object.values(eventosPorTipo).reduce((sum, evs) => sum + evs.length, 0)
    doc.text(`${campoNombre} - ${totalEventos} registros${periodoTexto}`, 14, 28)

    // Fecha de generación
    doc.setFontSize(9)
    doc.setTextColor(100)
    const fechaGeneracion = new Date().toLocaleDateString('es-UY', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    })
    doc.text(`Generado: ${fechaGeneracion}`, 14, 34)
    doc.setTextColor(0)

    let currentY = 42

    // Orden de tipos para el PDF
    const ordenTipos = [
      'LLUVIA', 'HELADA', 'NACIMIENTO', 'MORTANDAD', 'CONSUMO',
      'TRATAMIENTO', 'MANEJO', 'TACTO', 'DAO',
      'VENTA', 'COMPRA', 'CAMBIO_POTRERO', 'DESTETE', 'OBSERVACION'
    ]

    for (const tipo of ordenTipos) {
      const eventos = eventosPorTipo[tipo]
      if (!eventos || eventos.length === 0) continue

      const tipoNombre = NOMBRES_TIPO[tipo] || tipo
      const icono = ICONOS[tipo] || ''

      // Verificar si hay espacio, sino nueva página
      if (currentY > 250) {
        doc.addPage()
        currentY = 20
      }

      // Título de sección
      doc.setFontSize(13)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(59, 130, 246)
      doc.text(`${tipoNombre} (${eventos.length})`, 14, currentY)
      doc.setTextColor(0)
      currentY += 4

      // Tabla de datos
      const { headers, data } = prepararDatosTabla(eventos, tipo)

      autoTable(doc, {
        startY: currentY,
        head: [headers],
        body: data,
        theme: 'striped',
        headStyles: {
          fillColor: [59, 130, 246],
          textColor: 255,
          fontStyle: 'bold',
          fontSize: 9
        },
        bodyStyles: { fontSize: 8 },
        alternateRowStyles: { fillColor: [245, 247, 250] },
        columnStyles: { 0: { cellWidth: 22 } },
        margin: { left: 14, right: 14 },
        didDrawPage: (data: any) => {
          const pageCount = doc.getNumberOfPages()
          doc.setFontSize(8)
          doc.setTextColor(150)
          doc.text(
            `Página ${data.pageNumber} de ${pageCount}`,
            doc.internal.pageSize.width / 2,
            doc.internal.pageSize.height - 10,
            { align: 'center' }
          )
        }
      })

      currentY = (doc as any).lastAutoTable.finalY + 12
    }

    // Footer
    doc.setFontSize(8)
    doc.setTextColor(128, 128, 128)
    if (currentY > 270) {
      doc.addPage()
      currentY = 20
    }
    doc.text('Generado por Bot Rural - botrural.vercel.app', 14, currentY)

    return Buffer.from(doc.output('arraybuffer'))
  } catch (error) {
    console.error('Error generando PDF combinado:', error)
    return null
  }
}

/**
 * Extrae preñadas y porcentaje de un evento TACTO
 * Los tactos guardan preñadas en el campo "notas" (ej: "83 preñadas, 67 falladas")
 * o en la "descripcion" (ej: "129 animales tactados, 95 preñados (74% de preñez)")
 */
function extraerDatosTacto(evento: any): { preñadas: string, porcentaje: string } {
  // Intentar desde metadata primero (por si se implementa en el futuro)
  const metadata = evento.metadata as any
  if (metadata?.preñadas != null) {
    const p = metadata.preñadas
    const pct = evento.cantidad ? Math.round(p / evento.cantidad * 100) : null
    return { preñadas: p.toString(), porcentaje: pct?.toString() || '' }
  }
  if (metadata?.prenadas != null) {
    const p = metadata.prenadas
    const pct = evento.cantidad ? Math.round(p / evento.cantidad * 100) : null
    return { preñadas: p.toString(), porcentaje: pct?.toString() || '' }
  }

  // Extraer de "notas" (formato: "83 preñadas, 67 falladas")
  if (evento.notas) {
    const match = evento.notas.match(/(\d+)\s*preñadas/i)
    if (match) {
      const p = parseInt(match[1])
      const pct = evento.cantidad ? Math.round(p / evento.cantidad * 100) : null
      return { preñadas: p.toString(), porcentaje: pct?.toString() || '' }
    }
  }

  // Extraer de "descripcion" (formato: "129 animales tactados, 95 preñados (74% de preñez)")
  if (evento.descripcion) {
    const matchPreñados = evento.descripcion.match(/(\d+)\s*preñad[oa]s/i)
    const matchPct = evento.descripcion.match(/(\d+)%/)
    if (matchPreñados) {
      return {
        preñadas: matchPreñados[1],
        porcentaje: matchPct ? matchPct[1] : ''
      }
    }
  }

  return { preñadas: '?', porcentaje: '' }
}

/**
 * Formatea un evento individual según su tipo para envío por texto
 */
function formatearEvento(evento: any, tipoEvento: string): string {
  const fecha = evento.fecha.toLocaleDateString('es-UY', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit'
  })
  const potrero = evento.lote?.nombre ? ` (${evento.lote.nombre})` : ''
  const metadata = evento.metadata as any
  const foto = evento.imageUrl ? ' 📷' : ''

  switch (tipoEvento) {
    case 'LLUVIA':
      return `📅 ${fecha} - *${evento.cantidad || '?'}mm*${foto}\n`

    case 'HELADA':
      return `📅 ${fecha}${potrero}${foto}\n`

    case 'TACTO': {
      const tactadas = evento.cantidad || '?'
      const { preñadas: prn, porcentaje: pct } = extraerDatosTacto(evento)
      const pctStr = pct ? ` (${pct}%)` : ''
      return `📅 ${fecha} - ${tactadas} tactadas, ${prn} preñadas${pctStr}${potrero}${foto}\n`
    }

    case 'DAO': {
      const prenado = metadata?.prenado ?? '?'
      const ciclando = metadata?.ciclando ?? '?'
      const anestroSup = metadata?.anestroSuperficial ?? 0
      const anestroProf = metadata?.anestroProfundo ?? 0
      let linea = `📅 ${fecha} - ${evento.cantidad || '?'} examinadas${potrero}${foto}\n`
      linea += `    Preñadas: ${prenado} | Ciclando: ${ciclando}`
      if (anestroSup || anestroProf) {
        linea += ` | Anestro S: ${anestroSup} P: ${anestroProf}`
      }
      linea += '\n'
      return linea
    }

    case 'NACIMIENTO':
      return `📅 ${fecha} - ${evento.cantidad || '?'} ${evento.categoria || 'animales'}${potrero}${foto}\n`

    case 'MORTANDAD':
      return `📅 ${fecha} - ${evento.cantidad || '?'} ${evento.categoria || 'animales'}${potrero}${foto}\n`

    case 'CONSUMO':
      return `📅 ${fecha} - ${evento.cantidad || '?'} ${evento.categoria || 'animales'}${potrero}${foto}\n`

    case 'TRATAMIENTO':
    case 'MANEJO': {
      const desc = evento.descripcion || 'sin detalle'
      return `📅 ${fecha} - ${desc}${potrero}${foto}\n`
    }

    case 'VENTA':
    case 'COMPRA': {
      const cant = evento.cantidad ? `${evento.cantidad} ${evento.categoria || 'animales'}` : ''
      const monto = evento.monto ? ` - $${evento.monto.toLocaleString('es-UY')}` : ''
      return `📅 ${fecha} - ${cant}${monto}${potrero}${foto}\n`
    }

    case 'CAMBIO_POTRERO':
      return `📅 ${fecha} - ${evento.cantidad || '?'} ${evento.categoria || ''} ${evento.descripcion || ''}${potrero}${foto}\n`

    default:
      return `📅 ${fecha} - ${evento.descripcion || evento.tipo}${potrero}${foto}\n`
  }
}

/**
 * Genera un PDF con los datos de la consulta
 */
async function generarPDFConsulta(
  eventos: any[],
  tipoEvento: string,
  campoNombre: string
): Promise<Buffer | null> {
  try {
    const { jsPDF } = await import('jspdf')
    const autoTable = (await import('jspdf-autotable')).default

    const doc = new jsPDF()
    const tipoNombre = NOMBRES_TIPO[tipoEvento] || tipoEvento

    // Título
    doc.setFontSize(18)
    doc.setFont('helvetica', 'bold')
    doc.text(`${tipoNombre}`, 14, 20)

    // Subtítulo
    doc.setFontSize(11)
    doc.setFont('helvetica', 'normal')
    doc.text(`${campoNombre} - ${eventos.length} registros`, 14, 28)

    // Fecha de generación
    doc.setFontSize(9)
    doc.setTextColor(100)
    const fechaGeneracion = new Date().toLocaleDateString('es-UY', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
    doc.text(`Generado: ${fechaGeneracion}`, 14, 34)
    doc.setTextColor(0)

    // Preparar datos de la tabla según el tipo
    const { headers, data } = prepararDatosTabla(eventos, tipoEvento)

    // Generar tabla
    autoTable(doc, {
      startY: 40,
      head: [headers],
      body: data,
      theme: 'striped',
      headStyles: {
        fillColor: [59, 130, 246],
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 10
      },
      bodyStyles: {
        fontSize: 9
      },
      alternateRowStyles: {
        fillColor: [245, 247, 250]
      },
      columnStyles: {
        0: { cellWidth: 25 },
      },
      margin: { top: 40, left: 14, right: 14 },
      didDrawPage: (data: any) => {
        const pageCount = doc.getNumberOfPages()
        doc.setFontSize(8)
        doc.setTextColor(150)
        doc.text(
          `Página ${data.pageNumber} de ${pageCount}`,
          doc.internal.pageSize.width / 2,
          doc.internal.pageSize.height - 10,
          { align: 'center' }
        )
      }
    })

    // Footer
    const finalY = (doc as any).lastAutoTable.finalY + 10
    doc.setFontSize(8)
    doc.setTextColor(128, 128, 128)
    doc.text('Generado por Bot Rural - botrural.vercel.app', 14, finalY)

    return Buffer.from(doc.output('arraybuffer'))
  } catch (error) {
    console.error('Error generando PDF:', error)
    return null
  }
}

/**
 * Prepara los datos para la tabla según el tipo de evento
 */
function prepararDatosTabla(eventos: any[], tipoEvento: string): { headers: string[], data: any[][] } {
  const formatFecha = (fecha: Date) => fecha.toLocaleDateString('es-UY', {
    day: '2-digit', month: '2-digit', year: '2-digit'
  })

  switch (tipoEvento) {
    case 'LLUVIA':
      return {
        headers: ['Fecha', 'mm'],
        data: eventos.map(e => [
          formatFecha(e.fecha),
          e.cantidad ? `${e.cantidad}` : '-'
        ])
      }

    case 'TRATAMIENTO':
    case 'MANEJO':
      return {
        headers: ['Fecha', 'Descripción', 'Potrero'],
        data: eventos.map(e => [
          formatFecha(e.fecha),
          e.descripcion || '-',
          e.lote?.nombre || '-'
        ])
      }

    case 'NACIMIENTO':
    case 'MORTANDAD':
      return {
        headers: ['Fecha', 'Cantidad', 'Categoría', 'Potrero'],
        data: eventos.map(e => [
          formatFecha(e.fecha),
          e.cantidad?.toString() || '-',
          e.categoria || '-',
          e.lote?.nombre || '-'
        ])
      }

    case 'TACTO':
      return {
        headers: ['Fecha', 'Tactadas', 'Preñadas', '%', 'Potrero'],
        data: eventos.map(e => {
          const { preñadas, porcentaje } = extraerDatosTacto(e)
          return [
            formatFecha(e.fecha),
            e.cantidad?.toString() || '-',
            preñadas,
            porcentaje ? `${porcentaje}%` : '-',
            e.lote?.nombre || '-'
          ]
        })
      }

    case 'DAO':
      return {
        headers: ['Fecha', 'Total', 'Preñadas', 'Ciclando', 'Anestro S', 'Anestro P', 'Potrero'],
        data: eventos.map(e => {
          const metadata = e.metadata as any
          return [
            formatFecha(e.fecha),
            e.cantidad?.toString() || '-',
            metadata?.prenado?.toString() || '-',
            metadata?.ciclando?.toString() || '-',
            metadata?.anestroSuperficial?.toString() || '0',
            metadata?.anestroProfundo?.toString() || '0',
            e.lote?.nombre || '-'
          ]
        })
      }

    case 'VENTA':
    case 'COMPRA':
      return {
        headers: ['Fecha', 'Cantidad', 'Categoría', 'Monto'],
        data: eventos.map(e => [
          formatFecha(e.fecha),
          e.cantidad?.toString() || '-',
          e.categoria || '-',
          e.monto ? `$${e.monto.toLocaleString('es-UY')}` : '-'
        ])
      }

    case 'CAMBIO_POTRERO':
      return {
        headers: ['Fecha', 'Cantidad', 'Categoría', 'Descripción'],
        data: eventos.map(e => [
          formatFecha(e.fecha),
          e.cantidad?.toString() || '-',
          e.categoria || '-',
          e.descripcion || '-'
        ])
      }

    default:
      return {
        headers: ['Fecha', 'Descripción', 'Potrero'],
        data: eventos.map(e => [
          formatFecha(e.fecha),
          e.descripcion || '-',
          e.lote?.nombre || '-'
        ])
      }
  }
}

/**
 * Sube el PDF a Supabase Storage
 */
async function subirPDFaSupabase(pdfBuffer: Buffer, tipoNombre: string): Promise<string | null> {
  try {
    const fecha = new Date().toISOString().split('T')[0]
    const nombreArchivo = `reportes/consulta_${tipoNombre.toLowerCase()}_${fecha}_${Date.now()}.pdf`

    const supabase = getSupabaseClient()
    const { error } = await supabase.storage
      .from('invoices')
      .upload(nombreArchivo, pdfBuffer, {
        contentType: 'application/pdf',
        cacheControl: '3600'
      })

    if (error) {
      console.error('❌ Error subiendo PDF:', error)
      return null
    }

    const { data: urlData } = supabase.storage
      .from('invoices')
      .getPublicUrl(nombreArchivo)

    console.log('✅ PDF subido:', urlData.publicUrl)
    return urlData.publicUrl

  } catch (error) {
    console.error('Error en subirPDFaSupabase:', error)
    return null
  }
}

/**
 * Envía las fotos adjuntas de los eventos (máximo 10)
 */
async function enviarFotosAdjuntas(phoneNumber: string, eventos: any[], tipoNombre: string) {
  console.log(`📷 Buscando fotos en ${eventos.length} eventos...`)
  const eventosConFoto = eventos.filter(e => e.imageUrl)
  console.log(`📷 Encontré ${eventosConFoto.length} eventos con foto`)
  if (eventosConFoto.length > 0) {
    console.log(`📷 Primera foto URL: ${eventosConFoto[0].imageUrl}`)
  }
  if (eventosConFoto.length === 0) return

  const MAX_FOTOS = 10
  const fotosAEnviar = eventosConFoto.slice(0, MAX_FOTOS)

  for (const evento of fotosAEnviar) {
    const fechaFoto = evento.fecha.toLocaleDateString('es-UY', { day: '2-digit', month: '2-digit', year: '2-digit' })
    const desc = evento.descripcion || evento.categoria || tipoNombre
    await sendWhatsAppImage(phoneNumber, evento.imageUrl, `📷 ${fechaFoto} - ${desc}`)
  }

  if (eventosConFoto.length > MAX_FOTOS) {
    await sendWhatsAppMessage(
      phoneNumber,
      `📷 Hay ${eventosConFoto.length - MAX_FOTOS} fotos más. Consultalas en la web.`
    )
  }
}

/**
 * Fallback: envía como texto resumido si falla el PDF
 */
async function enviarComoTextoResumido(
  phoneNumber: string,
  eventos: any[],
  tipoEvento: string
) {
  const icono = ICONOS[tipoEvento] || '📊'
  const tipoNombre = NOMBRES_TIPO[tipoEvento] || tipoEvento

  let mensaje = `${icono} *${tipoNombre}* (${eventos.length} registros)\n\n`
  mensaje += `_Mostrando primeros 15:_\n\n`

  for (const evento of eventos.slice(0, 15)) {
    mensaje += formatearEvento(evento, tipoEvento)
  }

  if (eventos.length > 15) {
    mensaje += `\n_...y ${eventos.length - 15} más_`
  }

  await sendWhatsAppMessage(phoneNumber, mensaje)
}
