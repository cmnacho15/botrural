'use client'

import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Polygon, useMapEvents, Marker, useMap } from 'react-leaflet'
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

  useMapEvents({
    click(e) {
      setPoints((prev) => [...prev, [e.latlng.lat, e.latlng.lng]])
    },
  })

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && points.length >= 3) {
        onComplete(points)
        setPoints([])
      }
      if (e.key === 'Escape') {
        setPoints([])
      }
      // NUEVO: Deshacer último punto con Backspace
      if (e.key === 'Backspace' && points.length > 0) {
        setPoints(prev => prev.slice(0, -1))
      }
    }
    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [points, onComplete])

  return (
    <>
      {points.map((point, idx) => (
        <Marker key={idx} position={point} />
      ))}
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
      {points.length >= 2 && points.length < 3 && (
        <Polygon
          positions={points}
          pathOptions={{
            color: '#FFD700',
            fillColor: 'transparent',
            weight: 3,
            dashArray: '5, 10',
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

  // Cargar potreros existentes
  useEffect(() => {
    setIsClient(true)
    
    const fetchLotes = async () => {
      try {
        const res = await fetch('/api/lotes')
        if (res.ok) {
          const data = await res.json()
          setLotes(data)
        }
      } catch (error) {
        console.error('Error cargando potreros:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchLotes()
  }, [])

  if (!isClient) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-100 rounded-lg">
        <p className="text-gray-500">Cargando mapa...</p>
      </div>
    )
  }

  // Determinar el centro del mapa
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
        
        {/* Mostrar potreros existentes */}
        {!loading && lotesConPoligono.map((lote) => (
          <Polygon
            key={lote.id}
            positions={lote.poligono!.map(p => [p[0], p[1]] as [number, number])}
            pathOptions={{
              color: '#22c55e',
              fillColor: '#22c55e',
              fillOpacity: 0.2,
              weight: 2,
            }}
          >
            {/* Tooltip con nombre del potrero */}
          </Polygon>
        ))}

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
          <p className="text-xs text-green-600 mt-2 font-medium">
            ✓ Mostrando {lotesConPoligono.length} potrero{lotesConPoligono.length > 1 ? 's' : ''} existente{lotesConPoligono.length > 1 ? 's' : ''}
          </p>
        )}
      </div>
    </div>
  )
}