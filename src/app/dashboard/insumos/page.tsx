'use client'

import { useState, useEffect } from 'react'
import ModalIngresoInsumos from '@/app/components/modales/ModalIngresoInsumos'
import ModalUsoInsumos from '@/app/components/modales/ModalUsoInsumos'

type Insumo = {
  id: string
  nombre: string
  unidad: string
  stock: number
}

export default function InsumosPage() {
  const [insumos, setInsumos] = useState<Insumo[]>([])
  const [loading, setLoading] = useState(true)
  const [modalIngresoAbierto, setModalIngresoAbierto] = useState(false)
  const [modalUsoAbierto, setModalUsoAbierto] = useState(false)

  const cargarInsumos = async () => {
    try {
      const res = await fetch('/api/insumos')
      const data = await res.json()
      setInsumos(data)
    } catch (error) {
      console.error('Error cargando insumos:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    cargarInsumos()
  }, [])

  const handleSuccess = () => {
    cargarInsumos()
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* HEADER */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Gestión de Insumos</h1>
              <p className="text-gray-600">Administrá el inventario de insumos de tu campo</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setModalIngresoAbierto(true)}
                className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium flex items-center gap-2 shadow-lg transition-all"
              >
                <span className="text-xl">📥</span>
                Ingreso
              </button>
              <button
                onClick={() => setModalUsoAbierto(true)}
                className="px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-medium flex items-center gap-2 shadow-lg transition-all"
              >
                <span className="text-xl">📤</span>
                Uso
              </button>
            </div>
          </div>
        </div>

        {/* LISTA DE INSUMOS */}
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-gray-300 border-t-blue-600"></div>
            <p className="mt-4 text-gray-600">Cargando insumos...</p>
          </div>
        ) : insumos.length === 0 ? (
          <div className="bg-white rounded-xl shadow-md p-12 text-center">
            <div className="text-6xl mb-4">📦</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No hay insumos registrados</h3>
            <p className="text-gray-600 mb-6">Comenzá registrando un ingreso de insumos</p>
            <button
              onClick={() => setModalIngresoAbierto(true)}
              className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium inline-flex items-center gap-2"
            >
              <span className="text-xl">📥</span>
              Registrar Ingreso
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {insumos.map((insumo) => (
              <div
                key={insumo.id}
                className="bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow p-6"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">
                      {insumo.nombre}
                    </h3>
                    <p className="text-sm text-gray-500">{insumo.unidad}</p>
                  </div>
                  <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-2xl">
                    📦
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-100">
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-gray-900">
                      {insumo.stock.toLocaleString('es-UY')}
                    </span>
                    <span className="text-gray-600">{insumo.unidad}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Stock disponible</p>
                </div>

                {/* Indicador de stock bajo */}
                {insumo.stock < 10 && (
                  <div className="mt-4 px-3 py-2 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-xs text-red-600 font-medium">⚠️ Stock bajo</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MODALES */}
      {modalIngresoAbierto && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <ModalIngresoInsumos
              onClose={() => setModalIngresoAbierto(false)}
              onSuccess={handleSuccess}
            />
          </div>
        </div>
      )}

      {modalUsoAbierto && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <ModalUsoInsumos
              onClose={() => setModalUsoAbierto(false)}
              onSuccess={handleSuccess}
            />
          </div>
        </div>
      )}
    </div>
  )
}