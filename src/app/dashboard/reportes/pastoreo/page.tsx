'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

type Modulo = {
  id: string
  nombre: string
}

type Registro = {
  potrero: string
  fechaEntrada: string
  dias: number
  fechaSalida: string
  diasDescanso: number
  hectareas: number
  comentarios: string
}

export default function ReportePastoreoPage() {
  const [modulos, setModulos] = useState<Modulo[]>([])
  const [moduloSeleccionado, setModuloSeleccionado] = useState('')
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')
  const [registros, setRegistros] = useState<Registro[]>([])
  const [nombreModulo, setNombreModulo] = useState('')
  const [cargando, setCargando] = useState(false)
  const [mostrandoReporte, setMostrandoReporte] = useState(false)

  useEffect(() => {
    cargarModulos()
  }, [])

  async function cargarModulos() {
    try {
      const response = await fetch('/api/modulos-pastoreo')
      if (response.ok) {
        const data = await response.json()
        setModulos(data)
      }
    } catch (error) {
      console.error('Error cargando módulos:', error)
    }
  }

  async function generarReporte() {
    if (!moduloSeleccionado) {
      alert('Selecciona un módulo')
      return
    }

    setCargando(true)
    setMostrandoReporte(false)

    try {
      const params = new URLSearchParams({
        moduloId: moduloSeleccionado,
        ...(fechaDesde && { fechaDesde }),
        ...(fechaHasta && { fechaHasta }),
      })

      const response = await fetch(`/api/reportes/pastoreo-rotativo?${params}`)
      
      if (response.ok) {
        const data = await response.json()
        setRegistros(data.registros)
        setNombreModulo(data.modulo)
        setMostrandoReporte(true)
      } else {
        alert('Error al generar reporte')
      }
    } catch (error) {
      console.error('Error:', error)
      alert('Error al generar reporte')
    } finally {
      setCargando(false)
    }
  }

  function descargarPDF() {
    const doc = new jsPDF()
    
    // Título
    doc.setFontSize(16)
    doc.text(nombreModulo.toUpperCase(), 14, 15)
    
    // Fecha
    doc.setFontSize(10)
    doc.text(new Date().toLocaleDateString('es-UY'), 14, 22)

    // Tabla
    autoTable(doc, {
      startY: 30,
      head: [['POTRERO', 'FECHA\nENTRADA', 'DÍAS', 'FECHA\nSALIDA', 'DÍAS DE\nDESCANSO', 'HECTÁREAS', 'COMENTARIOS']],
      body: registros.map(r => [
        r.potrero,
        r.fechaEntrada,
        r.dias,
        r.fechaSalida,
        r.diasDescanso,
        r.hectareas.toFixed(2),
        r.comentarios,
      ]),
      theme: 'grid',
      headStyles: {
        fillColor: [41, 128, 185],
        textColor: 255,
        fontStyle: 'bold',
        halign: 'center',
      },
      styles: {
        fontSize: 9,
        cellPadding: 3,
      },
      columnStyles: {
        0: { halign: 'center', fillColor: [173, 216, 230] },
        1: { halign: 'center' },
        2: { halign: 'center' },
        3: { halign: 'center' },
        4: { halign: 'center' },
        5: { halign: 'center' },
        6: { halign: 'left' },
      },
    })

    doc.save(`pastoreo-${nombreModulo}-${new Date().toISOString().split('T')[0]}.pdf`)
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Botón de volver */}
        <div className="mb-6">
          <Link
            href="/dashboard/lotes"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 shadow-sm transition text-sm font-medium"
          >
            <span className="text-lg">←</span> Volver a Potreros
          </Link>
        </div>

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">📊 Reporte de Pastoreo Rotativo</h1>
          <p className="text-gray-600 text-sm">Genera el historial de movimientos por módulo</p>
        </div>

        {/* Filtros */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Módulo de Pastoreo <span className="text-red-500">*</span>
              </label>
              <select
                value={moduloSeleccionado}
                onChange={(e) => setModuloSeleccionado(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5"
              >
                <option value="">Seleccionar módulo...</option>
                {modulos.map((mod) => (
                  <option key={mod.id} value={mod.id}>
                    {mod.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Desde (opcional)
              </label>
              <input
                type="date"
                value={fechaDesde}
                onChange={(e) => setFechaDesde(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Hasta (opcional)
              </label>
              <input
                type="date"
                value={fechaHasta}
                onChange={(e) => setFechaHasta(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5"
              />
            </div>
          </div>

          <button
            onClick={generarReporte}
            disabled={cargando || !moduloSeleccionado}
            className="w-full md:w-auto px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
          >
            {cargando ? 'Generando...' : '🔍 Generar Reporte'}
          </button>
        </div>

        {/* Resultados */}
        {mostrandoReporte && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">{nombreModulo}</h2>
                <p className="text-sm text-gray-500">{registros.length} registros</p>
              </div>
              <button
                onClick={descargarPDF}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
              >
                📄 Descargar PDF
              </button>
            </div>

            {registros.length === 0 ? (
              <p className="text-center text-gray-500 py-8">No hay registros de pastoreo para este módulo</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase text-center">POTRERO</th>
                      <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase text-center">FECHA<br/>ENTRADA</th>
                      <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase text-center">DÍAS</th>
                      <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase text-center">FECHA<br/>SALIDA</th>
                      <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase text-center">DÍAS DE<br/>DESCANSO</th>
                      <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase text-center">HECTÁREAS</th>
                      <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase text-left">COMENTARIOS</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {registros.map((registro, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-center bg-blue-100 font-medium">{registro.potrero}</td>
                        <td className="px-4 py-3 text-sm text-center">{registro.fechaEntrada}</td>
                        <td className="px-4 py-3 text-sm text-center">{registro.dias}</td>
                        <td className="px-4 py-3 text-sm text-center">{registro.fechaSalida}</td>
                        <td className="px-4 py-3 text-sm text-center">{registro.diasDescanso}</td>
                        <td className="px-4 py-3 text-sm text-center">{registro.hectareas.toFixed(2)}</td>
                        <td className="px-4 py-3 text-sm">{registro.comentarios}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}