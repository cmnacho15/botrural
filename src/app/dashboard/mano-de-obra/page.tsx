'use client'

import { useState, useEffect } from 'react'
import { Calendar, Download, Printer, Plus, Edit2, Trash2, X, Save } from 'lucide-react'
import jsPDF from 'jspdf'
import 'jspdf-autotable'

// 👇 Permite usar autoTable en TypeScript
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF
    lastAutoTable: { finalY: number }
  }
}

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

  const meses = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ]

  // -----------------------------------------------------
  // 🔥 CARGAR DATOS DESDE TU API PRISMA
  // -----------------------------------------------------
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
      }))

      setEmpleados(empleadosMapeados)
    } catch (error: any) {
      alert(error.message)
    } finally {
      setCargando(false)
    }
  }

  // -----------------------------------------------------
  // 💾 GUARDAR (CREAR / EDITAR)
  // -----------------------------------------------------
  const handleGuardar = async () => {
    if (!formData.nombre.trim()) {
      alert('El nombre es obligatorio')
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

      if (!res.ok) throw new Error('Error guardando')

      setModalOpen(false)
      cargarDatos()
      alert('✅ Guardado correctamente')
    } catch (error: any) {
      alert('❌ Error al guardar: ' + error.message)
    }
  }

  // -----------------------------------------------------
  // 🗑️ ELIMINAR
  // -----------------------------------------------------
  const handleEliminar = async (id: number) => {
    if (!confirm('¿Eliminar este registro?')) return

    try {
      const res = await fetch(`/api/mano-obra?id=${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Error eliminando')

      cargarDatos()
      alert('✅ Eliminado correctamente')
    } catch (error: any) {
      alert('❌ Error al eliminar: ' + error.message)
    }
  }

  // -----------------------------------------------------
  // 📄 EXPORTAR PDF
  // -----------------------------------------------------
  const handleExportarPDF = () => {
    const doc = new jsPDF()

    doc.setFontSize(18)
    doc.text('INFORME DE MANO DE OBRA', 105, 15, { align: 'center' })

    doc.setFontSize(12)
    doc.text(`Período: ${meses[mesSeleccionado]} ${anioSeleccionado}`, 105, 23, { align: 'center' })
    doc.text(`Generado: ${new Date().toLocaleDateString('es-UY')}`, 105, 30, { align: 'center' })

    doc.autoTable({
      head: [['Empleado', 'Hs. Trab.', 'Días Trab.', 'No Trab.', 'Feriados', 'Descansos', 'Faltas', 'Extras', 'Licencias']],
      body: empleados.map(emp => [
        emp.nombre,
        emp.horasTrabajadas,
        emp.diasTrabajados,
        emp.diasNoTrabajados,
        emp.feriadosTrabajados,
        emp.diasDescansoTrabajados,
        emp.faltas,
        emp.horasExtras,
        emp.licencias,
      ]),
      startY: 40,
      theme: 'striped'
    })

    doc.save(`mano-obra-${meses[mesSeleccionado]}-${anioSeleccionado}.pdf`)
  }

  // -----------------------------------------------------
  // 📊 EXPORTAR A CSV
  // -----------------------------------------------------
  const handleExportarExcel = () => {
    const headers = ['Empleado', 'Horas Trabajadas', 'Días Trabajados', 'NO Trabajados', 'Feriados', 'Descansos', 'Faltas', 'Extras', 'Licencias']

    const csvContent = [
      headers.join(','),
      ...empleados.map(emp =>
        [
          emp.nombre,
          emp.horasTrabajadas,
          emp.diasTrabajados,
          emp.diasNoTrabajados,
          emp.feriadosTrabajados,
          emp.diasDescansoTrabajados,
          emp.faltas,
          emp.horasExtras,
          emp.licencias
        ].join(',')
      )
    ].join('\n')

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `mano-obra-${meses[mesSeleccionado]}-${anioSeleccionado}.csv`
    link.click()
  }

  // -----------------------------------------------------
  // ➕ ABRIR MODAL NUEVO
  // -----------------------------------------------------
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
    setModalOpen(true)
  }

  // -----------------------------------------------------
  // ✏️ ABRIR MODAL EDITAR
  // -----------------------------------------------------
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
    setModalOpen(true)
  }

  // -----------------------------------------------------
  // RENDER UI (NO TOQUÉ NADA)
  // -----------------------------------------------------
  return (
    <div className="min-h-screen bg-gray-50">

      {/* HEADER */}
      <div className="bg-white border-b border-gray-200 px-4 py-4 mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Mano de Obra</h1>
          <p className="text-gray-500 text-sm">Resumen mensual para el contador</p>
        </div>

        <div className="flex gap-3">
          <button onClick={handleAgregar} className="px-4 py-2 bg-blue-600 text-white rounded-lg flex items-center gap-2">
            <Plus className="w-4 h-4" /> Agregar
          </button>

          <button onClick={handleExportarPDF} className="px-4 py-2 bg-red-600 text-white rounded-lg flex items-center gap-2">
            <Download className="w-4 h-4" /> PDF
          </button>

          <button onClick={handleExportarExcel} className="px-4 py-2 bg-green-600 text-white rounded-lg flex items-center gap-2">
            <Download className="w-4 h-4" /> Excel
          </button>
        </div>
      </div>

      {/* SELECTOR DE PERÍODO */}
      <div className="px-4 mb-6">
        <div className="bg-white rounded-xl p-6 shadow border">
          <div className="flex items-center gap-4">
            <Calendar className="w-5 h-5 text-gray-500" />
            <span className="font-medium text-gray-700">Período:</span>

            <select
              value={mesSeleccionado}
              onChange={e => setMesSeleccionado(Number(e.target.value))}
              className="px-4 py-2 border rounded-lg"
            >
              {meses.map((m, idx) => (
                <option key={idx} value={idx}>{m}</option>
              ))}
            </select>

            <select
              value={anioSeleccionado}
              onChange={e => setAnioSeleccionado(Number(e.target.value))}
              className="px-4 py-2 border rounded-lg"
            >
              {[2023, 2024, 2025, 2026].map(yr => (
                <option key={yr} value={yr}>{yr}</option>
              ))}
            </select>

            {cargando && <span className="text-gray-500 animate-pulse">Cargando...</span>}
          </div>
        </div>
      </div>

      {/* TABLA */}
      <div className="px-4">
        <div className="bg-white rounded-xl shadow border overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left">Empleado</th>
                <th className="px-6 py-3 text-center">Horas</th>
                <th className="px-6 py-3 text-center">Trab.</th>
                <th className="px-6 py-3 text-center">NO</th>
                <th className="px-6 py-3 text-center">Feriados</th>
                <th className="px-6 py-3 text-center">Descanso</th>
                <th className="px-6 py-3 text-center">Faltas</th>
                <th className="px-6 py-3 text-center">Extras</th>
                <th className="px-6 py-3 text-center">Licencias</th>
                <th className="px-6 py-3 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {empleados.map(emp => (
                <tr key={emp.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium">{emp.nombre}</td>
                  <td className="px-6 py-4 text-center">{emp.horasTrabajadas}</td>
                  <td className="px-6 py-4 text-center">{emp.diasTrabajados}</td>
                  <td className="px-6 py-4 text-center">{emp.diasNoTrabajados}</td>
                  <td className="px-6 py-4 text-center">{emp.feriadosTrabajados}</td>
                  <td className="px-6 py-4 text-center">{emp.diasDescansoTrabajados}</td>
                  <td className="px-6 py-4 text-center">{emp.faltas}</td>
                  <td className="px-6 py-4 text-center">{emp.horasExtras}</td>
                  <td className="px-6 py-4 text-center">{emp.licencias}</td>

                  <td className="px-6 py-4 text-center flex justify-center gap-2">
                    <button onClick={() => handleEditar(emp)} className="text-blue-600 p-2">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleEliminar(emp.id)} className="text-red-600 p-2">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {empleados.length === 0 && !cargando && (
            <div className="text-center py-12 text-gray-500">
              No hay registros para este período.
              <button
                onClick={handleAgregar}
                className="block mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg"
              >
                Agregar primer registro
              </button>
            </div>
          )}
        </div>
      </div>

      {/* MODAL */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl p-6 shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">
                {empleadoEditando ? 'Editar' : 'Agregar'} Registro
              </h2>
              <button onClick={() => setModalOpen(false)}>
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* CAMPOS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  <label className="block text-sm font-medium mb-1">{label}</label>
                  <input
                    type={campo === 'nombre' ? 'text' : 'number'}
                    value={(formData as any)[campo]}
                    onChange={e => setFormData({ ...formData, [campo]: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
              ))}
            </div>

            {/* BOTONES */}
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setModalOpen(false)}
                className="px-5 py-2 bg-gray-200 rounded-lg"
              >
                Cancelar
              </button>

              <button
                onClick={handleGuardar}
                className="px-5 py-2 bg-blue-600 text-white rounded-lg flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}