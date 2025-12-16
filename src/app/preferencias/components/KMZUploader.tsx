// src/app/preferencias/components/KMZUploader.tsx
'use client'

import { useState } from 'react'
import JSZip from 'jszip'
import * as turf from '@turf/turf'

type LotePreview = {
  nombre: string
  hectareas: number
  poligono: number[][]
}

export default function KMZUploader({ onComplete }: { onComplete: () => void }) {
  const [uploading, setUploading] = useState(false)
  const [previews, setPreviews] = useState<LotePreview[]>([])
  const [error, setError] = useState<string | null>(null)

  async function parseKMZ(file: File): Promise<LotePreview[]> {
    try {
      let kmlContent = ''

      // Si es KML directo, leerlo
      if (file.name.endsWith('.kml')) {
        kmlContent = await file.text()
      } 
      // Si es KMZ, descomprimirlo
      else {
        const zip = await JSZip.loadAsync(file)
        
        for (const filename in zip.files) {
          if (filename.endsWith('.kml')) {
            kmlContent = await zip.files[filename].async('text')
            break
          }
        }
      }

      if (!kmlContent) {
        throw new Error('No se encontró archivo KML dentro del KMZ')
      }

      // 3. Parsear KML a XML
      const parser = new DOMParser()
      const xmlDoc = parser.parseFromString(kmlContent, 'text/xml')

      // 4. Extraer placemarks (potreros)
      const placemarks = xmlDoc.getElementsByTagName('Placemark')
      const lotes: LotePreview[] = []

      for (let i = 0; i < placemarks.length; i++) {
        const placemark = placemarks[i]
        
        // Extraer nombre
        const nameElement = placemark.getElementsByTagName('name')[0]
        const nombre = nameElement?.textContent?.trim() || `Potrero ${i + 1}`

        // Extraer coordenadas
        const coordinatesElement = placemark.getElementsByTagName('coordinates')[0]
        if (!coordinatesElement) continue

        const coordsText = coordinatesElement.textContent?.trim()
        if (!coordsText) continue

        // Parsear coordenadas: "lng,lat,alt lng,lat,alt ..."
        const coords = coordsText
          .split(/\s+/)
          .map(coord => {
            const [lng, lat] = coord.split(',').map(parseFloat)
            return [lng, lat]
          })
          .filter(coord => !isNaN(coord[0]) && !isNaN(coord[1]))

        if (coords.length < 3) continue

        // Cerrar polígono si no está cerrado
        const firstCoord = coords[0]
        const lastCoord = coords[coords.length - 1]
        if (firstCoord[0] !== lastCoord[0] || firstCoord[1] !== lastCoord[1]) {
          coords.push([...firstCoord])
        }

        // Calcular hectáreas usando turf
        const polygon = turf.polygon([coords])
        const areaM2 = turf.area(polygon)
        const hectareas = parseFloat((areaM2 / 10000).toFixed(2))

        lotes.push({
          nombre,
          hectareas,
          poligono: coords
        })
      }

      return lotes
    } catch (err) {
      console.error('Error parseando KMZ:', err)
      throw new Error('Error al procesar el archivo KMZ')
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const isKMZ = file.name.endsWith('.kmz')
    const isKML = file.name.endsWith('.kml')

    if (!isKMZ && !isKML) {
      setError('Por favor selecciona un archivo .kmz o .kml')
      return
    }

    setUploading(true)
    setError(null)
    setPreviews([])

    try {
      const lotes = await parseKMZ(file)
      
      if (lotes.length === 0) {
        setError('No se encontraron potreros en el archivo')
        return
      }

      setPreviews(lotes)
    } catch (err: any) {
      setError(err.message || 'Error al procesar el archivo')
    } finally {
      setUploading(false)
    }
  }

  async function handleConfirm() {
    setUploading(true)
    setError(null)

    try {
      for (const lote of previews) {
        const response = await fetch('/api/lotes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nombre: lote.nombre,
            hectareas: lote.hectareas,
            poligono: lote.poligono,
            cultivos: [],
            animales: [],
            esPastoreable: true
          })
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || 'Error al crear potrero')
        }
      }

      alert(`✅ Se crearon ${previews.length} potreros exitosamente`)
      setPreviews([])
      onComplete()
    } catch (err: any) {
      setError(err.message || 'Error al guardar los potreros')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Upload Section */}
      {previews.length === 0 && (
        <div>
          {/* Instrucciones */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0">
                ?
              </div>
              <div>
                <h3 className="font-semibold text-blue-900 mb-3">Instrucciones</h3>
                <ol className="space-y-2 text-sm text-blue-800">
                  <li className="flex gap-2">
                    <span className="font-bold">1.</span>
                    <span>Subí un archivo de Google Earth <strong>(formato .KMZ o .KML)</strong></span>
                  </li>
                  <li className="flex gap-2">
                    <span className="font-bold">2.</span>
                    <span>Cada potrero de tu campo como un polígono diferente.</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="font-bold">3.</span>
                    <span>El nombre del potrero debe coincidir con el nombre del polígono.</span>
                  </li>
                </ol>
                <a href="#" className="text-blue-600 hover:underline text-sm font-medium mt-2 inline-block">
                  Video Demo
                </a>
                <span className="text-sm text-blue-700"> que explica cómo exportar un archivo KMZ desde Google Earth.</span>
              </div>
            </div>
          </div>

          {/* Zona de carga */}
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center hover:border-blue-400 transition">
            <div className="text-5xl mb-4">☁️</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Subir Archivo
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              Hacé clic arriba o arrastrá el archivo acá
            </p>
            
            <label className="inline-block cursor-pointer">
              <input
                type="file"
                accept=".kmz,.kml"
                onChange={handleFileUpload}
                disabled={uploading}
                className="hidden"
              />
              <span className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium inline-block">
                {uploading ? 'Procesando...' : 'Subir Archivo'}
              </span>
            </label>

            <p className="text-xs text-gray-400 mt-4">
              Permitidos: KMZ o KML
            </p>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <span className="text-2xl">⚠️</span>
          <div>
            <p className="font-medium text-red-900">Error</p>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      )}

      {/* Preview */}
      {previews.length > 0 && (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-2">
              ✅ Se encontraron {previews.length} potreros
            </h3>
            <p className="text-sm text-blue-700">
              Revisá los datos antes de confirmar
            </p>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Nombre
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Hectáreas
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Coordenadas
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {previews.map((lote, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <span className="text-sm font-medium text-gray-900">
                        {lote.nombre}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-700">
                        {lote.hectareas} ha
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs text-gray-500 font-mono">
                        {lote.poligono.length} puntos
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => {
                setPreviews([])
                setError(null)
              }}
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium text-gray-700"
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirm}
              disabled={uploading}
              className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium"
            >
              {uploading ? 'Creando potreros...' : `Crear ${previews.length} potreros`}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}