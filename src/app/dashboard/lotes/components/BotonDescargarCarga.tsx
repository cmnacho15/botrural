'use client'

import { useState } from 'react'

interface Categoria {
  nombre: string
  equivalenciaUG: number
}

interface ReporteCarga {
  campo: {
    nombre: string
    hectareasTotal: number
  }
  categorias: {
    bovinas: Categoria[]
    ovinas: Categoria[]
    equinas: Categoria[]
  }
  potreros: Array<{
    nombre: string
    hectareas: number
    animalesPorCategoria: Record<string, number>
    ugPorHa: number
    vacunosTotales: number
  }>
  totales: {
    hectareas: number
    porCategoria: Record<string, number>
    ugTotales: number
    vacunosTotales: number
    ugPorHa: number
  }
  fecha: string
}

/**
 * Carga el logo y lo convierte a Base64
 */
async function cargarLogoBase64(): Promise<string | null> {
  try {
    const response = await fetch('/BotRURAL.png')
    if (!response.ok) {
      console.warn('⚠️ Logo PNG no encontrado en /public/BotRURAL.png')
      return null
    }
    
    const blob = await response.blob()
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  } catch (error) {
    console.error('❌ Error cargando logo:', error)
    return null
  }
}

/**
 * Agrega marca de agua al PDF
 */
function agregarMarcaDeAgua(doc: any, logoBase64: string | null) {
  try {
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()

    if (logoBase64) {
      // Marca de agua con logo (centro de la página, semi-transparente)
      const logoWidth = 60
      const logoHeight = 60
      // AHORA (arriba, centrado horizontalmente):
const x = (pageWidth - logoWidth) / 2
const y = 5  // Arriba, cerca del header pero sin tocar el texto

      // Guardar estado gráfico
      doc.saveGraphicsState()
      
      // Aplicar transparencia
      doc.setGState(new doc.GState({ opacity: 0.1 }))
      
      // Agregar imagen
      doc.addImage(
        logoBase64,
        'PNG',
        x,
        y,
        logoWidth,
        logoHeight
      )
      
      // Restaurar estado gráfico
      doc.restoreGraphicsState()
    } else {
      // Marca de agua de texto alternativa
      doc.saveGraphicsState()
      doc.setGState(new doc.GState({ opacity: 0.1 }))
      doc.setFontSize(50)
      doc.setTextColor(128, 128, 128)
      doc.setFont('helvetica', 'bold')
      
      const texto = 'BOT RURAL'
      const textWidth = doc.getTextWidth(texto)
      doc.text(
        texto,
        (pageWidth - textWidth) / 2,
        pageHeight / 2,
        { angle: 45 }
      )
      
      doc.restoreGraphicsState()
    }
  } catch (error) {
    console.error('❌ Error agregando marca de agua:', error)
  }
}

