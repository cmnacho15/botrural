// src/app/api/altimetria/route.ts
import { NextRequest, NextResponse } from 'next/server'
import * as GeoTIFF from 'geotiff'
import sharp from 'sharp'
import { prisma } from '@/lib/prisma'
import { uploadAltimetriaImageToSupabase } from '@/lib/supabase-storage'

// 🎨 Paleta terrain cartográfica profesional (alta saturación)
// Inspirada en mapas topográficos suizos/alemanes
const TERRAIN_PALETTE = [
  { elev: 0.00, r: 5, g: 113, b: 176 },    // #0571b0 - Azul (valles bajos/agua)
  { elev: 0.10, r: 40, g: 140, b: 100 },   // #288c64 - Verde azulado
  { elev: 0.25, r: 60, g: 167, b: 69 },    // #3ca745 - Verde intenso
  { elev: 0.40, r: 127, g: 205, b: 81 },   // #7fcd51 - Verde claro
  { elev: 0.50, r: 200, g: 230, b: 100 },  // #c8e664 - Verde-amarillo
  { elev: 0.60, r: 240, g: 228, b: 66 },   // #f0e442 - Amarillo
  { elev: 0.70, r: 245, g: 180, b: 70 },   // #f5b446 - Naranja claro
  { elev: 0.80, r: 220, g: 130, b: 60 },   // #dc823c - Naranja
  { elev: 0.90, r: 180, g: 90, b: 50 },    // #b45a32 - Marrón rojizo
  { elev: 1.00, r: 140, g: 60, b: 40 },    // #8c3c28 - Marrón oscuro (cimas)
]

// 🎨 Paleta pendiente (verde → amarillo → rojo)
const SLOPE_PALETTE = [
  { slope: 0, r: 34, g: 139, b: 34 },     // Verde - plano
  { slope: 5, r: 144, g: 238, b: 144 },   // Verde claro
  { slope: 10, r: 255, g: 255, b: 0 },    // Amarillo
  { slope: 15, r: 255, g: 165, b: 0 },    // Naranja
  { slope: 20, r: 255, g: 69, b: 0 },     // Rojo-naranja
  { slope: 30, r: 139, g: 0, b: 0 },      // Rojo oscuro
]

// 🔧 Interpolación de color para terrain
function getTerrainColor(normalizedElev: number): { r: number; g: number; b: number } {
  const t = Math.max(0, Math.min(1, normalizedElev))

  for (let i = 0; i < TERRAIN_PALETTE.length - 1; i++) {
    if (t >= TERRAIN_PALETTE[i].elev && t <= TERRAIN_PALETTE[i + 1].elev) {
      const range = TERRAIN_PALETTE[i + 1].elev - TERRAIN_PALETTE[i].elev
      const fraction = (t - TERRAIN_PALETTE[i].elev) / range

      return {
        r: Math.round(TERRAIN_PALETTE[i].r + fraction * (TERRAIN_PALETTE[i + 1].r - TERRAIN_PALETTE[i].r)),
        g: Math.round(TERRAIN_PALETTE[i].g + fraction * (TERRAIN_PALETTE[i + 1].g - TERRAIN_PALETTE[i].g)),
        b: Math.round(TERRAIN_PALETTE[i].b + fraction * (TERRAIN_PALETTE[i + 1].b - TERRAIN_PALETTE[i].b)),
      }
    }
  }

  return TERRAIN_PALETTE[TERRAIN_PALETTE.length - 1]
}

// 🔧 Interpolación de color para pendiente
function getSlopeColor(slopeDegrees: number): { r: number; g: number; b: number } {
  const s = Math.max(0, slopeDegrees)

  for (let i = 0; i < SLOPE_PALETTE.length - 1; i++) {
    if (s >= SLOPE_PALETTE[i].slope && s <= SLOPE_PALETTE[i + 1].slope) {
      const range = SLOPE_PALETTE[i + 1].slope - SLOPE_PALETTE[i].slope
      const fraction = (s - SLOPE_PALETTE[i].slope) / range

      return {
        r: Math.round(SLOPE_PALETTE[i].r + fraction * (SLOPE_PALETTE[i + 1].r - SLOPE_PALETTE[i].r)),
        g: Math.round(SLOPE_PALETTE[i].g + fraction * (SLOPE_PALETTE[i + 1].g - SLOPE_PALETTE[i].g)),
        b: Math.round(SLOPE_PALETTE[i].b + fraction * (SLOPE_PALETTE[i + 1].b - SLOPE_PALETTE[i].b)),
      }
    }
  }

  return SLOPE_PALETTE[SLOPE_PALETTE.length - 1]
}

