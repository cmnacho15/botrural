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
    throw new Error('Error obteniendo token de Copernicus')
  }

  const data = await tokenResponse.json()
  return data.access_token
}

// ===============================================
// 🔹 2) NUEVA FUNCIÓN: obtener matriz NDVI completa
// ===============================================

async function calcularNDVIMatriz(imageBuffer: ArrayBuffer) {
  try {
    const tiff = await GeoTIFF.fromArrayBuffer(imageBuffer)
    const image = await tiff.getImage()
    const data = await image.readRasters()

    const ndviValues = data[0] as Float32Array
    const width = await image.getWidth()
    const height = await image.getHeight()
    const bbox = await image.getBoundingBox()

    const matriz: number[][] = []
    let validCount = 0
    let sum = 0

    for (let y = 0; y < height; y++) {
      const fila: number[] = []
      for (let x = 0; x < width; x++) {
        const idx = y * width + x
        const value = ndviValues[idx]

        if (!isNaN(value) && value >= -1 && value <= 1) {
          fila.push(value)
          sum += value
          validCount++
        } else {
          fila.push(-999)
        }
      }
      matriz.push(fila)
    }

    // ✅ CAMBIO AQUÍ: Si no hay datos válidos, devolver null
    if (validCount === 0) {
      return {
        promedio: null,
        matriz: [],
        width: 0,
        height: 0,
        bbox: [0, 0, 0, 0],
        validPixels: 0,
        totalPixels: width * height,
      }
    }

    const promedio = sum / validCount  // Sin fallback

    return {
      promedio,
      matriz,
      width,
      height,
      bbox,
      validPixels: validCount,
      totalPixels: width * height,
    }
  } catch (error) {
    console.error('Error procesando TIFF:', error)
    return {
      promedio: null,  // ✅ También null en caso de error
      matriz: [],
      width: 0,
      height: 0,
      bbox: [0, 0, 0, 0],
      validPixels: 0,
      totalPixels: 0,
    }
  }
}

// ===============================================
// 🔹 3) Calcular NDVI (usa la nueva función)
// ===============================================

async function calcularNDVI(coordinates: number[][], accessToken: string) {
  const lats = coordinates.map((c) => c[0])
  const lngs = coordinates.map((c) => c[1])

  const bbox = [
    Math.min(...lngs),
    Math.min(...lats),
    Math.max(...lngs),
    Math.max(...lats),
  ]

  const endDate = new Date().toISOString().split('T')[0]
  const startDate = new Date(Date.now() - 30 * 86400000)
    .toISOString()
    .split('T')[0]

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
      if (sample.SCL === 3 || sample.SCL === 8 || sample.SCL === 9 || sample.SCL === 10) {
        return [NaN]
      }
      let ndvi = (sample.B08 - sample.B04) / (sample.B08 + sample.B04)
      return [ndvi]
    }
  `

  try {
    const response = await fetch(
      'https://sh.dataspace.copernicus.eu/api/v1/process',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
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
                  maxCloudCoverage: 30,
                },
              },
            ],
          },
          output: {
            width: 64,   // Reducido para optimizar
            height: 64,
            responses: [
              {
                identifier: 'default',
                format: { type: 'image/tiff' },
              },
            ],
          },
          evalscript,
        }),
      }
    )

    if (!response.ok) {
      const text = await response.text()
      console.error('Error en Sentinel Hub:', text)
      throw new Error(`Error obteniendo imagen: ${response.status}`)
    }

    const imageBuffer = await response.arrayBuffer()

    // --- NUEVO: retornar datos completos ---
    return await calcularNDVIMatriz(imageBuffer)
  } catch (error) {
    console.error('Error calculando NDVI:', error)
    throw error
  }
}

// ===============================================
// 🔹 4) POST Handler actualizado
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
      return NextResponse.json(
        { error: 'Credenciales de Copernicus no configuradas' },
        { status: 500 }
      )
    }

    const accessToken = await getAccessToken()
    const resultados: Record<string, any> = {}

    for (const lote of lotes) {
  if (lote.poligono && lote.poligono.length > 0) {  // ← Cambiar coordenadas por poligono
    try {
      console.log(`Calculando NDVI para lote ${lote.id}...`)
      const ndviData = await calcularNDVI(lote.poligono, accessToken)  // ← Cambiar

          resultados[lote.id] = {
            promedio: ndviData.promedio,
            matriz: ndviData.matriz,
            width: ndviData.width,
            height: ndviData.height,
            bbox: ndviData.bbox,
            confiabilidad: ndviData.validPixels / ndviData.totalPixels,
            validPixels: ndviData.validPixels,
            totalPixels: ndviData.totalPixels,
          }

          console.log(
            `NDVI ${lote.id}: ${ndviData.promedio.toFixed(3)} (${Math.round(
              (ndviData.validPixels / ndviData.totalPixels) * 100
            )}% válidos)`
          )
        } catch (error) {
          console.error(`Error calculando NDVI para lote ${lote.id}:`, error)

          resultados[lote.id] = {
            promedio: 0.5,
            matriz: [],
            width: 0,
            height: 0,
            bbox: [0, 0, 0, 0],
            confiabilidad: 0,
            validPixels: 0,
            totalPixels: 0,
          }
        }
      }
    }

    return NextResponse.json({ ndvi: resultados })
  } catch (error) {
    console.error('Error API NDVI:', error)
    return NextResponse.json(
      { error: 'Error obteniendo datos NDVI' },
      { status: 500 }
    )
  }
}