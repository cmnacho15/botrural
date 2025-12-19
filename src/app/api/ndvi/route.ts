// app/api/ndvi/route.ts
import { NextRequest, NextResponse } from 'next/server'
import * as GeoTIFF from 'geotiff'

// ===============================================
// 🔹 1) Obtener token de Copernicus
// ===============================================
async function getAccessToken() {
  const tokenResponse = await fetch(
    'https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: process.env.COPERNICUS_CLIENT_ID!,
        client_secret: process.env.COPERNICUS_CLIENT_SECRET!,
      }),
    }
  )

  if (!tokenResponse.ok) {
    const error = await tokenResponse.text()
    console.error('Error obteniendo token:', error)
    throw new Error('Error obteniendo token de Copernicus')
  }

  const data = await tokenResponse.json()
  return data.access_token
}

// ===============================================
// 🔹 2) Procesar matriz NDVI desde TIFF
// ===============================================
async function calcularNDVIMatriz(imageBuffer: ArrayBuffer) {
  try {
    const tiff = await GeoTIFF.fromArrayBuffer(imageBuffer)
    const image = await tiff.getImage()
    const data = await image.readRasters()

    const ndviValues = data[0] as Float32Array
    const width = image.getWidth()
    const height = image.getHeight()
    const bbox = image.getBoundingBox()

    console.log(`📐 Imagen NDVI: ${width}x${height} píxeles`)
    console.log(`📦 BBox:`, bbox)

    const matriz: number[][] = []
    let validCount = 0
    let sum = 0
    let min = Infinity
    let max = -Infinity

    for (let y = 0; y < height; y++) {
      const fila: number[] = []
      for (let x = 0; x < width; x++) {
        const idx = y * width + x
        const value = ndviValues[idx]

        // Valores NDVI válidos están entre -1 y 1
        if (!isNaN(value) && isFinite(value) && value >= -1 && value <= 1) {
          fila.push(value)
          sum += value
          validCount++
          if (value < min) min = value
          if (value > max) max = value
        } else {
          fila.push(-999) // Marcador de píxel inválido
        }
      }
      matriz.push(fila)
    }

    console.log(`✅ Píxeles válidos: ${validCount} de ${width * height} (${Math.round((validCount / (width * height)) * 100)}%)`)
    console.log(`📊 Rango NDVI: ${min.toFixed(3)} a ${max.toFixed(3)}`)

    // Si no hay datos válidos, devolver null
    if (validCount === 0) {
      console.warn('⚠️ No se encontraron píxeles válidos')
      return {
        promedio: null,
        matriz: [],
        width: 0,
        height: 0,
        bbox: [0, 0, 0, 0],
        validPixels: 0,
        totalPixels: width * height,
        min: null,
        max: null,
      }
    }

    const promedio = sum / validCount

    console.log(`📊 NDVI promedio: ${promedio.toFixed(3)}`)

    return {
      promedio,
      matriz,
      width,
      height,
      bbox,
      validPixels: validCount,
      totalPixels: width * height,
      min,
      max,
    }
  } catch (error) {
    console.error('❌ Error procesando TIFF:', error)
    return {
      promedio: null,
      matriz: [],
      width: 0,
      height: 0,
      bbox: [0, 0, 0, 0],
      validPixels: 0,
      totalPixels: 0,
      min: null,
      max: null,
    }
  }
}