// 📍 Verificar si un punto está dentro del polígono
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

// 🗺️ Calcular qué tile Copernicus necesitamos
function getTileName(lat: number, lon: number): string {
  const latTile = Math.ceil(Math.abs(lat))
  const lonTile = Math.ceil(Math.abs(lon))
  const latDir = lat < 0 ? 'S' : 'N'
  const lonDir = lon < 0 ? 'W' : 'E'

  const latStr = latTile.toString().padStart(2, '0')
  const lonStr = lonTile.toString().padStart(3, '0')

  return `Copernicus_DSM_COG_10_${latDir}${latStr}_00_${lonDir}${lonStr}_00_DEM`
}

// 📥 Obtener URL del DEM en AWS S3
function getDEMUrl(tileName: string): string {
  return `https://copernicus-dem-30m.s3.eu-central-1.amazonaws.com/${tileName}/${tileName}.tif`
}

// 🧮 Calcular pendiente (slope) usando método de Horn
function calculateSlope(
  elevations: Float32Array,
  width: number,
  height: number,
  cellSize: number
): Float32Array {
  const slopes = new Float32Array(width * height)

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x

      const a = elevations[(y - 1) * width + (x - 1)]
      const b = elevations[(y - 1) * width + x]
      const c = elevations[(y - 1) * width + (x + 1)]
      const d = elevations[y * width + (x - 1)]
      const f = elevations[y * width + (x + 1)]
      const g = elevations[(y + 1) * width + (x - 1)]
      const h = elevations[(y + 1) * width + x]
      const i = elevations[(y + 1) * width + (x + 1)]

      const dzdx = ((c + 2 * f + i) - (a + 2 * d + g)) / (8 * cellSize)
      const dzdy = ((g + 2 * h + i) - (a + 2 * b + c)) / (8 * cellSize)

      slopes[idx] = Math.atan(Math.sqrt(dzdx * dzdx + dzdy * dzdy)) * (180 / Math.PI)
    }
  }

  return slopes
}

// ☀️ Calcular Hillshade profesional (iluminación 3D visible desde arriba)
// Azimuth: 315° (luz desde noroeste), Altitude: 35° (bajo para sombras largas)
function calculateHillshade(
  elevations: Float32Array,
  width: number,
  height: number,
  cellSize: number,
  azimuth: number = 315,
  altitude: number = 35,  // Más bajo = sombras más largas
  zFactor: number = 8.0   // Muy alto para Uruguay (terreno muy suave)
): Float32Array {
  const hillshade = new Float32Array(width * height)

  // Convertir a radianes
  const azimuthRad = (360 - azimuth + 90) * Math.PI / 180
  const altitudeRad = altitude * Math.PI / 180

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x

      // Vecinos 3x3 con exageración vertical extrema
      const a = elevations[(y - 1) * width + (x - 1)] * zFactor
      const b = elevations[(y - 1) * width + x] * zFactor
      const c = elevations[(y - 1) * width + (x + 1)] * zFactor
      const d = elevations[y * width + (x - 1)] * zFactor
      const f = elevations[y * width + (x + 1)] * zFactor
      const g = elevations[(y + 1) * width + (x - 1)] * zFactor
      const h = elevations[(y + 1) * width + x] * zFactor
      const i = elevations[(y + 1) * width + (x + 1)] * zFactor

      // Gradientes (método Horn)
      const dzdx = ((c + 2 * f + i) - (a + 2 * d + g)) / (8 * cellSize)
      const dzdy = ((g + 2 * h + i) - (a + 2 * b + c)) / (8 * cellSize)

      // Slope y aspect
      const slope = Math.atan(Math.sqrt(dzdx * dzdx + dzdy * dzdy))
      let aspect = Math.atan2(dzdy, -dzdx)
      if (aspect < 0) aspect += 2 * Math.PI

      // Hillshade
      let shade = Math.sin(altitudeRad) * Math.cos(slope) +
                  Math.cos(altitudeRad) * Math.sin(slope) * Math.cos(azimuthRad - aspect)

      // Expandir rango para máximo contraste
      shade = (shade - 0.1) / 0.9
      shade = Math.max(0, Math.min(1, shade))

      // Curva de contraste (gamma) para más drama
      shade = Math.pow(shade, 0.8)

      hillshade[idx] = shade
    }
  }

  // Rellenar bordes
  for (let x = 0; x < width; x++) {
    hillshade[x] = hillshade[width + x]
    hillshade[(height - 1) * width + x] = hillshade[(height - 2) * width + x]
  }
  for (let y = 0; y < height; y++) {
    hillshade[y * width] = hillshade[y * width + 1]
    hillshade[y * width + width - 1] = hillshade[y * width + width - 2]
  }

  return hillshade
}

