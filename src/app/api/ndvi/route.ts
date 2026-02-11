// app/api/ndvi/route.ts
import { NextRequest, NextResponse } from 'next/server'
import * as GeoTIFF from 'geotiff'
import { createCanvas } from 'canvas'
import sharp from 'sharp'
import { prisma } from '@/lib/prisma'
import { uploadNDVIImageToSupabase } from '@/lib/supabase-storage'

// ⏰ Cache válido por 5 días (Sentinel-2 pasa cada ~5 días)
const CACHE_DAYS = 5

// 🎨 PALETA FIELDDATA REAL - Extraída de imagen fielddata1.png
// NDVI bajo (seco) → NDVI alto (vegetación sana)
// Naranja → Amarillo → Verde lima → Verde claro → Verde oscuro
const FIELDDATA_COLORS_RGB = [
  { r: 190, g: 75, b: 35 },    // 0: Naranja rojizo (muy seco/suelo)
  { r: 220, g: 110, b: 40 },   // 1: Naranja intenso
  { r: 245, g: 150, b: 55 },   // 2: Naranja claro
  { r: 250, g: 190, b: 70 },   // 3: Amarillo anaranjado
  { r: 245, g: 220, b: 90 },   // 4: Amarillo dorado
  { r: 225, g: 235, b: 110 },  // 5: Amarillo verdoso
  { r: 195, g: 225, b: 120 },  // 6: Verde lima claro
  { r: 160, g: 210, b: 120 },  // 7: Verde claro
  { r: 120, g: 190, b: 100 },  // 8: Verde medio
  { r: 80, g: 165, b: 80 },    // 9: Verde intenso
  { r: 50, g: 140, b: 60 },    // 10: Verde oscuro
  { r: 30, g: 110, b: 45 },    // 11: Verde muy oscuro (vegetación densa)
]

// 🌊 Color especial para AGUA (NDVI negativo) - verde muy oscuro como FieldData
const WATER_COLOR = { r: 20, g: 55, b: 35 }  // Verde muy oscuro casi negro

// 🎨 Interpolación con escala DINÁMICA (como FieldData)
// Mapea el rango [minNDVI, maxNDVI] a toda la paleta de colores
function getColorFromNDVIDynamic(
  ndvi: number,
  minNDVI: number,
  maxNDVI: number
): { r: number, g: number, b: number } {
  const colors = FIELDDATA_COLORS_RGB

  // 🌊 AGUA: NDVI negativo → verde muy oscuro (como en FieldData)
  if (ndvi < 0) {
    return WATER_COLOR
  }

  // Para vegetación (NDVI >= 0), usar escala dinámica
  // Ajustar el rango para solo valores positivos si hay agua
  const effectiveMin = Math.max(0, minNDVI)
  const effectiveMax = maxNDVI
  const range = effectiveMax - effectiveMin

  if (range <= 0.01) {
    // Si el rango es muy pequeño, usar color medio
    return colors[Math.floor(colors.length / 2)]
  }

  // t va de 0 (effectiveMin) a 1 (effectiveMax)
  let t = (ndvi - effectiveMin) / range
  t = Math.max(0, Math.min(1, t)) // Clamp a [0, 1]

  // Aplicar curva de contraste (gamma) para mejor separación de tonos
  // Gamma < 1 = más contraste en verdes altos
  const gamma = 0.85
  t = Math.pow(t, gamma)

  // Mapear t a índice en la paleta (0 a colors.length-1)
  const indexFloat = t * (colors.length - 1)
  const indexLow = Math.floor(indexFloat)
  const indexHigh = Math.min(indexLow + 1, colors.length - 1)
  const fraction = indexFloat - indexLow

  // Interpolación entre los dos colores
  const c1 = colors[indexLow]
  const c2 = colors[indexHigh]

  return {
    r: Math.round(c1.r + fraction * (c2.r - c1.r)),
    g: Math.round(c1.g + fraction * (c2.g - c1.g)),
    b: Math.round(c1.b + fraction * (c2.b - c1.b)),
  }
}

