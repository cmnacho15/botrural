//src/app/dashboard/lotes/components/BotonDescargarCarga.tsx

'use client'

import { useState } from 'react'

interface Categoria {
  nombre: string
  equivalenciaUG: number
}

interface Potrero {
  nombre: string
  hectareas: number
  animalesPorCategoria: Record<string, number>
  ugPorHa: number
  ugTotales?: number
  vacunosTotales: number
  ovinosTotales: number
  equinosTotales: number
  tieneAnimales?: boolean
}

interface Modulo {
  id: string
  nombre: string
  hectareas: number
  ugPorHa: number
  cantidadPotreros: number
  potreros: Potrero[]
}

interface ReporteCargaModulos {
  campo: { nombre: string; hectareasTotal: number }
  categorias: { bovinas: Categoria[]; ovinas: Categoria[]; equinas: Categoria[] }
  modulos: Modulo[]
  restoDelCampo: Modulo | null
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

interface ReporteCargaOriginal {
  campo: { nombre: string; hectareasTotal: number }
  categorias: { bovinas: Categoria[]; ovinas: Categoria[]; equinas: Categoria[] }
  potreros: Potrero[]
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

type ReporteCarga = ReporteCargaModulos | ReporteCargaOriginal

function tieneModulos(data: ReporteCarga): data is ReporteCargaModulos {
  return 'modulos' in data
}

export default function BotonDescargarCarga() {
  const [descargando, setDescargando] = useState(false)

  async function descargarPDF() {
    setDescargando(true)

    try {
      const dataResponse = await fetch('/api/reportes/carga-actual')

      if (!dataResponse.ok) {
        const errorData = await dataResponse.text()
        console.error('Error API:', dataResponse.status, errorData)
        throw new Error(`Error obteniendo datos: ${dataResponse.status}`)
      }

      const data: ReporteCarga = await dataResponse.json()
      console.log('Datos recibidos:', data)

      const jsPDFModule = await import('jspdf')
      const jsPDF = jsPDFModule.default
      const autoTable = (await import('jspdf-autotable')).default

      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      })

      const pageWidth = doc.internal.pageSize.getWidth()
      const pageHeight = doc.internal.pageSize.getHeight()
      const margin = 10

      // Marca de agua
      function dibujarMarcaAgua() {
        doc.setFontSize(30)
        doc.setTextColor(235, 235, 235)
        doc.setFont('helvetica', 'bold')
        doc.text('BOTRURAL', pageWidth / 2, 16, { align: 'center' })
      }

      // Header principal
      doc.setFontSize(16)
      doc.setTextColor(0, 0, 0)
      doc.setFont('helvetica', 'bold')
      doc.text(`Establecimiento: ${data.campo.nombre}`, margin, 15)

      doc.setFontSize(12)
      doc.setFont('helvetica', 'normal')
      doc.text(`TOTAL UG/ha: ${data.totales.ugPorHa.toFixed(2)}`, pageWidth - margin - 50, 15)

      const fecha = new Date(data.fecha)
      doc.setFontSize(10)
      doc.text(
        `Generado: ${fecha.toLocaleDateString('es-UY', { day: '2-digit', month: '2-digit', year: 'numeric' })}`,
        pageWidth - margin - 50,
        22
      )

      dibujarMarcaAgua()

      if (tieneModulos(data)) {
        // ========== FORMATO NUEVO: POR MÓDULOS ==========
        let currentY = 30

        function generarTablaModulo(modulo: Modulo, startY: number): number {
          if (startY > pageHeight - 60) {
            doc.addPage()
            dibujarMarcaAgua()
            startY = 20
          }

          // Título del módulo
          doc.setFontSize(11)
          doc.setFont('helvetica', 'bold')
          doc.setTextColor(0, 0, 0)
          doc.text(`MODULO: ${modulo.nombre}`, margin, startY)

          doc.setFontSize(9)
          doc.setFont('helvetica', 'normal')
          doc.setTextColor(100, 100, 100)
          doc.text(
            `${modulo.cantidadPotreros} potrero${modulo.cantidadPotreros !== 1 ? 's' : ''} | ${modulo.hectareas.toFixed(0)} ha | ${modulo.ugPorHa.toFixed(2)} UG/ha`,
            margin + 50,
            startY
          )

          startY += 5

          // Filtrar categorías con animales en este módulo
          const categoriasBovinas = data.categorias.bovinas.filter(cat =>
            modulo.potreros.some(p => (p.animalesPorCategoria[cat.nombre] || 0) > 0)
          )
          const categoriasOvinas = data.categorias.ovinas.filter(cat =>
            modulo.potreros.some(p => (p.animalesPorCategoria[cat.nombre] || 0) > 0)
          )
          const categoriasEquinas = data.categorias.equinas.filter(cat =>
            modulo.potreros.some(p => (p.animalesPorCategoria[cat.nombre] || 0) > 0)
          )

          // TABLA VACUNOS
          if (categoriasBovinas.length > 0) {
            const headers = ['Potrero', 'Ha', ...categoriasBovinas.map(c => c.nombre), 'Total', 'UG/Ha']
            const filaEq = ['UG x Cat', '', ...categoriasBovinas.map(c => c.equivalenciaUG.toFixed(2)), '', '']

            const filasDatos = modulo.potreros.map(p => [
              p.nombre,
              p.hectareas.toFixed(0),
              ...categoriasBovinas.map(c => {
                const cant = p.animalesPorCategoria[c.nombre] || 0
                return cant > 0 ? cant.toString() : ''
              }),
              p.vacunosTotales.toString(),
              p.ugPorHa.toFixed(2)
            ])

            const totMod = {
              ha: modulo.potreros.reduce((s, p) => s + p.hectareas, 0),
              vac: modulo.potreros.reduce((s, p) => s + p.vacunosTotales, 0),
              cat: {} as Record<string, number>
            }
            categoriasBovinas.forEach(c => {
              totMod.cat[c.nombre] = modulo.potreros.reduce((s, p) => s + (p.animalesPorCategoria[c.nombre] || 0), 0)
            })

            const filaTot = [
              'TOTAL', totMod.ha.toFixed(0),
              ...categoriasBovinas.map(c => totMod.cat[c.nombre] > 0 ? totMod.cat[c.nombre].toString() : ''),
              totMod.vac.toString(),
              modulo.ugPorHa.toFixed(2)
            ]

            autoTable(doc, {
              head: [headers, filaEq],
              body: [...filasDatos, filaTot],
              startY,
              theme: 'grid',
              styles: { fontSize: 6, cellPadding: 1, halign: 'center', valign: 'middle' },
              headStyles: { fillColor: [245, 245, 220], textColor: [0, 0, 0], fontStyle: 'bold', fontSize: 5 },
              columnStyles: { 0: { halign: 'left', cellWidth: 22 }, 1: { cellWidth: 10 } },
              didParseCell: function(cellData: any) {
                if (cellData.section === 'head' && cellData.row.index === 1) {
                  cellData.cell.styles.fillColor = [255, 255, 200]
                  cellData.cell.styles.fontStyle = 'normal'
                }
                if (cellData.section === 'body' && cellData.row.index === filasDatos.length) {
                  cellData.cell.styles.fillColor = [200, 255, 200]
                  cellData.cell.styles.fontStyle = 'bold'
                }
                if (cellData.section === 'body' && cellData.column.index === headers.length - 1) {
                  const valor = parseFloat(cellData.cell.raw) || 0
                  if (valor === 0) cellData.cell.styles.textColor = [150, 150, 150]
                  else if (valor < 0.7) cellData.cell.styles.textColor = [0, 100, 200]
                  else if (valor <= 1.5) cellData.cell.styles.textColor = [0, 150, 0]
                  else if (valor <= 2.0) cellData.cell.styles.textColor = [200, 150, 0]
                  else cellData.cell.styles.textColor = [200, 0, 0]
                }
              },
              margin: { left: margin, right: margin }
            })
            startY = (doc as any).lastAutoTable.finalY + 3
          }

          // TABLA OVINOS
          if (categoriasOvinas.length > 0) {
            if (startY > pageHeight - 40) {
              doc.addPage()
              dibujarMarcaAgua()
              startY = 20
            }

            const headers = ['Potrero', 'Ha', ...categoriasOvinas.map(c => c.nombre), 'Total']
            const filaEq = ['UG x Cat', '', ...categoriasOvinas.map(c => c.equivalenciaUG.toFixed(2)), '']

            const filasDatos = modulo.potreros.map(p => [
              p.nombre,
              p.hectareas.toFixed(0),
              ...categoriasOvinas.map(c => {
                const cant = p.animalesPorCategoria[c.nombre] || 0
                return cant > 0 ? cant.toString() : ''
              }),
              p.ovinosTotales.toString()
            ])

            const totMod = {
              ha: modulo.potreros.reduce((s, p) => s + p.hectareas, 0),
              ovi: modulo.potreros.reduce((s, p) => s + p.ovinosTotales, 0),
              cat: {} as Record<string, number>
            }
            categoriasOvinas.forEach(c => {
              totMod.cat[c.nombre] = modulo.potreros.reduce((s, p) => s + (p.animalesPorCategoria[c.nombre] || 0), 0)
            })

            const filaTot = [
              'TOTAL', totMod.ha.toFixed(0),
              ...categoriasOvinas.map(c => totMod.cat[c.nombre] > 0 ? totMod.cat[c.nombre].toString() : ''),
              totMod.ovi.toString()
            ]

            doc.setFontSize(8)
            doc.setFont('helvetica', 'italic')
            doc.setTextColor(80, 80, 80)
            doc.text('Ovinos:', margin, startY)
            startY += 3

            autoTable(doc, {
              head: [headers, filaEq],
              body: [...filasDatos, filaTot],
              startY,
              theme: 'grid',
              styles: { fontSize: 6, cellPadding: 1, halign: 'center', valign: 'middle' },
              headStyles: { fillColor: [220, 235, 245], textColor: [0, 0, 0], fontStyle: 'bold', fontSize: 5 },
              columnStyles: { 0: { halign: 'left', cellWidth: 22 }, 1: { cellWidth: 10 } },
              didParseCell: function(cellData: any) {
                if (cellData.section === 'head' && cellData.row.index === 1) {
                  cellData.cell.styles.fillColor = [235, 245, 255]
                  cellData.cell.styles.fontStyle = 'normal'
                }
                if (cellData.section === 'body' && cellData.row.index === filasDatos.length) {
                  cellData.cell.styles.fillColor = [200, 255, 200]
                  cellData.cell.styles.fontStyle = 'bold'
                }
              },
              margin: { left: margin, right: margin }
            })
            startY = (doc as any).lastAutoTable.finalY + 3
          }

          // TABLA EQUINOS
          if (categoriasEquinas.length > 0) {
            if (startY > pageHeight - 40) {
              doc.addPage()
              dibujarMarcaAgua()
              startY = 20
            }

            const headers = ['Potrero', 'Ha', ...categoriasEquinas.map(c => c.nombre), 'Total']
            const filaEq = ['UG x Cat', '', ...categoriasEquinas.map(c => c.equivalenciaUG.toFixed(2)), '']

            const filasDatos = modulo.potreros.map(p => [
              p.nombre,
              p.hectareas.toFixed(0),
              ...categoriasEquinas.map(c => {
                const cant = p.animalesPorCategoria[c.nombre] || 0
                return cant > 0 ? cant.toString() : ''
              }),
              p.equinosTotales.toString()
            ])

            const totMod = {
              ha: modulo.potreros.reduce((s, p) => s + p.hectareas, 0),
              equ: modulo.potreros.reduce((s, p) => s + p.equinosTotales, 0),
              cat: {} as Record<string, number>
            }
            categoriasEquinas.forEach(c => {
              totMod.cat[c.nombre] = modulo.potreros.reduce((s, p) => s + (p.animalesPorCategoria[c.nombre] || 0), 0)
            })

            const filaTot = [
              'TOTAL', totMod.ha.toFixed(0),
              ...categoriasEquinas.map(c => totMod.cat[c.nombre] > 0 ? totMod.cat[c.nombre].toString() : ''),
              totMod.equ.toString()
            ]

            doc.setFontSize(8)
            doc.setFont('helvetica', 'italic')
            doc.setTextColor(80, 80, 80)
            doc.text('Equinos:', margin, startY)
            startY += 3

            autoTable(doc, {
              head: [headers, filaEq],
              body: [...filasDatos, filaTot],
              startY,
              theme: 'grid',
              styles: { fontSize: 6, cellPadding: 1, halign: 'center', valign: 'middle' },
              headStyles: { fillColor: [245, 235, 220], textColor: [0, 0, 0], fontStyle: 'bold', fontSize: 5 },
              columnStyles: { 0: { halign: 'left', cellWidth: 22 }, 1: { cellWidth: 10 } },
              didParseCell: function(cellData: any) {
                if (cellData.section === 'head' && cellData.row.index === 1) {
                  cellData.cell.styles.fillColor = [255, 245, 230]
                  cellData.cell.styles.fontStyle = 'normal'
                }
                if (cellData.section === 'body' && cellData.row.index === filasDatos.length) {
                  cellData.cell.styles.fillColor = [200, 255, 200]
                  cellData.cell.styles.fontStyle = 'bold'
                }
              },
              margin: { left: margin, right: margin }
            })
            startY = (doc as any).lastAutoTable.finalY + 3
          }

          return startY + 8
        }

        // Generar tablas para cada módulo
        for (const modulo of data.modulos) {
          currentY = generarTablaModulo(modulo, currentY)
        }

        // Generar tabla para "Resto del campo"
        if (data.restoDelCampo && data.restoDelCampo.potreros.length > 0) {
          currentY = generarTablaModulo(data.restoDelCampo, currentY)
        }

        // Footer
        if (currentY > pageHeight - 15) {
          doc.addPage()
          dibujarMarcaAgua()
          currentY = 20
        }
        doc.setFontSize(8)
        doc.setTextColor(128, 128, 128)
        doc.text('Generado por Bot Rural - botrural.vercel.app', margin, currentY + 5)

      } else {
        // ========== FORMATO ORIGINAL: SIN MÓDULOS ==========
        const categoriasBovinas = data.categorias.bovinas.filter(cat =>
          data.potreros.some(p => (p.animalesPorCategoria[cat.nombre] || 0) > 0) ||
          (data.totales.porCategoria[cat.nombre] || 0) > 0
        )

        const headersBovinos = [
          'Potreros', 'Ha',
          ...categoriasBovinas.map(c => c.nombre),
          'Total Vacunos', 'UG/Ha (Vac+Ovi+Equ)'
        ]

        const filaEquivalenciasBovinos = [
          'UG x Categoría', '',
          ...categoriasBovinas.map(c => c.equivalenciaUG.toFixed(2)),
          '', ''
        ]

        const filasDatosBovinos = data.potreros.map(potrero => [
          potrero.nombre,
          potrero.hectareas.toFixed(0),
          ...categoriasBovinas.map(c => {
            const cantidad = potrero.animalesPorCategoria[c.nombre] || 0
            return cantidad > 0 ? cantidad.toString() : ''
          }),
          potrero.vacunosTotales.toString(),
          potrero.ugPorHa.toFixed(2)
        ])

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

        doc.setFontSize(12)
        doc.setFont('helvetica', 'bold')
        doc.text('VACUNOS', margin, 30)

        autoTable(doc, {
          head: [headersBovinos, filaEquivalenciasBovinos],
          body: [...filasDatosBovinos, filaTotalesBovinos],
          startY: 35,
          theme: 'grid',
          styles: { fontSize: 7, cellPadding: 1.5, overflow: 'linebreak', halign: 'center', valign: 'middle' },
          headStyles: { fillColor: [245, 245, 220], textColor: [0, 0, 0], fontStyle: 'bold', fontSize: 6 },
          columnStyles: { 0: { halign: 'left', cellWidth: 25 }, 1: { cellWidth: 12 } },
          didParseCell: function(cellData: any) {
            if (cellData.section === 'head' && cellData.row.index === 1) {
              cellData.cell.styles.fillColor = [255, 255, 200]
              cellData.cell.styles.fontStyle = 'normal'
            }
            if (cellData.section === 'body' && cellData.row.index === filasDatosBovinos.length) {
              cellData.cell.styles.fillColor = [200, 255, 200]
              cellData.cell.styles.fontStyle = 'bold'
            }
            if (cellData.section === 'body' && cellData.column.index === headersBovinos.length - 1) {
              const valor = parseFloat(cellData.cell.raw) || 0
              if (valor === 0) cellData.cell.styles.textColor = [150, 150, 150]
              else if (valor < 0.7) cellData.cell.styles.textColor = [0, 100, 200]
              else if (valor <= 1.5) cellData.cell.styles.textColor = [0, 150, 0]
              else if (valor <= 2.0) cellData.cell.styles.textColor = [200, 150, 0]
              else cellData.cell.styles.textColor = [200, 0, 0]
            }
          },
          didDrawPage: function() {
            dibujarMarcaAgua()
          },
          margin: { left: margin, right: margin }
        })

        // TABLA OVINOS (formato original)
        const categoriasOvinas = data.categorias.ovinas.filter(cat =>
          data.potreros.some(p => (p.animalesPorCategoria[cat.nombre] || 0) > 0) ||
          (data.totales.porCategoria[cat.nombre] || 0) > 0
        )

        if (categoriasOvinas.length > 0) {
          const headersOvinos = [
            'Potreros', 'Ha',
            ...categoriasOvinas.map(c => c.nombre),
            'Total Ovinos'
          ]

          const filaEquivalenciasOvinos = [
            'UG x Categoría', '',
            ...categoriasOvinas.map(c => c.equivalenciaUG.toFixed(2)),
            ''
          ]

          const filasDatosOvinos = data.potreros.map(potrero => [
            potrero.nombre,
            potrero.hectareas.toFixed(0),
            ...categoriasOvinas.map(c => {
              const cantidad = potrero.animalesPorCategoria[c.nombre] || 0
              return cantidad > 0 ? cantidad.toString() : ''
            }),
            potrero.ovinosTotales.toString()
          ])

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
            styles: { fontSize: 7, cellPadding: 1.5, overflow: 'linebreak', halign: 'center', valign: 'middle' },
            headStyles: { fillColor: [245, 245, 220], textColor: [0, 0, 0], fontStyle: 'bold', fontSize: 6 },
            columnStyles: { 0: { halign: 'left', cellWidth: 25 }, 1: { cellWidth: 12 } },
            didParseCell: function(cellData: any) {
              if (cellData.section === 'head' && cellData.row.index === 1) {
                cellData.cell.styles.fillColor = [255, 255, 200]
                cellData.cell.styles.fontStyle = 'normal'
              }
              if (cellData.section === 'body' && cellData.row.index === filasDatosOvinos.length) {
                cellData.cell.styles.fillColor = [200, 255, 200]
                cellData.cell.styles.fontStyle = 'bold'
              }
            },
            didDrawPage: function() {
              dibujarMarcaAgua()
            },
            margin: { left: margin, right: margin }
          })
        }

        // Footer
        const finalY = (doc as any).lastAutoTable.finalY + 10
        doc.setFontSize(8)
        doc.setTextColor(128, 128, 128)
        doc.text('Generado por Bot Rural - botrural.vercel.app', margin, finalY)
      }

      // Descargar
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