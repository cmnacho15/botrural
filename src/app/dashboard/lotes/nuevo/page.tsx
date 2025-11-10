'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import dynamic from 'next/dynamic'

const MapaPoligono = dynamic(() => import('@/app/components/MapaPoligono'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[500px] flex items-center justify-center bg-gray-100 rounded-lg">
      <p>Cargando mapa...</p>
    </div>
  ),
})

interface LoteExistente {
  id: string
  nombre: string
  hectareas: number
  coordenadas: number[][]
}

export default function NuevoLotePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [nombre, setNombre] = useState('')
  const [hectareasManual, setHectareasManual] = useState('')
  const [showMap, setShowMap] = useState(false)
  const [poligono, setPoligono] = useState<number[][] | null>(null)
  const [hectareasCalculadas, setHectareasCalculadas] = useState<number | null>(null)
  const [lotesExistentes, setLotesExistentes] = useState<LoteExistente[]>([])
  const [cargandoLotes, setCargandoLotes] = useState(true)

  const savedCenter = typeof window !== 'undefined' 
    ? localStorage.getItem('lastPotreroCenter')
    : null
  
  const initialCenter: [number, number] | undefined = savedCenter 
    ? JSON.parse(savedCenter) 
    : undefined

  // Cargar potreros existentes al montar el componente
  useEffect(() => {
    cargarLotesExistentes()
  }, [])

  async function cargarLotesExistentes() {
    try {
      const response = await fetch('/api/lotes')
      if (response.ok) {
        const data = await response.json()
        setLotesExistentes(data)
      }
    } catch (error) {
      console.error('Error cargando lotes existentes:', error)
    } finally {
      setCargandoLotes(false)
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    if (!poligono) {
      alert('Dibujá la ubicación del potrero en el mapa')
      return
    }

    setLoading(true)

    try {
      // 🎯 Usar el área calculada del mapa, no la manual
      const hectareasFinales = hectareasCalculadas || parseFloat(hectareasManual)

      const response = await fetch('/api/lotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre,
          hectareas: hectareasFinales,
          poligono,
        }),
      })

      if (response.ok) {
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

  const handlePolygonComplete = (coordinates: number[][], areaHectareas: number) => {
    setPoligono(coordinates)
    setHectareasCalculadas(areaHectareas)
    setShowMap(false)
    alert(`¡Potrero dibujado! Área: ${areaHectareas.toFixed(2)} ha`)
  }

  // Determinar qué hectáreas mostrar
  const hectareasAMostrar = hectareasCalculadas 
    ? hectareasCalculadas.toFixed(2)
    : hectareasManual

  const hayDiferencia = hectareasCalculadas && hectareasManual && 
    Math.abs(hectareasCalculadas - parseFloat(hectareasManual)) > 0.1

  // Preparar potreros existentes para el mapa
  const potrerosParaMapa = lotesExistentes
    .filter(lote => lote.coordenadas && lote.coordenadas.length > 0)
    .map(lote => ({
      id: lote.id,
      nombre: lote.nombre,
      coordinates: lote.coordenadas,
      color: '#94a3b8' // Gris/azul claro para potreros existentes
    }))

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 md:p-8 text-gray-900">
      <div className="mb-6 md:mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-1">Nuevo Potrero</h1>
        <p className="text-gray-600 text-sm">
          Ingresá los datos del potrero y dibujá su ubicación
        </p>
        {potrerosParaMapa.length > 0 && (
          <p className="text-blue-600 text-sm mt-1">
            ℹ️ Los {potrerosParaMapa.length} potreros existentes se mostrarán en el mapa en gris
          </p>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-md border border-gray-200 p-4 sm:p-6 md:p-8 max-w-4xl mx-auto">
        <form onSubmit={handleSubmit} className="space-y-4 md:space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nombre del Potrero
            </label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              required
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 text-base"
              placeholder="Ej: norte"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Hectáreas {hectareasCalculadas ? '(Estimado - será reemplazado por el área del mapa)' : ''}
            </label>
            <input
              type="number"
              value={hectareasManual}
              onChange={(e) => setHectareasManual(e.target.value)}
              step="0.01"
              required
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 text-base"
              placeholder="Ej: 25.5"
            />
            {hayDiferencia && (
              <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800">
                  ⚠️ Área manual ({hectareasManual} ha) difiere del área calculada ({hectareasCalculadas.toFixed(2)} ha).
                  <br />
                  <strong>Se usará el área calculada del mapa.</strong>
                </p>
              </div>
            )}
          </div>

          {/* Botón para abrir mapa */}
          {!poligono && (
            <button
              type="button"
              onClick={() => setShowMap(true)}
              disabled={cargandoLotes}
              className="w-full bg-green-600 text-white px-6 py-3.5 rounded-lg hover:bg-green-700 transition text-base font-medium disabled:opacity-50"
            >
              {cargandoLotes ? '⏳ Cargando mapa...' : '📍 Agregar ubicación en el mapa'}
            </button>
          )}

          {poligono && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-green-700 font-medium">
                ✅ Ubicación agregada ({poligono.length} puntos)
              </p>
              {hectareasCalculadas && (
                <p className="text-green-600 text-sm mt-1">
                  Área calculada: <strong>{hectareasCalculadas.toFixed(2)} ha</strong>
                </p>
              )}
              <button
                type="button"
                onClick={() => setShowMap(true)}
                className="mt-2 text-blue-600 hover:underline text-sm"
              >
                Editar ubicación
              </button>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <button
              type="submit"
              disabled={loading || !poligono}
              className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition disabled:opacity-50 font-medium text-base"
            >
              {loading ? 'Guardando...' : 'Confirmar'}
            </button>

            <Link
              href="/dashboard/lotes"
              className="flex-1 bg-gray-100 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-200 text-center transition font-medium text-base"
            >
              Cancelar
            </Link>
          </div>
        </form>
      </div>

      {/* Modal del mapa - Pantalla completa en móvil */}
      {showMap && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-0 md:p-4">
          <div className="bg-white w-full h-full md:rounded-xl md:w-full md:max-w-5xl md:h-[85vh] flex flex-col">
            <div className="p-3 md:p-4 border-b flex justify-between items-center">
              <div>
                <h2 className="text-lg md:text-xl font-bold">
                  Dibujar {nombre || 'potrero'}
                </h2>
                {potrerosParaMapa.length > 0 && (
                  <p className="text-xs text-gray-500 mt-0.5">
                    Los potreros existentes aparecen en gris
                  </p>
                )}
              </div>
              <button
                onClick={() => setShowMap(false)}
                className="text-gray-500 hover:text-gray-700 text-2xl w-8 h-8 flex items-center justify-center"
              >
                ✕
              </button>
            </div>
            <div className="flex-1">
              <MapaPoligono 
                onPolygonComplete={handlePolygonComplete}
                initialCenter={initialCenter}
                initialZoom={initialCenter ? 16 : 8}
                existingPolygons={potrerosParaMapa}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}