// ===============================================
// 🔹 3) Buscar mejor imagen disponible con metadata
// ===============================================
async function buscarMejorImagen(bbox: number[], accessToken: string) {
  const endDate = new Date().toISOString().split('T')[0]
  const startDate = new Date(Date.now() - 45 * 86400000)
    .toISOString()
    .split('T')[0]

  console.log(`🔍 Buscando imágenes desde ${startDate} hasta ${endDate}`)

  try {
    // Buscar imágenes disponibles usando Catalog API
    const catalogUrl = 'https://sh.dataspace.copernicus.eu/api/v1/catalog/1.0.0/search'
    
    const catalogRequest = {
      bbox,
      datetime: `${startDate}T00:00:00Z/${endDate}T23:59:59Z`,
      collections: ['sentinel-2-l2a'],
      limit: 10, // Obtener últimas 10 imágenes
      filter: 'eo:cloud_cover < 50' // Máximo 50% nubes
    }

    const catalogResponse = await fetch(catalogUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(catalogRequest),
    })

    if (catalogResponse.ok) {
      const catalogData = await catalogResponse.json()
      
      if (catalogData.features && catalogData.features.length > 0) {
        // Ordenar por fecha (más reciente primero) y menor cobertura de nubes
        const sortedImages = catalogData.features
          .map((feature: any) => ({
            date: feature.properties.datetime,
            cloudCoverage: feature.properties['eo:cloud_cover'] || 0,
            id: feature.id
          }))
          .sort((a: any, b: any) => {
            // Primero por fecha (más reciente)
            const dateCompare = new Date(b.date).getTime() - new Date(a.date).getTime()
            if (dateCompare !== 0) return dateCompare
            // Luego por nubes (menos nubes)
            return a.cloudCoverage - b.cloudCoverage
          })

        const bestImage = sortedImages[0]
        console.log(`✅ Mejor imagen encontrada:`, {
          fecha: bestImage.date,
          nubes: `${bestImage.cloudCoverage.toFixed(1)}%`,
          id: bestImage.id
        })

        return {
          fecha: new Date(bestImage.date).toISOString().split('T')[0],
          cloudCoverage: bestImage.cloudCoverage,
          imageId: bestImage.id
        }
      }
    }
  } catch (error) {
    console.warn('⚠️ No se pudo obtener metadata del catálogo:', error)
  }

  // Si no se puede obtener del catálogo, estimar fecha
  return {
    fecha: endDate,
    cloudCoverage: null,
    imageId: null
  }
}

// ===============================================
// 🔹 4) Calcular NDVI desde Sentinel Hub
// ===============================================
async function calcularNDVI(coordinates: number[][], accessToken: string) {
  // Calcular bounding box
  // Las coordenadas vienen en formato GeoJSON: [lng, lat]
  const lngs = coordinates.map((c) => c[0])
  const lats = coordinates.map((c) => c[1])

  const bbox = [
    Math.min(...lngs),
    Math.min(...lats),
    Math.max(...lngs),
    Math.max(...lats),
  ]

  console.log(`📍 BBox calculado:`, bbox)

  // 🆕 Buscar mejor imagen disponible
  const imageMetadata = await buscarMejorImagen(bbox, accessToken)

  // Fechas: últimos 45 días
  const endDate = new Date().toISOString().split('T')[0]
  const startDate = new Date(Date.now() - 45 * 86400000)
    .toISOString()
    .split('T')[0]

  // Evalscript mejorado
  const evalscript = `
    //VERSION=3
    function setup() {
      return {
        input: [{
          bands: ["B04", "B08", "SCL"],
          units: "DN"
        }],
        output: {
          bands: 1,
          sampleType: "FLOAT32"
        }
      }
    }
    
    function evaluatePixel(sample) {
      // Filtrar nubes, sombras y nieve (SCL = Scene Classification Layer)
      // 3=cloud shadow, 8=cloud medium, 9=cloud high, 10=thin cirrus, 11=snow
      if (sample.SCL === 3 || sample.SCL === 8 || sample.SCL === 9 || 
          sample.SCL === 10 || sample.SCL === 11) {
        return [NaN]
      }
      
      // Calcular NDVI
      let ndvi = (sample.B08 - sample.B04) / (sample.B08 + sample.B04)
      
      // Validar rango
      if (isNaN(ndvi) || !isFinite(ndvi)) {
        return [NaN]
      }
      
      return [ndvi]
    }
  `

  try {
    const requestBody = {
      input: {
        bounds: {
          bbox,
          properties: { crs: 'http://www.opengis.net/def/crs/EPSG/0/4326' },
        },
        data: [
          {
            type: 'sentinel-2-l2a',
            dataFilter: {
              timeRange: {
                from: `${startDate}T00:00:00Z`,
                to: `${endDate}T23:59:59Z`,
              },
              maxCloudCoverage: 50,
              mosaickingOrder: 'leastCC',
            },
          },
        ],
      },
      output: {
        width: 256,
        height: 256,
        responses: [
          {
            identifier: 'default',
            format: { type: 'image/tiff' },
          },
        ],
      },
      evalscript,
    }

    console.log('🚀 Enviando request a Sentinel Hub...')

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000)

    const response = await fetch(
      'https://sh.dataspace.copernicus.eu/api/v1/process',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      }
    )

    clearTimeout(timeoutId)

    if (!response.ok) {
      const text = await response.text()
      console.error('❌ Error en Sentinel Hub:', response.status, text)
      
      if (response.status === 400) {
        console.warn('⚠️ No se encontraron imágenes Sentinel-2 para esta área/fecha')
      }
      
      throw new Error(`Error ${response.status}: ${text}`)
    }

    const imageBuffer = await response.arrayBuffer()
    console.log(`✅ Imagen descargada: ${imageBuffer.byteLength} bytes`)

    const ndviData = await calcularNDVIMatriz(imageBuffer)

    // 🆕 Agregar metadata de la imagen
    return {
      ...ndviData,
      fecha: imageMetadata.fecha,
      cloudCoverage: imageMetadata.cloudCoverage,
      source: 'Sentinel-2 L2A',
      resolution: '10m',
      imageId: imageMetadata.imageId,
    }
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.error('⏱️ Timeout: La request tardó más de 30 segundos')
    }
    console.error('❌ Error calculando NDVI:', error)
    throw error
  }
}

