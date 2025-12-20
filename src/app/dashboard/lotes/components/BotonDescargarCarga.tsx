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
    ovinosTotales: number
    equinosTotales: number
  }>
  totales: {
    hectareas: number
    porCategoria: Record<string, number>
    ugTotales: number
    vacunosTotales: number
    ovinosTotales: number
    equinosTotales: number
    ugPorHa: number
  }
  fecha: string
}

export default function BotonDescargarCarga() {
  const [descargando, setDescargando] = useState(false)

  async function descargarPDF() {
    setDescargando(true)

    try {
      // 1. Cargar el logo en paralelo con los datos
      const dataResponse = await fetch('/api/reportes/carga-actual')

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

      // Header
      doc.setFontSize(16)
      doc.setTextColor(0, 0, 0)
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

      // ========== TABLA 1: VACUNOS ==========
      const categoriasBovinas = data.categorias.bovinas.filter(cat => {
        return data.potreros.some(p => (p.animalesPorCategoria[cat.nombre] || 0) > 0) ||
               (data.totales.porCategoria[cat.nombre] || 0) > 0
      })

      const headersBovinos = [
        'Potreros',
        'Ha',
        ...categoriasBovinas.map(c => c.nombre),
        'Total Vacunos',
        'UG/Ha (Vac+Ovi+Equ)'
      ]

      const filaEquivalenciasBovinos = [
        'UG x Categoría',
        '',
        ...categoriasBovinas.map(c => c.equivalenciaUG.toFixed(2)),
        '',
        ''
      ]

      const filasDatosBovinos = data.potreros.map(potrero => {
        return [
          potrero.nombre,
          potrero.hectareas.toFixed(0),
          ...categoriasBovinas.map(c => {
            const cantidad = potrero.animalesPorCategoria[c.nombre] || 0
            return cantidad > 0 ? cantidad.toString() : ''
          }),
          potrero.vacunosTotales.toString(),
          potrero.ugPorHa.toFixed(2)
        ]
      })

      const filaTotalesBovinos = [
        'TOTAL:',
        data.totales.hectareas.toFixed(0),
        ...categoriasBovinas.map(c => {
          const total = data.totales.porCategoria[c.nombre] || 0
          return total > 0 ? total.toString() : ''
        }),
        data.totales.vacunosTotales.toString(),
        data.totales.ugPorHa.toFixed(2)
      ]

      // Generar TABLA VACUNOS
      doc.setFontSize(12)
      doc.setFont('helvetica', 'bold')
      doc.text('VACUNOS', margin, 30)

      autoTable(doc, {
        head: [headersBovinos, filaEquivalenciasBovinos],
        body: [...filasDatosBovinos, filaTotalesBovinos],
        startY: 35,
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
          if (data.section === 'head' && data.row.index === 1) {
            data.cell.styles.fillColor = [255, 255, 200]
            data.cell.styles.fontStyle = 'normal'
          }
          
          if (data.section === 'body' && data.row.index === filasDatosBovinos.length) {
            data.cell.styles.fillColor = [200, 255, 200]
            data.cell.styles.fontStyle = 'bold'
          }
          
          // Columna UG/Ha está ahora al final
          if (data.section === 'body' && data.column.index === headersBovinos.length - 1) {
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
        didDrawPage: function(data: any) {
          // Marca de agua en cada página
          doc.setFontSize(30)
          doc.setTextColor(235, 235, 235)
          doc.setFont('helvetica', 'bold')
          doc.text('BOTRURAL', pageWidth / 2, 10, { align: 'center' })
        },
        margin: { left: margin, right: margin }
      })

      // ========== TABLA 2: OVINOS ==========
      const categoriasOvinas = data.categorias.ovinas.filter(cat => {
        return data.potreros.some(p => (p.animalesPorCategoria[cat.nombre] || 0) > 0) ||
               (data.totales.porCategoria[cat.nombre] || 0) > 0
      })

      const headersOvinos = [
        'Potreros',
        'Ha',
        ...categoriasOvinas.map(c => c.nombre),
        'Total Ovinos'
      ]

      const filaEquivalenciasOvinos = [
        'UG x Categoría',
        '',
        ...categoriasOvinas.map(c => c.equivalenciaUG.toFixed(2)),
        ''
      ]

      const filasDatosOvinos = data.potreros.map(potrero => {
        return [
          potrero.nombre,
          potrero.hectareas.toFixed(0),
          ...categoriasOvinas.map(c => {
            const cantidad = potrero.animalesPorCategoria[c.nombre] || 0
            return cantidad > 0 ? cantidad.toString() : ''
          }),
          potrero.ovinosTotales.toString()
        ]
      })

      const filaTotalesOvinos = [
        'TOTAL:',
        data.totales.hectareas.toFixed(0),
        ...categoriasOvinas.map(c => {
          const total = data.totales.porCategoria[c.nombre] || 0
          return total > 0 ? total.toString() : ''
        }),
        data.totales.ovinosTotales.toString()
      ]

      const startYOvinos = (doc as any).lastAutoTable.finalY + 10

      doc.setFontSize(12)
      doc.setFont('helvetica', 'bold')
      doc.text('OVINOS', margin, startYOvinos)

      autoTable(doc, {
        head: [headersOvinos, filaEquivalenciasOvinos],
        body: [...filasDatosOvinos, filaTotalesOvinos],
        startY: startYOvinos + 5,
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
          if (data.section === 'head' && data.row.index === 1) {
            data.cell.styles.fillColor = [255, 255, 200]
            data.cell.styles.fontStyle = 'normal'
          }
          
          if (data.section === 'body' && data.row.index === filasDatosOvinos.length) {
            data.cell.styles.fillColor = [200, 255, 200]
            data.cell.styles.fontStyle = 'bold'
          }
        },
        didDrawPage: function(data: any) {
          // Marca de agua en cada página
          doc.setFontSize(30)
          doc.setTextColor(235, 235, 235)
          doc.setFont('helvetica', 'bold')
          doc.text('BOTRURAL', pageWidth / 2, 10, { align: 'center' })
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