// 🎨 Blend mode: Multiply (como Photoshop/GDAL)
function blendMultiply(base: number, blend: number): number {
  return (base * blend) / 255
}

// 🎨 Blend mode: Soft Light (para refuerzo de profundidad)
function blendSoftLight(base: number, blend: number): number {
  const b = base / 255
  const s = blend / 255
  let result: number
  if (s <= 0.5) {
    result = b - (1 - 2 * s) * b * (1 - b)
  } else {
    const d = b <= 0.25 ? ((16 * b - 12) * b + 4) * b : Math.sqrt(b)
    result = b + (2 * s - 1) * (d - b)
  }
  return Math.round(result * 255)
}

// 🎭 Crear máscara SVG del polígono con antialiasing
function createPolygonMaskSVG(
  coords: number[][],
  width: number,
  height: number,
  bbox: number[]
): string {
  const [west, south, east, north] = bbox

  // Convertir coordenadas geográficas a píxeles
  const points = coords.map(([lng, lat]) => {
    const x = ((lng - west) / (east - west)) * width
    const y = ((north - lat) / (north - south)) * height
    return `${x},${y}`
  }).join(' ')

  return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <polygon points="${points}" fill="white"/>
  </svg>`
}

// 🖼️ Generar imagen con terrain + hillshade combinados (técnica cartográfica profesional)
// Stack: Hillshade base → Color hipsométrico (multiply) → Hillshade refuerzo (soft-light)
async function generateTerrainWithHillshade(
  elevations: Float32Array,
  hillshade: Float32Array,
  width: number,
  height: number,
  minElev: number,
  maxElev: number,
  coords: number[][],
  bbox: number[]
): Promise<Buffer> {
  const pixels = new Uint8Array(width * height * 4)
  const elevRange = maxElev - minElev

  // Generar imagen COMPLETA (sin máscara punto a punto)
  for (let i = 0; i < elevations.length; i++) {
    const pixelIdx = i * 4
    const elev = elevations[i]

    if (isFinite(elev) && elev > -500) {
      // Normalizar elevación
      const normalizedElev = elevRange > 0 ? (elev - minElev) / elevRange : 0.5

      // CAPA 1: Hillshade base
      const shadeValue = Math.round(hillshade[i] * 255)

      // CAPA 2: Color hipsométrico con blend MULTIPLY
      const terrain = getTerrainColor(normalizedElev)
      const multiplyOpacity = 0.75
      let r = blendMultiply(shadeValue, terrain.r)
      let g = blendMultiply(shadeValue, terrain.g)
      let b = blendMultiply(shadeValue, terrain.b)

      r = Math.round(shadeValue * (1 - multiplyOpacity) + r * multiplyOpacity)
      g = Math.round(shadeValue * (1 - multiplyOpacity) + g * multiplyOpacity)
      b = Math.round(shadeValue * (1 - multiplyOpacity) + b * multiplyOpacity)

      // CAPA 3: Hillshade refuerzo con blend SOFT-LIGHT
      const softLightOpacity = 0.35
      const finalR = Math.round(r * (1 - softLightOpacity) + blendSoftLight(r, shadeValue) * softLightOpacity)
      const finalG = Math.round(g * (1 - softLightOpacity) + blendSoftLight(g, shadeValue) * softLightOpacity)
      const finalB = Math.round(b * (1 - softLightOpacity) + blendSoftLight(b, shadeValue) * softLightOpacity)

      // Saturación
      const avg = (finalR + finalG + finalB) / 3
      const satBoost = 1.3
      pixels[pixelIdx] = Math.min(255, Math.round(avg + (finalR - avg) * satBoost))
      pixels[pixelIdx + 1] = Math.min(255, Math.round(avg + (finalG - avg) * satBoost))
      pixels[pixelIdx + 2] = Math.min(255, Math.round(avg + (finalB - avg) * satBoost))
      pixels[pixelIdx + 3] = 255
    } else {
      pixels[pixelIdx] = 128
      pixels[pixelIdx + 1] = 128
      pixels[pixelIdx + 2] = 128
      pixels[pixelIdx + 3] = 255
    }
  }

  // Escalar 4x con suavizado Lanczos
  const scaleFactor = 4
  const scaledWidth = width * scaleFactor
  const scaledHeight = height * scaleFactor

  // Crear máscara SVG con antialiasing
  const maskSvg = createPolygonMaskSVG(coords, scaledWidth, scaledHeight, bbox)

  // Generar imagen escalada
  const scaledImage = await sharp(pixels, {
    raw: { width, height, channels: 4 }
  })
    .resize(scaledWidth, scaledHeight, { kernel: 'lanczos3' })
    .png()
    .toBuffer()

  // Aplicar máscara SVG (bordes suaves con antialiasing)
  return sharp(scaledImage)
    .composite([{
      input: Buffer.from(maskSvg),
      blend: 'dest-in'
    }])
    .png({ compressionLevel: 6 })
    .toBuffer()
}

// 🖼️ Generar imagen de pendiente con hillshade profesional
async function generateSlopeWithHillshade(
  slopes: Float32Array,
  hillshade: Float32Array,
  width: number,
  height: number,
  coords: number[][],
  bbox: number[]
): Promise<Buffer> {
  const pixels = new Uint8Array(width * height * 4)

  for (let i = 0; i < slopes.length; i++) {
    const pixelIdx = i * 4
    const slope = slopes[i]

    if (isFinite(slope)) {
      // Hillshade base
      const shadeValue = Math.round(hillshade[i] * 255)

      // Color según pendiente
      const slopeColor = getSlopeColor(slope)

      // Blend multiply
      const multiplyOpacity = 0.7
      let r = blendMultiply(shadeValue, slopeColor.r)
      let g = blendMultiply(shadeValue, slopeColor.g)
      let b = blendMultiply(shadeValue, slopeColor.b)

      r = Math.round(shadeValue * (1 - multiplyOpacity) + r * multiplyOpacity)
      g = Math.round(shadeValue * (1 - multiplyOpacity) + g * multiplyOpacity)
      b = Math.round(shadeValue * (1 - multiplyOpacity) + b * multiplyOpacity)

      // Soft-light
      const softLightOpacity = 0.3
      const finalR = Math.round(r * (1 - softLightOpacity) + blendSoftLight(r, shadeValue) * softLightOpacity)
      const finalG = Math.round(g * (1 - softLightOpacity) + blendSoftLight(g, shadeValue) * softLightOpacity)
      const finalB = Math.round(b * (1 - softLightOpacity) + blendSoftLight(b, shadeValue) * softLightOpacity)

      // Saturación
      const avg = (finalR + finalG + finalB) / 3
      const satBoost = 1.25
      pixels[pixelIdx] = Math.min(255, Math.round(avg + (finalR - avg) * satBoost))
      pixels[pixelIdx + 1] = Math.min(255, Math.round(avg + (finalG - avg) * satBoost))
      pixels[pixelIdx + 2] = Math.min(255, Math.round(avg + (finalB - avg) * satBoost))
      pixels[pixelIdx + 3] = 255
    } else {
      pixels[pixelIdx] = 128
      pixels[pixelIdx + 1] = 128
      pixels[pixelIdx + 2] = 128
      pixels[pixelIdx + 3] = 255
    }
  }

  const scaleFactor = 4
  const scaledWidth = width * scaleFactor
  const scaledHeight = height * scaleFactor

  // Máscara SVG con antialiasing
  const maskSvg = createPolygonMaskSVG(coords, scaledWidth, scaledHeight, bbox)

  const scaledImage = await sharp(pixels, {
    raw: { width, height, channels: 4 }
  })
    .resize(scaledWidth, scaledHeight, { kernel: 'lanczos3' })
    .png()
    .toBuffer()

  return sharp(scaledImage)
    .composite([{
      input: Buffer.from(maskSvg),
      blend: 'dest-in'
    }])
    .png({ compressionLevel: 6 })
    .toBuffer()
}

// ===============================================
// 🔹 POST Handler - Procesar altimetría
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

    for (const lote of lotes) {
      if (!lote.coordenadas || lote.coordenadas.length < 3) {
        console.warn(`⚠️ Lote ${lote.id} no tiene coordenadas válidas`)
        continue
      }

      // 🔍 Verificar si ya existe en cache
      const cached = await prisma.altimetriaImage.findUnique({
        where: { loteId: lote.id },
      })

      if (cached) {
        console.log(`✅ CACHE HIT para lote ${lote.id}`)
        resultados[lote.id] = {
          elevacionMin: cached.elevacionMin,
          elevacionMax: cached.elevacionMax,
          elevacionPromedio: cached.elevacionPromedio,
          rangoElevacion: cached.rangoElevacion,
          pendientePromedio: cached.pendientePromedio,
          pendienteMax: cached.pendienteMax,
          heatmapUrl: cached.heatmapUrl,
          slopeUrl: cached.slopeUrl,
          bbox: cached.bbox,
          fromCache: true,
        }
        continue
      }

      console.log(`🏔️ Procesando altimetría para lote ${lote.id}...`)

      try {
        // Calcular bounding box del polígono con margen para cubrir todo
        const coords = lote.coordenadas as number[][]
        const lngs = coords.map(c => c[0])
        const lats = coords.map(c => c[1])

        // Agregar margen de 5% para asegurar cobertura completa
        const lngSpan = Math.max(...lngs) - Math.min(...lngs)
        const latSpan = Math.max(...lats) - Math.min(...lats)
        const margin = Math.max(lngSpan, latSpan) * 0.05

        const bbox = [
          Math.min(...lngs) - margin,
          Math.min(...lats) - margin,
          Math.max(...lngs) + margin,
          Math.max(...lats) + margin,
        ]

        // Determinar qué tile necesitamos
        const centerLat = (bbox[1] + bbox[3]) / 2
        const centerLon = (bbox[0] + bbox[2]) / 2
        const tileName = getTileName(centerLat, centerLon)
        const demUrl = getDEMUrl(tileName)

        console.log(`📥 Cargando DEM (COG): ${tileName}`)

        // Usar COG con range requests
        const tiff = await GeoTIFF.fromUrl(demUrl)
        const image = await tiff.getImage()

        const tiffWidth = image.getWidth()
        const tiffHeight = image.getHeight()
        const tiffBbox = image.getBoundingBox()
        const [tiffWest, tiffSouth, tiffEast, tiffNorth] = tiffBbox

        // Usar bbox exacto del polígono
        const readBbox = [
          Math.max(tiffWest, bbox[0]),
          Math.max(tiffSouth, bbox[1]),
          Math.min(tiffEast, bbox[2]),
          Math.min(tiffNorth, bbox[3]),
        ]

        // Calcular window de píxeles
        const windowX = Math.floor(((readBbox[0] - tiffWest) / (tiffEast - tiffWest)) * tiffWidth)
        const windowY = Math.floor(((tiffNorth - readBbox[3]) / (tiffNorth - tiffSouth)) * tiffHeight)
        const windowWidth = Math.ceil(((readBbox[2] - readBbox[0]) / (tiffEast - tiffWest)) * tiffWidth)
        const windowHeight = Math.ceil(((readBbox[3] - readBbox[1]) / (tiffNorth - tiffSouth)) * tiffHeight)

        console.log(`📐 Ventana: ${windowWidth}x${windowHeight}px`)

        // Leer porción del DEM
        const rasters = await image.readRasters({
          window: [windowX, windowY, windowX + windowWidth, windowY + windowHeight],
        })
        const elevations = rasters[0] as Float32Array

        // Bbox de los datos leídos
        const readWest = tiffWest + (windowX / tiffWidth) * (tiffEast - tiffWest)
        const readNorth = tiffNorth - (windowY / tiffHeight) * (tiffNorth - tiffSouth)
        const readEast = tiffWest + ((windowX + windowWidth) / tiffWidth) * (tiffEast - tiffWest)
        const readSouth = tiffNorth - ((windowY + windowHeight) / tiffHeight) * (tiffNorth - tiffSouth)

        // Crear máscara del polígono
        const mask: boolean[] = new Array(windowWidth * windowHeight).fill(false)
        const clippedElevations = new Float32Array(windowWidth * windowHeight)

        let validCount = 0
        let sum = 0
        let minElev = Infinity
        let maxElev = -Infinity

        for (let y = 0; y < windowHeight; y++) {
          for (let x = 0; x < windowWidth; x++) {
            const idx = y * windowWidth + x
            const lng = readWest + (x / windowWidth) * (readEast - readWest)
            const lat = readNorth - (y / windowHeight) * (readNorth - readSouth)

            if (puntoEnPoligono(lat, lng, coords)) {
              mask[idx] = true
              const elev = elevations[idx]

              if (isFinite(elev) && elev > -500 && elev < 9000) {
                clippedElevations[idx] = elev
                validCount++
                sum += elev
                minElev = Math.min(minElev, elev)
                maxElev = Math.max(maxElev, elev)
              }
            }
          }
        }

        if (validCount === 0) {
          console.error(`❌ No se encontraron datos válidos para ${lote.id}`)
          resultados[lote.id] = { error: 'No se encontraron datos de elevación' }
          continue
        }

        const avgElev = sum / validCount
        const rangoElev = maxElev - minElev

        console.log(`📊 Elevación: ${minElev.toFixed(1)}m - ${maxElev.toFixed(1)}m (rango: ${rangoElev.toFixed(1)}m)`)

        // Calcular Hillshade (efecto 3D)
        console.log(`☀️ Calculando hillshade...`)
        const cellSize = 30
        const hillshade = calculateHillshade(clippedElevations, windowWidth, windowHeight, cellSize)

        // Calcular pendientes
        const slopes = calculateSlope(clippedElevations, windowWidth, windowHeight, cellSize)

        let slopeSum = 0, slopeCount = 0, maxSlope = 0
        for (let i = 0; i < slopes.length; i++) {
          if (mask[i] && isFinite(slopes[i])) {
            slopeSum += slopes[i]
            slopeCount++
            maxSlope = Math.max(maxSlope, slopes[i])
          }
        }
        const avgSlope = slopeCount > 0 ? slopeSum / slopeCount : 0

        console.log(`📐 Pendiente: prom ${avgSlope.toFixed(1)}°, máx ${maxSlope.toFixed(1)}°`)

        // Bbox final (necesario para la máscara SVG)
        const finalBbox = [readWest, readSouth, readEast, readNorth]

        // Generar imágenes profesionales con hillshade y bordes suaves
        console.log(`🎨 Generando imágenes con hillshade + antialiasing (4x upscale)...`)

        const heatmapBuffer = await generateTerrainWithHillshade(
          clippedElevations, hillshade, windowWidth, windowHeight,
          minElev, maxElev, coords, finalBbox
        )

        const slopeBuffer = await generateSlopeWithHillshade(
          slopes, hillshade, windowWidth, windowHeight, coords, finalBbox
        )

        console.log(`📤 Subiendo a Supabase...`)

        // Subir a Supabase
        const heatmapUpload = await uploadAltimetriaImageToSupabase(heatmapBuffer, lote.id, 'heatmap')
        const slopeUpload = await uploadAltimetriaImageToSupabase(slopeBuffer, lote.id, 'slope')

        // Guardar en base de datos
        await prisma.altimetriaImage.create({
          data: {
            loteId: lote.id,
            elevacionMin: minElev,
            elevacionMax: maxElev,
            elevacionPromedio: avgElev,
            rangoElevacion: rangoElev,
            pendientePromedio: avgSlope,
            pendienteMax: maxSlope,
            heatmapUrl: heatmapUpload?.url || null,
            slopeUrl: slopeUpload?.url || null,
            bbox: finalBbox as any,
            width: windowWidth * 4, // 4x upscaled
            height: windowHeight * 4,
          },
        })

        console.log(`✅ Altimetría guardada para ${lote.id}`)

        resultados[lote.id] = {
          elevacionMin: minElev,
          elevacionMax: maxElev,
          elevacionPromedio: avgElev,
          rangoElevacion: rangoElev,
          pendientePromedio: avgSlope,
          pendienteMax: maxSlope,
          heatmapUrl: heatmapUpload?.url,
          slopeUrl: slopeUpload?.url,
          bbox: finalBbox,
          fromCache: false,
        }

      } catch (loteError: any) {
        console.error(`❌ Error procesando lote ${lote.id}:`, loteError.message)
        resultados[lote.id] = { error: loteError.message }
      }
    }

    return NextResponse.json({ altimetria: resultados })

  } catch (error: any) {
    console.error('❌ Error general en API altimetría:', error)
    return NextResponse.json(
      { error: error.message || 'Error procesando altimetría' },
      { status: 500 }
    )
  }
}
