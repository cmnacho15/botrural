// src/lib/whatsapp/handlers/reporteCargaHandler.ts

import { prisma } from "@/lib/prisma"
import { sendWhatsAppMessage, sendWhatsAppDocument } from "../sendMessage"
import { EQUIVALENCIAS_UG } from "@/lib/ugCalculator"
import { createClient } from "@supabase/supabase-js"

// Función para obtener cliente Supabase (lazy init)
function getSupabaseClient() {
  return createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// Obtener equivalencia UG de una categoría
function getEquivalenciaUG(categoria: string): number {
  return EQUIVALENCIAS_UG[categoria] || 0
}

/**
 * Genera el PDF de carga en el servidor usando jsPDF
 */
async function generarPDFCarga(campoId: string): Promise<Buffer | null> {
  try {
    // Importar jsPDF dinámicamente (solo en servidor)
    const { jsPDF } = await import('jspdf')
    const autoTable = (await import('jspdf-autotable')).default

    // Obtener datos del campo
    const campo = await prisma.campo.findUnique({
      where: { id: campoId }
    })

    if (!campo) return null

    // Obtener potreros con animales
    const lotes = await prisma.lote.findMany({
      where: { campoId },
      include: { animalesLote: true },
      orderBy: { nombre: 'asc' }
    })

    // Obtener categorías activas
    const categoriasDB = await prisma.categoriaAnimal.findMany({
      where: { campoId, activo: true },
      orderBy: [{ tipoAnimal: 'asc' }, { nombreSingular: 'asc' }]
    })

    // Procesar datos
    const todasCategorias = categoriasDB.map(c => ({
      nombre: c.nombreSingular,
      equivalenciaUG: getEquivalenciaUG(c.nombreSingular),
      tipo: c.tipoAnimal
    }))

    // Calcular totales por categoría
    const totalesPorCategoria: Record<string, number> = {}
    todasCategorias.forEach(c => { totalesPorCategoria[c.nombre] = 0 })

    let totalHectareas = 0
    let totalUG = 0

    const potrerosData = lotes.map(lote => {
      totalHectareas += lote.hectareas
      
      const animalesPorCategoria: Record<string, number> = {}
      todasCategorias.forEach(c => { animalesPorCategoria[c.nombre] = 0 })

      let ugPotrero = 0
      let vacunosPotrero = 0

      lote.animalesLote.forEach(animal => {
        const eq = getEquivalenciaUG(animal.categoria)
        ugPotrero += animal.cantidad * eq

        if (animalesPorCategoria[animal.categoria] !== undefined) {
          animalesPorCategoria[animal.categoria] += animal.cantidad
          totalesPorCategoria[animal.categoria] += animal.cantidad
        }

        // Verificar si es bovino
        const catDB = categoriasDB.find(c => c.nombreSingular === animal.categoria)
        if (catDB?.tipoAnimal === 'BOVINO') {
          vacunosPotrero += animal.cantidad * eq
        }
      })

      totalUG += ugPotrero
      const ugPorHa = lote.hectareas > 0 ? ugPotrero / lote.hectareas : 0

      return {
        nombre: lote.nombre,
        hectareas: lote.hectareas,
        animalesPorCategoria,
        ugPorHa,
        vacunosPotrero
      }
    })

    const ugPorHaGlobal = totalHectareas > 0 ? totalUG / totalHectareas : 0

    // Filtrar categorías con datos
    const categoriasConDatos = todasCategorias.filter(c => totalesPorCategoria[c.nombre] > 0)

    // Crear PDF
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    })

    const pageWidth = doc.internal.pageSize.getWidth()
    const margin = 10

    

// Header
doc.setFontSize(16)
doc.setTextColor(0, 0, 0)
doc.setFont('helvetica', 'bold')
doc.text(`Establecimiento: ${campo.nombre}`, margin, 15)

    // Fecha
    const fecha = new Date()
    doc.setFontSize(10)
    doc.text(
      `Generado: ${fecha.toLocaleDateString('es-UY', { day: '2-digit', month: '2-digit', year: 'numeric' })}`,
      pageWidth - margin - 50,
      22
    )

    // Headers de la tabla
    const headers = [
      'Potreros',
      'Ha',
      ...categoriasConDatos.map(c => c.nombre),
      'UG/Ha',
      'Vacunos'
    ]

    // Fila de equivalencias UG
    const filaEquivalencias = [
      'UG x Categoría',
      '',
      ...categoriasConDatos.map(c => c.equivalenciaUG.toFixed(2)),
      '',
      ''
    ]

    // Filas de datos
    const filasDatos = potrerosData.map(potrero => {
      return [
        potrero.nombre,
        potrero.hectareas.toFixed(0),
        ...categoriasConDatos.map(c => {
          const cantidad = potrero.animalesPorCategoria[c.nombre] || 0
          return cantidad > 0 ? cantidad.toString() : ''
        }),
        potrero.ugPorHa.toFixed(2),
        potrero.vacunosPotrero.toFixed(2)
      ]
    })

    // Calcular totales vacunos
    let totalVacunos = 0
    potrerosData.forEach(p => { totalVacunos += p.vacunosPotrero })

    // Fila de totales
    const filaTotales = [
      'TOTAL:',
      totalHectareas.toFixed(0),
      ...categoriasConDatos.map(c => {
        const total = totalesPorCategoria[c.nombre] || 0
        return total > 0 ? total.toString() : ''
      }),
      ugPorHaGlobal.toFixed(2),
      totalVacunos.toFixed(2)
    ]

    // Generar tabla
    autoTable(doc, {
      head: [headers, filaEquivalencias],
      body: [...filasDatos, filaTotales],
      startY: 28,
      theme: 'grid',
      styles: {
        fontSize: 7,
        cellPadding: 1.5,
        overflow: 'linebreak',
        halign: 'center',
        valign: 'middle'
      },
      headStyles: {
        fillColor: [245, 245, 220],
        textColor: [0, 0, 0],
        fontStyle: 'bold',
        fontSize: 6
      },
      columnStyles: {
        0: { halign: 'left', cellWidth: 25 },
        1: { cellWidth: 12 }
      },
      didParseCell: function(data: any) {
        // Fila de equivalencias UG
        if (data.section === 'head' && data.row.index === 1) {
          data.cell.styles.fillColor = [255, 255, 200]
          data.cell.styles.fontStyle = 'normal'
        }
        
        // Fila de totales
        if (data.section === 'body' && data.row.index === filasDatos.length) {
          data.cell.styles.fillColor = [200, 255, 200]
          data.cell.styles.fontStyle = 'bold'
        }
        
        // Colorear UG/Ha según valor
        if (data.section === 'body' && data.column.index === headers.length - 2) {
          const valor = parseFloat(data.cell.raw) || 0
          if (valor === 0) {
            data.cell.styles.textColor = [150, 150, 150]
          } else if (valor < 0.7) {
            data.cell.styles.textColor = [0, 100, 200]
          } else if (valor <= 1.5) {
            data.cell.styles.textColor = [0, 150, 0]
          } else if (valor <= 2.0) {
            data.cell.styles.textColor = [200, 150, 0]
          } else {
            data.cell.styles.textColor = [200, 0, 0]
          }
        }
      },
      margin: { left: margin, right: margin }
    })

    // Marca de agua diagonal sobre todo el documento
    doc.setFontSize(100)
    doc.setTextColor(250, 250, 250)
    doc.setFont('helvetica', 'bold')
    const pageHeight = doc.internal.pageSize.getHeight()
    doc.text('BOTRURAL', pageWidth / 2, pageHeight / 2, { angle: 45, align: 'center' })

    // Footer
    const finalY = (doc as any).lastAutoTable.finalY + 10
    doc.setFontSize(8)
    doc.setTextColor(128, 128, 128)
    doc.text('Generado por Bot Rural - botrural.vercel.app', margin, finalY)

    // Convertir a Buffer
    const pdfArrayBuffer = doc.output('arraybuffer')
    return Buffer.from(pdfArrayBuffer)

  } catch (error) {
    console.error('❌ Error generando PDF:', error)
    return null
  }
}

