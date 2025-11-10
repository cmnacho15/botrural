'use client'

import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Polygon, useMapEvents, Marker } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Fix para los iconos de Leaflet en Next.js
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

type MapaPoligonoProps = {
  onPolygonComplete: (coordinates: number[][]) => void
  initialCenter?: [number, number]
  initialZoom?: number
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
      }
      if (e.key === 'Escape') {
        setPoints([])
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
    </>
  )
}

export default function MapaPoligono({ 
  onPolygonComplete, 
  initialCenter = [-34.9011, -56.1645], // Uruguay por defecto
  initialZoom = 15 
}: MapaPoligonoProps) {
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
  }, [])

  if (!isClient) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-100 rounded-lg">
        <p className="text-gray-500">Cargando mapa...</p>
      </div>
    )
  }

  return (
    <div className="relative w-full h-full">
      <MapContainer
        center={initialCenter}
        zoom={initialZoom}
        className="w-full h-full rounded-lg z-0"
        style={{ height: '100%', width: '100%' }}
      >
        {/* Capa satelital de Esri */}
        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          attribution='&copy; <a href="https://www.esri.com/">Esri</a>'
        />
        
        {/* Componente para dibujar */}
        <DrawPolygon onComplete={onPolygonComplete} />
      </MapContainer>

      {/* Instrucciones */}
      <div className="absolute bottom-4 left-4 bg-white px-4 py-2 rounded-lg shadow-lg z-[1000]">
        <p className="text-sm text-gray-700 font-medium">
          Clickeá en el mapa para dibujar. Presioná <kbd className="px-2 py-1 bg-gray-200 rounded">Enter</kbd> para confirmar.
        </p>
      </div>
    </div>
  )
}