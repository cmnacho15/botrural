'use client'

import { useState, useEffect } from 'react'
import { Calendar, Download, Plus, Edit2, Trash2, X, Save } from 'lucide-react'
import { toast } from '@/app/components/Toast'

export default function ManoDeObraPage() {
  const [mesSeleccionado, setMesSeleccionado] = useState(new Date().getMonth())
  const [anioSeleccionado, setAnioSeleccionado] = useState(new Date().getFullYear())
  const [modalOpen, setModalOpen] = useState(false)
  const [empleadoEditando, setEmpleadoEditando] = useState<any>(null)
  const [cargando, setCargando] = useState(false)
  const [empleados, setEmpleados] = useState<any[]>([])

  const [formData, setFormData] = useState({
    nombre: '',
    horasTrabajadas: '',
    diasTrabajados: '',
    diasNoTrabajados: '',
    feriadosTrabajados: '',
    diasDescansoTrabajados: '',
    faltas: '',
    horasExtras: '',
    licencias: '',
  })
  const [trabajoFeriado, setTrabajoFeriado] = useState(false)

  const meses = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ]

  // Feriados fijos de Uruguay
  const feriadosFijos = [
    { mes: 0, nombre: 'Año Nuevo (1 de enero)' },
    { mes: 3, nombre: 'Día del Trabajador Rural (30 de abril)' },
    { mes: 4, nombre: 'Día de los Trabajadores (1 de mayo)' },
    { mes: 6, nombre: 'Jura de la Constitución (18 de julio)' },
    { mes: 7, nombre: 'Declaratoria de la Independencia (25 de agosto)' },
    { mes: 11, nombre: 'Navidad (25 de diciembre)' }
  ]

  // Verificar si el mes seleccionado tiene un feriado
  const feriadoDelMes = feriadosFijos.find(f => f.mes === mesSeleccionado)

  useEffect(() => {
    cargarDatos()
  }, [mesSeleccionado, anioSeleccionado])

  const cargarDatos = async () => {
    setCargando(true)
    try {
      const res = await fetch(`/api/mano-obra?mes=${mesSeleccionado}&anio=${anioSeleccionado}`)
      if (!res.ok) throw new Error('Error cargando datos')

      const data = await res.json()

      const empleadosMapeados = data.map((emp: any) => ({
        id: emp.id,
        nombre: emp.nombre,
        horasTrabajadas: emp.horas_trabajadas,
        diasTrabajados: emp.dias_trabajados,
        diasNoTrabajados: emp.dias_no_trabajados,
        feriadosTrabajados: emp.feriados_trabajados,
        diasDescansoTrabajados: emp.dias_descanso_trabajados,
        faltas: emp.faltas,
        horasExtras: emp.horas_extras,
        licencias: emp.licencias,
        trabajoFeriado: emp.trabajo_feriado === true || emp.trabajo_feriado === 1
      }))

      setEmpleados(empleadosMapeados)
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setCargando(false)
    }
  }

  const handleGuardar = async () => {
    if (!formData.nombre.trim()) {
      toast.error('El nombre es obligatorio')
      return
    }

    const datos = {
      nombre: formData.nombre,
      horas_trabajadas: Number(formData.horasTrabajadas) || 0,
      dias_trabajados: Number(formData.diasTrabajados) || 0,
      dias_no_trabajados: Number(formData.diasNoTrabajados) || 0,
      feriados_trabajados: Number(formData.feriadosTrabajados) || 0,
      dias_descanso_trabajados: Number(formData.diasDescansoTrabajados) || 0,
      faltas: Number(formData.faltas) || 0,
      horas_extras: Number(formData.horasExtras) || 0,
      licencias: Number(formData.licencias) || 0,
      trabajo_feriado: trabajoFeriado,
      mes: mesSeleccionado,
      anio: anioSeleccionado,
    }

    try {
      const res = await fetch('/api/mano-obra', {
        method: empleadoEditando ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...datos,
          id: empleadoEditando?.id,
        })
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.details || errorData.error || 'Error guardando')
      }

      setModalOpen(false)
      cargarDatos()
      toast.success('✅ Guardado correctamente')
    } catch (error: any) {
      toast.error('❌ Error al guardar: ' + error.message)
    }
  }

  const handleEliminar = async (id: number) => {
    if (!confirm('¿Eliminar este registro?')) return

    try {
      const res = await fetch(`/api/mano-obra?id=${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Error eliminando')

      cargarDatos()
      toast.success('✅ Eliminado correctamente')
    } catch (error: any) {
      toast.error('❌ Error al eliminar: ' + error.message)
    }
  }

  // ========================================
  // PDF - CON DATO DE FERIADO
  // ========================================
  const handleExportarPDF = () => {
    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      toast.error('Por favor permite ventanas emergentes para descargar el PDF')
      return
    }

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Mano de Obra - ${meses[mesSeleccionado]} ${anioSeleccionado}</title>
        <style>
          @media print {
            @page { margin: 1cm; }
          }
          body {
            font-family: Arial, sans-serif;
            padding: 20px;
          }
          h1 {
            text-align: center;
            color: #1e40af;
            margin-bottom: 10px;
          }
          .subtitle {
            text-align: center;
            color: #6b7280;
            margin-bottom: 30px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
          }
          th, td {
            border: 1px solid #d1d5db;
            padding: 8px;
            text-align: center;
            font-size: 12px;
          }
          th {
            background-color: #3b82f6;
            color: white;
            font-weight: bold;
          }
          tr:nth-child(even) {
            background-color: #f9fafb;
          }
          .nombre {
            text-align: left;
            font-weight: 500;
          }
        </style>
      </head>
      <body>
        <h1>INFORME DE MANO DE OBRA</h1>
        <div class="subtitle">
          Período: ${meses[mesSeleccionado]} ${anioSeleccionado}<br>
          Generado: ${new Date().toLocaleDateString('es-UY')}
          ${feriadoDelMes ? `<br><strong>Mes con feriado: ${feriadoDelMes.nombre}</strong>` : ''}
        </div>
        
        <table>
          <thead>
            <tr>
              <th>Empleado</th>
              <th>Horas Trabajadas</th>
              <th>Días Trabajados</th>
              <th>Días NO Trabajados</th>
              <th>Feriados</th>
              <th>Descansos</th>
              <th>Faltas</th>
              <th>Extras</th>
              <th>Licencias</th>
              ${feriadoDelMes ? '<th>Trabajó Feriado</th>' : ''}
            </tr>
          </thead>
          <tbody>
            ${empleados.map(emp => `
              <tr>
                <td class="nombre">${emp.nombre}</td>
                <td>${emp.horasTrabajadas}</td>
                <td>${emp.diasTrabajados}</td>
                <td>${emp.diasNoTrabajados}</td>
                <td>${emp.feriadosTrabajados}</td>
                <td>${emp.diasDescansoTrabajados}</td>
                <td>${emp.faltas}</td>
                <td>${emp.horasExtras}</td>
                <td>${emp.licencias}</td>
                ${feriadoDelMes ? `<td>${emp.trabajoFeriado ? 'SÍ' : 'NO'}</td>` : ''}
              </tr>
            `).join('')}
          </tbody>
        </table>
        
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
              setTimeout(function() {
                window.close();
              }, 100);
            }, 250);
          }
        </script>
      </body>
      </html>
    `

    printWindow.document.write(html)
    printWindow.document.close()
  }

  // ========================================
  // EXCEL - CSV CON DATO DE FERIADO
  // ========================================
  const handleExportarExcel = () => {
    // Primera fila: Período
    const periodo = `Período:;${meses[mesSeleccionado]} ${anioSeleccionado}${feriadoDelMes ? ` (Feriado: ${feriadoDelMes.nombre})` : ''}`
    
    // Segunda fila vacía
    const vacio = ''
    
    // Tercera fila: Headers de la tabla
    const headers = [
      'Empleado',
      'Horas Trabajadas',
      'Días Trabajados',
      'Días NO Trabajados',
      'Feriados Trabajados',
      'Días Descanso Trabajados',
      'Faltas',
      'Horas Extras',
      'Licencias',
      ...(feriadoDelMes ? ['Trabajó Feriado'] : [])
    ].join(';')

    // Filas de datos
    const rows = empleados.map(emp => [
      emp.nombre,
      emp.horasTrabajadas,
      emp.diasTrabajados,
      emp.diasNoTrabajados,
      emp.feriadosTrabajados,
      emp.diasDescansoTrabajados,
      emp.faltas,
      emp.horasExtras,
      emp.licencias,
      ...(feriadoDelMes ? [emp.trabajoFeriado ? 'SÍ' : 'NO'] : [])
    ].join(';')).join('\n')

    // Combinar todo
    const csvContent = [periodo, vacio, headers, rows].join('\n')

    // Crear el blob con BOM para UTF-8
    const blob = new Blob(['\ufeff' + csvContent], { 
      type: 'text/csv;charset=utf-8;' 
    })
    
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    
    link.href = url
    link.download = `ManoObra-${meses[mesSeleccionado]}-${anioSeleccionado}.csv`
    link.style.display = 'none'
    
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    
    setTimeout(() => URL.revokeObjectURL(url), 100)
  }

  const handleAgregar = () => {
    setEmpleadoEditando(null)
    setFormData({
      nombre: '',
      horasTrabajadas: '',
      diasTrabajados: '',
      diasNoTrabajados: '',
      feriadosTrabajados: '',
      diasDescansoTrabajados: '',
      faltas: '',
      horasExtras: '',
      licencias: '',
    })
    setTrabajoFeriado(false)
    setModalOpen(true)
  }

  const handleEditar = (emp: any) => {
    setEmpleadoEditando(emp)
    setFormData({
      nombre: emp.nombre,
      horasTrabajadas: emp.horasTrabajadas,
      diasTrabajados: emp.diasTrabajados,
      diasNoTrabajados: emp.diasNoTrabajados,
      feriadosTrabajados: emp.feriadosTrabajados,
      diasDescansoTrabajados: emp.diasDescansoTrabajados,
      faltas: emp.faltas,
      horasExtras: emp.horasExtras,
      licencias: emp.licencias,
    })
    setTrabajoFeriado(emp.trabajoFeriado || false)
    setModalOpen(true)
  }

  return (
    <div className="min-h-screen bg-white text-gray-900" style={{ colorScheme: 'light' }}>
      {/* HEADER */}
      <div className="bg-white border-b border-gray-200 px-3 sm:px-4 py-3 sm:py-4 mb-4 sm:mb-6">
        <div className="flex flex-col gap-3 sm:gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-lg sm:text-2xl font-bold text-gray-900">Mano de Obra</h1>
            <p className="text-gray-500 text-xs sm:text-sm">
              Resumen mensual para el contador
            </p>
          </div>

          <div className="flex flex-wrap gap-1.5 sm:gap-2">
            <button
              onClick={handleAgregar}
              className="px-2.5 sm:px-4 py-1.5 sm:py-2 bg-blue-600 text-white rounded-lg flex items-center gap-1.5 sm:gap-2 hover:bg-blue-700 transition text-xs sm:text-sm"
            >
              <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Agregar
            </button>

            <button
              onClick={handleExportarPDF}
              className="px-2.5 sm:px-4 py-1.5 sm:py-2 bg-red-600 text-white rounded-lg flex items-center gap-1.5 sm:gap-2 hover:bg-red-700 transition text-xs sm:text-sm"
            >
              <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> PDF
            </button>

            <button
              onClick={handleExportarExcel}
              className="px-2.5 sm:px-4 py-1.5 sm:py-2 bg-green-600 text-white rounded-lg flex items-center gap-1.5 sm:gap-2 hover:bg-green-700 transition text-xs sm:text-sm"
            >
              <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Excel
            </button>
          </div>
        </div>
      </div>

      {/* PERÍODO */}
      <div className="px-3 sm:px-4 mb-4 sm:mb-6">
        <div className="bg-white rounded-xl p-3 sm:p-6 shadow border border-gray-200">
          <div className="flex flex-col gap-3 sm:gap-4 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2 sm:gap-3">
              <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-gray-500" />
              <span className="font-medium text-gray-700 text-sm sm:text-base">
                Período:
              </span>
            </div>

            <div className="flex flex-wrap gap-2 sm:gap-3">
              <select
                value={mesSeleccionado}
                onChange={e => setMesSeleccionado(Number(e.target.value))}
                className="px-2 sm:px-4 py-1.5 sm:py-2 border rounded-lg bg-white border-gray-300 text-xs sm:text-base text-gray-900"
                style={{ colorScheme: 'light' }}
              >
                {meses.map((m, idx) => (
                  <option key={idx} value={idx}>{m}</option>
                ))}
              </select>

              <select
                value={anioSeleccionado}
                onChange={e => setAnioSeleccionado(Number(e.target.value))}
                className="px-2 sm:px-4 py-1.5 sm:py-2 border rounded-lg bg-white border-gray-300 text-xs sm:text-base text-gray-900"
                style={{ colorScheme: 'light' }}
              >
                {[2023, 2024, 2025, 2026].map(yr => (
                  <option key={yr} value={yr}>{yr}</option>
                ))}
              </select>

              {cargando && (
                <span className="text-gray-500 animate-pulse text-xs sm:text-sm">
                  Cargando...
                </span>
              )}
            </div>
          </div>

          {feriadoDelMes && (
            <p className="mt-3 sm:mt-4 text-[10px] sm:text-sm text-blue-700">
              💡 Este mes incluye el feriado:&nbsp;
              <span className="font-medium">{feriadoDelMes.nombre}</span>
            </p>
          )}
        </div>
      </div>

      {/* TABLA */}
      <div className="px-3 sm:px-4 pb-4 sm:pb-6">
        <div className="bg-white rounded-xl shadow border border-gray-200 overflow-x-auto">
          <table className="w-full min-w-[700px] text-xs sm:text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-semibold text-gray-600 whitespace-nowrap">
                  Empleado
                </th>
                <th className="px-2 sm:px-4 py-2 sm:py-3 text-center text-[10px] sm:text-xs font-semibold text-gray-600 whitespace-nowrap">
                  Horas
                </th>
                <th className="px-2 sm:px-4 py-2 sm:py-3 text-center text-[10px] sm:text-xs font-semibold text-gray-600 whitespace-nowrap">
                  Trab.
                </th>
                <th className="px-2 sm:px-4 py-2 sm:py-3 text-center text-[10px] sm:text-xs font-semibold text-gray-600 whitespace-nowrap">
                  NO
                </th>
                <th className="px-2 sm:px-4 py-2 sm:py-3 text-center text-[10px] sm:text-xs font-semibold text-gray-600 whitespace-nowrap">
                  Feriados
                </th>
                <th className="px-2 sm:px-4 py-2 sm:py-3 text-center text-[10px] sm:text-xs font-semibold text-gray-600 whitespace-nowrap">
                  Descanso
                </th>
                <th className="px-2 sm:px-4 py-2 sm:py-3 text-center text-[10px] sm:text-xs font-semibold text-gray-600 whitespace-nowrap">
                  Faltas
                </th>
                <th className="px-2 sm:px-4 py-2 sm:py-3 text-center text-[10px] sm:text-xs font-semibold text-gray-600 whitespace-nowrap">
                  Extras
                </th>
                <th className="px-2 sm:px-4 py-2 sm:py-3 text-center text-[10px] sm:text-xs font-semibold text-gray-600 whitespace-nowrap">
                  Licencias
                </th>
                {feriadoDelMes && (
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-center text-[10px] sm:text-xs font-semibold text-gray-600 whitespace-nowrap">
                    Trabajó feriado
                  </th>
                )}
                <th className="px-2 sm:px-4 py-2 sm:py-3 text-center text-[10px] sm:text-xs font-semibold text-gray-600 whitespace-nowrap">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {empleados.map(emp => (
                <tr
                  key={emp.id}
                  className="hover:bg-gray-50 transition-colors"
                >
                  <td className="px-2 sm:px-4 py-2 sm:py-3 font-medium text-gray-900">
                    {emp.nombre}
                  </td>
                  <td className="px-2 sm:px-4 py-2 sm:py-3 text-center text-gray-700">
                    {emp.horasTrabajadas}
                  </td>
                  <td className="px-2 sm:px-4 py-2 sm:py-3 text-center text-gray-700">
                    {emp.diasTrabajados}
                  </td>
                  <td className="px-2 sm:px-4 py-2 sm:py-3 text-center text-gray-700">
                    {emp.diasNoTrabajados}
                  </td>
                  <td className="px-2 sm:px-4 py-2 sm:py-3 text-center text-gray-700">
                    {emp.feriadosTrabajados}
                  </td>
                  <td className="px-2 sm:px-4 py-2 sm:py-3 text-center text-gray-700">
                    {emp.diasDescansoTrabajados}
                  </td>
                  <td className="px-2 sm:px-4 py-2 sm:py-3 text-center text-gray-700">
                    {emp.faltas}
                  </td>
                  <td className="px-2 sm:px-4 py-2 sm:py-3 text-center text-gray-700">
                    {emp.horasExtras}
                  </td>
                  <td className="px-2 sm:px-4 py-2 sm:py-3 text-center text-gray-700">
                    {emp.licencias}
                  </td>
                  {feriadoDelMes && (
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-center text-gray-700">
                      {emp.trabajoFeriado ? 'Sí' : 'No'}
                    </td>
                  )}
                  <td className="px-2 sm:px-4 py-2 sm:py-3">
                    <div className="flex justify-center gap-1 sm:gap-2">
                      <button
                        onClick={() => handleEditar(emp)}
                        className="text-blue-600 p-1.5 sm:p-2 hover:bg-blue-50 rounded transition"
                      >
                        <Edit2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      </button>
                      <button
                        onClick={() => handleEliminar(emp.id)}
                        className="text-red-600 p-1.5 sm:p-2 hover:bg-red-50 rounded transition"
                      >
                        <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {empleados.length === 0 && !cargando && (
            <div className="text-center py-8 sm:py-12 text-gray-500 text-sm">
              No hay registros para este período.
              <button
                onClick={handleAgregar}
                className="block mx-auto mt-3 sm:mt-4 px-3 sm:px-4 py-1.5 sm:py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-xs sm:text-sm"
              >
                Agregar primer registro
              </button>
            </div>
          )}
        </div>
      </div>

      {/* MODAL */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-2 sm:p-4 z-50">
          <div
            className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-4 sm:p-6 shadow-xl border border-gray-200"
            style={{ colorScheme: 'light' }}
          >
            <div className="flex justify-between items-center mb-3 sm:mb-4">
              <h2 className="text-base sm:text-xl font-bold text-gray-900">
                {empleadoEditando ? 'Editar' : 'Agregar'} Registro
              </h2>
              <button
                onClick={() => setModalOpen(false)}
                className="hover:bg-gray-100 p-1.5 sm:p-2 rounded"
              >
                <X className="w-5 h-5 sm:w-6 sm:h-6 text-gray-600" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              {[
                ['nombre', 'Nombre'],
                ['horasTrabajadas', 'Horas trabajadas'],
                ['diasTrabajados', 'Días trabajados'],
                ['diasNoTrabajados', 'Días NO trabajados'],
                ['feriadosTrabajados', 'Feriados trabajados'],
                ['diasDescansoTrabajados', 'Descansos trabajados'],
                ['faltas', 'Faltas'],
                ['horasExtras', 'Horas extras'],
                ['licencias', 'Licencias'],
              ].map(([campo, label]) => (
                <div key={campo}>
                  <label className="block text-xs sm:text-sm font-medium mb-1 text-gray-700">
                    {label}
                  </label>
                  <input
                    type={campo === 'nombre' ? 'text' : 'number'}
                    value={(formData as any)[campo]}
                    onChange={e =>
                      setFormData({ ...formData, [campo]: e.target.value })
                    }
                    className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white border-gray-300 text-gray-900 text-sm"
                    style={{ colorScheme: 'light' }}
                  />
                </div>
              ))}
            </div>

            {feriadoDelMes && (
              <div className="mt-3 sm:mt-4 p-3 sm:p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <label className="flex items-center gap-2 sm:gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={trabajoFeriado}
                    onChange={(e) => setTrabajoFeriado(e.target.checked)}
                    className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 rounded border-gray-300 focus:ring-2 focus:ring-blue-500"
                    style={{ colorScheme: 'light' }}
                  />
                  <span className="text-xs sm:text-sm font-medium text-gray-700">
                    ¿Trabajó el feriado de {feriadoDelMes.nombre}?
                  </span>
                </label>
              </div>
            )}

            <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-3 mt-4 sm:mt-6">
              <button
                onClick={() => setModalOpen(false)}
                className="px-4 sm:px-5 py-1.5 sm:py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition text-sm"
              >
                Cancelar
              </button>

              <button
                onClick={handleGuardar}
                className="px-4 sm:px-5 py-1.5 sm:py-2 bg-blue-600 text-white rounded-lg flex items-center justify-center gap-2 hover:bg-blue-700 transition text-sm"
              >
                <Save className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}