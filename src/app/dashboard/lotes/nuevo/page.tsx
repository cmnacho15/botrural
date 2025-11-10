'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import dynamic from 'next/dynamic'

// Importar el mapa dinámicamente para evitar SSR
const MapaPoligono = dynamic(() => import('@/app/components/MapaPoligono'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[500px] flex items-center justify-center bg-gray-100 rounded-lg">
      <p>Cargando mapa...</p>
    </div>
  ),
})

export default function NuevoLotePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [nombre, setNombre] = useState('')
  const [hectareas, setHectareas] = useState('')
  const [showMap, setShowMap] = useState(false)
  const [poligono, setPoligono] = useState<number[][] | null>(null)

  // Obtener centro guardado del primer potrero
  const savedCenter = typeof window !== 'undefined' 
    ? localStorage.getItem('lastPotreroCenter')
    : null
  
  const initialCenter: [number, number] | undefined = savedCenter 
    ? JSON.parse(savedCenter) 
    : undefined

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    if (!poligono) {
      alert('Dibujá la ubicación del potrero en el mapa')
      return
    }

    setLoading(true)

    try {
      const response = await fetch('/api/lotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre,
          hectareas: parseFloat(hectareas),
          poligono,
        }),
      })

      if (response.ok) {
        // ✅ Guardar centro del mapa para próximos potreros
        if (poligono.length > 0) {
          const center = poligono.reduce(
            (acc, point) => [acc[0] + point[0], acc[1] + point[1]],
            [0, 0]
          ).map(v => v / poligono.length) as [number, number]
          
          localStorage.setItem('lastPotreroCenter', JSON.stringify(center))
        }

        router.push('/dashboard/lotes')
        router.refresh()
      } else {
        alert('Error al crear el potrero')
      }
    } catch (error) {
      console.error(error)
      alert('Error al crear el potrero')
    } finally {
      setLoading(false)
    }
  }

  const handlePolygonComplete = (coordinates: number[][]) => {
    setPoligono(coordinates)
    setShowMap(false)
    alert('¡Potrero dibujado correctamente!')
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6 sm:p-8 text-gray-900">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-1">Nuevo Potrero</h1>
        <p className="text-gray-600 text-sm">
          Ingresá los datos del potrero y dibujá su ubicación
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-md border border-gray-200 p-8 max-w-4xl mx-auto">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nombre del Potrero
            </label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              required
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500"
              placeholder="Ej: norte"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Hectáreas
            </label>
            <input
              type="number"
              value={hectareas}
              onChange={(e) => setHectareas(e.target.value)}
              step="0.01"
              required
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500"
              placeholder="Ej: 25.5"
            />
          </div>

          {/* Botón para abrir mapa */}
          {!poligono && (
            <button
              type="button"
              onClick={() => setShowMap(true)}
              className="w-full bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition"
            >
              📍 Agregar ubicación en el mapa
            </button>
          )}

          {poligono && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-green-700 font-medium">
                ✅ Ubicación agregada ({poligono.length} puntos)
              </p>
              <button
                type="button"
                onClick={() => setShowMap(true)}
                className="mt-2 text-blue-600 hover:underline text-sm"
              >
                Editar ubicación
              </button>
            </div>
          )}

          <div className="flex gap-4 pt-4">
            <button
              type="submit"
              disabled={loading || !poligono}
              className="flex-1 bg-blue-600 text-white px-6 py-2.5 rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
            >
              {loading ? 'Guardando...' : 'Confirmar'}
            </button>

            <Link
              href="/dashboard/lotes"
              className="flex-1 bg-gray-100 text-gray-700 px-6 py-2.5 rounded-lg hover:bg-gray-200 text-center transition"
            >
              Cancelar
            </Link>
          </div>
        </form>
      </div>

      {/* Modal del mapa */}
      {showMap && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-5xl h-[80vh] flex flex-col">
            <div className="p-4 border-b flex justify-between items-center">
              <h2 className="text-xl font-bold">Agregar ubicación a {nombre || 'potrero'}</h2>
              <button
                onClick={() => setShowMap(false)}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ✕
              </button>
            </div>
            <div className="flex-1">
              <MapaPoligono 
                onPolygonComplete={handlePolygonComplete}
                initialCenter={initialCenter}
                initialZoom={initialCenter ? 16 : 15}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}