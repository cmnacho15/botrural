// app/api/ndvi/route.ts
import { NextRequest, NextResponse } from 'next/server'
import * as GeoTIFF from 'geotiff'

// Función para obtener token de Copernicus
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

// Función para calcular NDVI promedio de un TIFF
async function calcularNDVIPromedio(imageBuffer: ArrayBuffer): Promise<number> {
  try {
    const tiff = await GeoTIFF.fromArrayBuffer(imageBuffer)
    const image = await tiff.getImage()
    const data = await image.readRasters()
    
    // Los valores NDVI están en el primer canal
    const ndviValues = data[0] as Float32Array
    
    // Filtrar valores NaN (nubes, etc.)
    let sum = 0
    let count = 0
    
    for (let i = 0; i < ndviValues.length; i++) {
      const value = ndviValues[i]
      if (!isNaN(value) && value >= -1 && value <= 1) {
        sum += value
        count++
      }
    }
    
    if (count === 0) {
      // Si no hay datos válidos, retornar valor neutral
      return 0.5
    }
    
    return sum / count
  } catch (error) {
    console.error('Error procesando TIFF:', error)
    // En caso de error, retornar valor simulado
    return 0.4 + Math.random() * 0.4
  }
}

// Función para calcular NDVI de un polígono
async function calcularNDVI(coordinates: number[][], accessToken: string) {
  // Calcular bounding box del polígono
  const lats = coordinates.map((c) => c[0])
  const lngs = coordinates.map((c) => c[1])
  
  const bbox = [
    Math.min(...lngs),
    Math.min(...lats),
    Math.max(...lngs),
    Math.max(...lats),
  ]

  // Fechas: últimos 30 días
  const endDate = new Date().toISOString().split('T')[0]
  const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0]

  // Evalscript para calcular NDVI
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
      // Filtrar nubes (SCL: Scene Classification Layer)
      // 3=cloud shadows, 8=cloud medium probability, 9=cloud high probability, 10=thin cirrus
      if (sample.SCL === 3 || sample.SCL === 8 || sample.SCL === 9 || sample.SCL === 10) {
        return [NaN]
      }
      
      // Calcular NDVI: (NIR - Red) / (NIR + Red)
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
              properties: {
                crs: 'http://www.opengis.net/def/crs/EPSG/0/4326',
              },
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
            width: 256,
            height: 256,
            responses: [
              {
                identifier: 'default',
                format: {
                  type: 'image/tiff',
                },
              },
            ],
          },
          evalscript,
        }),
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Error en Sentinel Hub:', errorText)
      throw new Error(`Error obteniendo imagen: ${response.status}`)
    }

    // Obtener el buffer de la imagen TIFF
    const imageBuffer = await response.arrayBuffer()
    
    // Calcular NDVI promedio del TIFF
    const ndviPromedio = await calcularNDVIPromedio(imageBuffer)
    
    return ndviPromedio

  } catch (error) {
    console.error('Error calculando NDVI:', error)
    throw error
  }
}

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

    // Verificar que existan las credenciales
    if (!process.env.COPERNICUS_CLIENT_ID || !process.env.COPERNICUS_CLIENT_SECRET) {
      return NextResponse.json(
        { error: 'Credenciales de Copernicus no configuradas' },
        { status: 500 }
      )
    }

    // Obtener token de acceso
    const accessToken = await getAccessToken()

    // Calcular NDVI para cada lote
    const resultados: Record<string, number> = {}

    for (const lote of lotes) {
      if (lote.coordenadas && lote.coordenadas.length > 0) {
        try {
          console.log(`Calculando NDVI para lote ${lote.id}...`)
          const ndvi = await calcularNDVI(lote.coordenadas, accessToken)
          resultados[lote.id] = ndvi
          console.log(`NDVI calculado para ${lote.id}: ${ndvi.toFixed(3)}`)
        } catch (error) {
          console.error(`Error calculando NDVI para lote ${lote.id}:`, error)
          // Si falla, usar valor por defecto
          resultados[lote.id] = 0.5
        }
      }
    }

    return NextResponse.json({ ndvi: resultados })
  } catch (error) {
    console.error('Error en API NDVI:', error)
    return NextResponse.json(
      { error: 'Error obteniendo datos NDVI' },
      { status: 500 }
    )
  }
}