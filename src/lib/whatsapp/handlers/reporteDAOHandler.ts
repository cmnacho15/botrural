// src/lib/whatsapp/handlers/reporteDAOHandler.ts

import { prisma } from "@/lib/prisma"
import { sendWhatsAppMessage, sendWhatsAppDocument } from "../sendMessage"
import { createClient } from "@supabase/supabase-js"

// Función para obtener cliente Supabase (lazy init)
function getSupabaseClient() {
  return createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

/**
 * Genera el PDF de DAOs en el servidor usando jsPDF
 */
async function generarPDFDAO(campoId: string): Promise<Buffer | null> {
  try {
    const { jsPDF } = await import('jspdf')
    const autoTable = (await import('jspdf-autotable')).default

    const campo = await prisma.campo.findUnique({ where: { id: campoId } })
    if (!campo) return null

    // Obtener todos los eventos de tipo DAO
    const eventos = await prisma.evento.findMany({
      where: { 
        campoId, 
        tipo: 'DAO' as any
      },
      include: {
        lote: { select: { nombre: true } },
        rodeo: { select: { nombre: true } },
        usuario: { select: { name: true } }
      },
      orderBy: { fecha: 'desc' }
    })

    if (eventos.length === 0) {
      return null
    }

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    const margin = 10

    function dibujarMarcaAgua() {
      doc.setFontSize(30)
      doc.setTextColor(235, 235, 235)
      doc.setFont('helvetica', 'bold')
      doc.text('BOTRURAL', pageWidth / 2, 16, { align: 'center' })
    }

    // Header
    doc.setFontSize(16)
    doc.setTextColor(0, 0, 0)
    doc.setFont('helvetica', 'bold')
    doc.text(`Establecimiento: ${campo.nombre}`, margin, 15)
    
    doc.setFontSize(14)
    doc.text('Historial de DAOs', margin, 23)
    
    const fecha = new Date()
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text(`Generado: ${fecha.toLocaleDateString('es-UY', { day: '2-digit', month: '2-digit', year: 'numeric' })}`, pageWidth - margin - 50, 15)
    
    dibujarMarcaAgua()

    // Preparar datos para la tabla
    const filasDatos: any[] = []

    eventos.forEach((e) => {
      if (!e.descripcion) return

      // Parsear descripción: "DAO en potrero X: Vacas: 50 examinadas (Preñadas: 30, Ciclando: 10...)"
      const categorias = e.descripcion.split(' | ')
      
      categorias.forEach(catText => {
        const matchCategoria = catText.match(/([^:]+):\s*(\d+)\s*examinadas\s*\(Preñadas?:\s*(\d+),\s*Ciclando:\s*(\d+),\s*Anestro Superficial:\s*(\d+),\s*Anestro Profundo:\s*(\d+)\)/)
        
        if (matchCategoria) {
          const categoria = matchCategoria[1].replace(/^.*en potrero[^:]*:\s*/, '').trim()
          const examinada = parseInt(matchCategoria[2])
          const prenado = parseInt(matchCategoria[3])
          const ciclando = parseInt(matchCategoria[4])
          const anestroSup = parseInt(matchCategoria[5])
          const anestroProf = parseInt(matchCategoria[6])
          
          // Calcular porcentajes
          const prenadoPct = examinada > 0 ? ((prenado / examinada) * 100).toFixed(1) : '0.0'
          const ciclandoPct = examinada > 0 ? ((ciclando / examinada) * 100).toFixed(1) : '0.0'
          const anestroSupPct = examinada > 0 ? ((anestroSup / examinada) * 100).toFixed(1) : '0.0'
          const anestroProfPct = examinada > 0 ? ((anestroProf / examinada) * 100).toFixed(1) : '0.0'

          const fechaFormato = new Date(e.fecha).toLocaleDateString('es-UY', { 
            day: '2-digit', 
            month: '2-digit', 
            year: 'numeric' 
          })

          filasDatos.push([
            fechaFormato,
            e.lote?.nombre || '',
            e.rodeo?.nombre || '',
            categoria,
            examinada.toString(),
            `${prenado} (${prenadoPct}%)`,
            `${ciclando} (${ciclandoPct}%)`,
            `${anestroSup} (${anestroSupPct}%)`,
            `${anestroProf} (${anestroProfPct}%)`,
            e.notas || ''
          ])
        }
      })
    })

    // Crear tabla
    const columnas = [
      { header: 'Fecha', key: 'fecha', width: 20 },
      { header: 'Potrero', key: 'potrero', width: 20 },
      { header: 'Lote', key: 'lote', width: 20 },
      { header: 'Categoría', key: 'categoria', width: 25 },
      { header: 'Exam.', key: 'examinada', width: 15 },
      { header: 'Preñado', key: 'prenado', width: 25 },
      { header: 'Ciclando', key: 'ciclando', width: 25 },
      { header: 'Anestro Sup.', key: 'anestroSup', width: 28 },
      { header: 'Anestro Prof.', key: 'anestroProf', width: 28 },
      { header: 'Notas', key: 'notas', width: 40 }
    ]

    autoTable(doc, {
      head: [columnas.map(c => c.header)],
      body: filasDatos,
      startY: 30,
      theme: 'grid',
      styles: { 
        fontSize: 7, 
        cellPadding: 1.5, 
        overflow: 'linebreak', 
        halign: 'center', 
        valign: 'middle' 
      },
      headStyles: { 
        fillColor: [147, 51, 234], // púrpura
        textColor: [255, 255, 255], 
        fontStyle: 'bold', 
        fontSize: 7 
      },
      columnStyles: {
        0: { cellWidth: 20 },  // Fecha
        1: { cellWidth: 20 },  // Potrero
        2: { cellWidth: 20 },  // Lote
        3: { cellWidth: 25, halign: 'left' },  // Categoría
        4: { cellWidth: 15 },  // Examinada
        5: { cellWidth: 25 },  // Preñado
        6: { cellWidth: 25 },  // Ciclando
        7: { cellWidth: 28 },  // Anestro Sup
        8: { cellWidth: 28 },  // Anestro Prof
        9: { cellWidth: 40, halign: 'left' }   // Notas
      },
      alternateRowStyles: {
        fillColor: [249, 250, 251]
      },
      didDrawPage: function() {
        dibujarMarcaAgua()
      },
      margin: { left: margin, right: margin }
    })

    const finalY = (doc as any).lastAutoTable.finalY + 10
    
    if (finalY < pageHeight - 15) {
      doc.setFontSize(8)
      doc.setTextColor(128, 128, 128)
      doc.text('Generado por Bot Rural - botrural.vercel.app', margin, finalY)
    }

    return Buffer.from(doc.output('arraybuffer'))
  } catch (error) {
    console.error('❌ Error generando PDF DAO:', error)
    return null
  }
}

/**
 * Sube el PDF a Supabase Storage y retorna la URL pública
 */
async function subirPDFaSupabase(pdfBuffer: Buffer, nombreCampo: string): Promise<string | null> {
  try {
    const fecha = new Date().toISOString().split('T')[0]
    const nombreArchivo = `reportes/dao_${nombreCampo.replace(/\s+/g, '_')}_${fecha}_${Date.now()}.pdf`

    const supabase = getSupabaseClient()
    const { data, error } = await supabase.storage
      .from('invoices')
      .upload(nombreArchivo, pdfBuffer, {
        contentType: 'application/pdf',
        cacheControl: '3600'
      })

    if (error) {
      console.error('❌ Error subiendo PDF a Supabase:', error)
      return null
    }

    // Obtener URL pública
    const { data: urlData } = supabase.storage
      .from('invoices')
      .getPublicUrl(nombreArchivo)

    console.log('✅ PDF DAO subido a Supabase:', urlData.publicUrl)
    return urlData.publicUrl

  } catch (error) {
    console.error('❌ Error en subirPDFaSupabase:', error)
    return null
  }
}

/**
 * Handler principal: genera y envía el PDF de DAOs por WhatsApp
 */
export async function handleReporteDAO(telefono: string) {
  try {
    // 1. Obtener usuario y campo
    const usuario = await prisma.user.findUnique({
      where: { telefono },
      include: { campo: true }
    })

    if (!usuario?.campoId || !usuario.campo) {
      await sendWhatsAppMessage(
        telefono,
        "❌ No tenés un campo configurado. Configuralo primero desde la web."
      )
      return
    }

    await sendWhatsAppMessage(
      telefono,
      "⏳ Generando PDF de historial de DAOs... Un momento."
    )

    // 2. Generar el PDF
    const pdfBuffer = await generarPDFDAO(usuario.campoId)

    if (!pdfBuffer) {
      await sendWhatsAppMessage(
        telefono,
        "❌ No hay DAOs registrados o hubo un error generando el PDF."
      )
      return
    }

    // 3. Subir a Supabase
    const pdfUrl = await subirPDFaSupabase(pdfBuffer, usuario.campo.nombre)

    if (!pdfUrl) {
      await sendWhatsAppMessage(
        telefono,
        "❌ Error subiendo el archivo. Intentá de nuevo más tarde."
      )
      return
    }

    // 4. Enviar el PDF por WhatsApp
    const fecha = new Date().toLocaleDateString('es-UY', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric' 
    })
    
    const nombreArchivo = `DAO_${usuario.campo.nombre.replace(/\s+/g, '_')}_${fecha.replace(/\//g, '-')}.pdf`
    
    await sendWhatsAppDocument(
      telefono,
      pdfUrl,
      nombreArchivo,
      `🔬 Historial de DAOs - ${usuario.campo.nombre}\n📅 ${fecha}`
    )

    console.log(`✅ PDF DAO enviado a ${telefono}`)

  } catch (error) {
    console.error("❌ Error en handleReporteDAO:", error)
    await sendWhatsAppMessage(
      telefono,
      "❌ Hubo un error generando el reporte. Intentá de nuevo más tarde."
    )
  }
}