/**
 * Sube el PDF a Supabase Storage y retorna la URL pública
 */
async function subirPDFaSupabase(pdfBuffer: Buffer, nombreCampo: string): Promise<string | null> {
  try {
    const fecha = new Date().toISOString().split('T')[0]
    const nombreArchivo = `reportes/carga_${nombreCampo.replace(/\s+/g, '_')}_${fecha}_${Date.now()}.pdf`

    const supabase = getSupabaseClient()
const { data, error } = await supabase.storage
      .from('invoices') // Usar el mismo bucket que ya tenés
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

    console.log('✅ PDF subido a Supabase:', urlData.publicUrl)
    return urlData.publicUrl

  } catch (error) {
    console.error('❌ Error en subirPDFaSupabase:', error)
    return null
  }
}

/**
 * Handler principal: genera y envía el PDF de carga actual por WhatsApp
 */
export async function handleReporteCarga(telefono: string) {
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
      "⏳ Generando PDF de carga actual... Un momento."
    )

    // 2. Generar el PDF
    const pdfBuffer = await generarPDFCarga(usuario.campoId)

    if (!pdfBuffer) {
      await sendWhatsAppMessage(
        telefono,
        "❌ Error generando el PDF. Intentá de nuevo más tarde."
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
    
    const nombreArchivo = `Carga_${usuario.campo.nombre.replace(/\s+/g, '_')}_${fecha.replace(/\//g, '-')}.pdf`
    
    await sendWhatsAppDocument(
      telefono,
      pdfUrl,
      nombreArchivo,
      `📊 Reporte de Carga Actual - ${usuario.campo.nombre}\n📅 ${fecha}`
    )

    console.log(`✅ PDF de carga enviado a ${telefono}`)

  } catch (error) {
    console.error("❌ Error en handleReporteCarga:", error)
    await sendWhatsAppMessage(
      telefono,
      "❌ Hubo un error generando el reporte. Intentá de nuevo más tarde."
    )
  }
}