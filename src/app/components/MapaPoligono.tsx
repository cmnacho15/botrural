'use client'

import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Polygon, Polyline, useMapEvents, Marker, useMap, Tooltip } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Fix para los iconos de Leaflet en Next.js
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

type Lote = {
  id: string
  nombre: string
  hectareas: number
  poligono: number[][] | null
}

type MapaPoligonoProps = {
  onPolygonComplete: (coordinates: number[][]) => void
  initialCenter?: [number, number]
  initialZoom?: number
}

// Componente para ajustar el mapa a los bounds de todos los potreros
function FitBounds({ lotes }: { lotes: Lote[] }) {
  const map = useMap()

  useEffect(() => {
    const lotesConPoligono = lotes.filter(l => l.poligono && l.poligono.length > 0)
    
    if (lotesConPoligono.length > 0) {
      const allPoints: [number, number][] = []
      
      lotesConPoligono.forEach(lote => {
        if (lote.poligono) {
          lote.poligono.forEach(point => {
            allPoints.push([point[0], point[1]])
          })
        }
      })

      if (allPoints.length > 0) {
        const bounds = L.latLngBounds(allPoints)
        map.fitBounds(bounds, { padding: [50, 50] })
      }
    }
  }, [lotes, map])

  return null
}

function DrawPolygon({ onComplete }: { onComplete: (coords: number[][]) => void }) {
  const [points, setPoints] = useState<[number, number][]>([])
  const [currentPos, setCurrentPos] = useState<[number, number] | null>(null)

  useMapEvents({
    click(e) {
      setPoints((prev) => [...prev, [e.latlng.lat, e.latlng.lng]])
    },
    mousemove(e) {
      // Actualizar posición del cursor para mostrar la línea dinámica
      setCurrentPos([e.latlng.lat, e.latlng.lng])
    },
  })

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && points.length >= 3) {
        onComplete(points)
        setPoints([])
        setCurrentPos(null)
      }
      if (e.key === 'Escape') {
        setPoints([])
        setCurrentPos(null)
      }
      if (e.key === 'Backspace' && points.length > 0) {
        setPoints(prev => prev.slice(0, -1))
      }
    }
    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [points, onComplete])

  return (
    <>
      {/* Puntos clickeados */}
      {points.map((point, idx) => (
        <Marker key={idx} position={point} />
      ))}

      {/* Línea dinámica desde el último punto hasta el cursor */}
      {points.length > 0 && currentPos && (
        <Polyline
          positions={[points[points.length - 1], currentPos]}
          pathOptions={{
            color: '#FFD700',
            weight: 2,
            dashArray: '5, 5',
          }}
        />
      )}

      {/* Líneas entre los puntos clickeados */}
      {points.length >= 2 && (
        <Polyline
          positions={points}
          pathOptions={{
            color: '#FFD700',
            weight: 3,
          }}
        />
      )}

      {/* Polígono completo cuando hay 3+ puntos */}
      {points.length >= 3 && (
        <Polygon
          positions={points}
          pathOptions={{
            color: '#FFD700',
            fillColor: '#FFD700',
            fillOpacity: 0.3,
            weight: 3,
          }}
        />
      )}
    </>
  )
}

export default function MapaPoligono({ 
  onPolygonComplete, 
  initialCenter = [-34.9011, -56.1645],
  initialZoom = 15 
}: MapaPoligonoProps) {
  const [isClient, setIsClient] = useState(false)
  const [lotes, setLotes] = useState<Lote[]>([])
  const [loading, setLoading] = useState(true)

  // Colores para los potreros existentes
  const colors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316']

  // 🔄 Función para cargar/recargar potreros
  const fetchLotes = async () => {
    try {
      const res = await fetch('/api/lotes', {
        cache: 'no-store' // ✅ Evita caché
      })
      if (res.ok) {
        const data = await res.json()
        console.log('📦 Potreros cargados:', data.length)
        setLotes(data)
      }
    } catch (error) {
      console.error('Error cargando potreros:', error)
    } finally {
      setLoading(false)
    }
  }

  // 🚀 Cargar potreros al iniciar
  useEffect(() => {
    setIsClient(true)
    fetchLotes()
  }, [])

  // ⏱️ Auto-recargar cada 3 segundos para ver cambios nuevos
  useEffect(() => {
    const interval = setInterval(() => {
      console.log('🔄 Recargando potreros...')
      fetchLotes()
    }, 3000) // cada 3 segundos

    return () => clearInterval(interval)
  }, [])

  if (!isClient) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-100 rounded-lg">
        <p className="text-gray-500">Cargando mapa...</p>
      </div>
    )
  }

  const lotesConPoligono = lotes.filter(l => l.poligono && l.poligono.length > 0)
  const mapCenter = lotesConPoligono.length > 0 ? undefined : initialCenter

  return (
    <div className="relative w-full h-full">
      <MapContainer
        center={mapCenter}
        zoom={initialZoom}
        className="w-full h-full rounded-lg z-0"
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          attribution='&copy; <a href="https://www.esri.com/">Esri</a>'
        />
        
        {/* Mostrar potreros existentes con colores distintos */}
        {!loading && lotesConPoligono.map((lote, index) => {
          const color = colors[index % colors.length]
          return (
            <Polygon
              key={lote.id}
              positions={lote.poligono!.map(p => [p[0], p[1]] as [number, number])}
              pathOptions={{
                color: color,
                fillColor: color,
                fillOpacity: 0.4,
                weight: 3,
              }}
            >
              <Tooltip permanent direction="center" className="font-bold">
                {lote.nombre}
              </Tooltip>
            </Polygon>
          )
        })}

        {/* Ajustar bounds si hay potreros */}
        {lotesConPoligono.length > 0 && <FitBounds lotes={lotes} />}
        
        {/* Componente para dibujar nuevo potrero */}
        <DrawPolygon onComplete={onPolygonComplete} />
      </MapContainer>

      {/* Instrucciones mejoradas */}
      <div className="absolute bottom-4 left-4 bg-white px-4 py-3 rounded-lg shadow-lg z-[1000] max-w-md">
        <p className="text-sm text-gray-700 font-medium mb-2">
          📍 Clickeá en el mapa para dibujar el potrero
        </p>
        <div className="flex flex-wrap gap-2 text-xs text-gray-600">
          <div className="flex items-center gap-1">
            <kbd className="px-2 py-1 bg-gray-200 rounded font-mono">Enter</kbd>
            <span>Confirmar</span>
          </div>
          <div className="flex items-center gap-1">
            <kbd className="px-2 py-1 bg-gray-200 rounded font-mono">Esc</kbd>
            <span>Cancelar</span>
          </div>
          <div className="flex items-center gap-1">
            <kbd className="px-2 py-1 bg-gray-200 rounded font-mono">←</kbd>
            <span>Deshacer</span>
          </div>
        </div>
        {lotesConPoligono.length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-200">
            <p className="text-xs text-gray-600 font-medium mb-2">
              Potreros existentes ({lotesConPoligono.length}):
            </p>
            <div className="flex flex-wrap gap-2">
              {lotesConPoligono.map((lote, index) => (
                <div key={lote.id} className="flex items-center gap-1.5">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: colors[index % colors.length] }}
                  />
                  <span className="text-xs text-gray-700">{lote.nombre}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}