export default function BotonDescargarCarga() {
  const [descargando, setDescargando] = useState(false)

  async function descargarPDF() {
    setDescargando(true)

    try {
      // 1. Cargar el logo en paralelo con los datos
      const [dataResponse, logoBase64] = await Promise.all([
        fetch('/api/reportes/carga-actual'),
        cargarLogoBase64()
      ])

      if (!dataResponse.ok) {
        const errorData = await dataResponse.text()
        console.error('Error API:', dataResponse.status, errorData)
        throw new Error(`Error obteniendo datos: ${dataResponse.status}`)
      }
      
      const data: ReporteCarga = await dataResponse.json()
      console.log('Datos recibidos:', data)

      // 2. Importar jsPDF dinámicamente
      const jsPDFModule = await import('jspdf')
      const jsPDF = jsPDFModule.default
      const autoTable = (await import('jspdf-autotable')).default

      // 3. Crear el PDF en landscape para que entre toda la tabla
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      })

      const pageWidth = doc.internal.pageSize.getWidth()
      const margin = 10

      // ========== AGREGAR MARCA DE AGUA ==========
      agregarMarcaDeAgua(doc, logoBase64)
      // ===========================================

      // Header
      doc.setFontSize(16)
      doc.setFont('helvetica', 'bold')
      doc.text(`Establecimiento: ${data.campo.nombre}`, margin, 15)

      doc.setFontSize(12)
      doc.setFont('helvetica', 'normal')
      doc.text(`TOTAL UG/ha: ${data.totales.ugPorHa.toFixed(2)}`, pageWidth - margin - 50, 15)

      // Fecha
      const fecha = new Date(data.fecha)
      doc.setFontSize(10)
      doc.text(
        `Generado: ${fecha.toLocaleDateString('es-UY', { day: '2-digit', month: '2-digit', year: 'numeric' })}`,
        pageWidth - margin - 50,
        22
      )

      // Construir columnas de la tabla
      const todasCategorias = [
        ...data.categorias.bovinas,
        ...data.categorias.ovinas,
        ...data.categorias.equinas
      ]

      // Filtrar solo categorías que tienen al menos 1 animal en algún potrero
      const categoriasConDatos = todasCategorias.filter(cat => {
        return data.potreros.some(p => (p.animalesPorCategoria[cat.nombre] || 0) > 0) ||
               (data.totales.porCategoria[cat.nombre] || 0) > 0
      })

      // Crear headers de la tabla
      const headers = [
        'Potreros',
        'Ha',
        ...categoriasConDatos.map(c => c.nombre),
        'UG/Ha',
        'Vacunos'
      ]

      // Crear fila de equivalencias UG
      const filaEquivalencias = [
        'UG x Categoría',
        '',
        ...categoriasConDatos.map(c => c.equivalenciaUG.toFixed(2)),
        '',
        ''
      ]

      // Crear filas de datos
      const filasDatos = data.potreros.map(potrero => {
        return [
          potrero.nombre,
          potrero.hectareas.toFixed(0),
          ...categoriasConDatos.map(c => {
            const cantidad = potrero.animalesPorCategoria[c.nombre] || 0
            return cantidad > 0 ? cantidad.toString() : ''
          }),
          potrero.ugPorHa.toFixed(2),
          potrero.vacunosTotales.toFixed(2)
        ]
      })

      // Crear fila de totales
      const filaTotales = [
        'TOTAL:',
        data.totales.hectareas.toFixed(0),
        ...categoriasConDatos.map(c => {
          const total = data.totales.porCategoria[c.nombre] || 0
          return total > 0 ? total.toString() : ''
        }),
        data.totales.ugPorHa.toFixed(2),
        data.totales.vacunosTotales.toFixed(2)
      ]

      // Generar la tabla con autoTable
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
          fillColor: [245, 245, 220], // Beige como en la imagen
          textColor: [0, 0, 0],
          fontStyle: 'bold',
          fontSize: 6
        },
        columnStyles: {
          0: { halign: 'left', cellWidth: 25 }, // Potreros
          1: { cellWidth: 12 } // Ha
        },
        didParseCell: function(data: any) {
          // Fila de equivalencias UG (segunda fila del header)
          if (data.section === 'head' && data.row.index === 1) {
            data.cell.styles.fillColor = [255, 255, 200] // Amarillo claro
            data.cell.styles.fontStyle = 'normal'
          }
          
          // Fila de totales (última fila del body)
          if (data.section === 'body' && data.row.index === filasDatos.length) {
            data.cell.styles.fillColor = [200, 255, 200] // Verde claro
            data.cell.styles.fontStyle = 'bold'
          }
          
          // Columna UG/Ha - colorear según valor
          if (data.section === 'body' && data.column.index === headers.length - 2) {
            const valor = parseFloat(data.cell.raw) || 0
            if (valor === 0) {
              data.cell.styles.textColor = [150, 150, 150] // Gris
            } else if (valor < 0.7) {
              data.cell.styles.textColor = [0, 100, 200] // Azul
            } else if (valor <= 1.5) {
              data.cell.styles.textColor = [0, 150, 0] // Verde
            } else if (valor <= 2.0) {
              data.cell.styles.textColor = [200, 150, 0] // Naranja
            } else {
              data.cell.styles.textColor = [200, 0, 0] // Rojo
            }
          }
        },
        margin: { left: margin, right: margin }
      })

      // Footer
      const finalY = (doc as any).lastAutoTable.finalY + 10
      doc.setFontSize(8)
      doc.setTextColor(128, 128, 128)
      doc.text('Generado por Bot Rural - botrural.vercel.app', margin, finalY)

      // 4. Descargar el PDF
      const nombreArchivo = `carga_${data.campo.nombre.replace(/\s+/g, '_')}_${fecha.toISOString().split('T')[0]}.pdf`
      doc.save(nombreArchivo)

    } catch (error: any) {
      console.error('Error generando PDF:', error)
      alert(`Error al generar el PDF: ${error.message || 'Error desconocido'}`)
    } finally {
      setDescargando(false)
    }
  }

  return (
    <button
      onClick={descargarPDF}
      disabled={descargando}
      className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-100 text-gray-800 shadow-sm transition text-sm disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {descargando ? (
        <>
          <span className="animate-spin">⏳</span> Generando...
        </>
      ) : (
        <>
          <span className="text-lg">📥</span> Descargar Carga Actual
        </>
      )}
    </button>
  )
}