// ===============================================
// 🔹 5) POST Handler
// ===============================================
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { lotes } = body

    if (!lotes || !Array.isArray(lotes)) {
      return NextResponse.json(
        { error: 'Se requiere un array de lotes' },
        { status: 400 }
      )
    }

    if (!process.env.COPERNICUS_CLIENT_ID || !process.env.COPERNICUS_CLIENT_SECRET) {
      console.error('❌ Credenciales de Copernicus no configuradas')
      return NextResponse.json(
        { error: 'Credenciales de Copernicus no configuradas' },
        { status: 500 }
      )
    }

    console.log('🔐 Obteniendo token de acceso...')
    const accessToken = await getAccessToken()
    console.log('✅ Token obtenido')

    const resultados: Record<string, any> = {}

    for (const lote of lotes) {
      if (lote.coordenadas && lote.coordenadas.length > 0) {
        try {
          console.log(`\n🌾 Procesando lote ${lote.id}...`)
          const ndviData = await calcularNDVI(lote.coordenadas, accessToken)

          resultados[lote.id] = {
            promedio: ndviData.promedio,
            matriz: ndviData.matriz,
            width: ndviData.width,
            height: ndviData.height,
            bbox: ndviData.bbox,
            confiabilidad: ndviData.totalPixels > 0 
              ? ndviData.validPixels / ndviData.totalPixels 
              : 0,
            validPixels: ndviData.validPixels,
            totalPixels: ndviData.totalPixels,
            min: ndviData.min,
            max: ndviData.max,
            // 🆕 Metadata de calidad
            fecha: ndviData.fecha,
            cloudCoverage: ndviData.cloudCoverage,
            source: ndviData.source,
            resolution: ndviData.resolution,
            imageId: ndviData.imageId,
          }

          if (ndviData.promedio !== null) {
            console.log(
              `✅ NDVI ${lote.id}: ${ndviData.promedio.toFixed(3)} (${Math.round(
                (ndviData.validPixels / ndviData.totalPixels) * 100
              )}% válidos) - Fecha: ${ndviData.fecha}`
            )
          } else {
            console.log(`⚠️ Sin datos NDVI para lote ${lote.id}`)
          }
        } catch (error: any) {
          console.error(`❌ Error calculando NDVI para lote ${lote.id}:`, error.message)

          resultados[lote.id] = {
            promedio: null,
            matriz: [],
            width: 0,
            height: 0,
            bbox: [0, 0, 0, 0],
            confiabilidad: 0,
            validPixels: 0,
            totalPixels: 0,
            min: null,
            max: null,
            fecha: null,
            cloudCoverage: null,
            source: 'Sentinel-2 L2A',
            resolution: '10m',
            error: error.message,
          }
        }
      } else {
        console.warn(`⚠️ Lote ${lote.id} no tiene coordenadas`)
      }
    }

    return NextResponse.json({ ndvi: resultados })
  } catch (error: any) {
    console.error('❌ Error general en API NDVI:', error)
    return NextResponse.json(
      { error: error.message || 'Error obteniendo datos NDVI' },
      { status: 500 }
    )
  }
}