// 🖼️ Verificar si un punto está dentro del polígono
function puntoEnPoligono(lat: number, lng: number, coords: number[][]): boolean {
  let dentro = false
  for (let i = 0, j = coords.length - 1; i < coords.length; j = i++) {
    const xi = coords[i][0], yi = coords[i][1]
    const xj = coords[j][0], yj = coords[j][1]

    const intersecta = ((yi > lat) !== (yj > lat)) &&
      (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi)

    if (intersecta) dentro = !dentro
  }
  return dentro
}

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
// 🔹 2) Procesar TIFF y generar imagen PNG coloreada
// ===============================================
async function calcularNDVIMatriz(imageBuffer: ArrayBuffer, poligonoCoords: number[][]) {
  try {
    const tiff = await GeoTIFF.fromArrayBuffer(imageBuffer)
    const image = await tiff.getImage()
    const data = await image.readRasters()

    const ndviValues = data[0] as Float32Array
    const width = image.getWidth()
    const height = image.getHeight()
    const bbox = image.getBoundingBox()
    const [west, south, east, north] = bbox

    console.log(`📐 Imagen NDVI: ${width}x${height} píxeles`)
    console.log(`📦 BBox:`, bbox)

    // 🔍 PRIMERA PASADA: Calcular min/max NDVI dentro del polígono
    let validCount = 0
    let sum = 0
    let min = Infinity
    let max = -Infinity

    // Array para guardar qué píxeles están dentro del polígono
    const dentroPoligono: boolean[] = new Array(width * height).fill(false)

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x
        const value = ndviValues[idx]

        const lng = west + (x / width) * (east - west)
        const lat = north - (y / height) * (north - south)

        if (puntoEnPoligono(lat, lng, poligonoCoords)) {
          dentroPoligono[idx] = true
          if (!isNaN(value) && isFinite(value) && value >= -1 && value <= 1) {
            sum += value
            validCount++
            if (value < min) min = value
            if (value > max) max = value
          }
        }
      }
    }

    console.log(`📊 Rango NDVI detectado: ${min.toFixed(3)} a ${max.toFixed(3)}`)
    console.log(`🎨 Aplicando escala DINÁMICA para maximizar contraste`)

    // 🎨 SEGUNDA PASADA: Colorear con escala dinámica
    const canvas = createCanvas(width, height)
    const ctx = canvas.getContext('2d')
    const imageData = ctx.createImageData(width, height)
    const pixels = imageData.data

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x
        const pixelIdx = idx * 4
        const value = ndviValues[idx]

        if (dentroPoligono[idx]) {
          if (!isNaN(value) && isFinite(value) && value >= -1 && value <= 1) {
            // 🎨 Usar escala dinámica con min/max del campo
            const color = getColorFromNDVIDynamic(value, min, max)
            pixels[pixelIdx] = color.r
            pixels[pixelIdx + 1] = color.g
            pixels[pixelIdx + 2] = color.b
            pixels[pixelIdx + 3] = 255 // 100% opaco
          } else {
            // Píxel sin datos = gris oscuro opaco
            pixels[pixelIdx] = 80
            pixels[pixelIdx + 1] = 80
            pixels[pixelIdx + 2] = 80
            pixels[pixelIdx + 3] = 255
          }
        } else {
          // Fuera del polígono = transparente
          pixels[pixelIdx] = 0
          pixels[pixelIdx + 1] = 0
          pixels[pixelIdx + 2] = 0
          pixels[pixelIdx + 3] = 0
        }
      }
    }

    ctx.putImageData(imageData, 0, 0)

    console.log(`✅ Píxeles válidos: ${validCount} de ${width * height} (${Math.round((validCount / (width * height)) * 100)}%)`)
    console.log(`📊 Rango NDVI: ${min.toFixed(3)} a ${max.toFixed(3)}`)

    if (validCount === 0) {
      console.warn('⚠️ No se encontraron píxeles válidos')
      return {
        promedio: null,
        imagenBase64: null,
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

    // 🖼️ Convertir a PNG con procesamiento profesional usando Sharp
    const rawPngBuffer = canvas.toBuffer('image/png')

    console.log(`🔧 Aplicando procesamiento de imagen profesional...`)

    // 🎨 PROCESAMIENTO PROFESIONAL:
    // 1. Blur gaussiano ligero para suavizar transiciones (como FieldData)
    // 2. Unsharp mask para recuperar nitidez en bordes importantes
    // 3. Optimización PNG
    const processedBuffer = await sharp(rawPngBuffer)
      // Suavizado gaussiano ligero - elimina ruido y suaviza transiciones
      .blur(0.8)
      // Unsharp mask - recupera nitidez en bordes (amount, radius, threshold)
      .sharpen({
        sigma: 1.0,      // Radio del kernel
        m1: 0.5,         // Flat areas (menos sharpening)
        m2: 1.5,         // Jagged areas (más sharpening en bordes)
      })
      // PNG optimizado
      .png({
        compressionLevel: 6,
        adaptiveFiltering: true,
      })
      .toBuffer()

    const imagenBase64 = `data:image/png;base64,${processedBuffer.toString('base64')}`

    console.log(`🖼️ Imagen PNG generada: ${Math.round(rawPngBuffer.length / 1024)} KB → ${Math.round(processedBuffer.length / 1024)} KB (procesada)`)

    return {
      promedio,
      imagenBase64,
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
      imagenBase64: null,
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
        width: 2000,
        height: 2000,
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

    const ndviData = await calcularNDVIMatriz(imageBuffer, coordinates)

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
// 🔹 5) POST Handler con CACHE
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

    const resultados: Record<string, any> = {}
    const lotesParaProcesar: typeof lotes = []
    const cacheMinDate = new Date(Date.now() - CACHE_DAYS * 24 * 60 * 60 * 1000)

    // 🔍 PASO 1: Verificar cache para cada lote
    for (const lote of lotes) {
      if (!lote.coordenadas || lote.coordenadas.length === 0) {
        console.warn(`⚠️ Lote ${lote.id} no tiene coordenadas`)
        continue
      }

      // Buscar imagen cacheada reciente
      const cachedImage = await prisma.nDVIImage.findFirst({
        where: {
          loteId: lote.id,
          scale: 'dynamic',
          createdAt: { gte: cacheMinDate },
        },
        orderBy: { createdAt: 'desc' },
      })

      if (cachedImage) {
        // ✅ CACHE HIT - Usar imagen guardada
        console.log(`✅ CACHE HIT para lote ${lote.id} (${cachedImage.imagenDate.toISOString().split('T')[0]})`)

        resultados[lote.id] = {
          promedio: cachedImage.avgNdvi,
          imagenUrl: cachedImage.imagenUrl, // URL en vez de base64
          imagenBase64: null, // No enviamos base64 si hay URL
          width: cachedImage.width,
          height: cachedImage.height,
          bbox: cachedImage.bbox,
          confiabilidad: 1, // Asumimos buena calidad si está cacheada
          min: cachedImage.minNdvi,
          max: cachedImage.maxNdvi,
          fecha: cachedImage.imagenDate.toISOString().split('T')[0],
          cloudCoverage: cachedImage.cloudIndex,
          source: cachedImage.source,
          resolution: '10m',
          fromCache: true,
        }
      } else {
        // ❌ CACHE MISS - Agregar a lista para procesar
        console.log(`❌ CACHE MISS para lote ${lote.id}`)
        lotesParaProcesar.push(lote)
      }
    }

    // 🚀 PASO 2: Procesar lotes sin cache EN LOTES PARALELOS
    if (lotesParaProcesar.length > 0) {
      if (!process.env.COPERNICUS_CLIENT_ID || !process.env.COPERNICUS_CLIENT_SECRET) {
        console.error('❌ Credenciales de Copernicus no configuradas')
        return NextResponse.json(
          { error: 'Credenciales de Copernicus no configuradas' },
          { status: 500 }
        )
      }

      console.log(`\n🔐 Obteniendo token de acceso para ${lotesParaProcesar.length} lotes...`)
      const accessToken = await getAccessToken()

      // 🔄 Procesar en lotes de 3 para no sobrecargar Sentinel Hub
      const BATCH_SIZE = 3
      const DELAY_BETWEEN_BATCHES = 1000 // 1 segundo entre lotes

      for (let i = 0; i < lotesParaProcesar.length; i += BATCH_SIZE) {
        const batch = lotesParaProcesar.slice(i, i + BATCH_SIZE)
        console.log(`\n📦 Procesando lote ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(lotesParaProcesar.length / BATCH_SIZE)} (${batch.length} potreros)...`)

        // Procesar batch en paralelo
        const batchPromises = batch.map(async (lote) => {
          try {
            console.log(`  🌾 Procesando ${lote.id}...`)
            const ndviData = await calcularNDVI(lote.coordenadas, accessToken)

            if (ndviData.promedio !== null && ndviData.imagenBase64) {
              // 💾 GUARDAR EN CACHE
              try {
                const base64Data = ndviData.imagenBase64.replace(/^data:image\/png;base64,/, '')
                const imageBuffer = Buffer.from(base64Data, 'base64')
                const imagenDate = new Date(ndviData.fecha || Date.now())

                const uploadResult = await uploadNDVIImageToSupabase(
                  imageBuffer,
                  lote.id,
                  imagenDate,
                  'dynamic'
                )

                if (uploadResult) {
                  await prisma.nDVIImage.create({
                    data: {
                      loteId: lote.id,
                      imagenUrl: uploadResult.url,
                      imagenDate,
                      scale: 'dynamic',
                      minNdvi: ndviData.min,
                      maxNdvi: ndviData.max,
                      avgNdvi: ndviData.promedio,
                      cloudIndex: ndviData.cloudCoverage,
                      bbox: ndviData.bbox,
                      width: ndviData.width,
                      height: ndviData.height,
                      fileSize: uploadResult.fileSize,
                      source: 'Sentinel-2 L2A',
                    },
                  })

                  console.log(`  ✅ ${lote.id} guardado en cache`)

                  return {
                    loteId: lote.id,
                    data: {
                      promedio: ndviData.promedio,
                      imagenUrl: uploadResult.url,
                      imagenBase64: null,
                      width: ndviData.width,
                      height: ndviData.height,
                      bbox: ndviData.bbox,
                      confiabilidad: ndviData.totalPixels > 0
                        ? ndviData.validPixels / ndviData.totalPixels
                        : 0,
                      min: ndviData.min,
                      max: ndviData.max,
                      fecha: ndviData.fecha,
                      cloudCoverage: ndviData.cloudCoverage,
                      source: ndviData.source,
                      resolution: ndviData.resolution,
                      fromCache: false,
                    }
                  }
                }
              } catch (cacheError) {
                console.error(`  ⚠️ Error cache ${lote.id}:`, cacheError)
              }
            }

            // Si no se pudo cachear, devolver base64
            return {
              loteId: lote.id,
              data: {
                promedio: ndviData.promedio,
                imagenBase64: ndviData.imagenBase64,
                imagenUrl: null,
                width: ndviData.width,
                height: ndviData.height,
                bbox: ndviData.bbox,
                confiabilidad: ndviData.totalPixels > 0
                  ? ndviData.validPixels / ndviData.totalPixels
                  : 0,
                min: ndviData.min,
                max: ndviData.max,
                fecha: ndviData.fecha,
                cloudCoverage: ndviData.cloudCoverage,
                source: ndviData.source,
                resolution: ndviData.resolution,
                fromCache: false,
              }
            }
          } catch (error: any) {
            console.error(`  ❌ Error ${lote.id}:`, error.message)
            return {
              loteId: lote.id,
              data: {
                promedio: null,
                imagenBase64: null,
                imagenUrl: null,
                width: 0,
                height: 0,
                bbox: [0, 0, 0, 0],
                confiabilidad: 0,
                min: null,
                max: null,
                fecha: null,
                cloudCoverage: null,
                source: 'Sentinel-2 L2A',
                resolution: '10m',
                error: error.message,
                fromCache: false,
              }
            }
          }
        })

        // Esperar que termine el batch
        const batchResults = await Promise.all(batchPromises)
        batchResults.forEach(result => {
          resultados[result.loteId] = result.data
        })

        // Delay entre batches para no sobrecargar
        if (i + BATCH_SIZE < lotesParaProcesar.length) {
          await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES))
        }
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