


too esto me paso claude en cuenta nach200nach@gmail.com

me hizo hacerme cuenta gratis e railway , poner en env de aca un nuevo renlgon y crear 

Next.js:

 Crear /app/api/altimetria/route.ts
 Modificar /app/dashboard/mapa/page.tsx (agregar vista altimetría)
 Modificar /app/components/MapaPoligono.tsx (agregar useEffect)
 Agregar ALTIMETRIA_WORKER_URL en .env.local 

🚀 CÓDIGO COMPLETO - IMPLEMENTACIÓN ALTIMETRÍA

📦 PARTE 1: WORKER DE RAILWAY (Repo separado)
1. Crear repo campo-altimetria-worker en GitHub
bash# En tu terminal
mkdir campo-altimetria-worker
cd campo-altimetria-worker
git init

📄 DockerfileDockerfile - Railway WorkerCódigo # Base image con GDAL
FROM ghcr.io/osgeo/gdal:ubuntu-small-3.8.0

# Instalar Node.js 20
RUN apt-get update && apt-get install -y \
    curl \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    &&
📄 package.jsonpackage.json - Railway WorkerCódigo {
  "name": "campo-altimetria-worker",
  "version": "1.0.0",
  "description": "Worker para procesar altimetría con GDAL",
  "main": "src/server.js",
  "scripts": {
    "start": "node src/server.js",
    "dev": "nodemon src/server.js"
  },
  "dependen
📄 .gitignore.gitignore - Railway WorkerCódigo node_modules/
npm-debug.log
.env
.DS_Store
temp/
*.tif
*.las
*.png
📄 src/server.jssrc/server.js - Express ServerCódigo const express = require('express')
const cors = require('cors')
const { procesarAltimetria } = require('./processor')

const app = express()
const PORT = process.env.PORT || 3000

// Middleware
app.use(cors())
app.use(express.json())

// Health check
📄 src/processor.js (Parte 1 - CORE del procesamiento)src/processor.js - Procesamiento GDALCódigo const { exec } = require('child_process')
const { promisify } = require('util')
const fs = require('fs').promises
const path = require('path')
const fetch = require('node-fetch')
const sharp = require('sharp')
const { uploadToSupabase, saveToCache } 
📄 src/supabase.jssrc/supabase.js - Cliente SupabaseCódigo const { createClient } = require('@supabase/supabase-js')
const fs = require('fs').promises

// Inicializar cliente Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
)

/**
 * Subir imagen PNG a Supabase S
📄 README.md (documentación del worker)README.md - Railway WorkerDocumento # 🗺️ Campo Altimetria Worker

Worker para procesar datos de altimetría de Uruguay usando GDAL.

## 🚀 Deploy en Railway

### 1. Conectar repo con Railway
- Ir a [railway.app](https://railway.app)
- New Project → Deploy from GitHub repo
- Seleccionar
🚀 Subir Worker a GitHub
bash# En la carpeta campo-altimetria-worker/
git add .
git commit -m "Initial commit - Altimetria worker"
git remote add origin https://github.com/TU_USUARIO/campo-altimetria-worker.git
git branch -M main
git push -u origin main

⏭️ ¿SIGUIENTE PASO?
Ahora te paso:

✅ API Routes de Next.js (/app/api/altimetria/...)
✅ Modificaciones en MapaPoligono.tsx
✅ Modificaciones en page.tsx 





//  /app/dashboard/mapa/page.tsx 

'use client'

import { useState, useEffect, useMemo } from 'react'
import dynamic from 'next/dynamic'

const MapaPoligono = dynamic(() => import('@/app/components/MapaPoligono'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-gray-100">
      <p className="text-gray-600">Cargando mapa...</p>
    </div>
  ),
})

interface Cultivo {
  id: string
  tipoCultivo: string
  hectareas: number
  fechaSiembra: string
}

interface Animal {
  id: string
  categoria: string
  cantidad: number
}

interface Lote {
  id: string
  nombre: string
  hectareas: number
  poligono: number[][]
  moduloPastoreoId: string | null  // 🔥 AGREGADO
  cultivos: Cultivo[]
  animalesLote: Animal[]
}

// 🎨 Colores por tipo de cultivo
const COLORES_CULTIVOS: Record<string, string> = {
  Soja: '#FFD700',
  'Maíz': '#FF69B4',
  Trigo: '#F4A460',
  Girasol: '#FFD700',
  Sorgo: '#DEB887',
  Cebada: '#D2691E',
  Avena: '#F5DEB3',
  Arroz: '#90EE90',
  Alfalfa: '#32CD32',
  Pradera: '#228B22',
}

// 🎨 Colores por módulo de pastoreo
const COLORES_MODULOS: string[] = [
  '#8B5CF6', // Violeta
  '#EC4899', // Rosa
  '#F59E0B', // Ámbar
  '#10B981', // Esmeralda
  '#3B82F6', // Azul
  '#EF4444', // Rojo
  '#14B8A6', // Teal
  '#F97316', // Naranja
  '#6366F1', // Índigo
  '#84CC16', // Lima
]

function getColorModulo(moduloIndex: number): string {
  return COLORES_MODULOS[moduloIndex % COLORES_MODULOS.length]
}

export default function MapaPage() {
  const [lotes, setLotes] = useState<Lote[]>([])
  const [loading, setLoading] = useState(true)
  const [vistaActual, setVistaActual] = useState<'indice' | 'cultivo' | 'ndvi' | 'curvas' | 'coneat'>(
  'indice',
)
  const [mapCenter, setMapCenter] = useState<[number, number]>([
    -32.5228, -55.7658,
  ])
  const [hayDatosCultivos, setHayDatosCultivos] = useState(false)
  const [loadingNDVI, setLoadingNDVI] = useState(false)
  const [ndviData, setNdviData] = useState<Record<string, any>>({})
  const [modulos, setModulos] = useState<Array<{id: string, nombre: string}>>([])
  const [opacidadCurvas, setOpacidadCurvas] = useState(95)
  
  // Memorizar el key para que no cambie cuando solo cambia opacidad
  const mapaKey = useMemo(() => 
    `vista-${vistaActual}-${lotes.length}-${Object.keys(ndviData).length}-mapa`,
    [vistaActual, lotes.length, Object.keys(ndviData).length]
  )

  // Cargar lotes y módulos
  useEffect(() => {
    cargarLotes()
    cargarModulos()
  }, [])

  async function cargarLotes() {
    try {
      const response = await fetch('/api/lotes')
      if (response.ok) {
        const data: Lote[] = await response.json()
        setLotes(data)

        const tieneCultivos = data.some(
          (lote) => lote.cultivos && lote.cultivos.length > 0,
        )
        setHayDatosCultivos(tieneCultivos)

        if (data.length > 0) {
          const todosLosPuntos = data
            .flatMap((l) => l.poligono || [])
            .filter((c) => c && c.length === 2)

          if (todosLosPuntos.length > 0) {
            const center = todosLosPuntos
              .reduce(
                (acc, p) => [acc[0] + p[0], acc[1] + p[1]],
                [0, 0] as [number, number],
              )
              .map((v) => v / todosLosPuntos.length) as [number, number]
            setMapCenter(center)
          }
        }
      }
    } catch (error) {
      console.error('Error cargando lotes:', error)
    } finally {
      setLoading(false)
    }
  }

  async function cargarModulos() {
    try {
      const response = await fetch('/api/modulos-pastoreo')
      if (response.ok) {
        const data = await response.json()
        setModulos(data)
      }
    } catch (error) {
      console.error('Error cargando módulos:', error)
    }
  }

  // 🛰️ Obtener NDVI
  async function obtenerNDVIPotreros() {
    if (lotes.length === 0) return

    setLoadingNDVI(true)

    try {
      const response = await fetch('/api/ndvi', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          lotes: lotes.map((l) => ({
            id: l.id,
            coordenadas: l.poligono,
          })),
        }),
      })

      if (!response.ok) {
        throw new Error('Error obteniendo NDVI')
      }

      const data = await response.json()

      console.log('📊 Datos NDVI recibidos:', data.ndvi)

      Object.keys(data.ndvi).forEach((loteId) => {
        const ndvi = data.ndvi[loteId]
        console.log(`Lote ${loteId}:`, {
          promedio: ndvi.promedio,
          tieneMatriz: ndvi.matriz?.length > 0,
          dimensiones: `${ndvi.width}x${ndvi.height}`,
          bbox: ndvi.bbox,
          validPixels: ndvi.validPixels,
          totalPixels: ndvi.totalPixels,
          porcentajeValido:
            ndvi.totalPixels > 0
              ? `${Math.round((ndvi.validPixels / ndvi.totalPixels) * 100)}%`
              : '0%',
          primerosValores: ndvi.matriz?.[0]?.slice(0, 5) || 'sin datos',
        })
      })

      setNdviData(data.ndvi)
    } catch (error) {
      console.error('Error obteniendo NDVI:', error)
      alert('Error obteniendo datos NDVI. Intenta de nuevo más tarde.')
    } finally {
      setLoadingNDVI(false)
    }
  }

  // Cargar NDVI cuando se pasa a vista ndvi
  useEffect(() => {
  if (vistaActual !== 'ndvi') return; // Solo ejecutar en NDVI

  const faltanDatos = lotes.some(
    (l) =>
      !ndviData[l.id] ||                        // No existe ese lote
      !ndviData[l.id].matriz ||                 // No tiene matriz
      ndviData[l.id].matriz.length === 0 ||     // Matriz vacía
      ndviData[l.id].validPixels === 0          // Sin pixeles válidos
  );

  if (faltanDatos && !loadingNDVI) {
    obtenerNDVIPotreros();
  }
}, [vistaActual, lotes, ndviData]);

  // 🎨 Color según NDVI
  function getColorNDVI(ndvi: number): string {
    if (ndvi < 0.2) return '#8B4513'
    if (ndvi < 0.3) return '#DAA520'
    if (ndvi < 0.4) return '#FFFF00'
    if (ndvi < 0.5) return '#ADFF2F'
    if (ndvi < 0.6) return '#7CFC00'
    if (ndvi < 0.7) return '#32CD32'
    if (ndvi < 0.8) return '#228B22'
    return '#006400'
  }
  
  // 📦 Preparar datos de leyenda para el mapa (solo vista General)
  const modulosLeyendaParaMapa = vistaActual === 'indice' 
    ? [
        ...modulos.map((modulo, index) => {
          const lotesDelModulo = lotes.filter(l => l.moduloPastoreoId === modulo.id)
          
          // Calcular animales por categoría
          const animalesPorCategoria: Record<string, number> = {}
          lotesDelModulo.forEach(lote => {
            lote.animalesLote?.forEach(animal => {
              if (!animalesPorCategoria[animal.categoria]) {
                animalesPorCategoria[animal.categoria] = 0
              }
              animalesPorCategoria[animal.categoria] += animal.cantidad
            })
          })
          const totalAnimales = Object.values(animalesPorCategoria).reduce((sum, c) => sum + c, 0)
          
          return {
            id: modulo.id,
            nombre: modulo.nombre,
            color: getColorModulo(index),
            cantidadPotreros: lotesDelModulo.length,
            hectareas: lotesDelModulo.reduce((sum, l) => sum + l.hectareas, 0),
            totalAnimales,
            animalesPorCategoria
          }
        }),
        ...(() => {
          const lotesSinModulo = lotes.filter(l => !l.moduloPastoreoId)
          if (lotesSinModulo.length === 0) return []
          
          // Calcular animales por categoría para sin módulo
          const animalesPorCategoria: Record<string, number> = {}
          lotesSinModulo.forEach(lote => {
            lote.animalesLote?.forEach(animal => {
              if (!animalesPorCategoria[animal.categoria]) {
                animalesPorCategoria[animal.categoria] = 0
              }
              animalesPorCategoria[animal.categoria] += animal.cantidad
            })
          })
          const totalAnimales = Object.values(animalesPorCategoria).reduce((sum, c) => sum + c, 0)
          
          return [{
            id: 'sin-modulo',
            nombre: 'Sin módulo',
            color: '#1212dd',
            cantidadPotreros: lotesSinModulo.length,
            hectareas: lotesSinModulo.reduce((sum, l) => sum + l.hectareas, 0),
            totalAnimales,
            animalesPorCategoria
          }]
        })()
      ]
    : []


  // Polígonos para el mapa
  const poligonosParaMapa = lotes
    .filter((l) => l.poligono && l.poligono.length > 0)
    .map((lote) => {
      let color = '#1212dd' // Azul Vista General (default si no tiene módulo)

      // 🔥 VISTA GENERAL: Color por módulo
      if (vistaActual === 'indice') {
        if (lote.moduloPastoreoId) {
          const moduloIndex = modulos.findIndex(m => m.id === lote.moduloPastoreoId)
          if (moduloIndex !== -1) {
            color = getColorModulo(moduloIndex)
          }
        }
      }
      // Vista cultivos
      else if (vistaActual === 'cultivo') {
        if (lote.cultivos && lote.cultivos.length > 0) {
          const cultivoPrincipal = lote.cultivos[0].tipoCultivo
          color = COLORES_CULTIVOS[cultivoPrincipal] || '#10b981'
        } else {
          color = '#D3D3D3'
        }
      } else if (vistaActual === 'ndvi') {
        const ndviInfo = ndviData[lote.id]
        if (
          ndviInfo &&
          typeof ndviInfo.promedio === 'number' &&
          ndviInfo.validPixels > 0
        ) {
          color = getColorNDVI(ndviInfo.promedio)
        } else {
          color = '#CCCCCC'
        }
      }

      return {
        id: lote.id,
        nombre: lote.nombre,
        coordinates: lote.poligono,
        color,
        info: {
          hectareas: lote.hectareas,
          cultivos: lote.cultivos,
          animales: lote.animalesLote,
          ndviMatriz:
            vistaActual === 'ndvi' ? ndviData[lote.id] || null : null,
        },
      }
    })

  // Resumen cultivos
  const resumenCultivos = lotes.reduce((acc, lote) => {
    lote.cultivos?.forEach((cultivo) => {
      if (!acc[cultivo.tipoCultivo]) {
        acc[cultivo.tipoCultivo] = 0
      }
      acc[cultivo.tipoCultivo] += cultivo.hectareas
    })
    return acc
  }, {} as Record<string, number>)

  if (loading) {
    return (
      <div className="min-h-[60vh] bg-gray-50 flex items-center justify-center rounded-xl">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Cargando mapa del campo...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-[calc(100vh-80px)] sm:h-[calc(100vh-90px)] bg-gray-50">
      <div className="max-w-7xl mx-auto h-full flex flex-col gap-4 px-3 sm:px-4 py-3 sm:py-4">
        {/* HEADER */}
        <div className="bg-white border border-gray-200 rounded-xl px-4 sm:px-6 py-4 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
              🗺️ Mapa del Campo
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              {lotes.length}{' '}
              {lotes.length === 1 ? 'potrero registrado' : 'potreros registrados'}
            </p>
          </div>

          {/* TOGGLE DE VISTAS */}
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="text-xs sm:text-sm text-gray-600 font-medium">
              Vista:
            </span>
            <div className="inline-flex rounded-lg border-2 border-gray-200 bg-white overflow-hidden">
              <button
                onClick={() => setVistaActual('indice')}
                className={`px-3 py-2 text-xs sm:text-sm font-medium transition ${
                  vistaActual === 'indice'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                🗺️ General
              </button>
              <button
                onClick={() => setVistaActual('cultivo')}
                className={`px-3 py-2 text-xs sm:text-sm font-medium transition ${
                  vistaActual === 'cultivo'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                🌾 Cultivos
              </button>
              <button
                onClick={() => setVistaActual('ndvi')}
                disabled={loadingNDVI}
                className={`px-3 py-2 text-xs sm:text-sm font-medium transition relative ${
                  vistaActual === 'ndvi'
                    ? 'bg-green-600 text-white'
                    : 'text-gray-700 hover:bg-gray-50'
                } ${loadingNDVI ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                🛰️ NDVI
                {loadingNDVI && (
                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full animate-pulse" />
                )}
              </button>
              <button
  onClick={() => setVistaActual('curvas')}
  className={`px-3 py-2 text-xs sm:text-sm font-medium transition ${
    vistaActual === 'curvas'
      ? 'bg-amber-600 text-white'
      : 'text-gray-700 hover:bg-gray-50'
  }`}
>
  📏 Curvas
</button>
<button
  onClick={() => setVistaActual('coneat')}
  className={`px-3 py-2 text-xs sm:text-sm font-medium transition ${
    vistaActual === 'coneat'
      ? 'bg-green-600 text-white'
      : 'text-gray-700 hover:bg-gray-50'
  }`}
>
  🌱 CONEAT
</button>
            </div>
          </div>
        </div>

        {/* CONTENIDO PRINCIPAL: MAPA + PANEL */}
        <div className="flex-1 flex flex-col lg:flex-row gap-4 min-h-0">
          {/* MAPA (izquierda en desktop, arriba en móvil) */}
          <div className="flex-1 bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden min-h-[260px] sm:min-h-[320px] lg:min-h-0 lg:h-full">
            <div className="relative w-full h-full">
              {lotes.length === 0 ? (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
                  <div className="text-center p-6 sm:p-8">
                    <div className="text-5xl sm:text-6xl mb-4">🗺️</div>
                    <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2">
                      No hay potreros registrados
                    </h3>
                    <p className="text-gray-600 mb-4 text-sm sm:text-base">
                      Creá tu primer potrero para ver el mapa del campo
                    </p>
                    <a
                      href="/dashboard/lotes/nuevo"
                      className="inline-block px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium text-sm sm:text-base"
                    >
                      + Crear Potrero
                    </a>
                  </div>
                </div>
              ) : (
                
  <MapaPoligono
  key={mapaKey}
  initialCenter={mapCenter}
  initialZoom={14}
  existingPolygons={poligonosParaMapa}
  readOnly={true}
  modulosLeyenda={modulosLeyendaParaMapa}
  mostrarLeyendaModulos={vistaActual === 'indice'}
  mostrarCurvasNivel={vistaActual === 'curvas'}
  mostrarConeat={vistaActual === 'coneat'}
  opacidadCurvas={opacidadCurvas}
  onOpacidadCurvasChange={setOpacidadCurvas}
/>
              )}
            </div>
          </div>

          {/* PANEL (derecha en desktop, abajo en móvil) */}
          <div className="w-full lg:w-[400px] bg-white border border-gray-200 rounded-xl shadow-sm flex flex-col lg:max-h-full">
            {/* Encabezado de panel */}
            <div className="px-4 sm:px-5 py-3 border-b border-gray-200 bg-white">
              <h2 className="text-sm sm:text-base font-semibold text-gray-900">
  {vistaActual === 'indice' && '🗺️ Vista General'}
  {vistaActual === 'cultivo' && '🌾 Cultivos por potrero'}
  {vistaActual === 'ndvi' && '🛰️ Índice de Vegetación (NDVI)'}
  {vistaActual === 'curvas' && '📏 Curvas de Nivel'}
  {vistaActual === 'coneat' && '🌱 Grupos CONEAT'}
</h2>
            </div>

            {/* Contenido del panel:
                - En móvil: ocupa su altura natural -> la página entera hace scroll
                - En desktop: scroll interno del panel (max alto) */}
            <div className="flex-1 bg-gray-50 px-4 sm:px-5 py-3 sm:py-4 lg:overflow-y-auto">
              
              {/* VISTA GENERAL (ÍNDICE) - Leyenda de módulos */}
              {vistaActual === 'indice' && modulos.length > 0 && (
                <div className="mb-5">
                  <h3 className="text-xs sm:text-sm font-semibold text-gray-700 mb-2 sm:mb-3">
                    📦 Módulos de Pastoreo
                  </h3>
                  <div className="space-y-2">
                    {modulos.map((modulo, index) => {
                      const lotesDelModulo = lotes.filter(l => l.moduloPastoreoId === modulo.id)
                      const totalHa = lotesDelModulo.reduce((sum, l) => sum + l.hectareas, 0)
                      
                      return (
                        <div
                          key={modulo.id}
                          className="flex items-center justify-between p-2.5 sm:p-3 rounded-lg border border-gray-200 hover:bg-gray-100 transition"
                          style={{
                            backgroundColor: `${getColorModulo(index)}20`,
                          }}
                        >
                          <div className="flex items-center gap-2.5 sm:gap-3">
                            <div
                              className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded"
                              style={{
                                backgroundColor: getColorModulo(index),
                              }}
                            />
                            <span className="font-medium text-gray-900 text-xs sm:text-sm">
                              {modulo.nombre}
                            </span>
                            <span className="text-[11px] sm:text-xs text-gray-500">
                              ({lotesDelModulo.length} potrero{lotesDelModulo.length !== 1 ? 's' : ''}, {totalHa.toFixed(1)} ha)
                            </span>
                          </div>
                        </div>
                      )
                    })}
                    
                    {/* Potreros sin módulo */}
                    {(() => {
                      const lotesSinModulo = lotes.filter(l => !l.moduloPastoreoId)
                      if (lotesSinModulo.length === 0) return null
                      
                      const totalHa = lotesSinModulo.reduce((sum, l) => sum + l.hectareas, 0)
                      
                      return (
                        <div
                          className="flex items-center justify-between p-2.5 sm:p-3 rounded-lg border border-gray-200 hover:bg-gray-100 transition bg-gray-50"
                        >
                          <div className="flex items-center gap-2.5 sm:gap-3">
                            <div
                              className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded"
                              style={{ backgroundColor: '#1212dd' }}
                            />
                            <span className="font-medium text-gray-900 text-xs sm:text-sm">
                              Sin módulo
                            </span>
                            <span className="text-[11px] sm:text-xs text-gray-500">
                              ({lotesSinModulo.length} potrero{lotesSinModulo.length !== 1 ? 's' : ''}, {totalHa.toFixed(1)} ha)
                            </span>
                          </div>
                        </div>
                      )
                    })()}
                  </div>
                </div>
              )}

              {/* VISTA NDVI */}
              {vistaActual === 'ndvi' && (
                <>
                  {loadingNDVI ? (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4 mb-4">
                      <div className="flex items-center gap-3">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
                        <p className="text-sm text-gray-700">
                          Obteniendo datos satelitales...
                        </p>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* 🛰️ Info satelital */}
                      {Object.keys(ndviData).length > 0 &&
                        (() => {
                          const primeraImagen = ndviData[Object.keys(ndviData)[0]]
                          if (!primeraImagen) return null

                          return (
                            <div className="mb-4 bg-gradient-to-r from-blue-50 to-green-50 border border-blue-200 rounded-lg p-3 sm:p-4">
                              <h3 className="text-xs sm:text-sm font-semibold text-gray-800 mb-2">
                                🛰️ Información Satelital
                              </h3>
                              <div className="space-y-2 text-xs sm:text-[13px]">
                                {primeraImagen.fecha && (
                                  <div className="flex justify-between gap-2">
                                    <span className="text-gray-600">📅 Fecha:</span>
                                    <span className="font-semibold text-gray-900">
                                      {new Date(
                                        primeraImagen.fecha,
                                      ).toLocaleDateString('es-UY', {
                                        year: 'numeric',
                                        month: 'long',
                                        day: 'numeric',
                                      })}
                                    </span>
                                  </div>
                                )}
                                <div className="flex justify-between gap-2">
                                  <span className="text-gray-600">🛰️ Satélite:</span>
                                  <span className="font-medium text-gray-800">
                                    {primeraImagen.source || 'Sentinel-2'}
                                  </span>
                                </div>
                                {primeraImagen.cloudCoverage !== null &&
                                  primeraImagen.cloudCoverage !== undefined && (
                                    <div className="flex justify-between gap-2">
                                      <span className="text-gray-600">☁️ Nubes:</span>
                                      <span
                                        className={`font-medium ${
                                          primeraImagen.cloudCoverage < 20
                                            ? 'text-green-600'
                                            : primeraImagen.cloudCoverage < 40
                                            ? 'text-yellow-600'
                                            : 'text-red-600'
                                        }`}
                                      >
                                        {primeraImagen.cloudCoverage.toFixed(1)}%
                                      </span>
                                    </div>
                                  )}
                              </div>
                            </div>
                          )
                        })()}

                      {/* Escala NDVI */}
                      <div className="mb-5">
  <h3 className="text-xs sm:text-sm font-semibold text-gray-700 mb-2 sm:mb-3">
    📊 Escala de Vegetación
  </h3>
                        <div className="space-y-1.5 text-[11px] sm:text-xs">
                          {[
                            ['#006400', '0.8 - 1.0: Vegetación muy densa'],
                            ['#228B22', '0.7 - 0.8: Vegetación densa'],
                            ['#32CD32', '0.6 - 0.7: Vegetación media-alta'],
                            ['#7CFC00', '0.5 - 0.6: Vegetación media'],
                            ['#ADFF2F', '0.4 - 0.5: Vegetación baja-media'],
                            ['#FFFF00', '0.3 - 0.4: Vegetación baja'],
                            ['#DAA520', '0.2 - 0.3: Vegetación escasa'],
                            ['#8B4513', '0.0 - 0.2: Sin vegetación'],
                          ].map(([color, label]) => (
                            <div
                              key={label}
                              className="flex items-center gap-2 sm:gap-3"
                            >
                              <div
                                className="w-7 h-3 sm:w-8 sm:h-4 rounded"
                                style={{ backgroundColor: color as string }}
                              />
                              <span>{label}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <button
                        onClick={obtenerNDVIPotreros}
                        className="w-full mb-4 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-xs sm:text-sm font-medium"
                      >
                        🔄 Actualizar Datos NDVI
                      </button>

                      {/* Calidad de datos */}
                      {Object.keys(ndviData).length > 0 &&
                        (() => {
                          const totalPotreros = Object.keys(ndviData).length
                          const potrerosConDatos = Object.values(ndviData).filter(
                            (d: any) => d.validPixels > 0,
                          ).length
                          const coberturaPromedio =
                            (Object.values(ndviData).reduce(
                              (sum: number, d: any) =>
                                sum + ((d.validPixels / d.totalPixels) || 0),
                              0,
                            ) /
                              totalPotreros) *
                            100

                          return (
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 text-[11px] sm:text-xs">
                              <p className="text-gray-700 font-semibold mb-2">
                                📊 Calidad de Datos
                              </p>
                              <ul className="space-y-1.5 text-gray-600">
                                <li className="flex items-center gap-2">
                                  <span
                                    className={
                                      potrerosConDatos === totalPotreros
                                        ? 'text-green-600'
                                        : 'text-yellow-600'
                                    }
                                  >
                                    {potrerosConDatos === totalPotreros
                                      ? '✅'
                                      : '⚠️'}
                                  </span>
                                  <span>
                                    {potrerosConDatos} de {totalPotreros} potreros con
                                    datos
                                  </span>
                                </li>
                                <li className="flex items-center gap-2">
                                  <span
                                    className={
                                      coberturaPromedio > 90
                                        ? 'text-green-600'
                                        : coberturaPromedio > 70
                                        ? 'text-yellow-600'
                                        : 'text-red-600'
                                    }
                                  >
                                    {coberturaPromedio > 90
                                      ? '✅'
                                      : coberturaPromedio > 70
                                      ? '⚠️'
                                      : '❌'}
                                  </span>
                                  <span>
                                    Cobertura: {coberturaPromedio.toFixed(1)}%
                                  </span>
                                </li>
                              </ul>
                            </div>
                          )
                        })()}

                      <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4 text-[11px] sm:text-xs">
                        <p className="text-gray-700">
                          <strong>🛰️ Datos satelitales:</strong> Los valores NDVI se
                          obtienen de imágenes Sentinel-2 de los últimos 45 días
                          (Copernicus).
                        </p>
                      </div>
                    </>
                  )}
                </>
              )}

              
              {/* VISTA CURVAS DE NIVEL */}
              {vistaActual === 'curvas' && (
                <>

                {/* Control de opacidad */}
                  <div className="mb-4 bg-white border border-gray-200 rounded-lg p-3 sm:p-4">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs sm:text-sm font-medium text-gray-700">
                        Opacidad del mapa
                      </label>
                      <span className="text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-1 rounded">
                        {opacidadCurvas}%
                      </span>
                    </div>
                    <input 
                      type="range" 
                      min="10" 
                      max="100" 
                      value={opacidadCurvas}
                      onChange={(e) => setOpacidadCurvas(Number(e.target.value))}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-amber-600"
                      style={{
                        background: `linear-gradient(to right, #d97706 0%, #d97706 ${opacidadCurvas}%, #e5e7eb ${opacidadCurvas}%, #e5e7eb 100%)`
                      }}
                    />
                    <div className="flex justify-between text-[10px] sm:text-xs text-gray-500 mt-1">
                      <span>Transparente</span>
                      <span>Opaco</span>
                    </div>
                  </div>

                  {/* Información */}
                  <div className="mb-5 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-lg p-3 sm:p-4">
                    <h3 className="text-xs sm:text-sm font-semibold text-gray-800 mb-2">
                      📏 Información de Curvas de Nivel
                    </h3>
                    <div className="space-y-2 text-xs sm:text-[13px] text-gray-700">
                      <div className="flex items-start gap-2">
                        <span>📐</span>
                        <span><strong>Intervalo:</strong> Curvas cada 10 metros de elevación</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span>🗺️</span>
                        <span><strong>Fuente:</strong> OpenTopoMap (datos topográficos abiertos)</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span>🌍</span>
                        <span><strong>Cobertura:</strong> Todo Uruguay y el mundo</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span>💡</span>
                        <span><strong>Uso:</strong> Identifica pendientes, zonas bajas/altas y planifica drenajes</span>
                      </div>
                    </div>
                  </div>

                  {/* Guía de interpretación */}
                  <div className="mb-5">
                    <h3 className="text-xs sm:text-sm font-semibold text-gray-700 mb-2 sm:mb-3">
                      📊 ¿Cómo interpretar?
                    </h3>
                    <div className="space-y-2 text-xs sm:text-[13px]">
                      <div className="p-2.5 bg-white rounded-lg border border-gray-200">
                        <p className="font-medium text-gray-900 mb-1">🔵 Líneas muy juntas</p>
                        <p className="text-gray-600">Pendiente pronunciada / Zona empinada</p>
                      </div>
                      <div className="p-2.5 bg-white rounded-lg border border-gray-200">
                        <p className="font-medium text-gray-900 mb-1">🔵 Líneas separadas</p>
                        <p className="text-gray-600">Pendiente suave / Zona plana</p>
                      </div>
                      <div className="p-2.5 bg-white rounded-lg border border-gray-200">
                        <p className="font-medium text-gray-900 mb-1">⭕ Círculos concéntricos</p>
                        <p className="text-gray-600">Cerros o lomadas elevadas</p>
                      </div>
                      <div className="p-2.5 bg-white rounded-lg border border-gray-200">
                        <p className="font-medium text-gray-900 mb-1">🔽 Curvas en "V"</p>
                        <p className="text-gray-600">Cañadas o cursos de agua</p>
                      </div>
                    </div>
                  </div>
                  

                  {/* Tip de uso */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 text-xs sm:text-[13px]">
                    <p className="font-semibold text-blue-900 mb-1.5">💡 Consejo</p>
                    <p className="text-blue-800">
                      Hacé zoom para ver más detalle de las curvas. Las líneas representan puntos de igual elevación sobre el nivel del mar.
                    </p>
                  </div>
                </>
              )}

              {/* VISTA CONEAT */}
              {vistaActual === 'coneat' && (
                <>
                  {/* Información */}
                  <div className="mb-5 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-3 sm:p-4">
                    <h3 className="text-xs sm:text-sm font-semibold text-gray-800 mb-2">
                      🌱 ¿Qué es CONEAT?
                    </h3>
                    <div className="space-y-2 text-xs sm:text-[13px] text-gray-700">
                      <div className="flex items-start gap-2">
                        <span>📊</span>
                        <span><strong>CONEAT</strong> es el Índice de Productividad de Suelos de Uruguay (0-200+)</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span>🏛️</span>
                        <span><strong>Fuente:</strong> MGAP - Ministerio de Ganadería, Agricultura y Pesca</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span>💡</span>
                        <span><strong>Uso:</strong> Evaluar potencial productivo del suelo para toma de decisiones</span>
                      </div>
                    </div>
                  </div>

              

                  {/* Usos prácticos */}
                  <div className="mb-5">
                    <h3 className="text-xs sm:text-sm font-semibold text-gray-700 mb-2 sm:mb-3">
                      💡 ¿Para qué sirve?
                    </h3>
                    <div className="space-y-2 text-xs sm:text-[13px]">
                      <div className="p-2.5 bg-white rounded-lg border border-gray-200">
                        <p className="font-medium text-gray-900 mb-1">🌾 Decisiones de siembra</p>
                        <p className="text-gray-600">Elegir cultivos según potencial del suelo</p>
                      </div>
                      <div className="p-2.5 bg-white rounded-lg border border-gray-200">
                        <p className="font-medium text-gray-900 mb-1">💰 Cálculo de arrendamientos</p>
                        <p className="text-gray-600">Base para determinar valor de alquiler</p>
                      </div>
                      <div className="p-2.5 bg-white rounded-lg border border-gray-200">
                        <p className="font-medium text-gray-900 mb-1">📈 Planificación productiva</p>
                        <p className="text-gray-600">Rotaciones cultivo/pastoreo según CONEAT</p>
                      </div>
                      <div className="p-2.5 bg-white rounded-lg border border-gray-200">
                        <p className="font-medium text-gray-900 mb-1">🎯 Expectativas de rinde</p>
                        <p className="text-gray-600">Estimar productividad esperada por potrero</p>
                      </div>
                    </div>
                  </div>

                  {/* Nota oficial */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs sm:text-[13px]">
                    <p className="font-semibold text-blue-900 mb-1.5">ℹ️ Datos Oficiales</p>
                    <p className="text-blue-800">
                      Los datos CONEAT provienen del MGAP (Ministerio de Ganadería, Agricultura y Pesca) y son los mismos que usa el gobierno uruguayo para políticas agropecuarias.
                    </p>
                  </div>
                </>
              )}

              {/* VISTA CULTIVOS */}
              {vistaActual === 'cultivo' && (
                <>
                  {!hayDatosCultivos ? (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 sm:p-4 mb-4">
                      <p className="text-sm text-gray-700 mb-2">
                        Todavía no ingresaste datos de cultivos por potrero. Podés
                        ingresarlos en la página de potreros para que aparezcan acá.
                      </p>
                      <a
                        href="/dashboard/lotes"
                        className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                      >
                        → Ir a Potreros
                      </a>
                    </div>
                  ) : (
                    <div className="mb-5">
                      <h3 className="text-xs sm:text-sm font-semibold text-gray-700 mb-2 sm:mb-3">
                        🌾 Resumen de cultivos
                      </h3>
                      <div className="space-y-2">
                        {Object.entries(resumenCultivos).map(
                          ([cultivo, hectareas]) => (
                            <div
                              key={cultivo}
                              className="flex items-center justify-between p-2.5 sm:p-3 rounded-lg border border-gray-200 hover:bg-gray-100 transition"
                              style={{
                                backgroundColor: `${
                                  COLORES_CULTIVOS[cultivo] || '#10b981'
                                }20`,
                              }}
                            >
                              <div className="flex items-center gap-2.5 sm:gap-3">
                                <div
                                  className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded"
                                  style={{
                                    backgroundColor:
                                      COLORES_CULTIVOS[cultivo] || '#10b981',
                                  }}
                                />
                                <span className="font-medium text-gray-900 text-xs sm:text-sm">
                                  {cultivo}
                                </span>
                                <span className="text-[11px] sm:text-xs text-gray-500">
                                  ({hectareas.toFixed(1)} ha)
                                </span>
                              </div>
                            </div>
                          ),
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* LISTA DE POTREROS */}
              <div className="mt-2">
                <h3 className="text-xs sm:text-sm font-semibold text-gray-700 mb-2 sm:mb-3">
                  📍 Potreros ({lotes.length})
                </h3>
                <div className="space-y-2.5">
                  {lotes.map((lote) => {
                    const totalAnimales =
                      lote.animalesLote?.reduce(
                        (sum, a) => sum + a.cantidad,
                        0,
                      ) || 0
                    const ndvi = ndviData[lote.id]

                    return (
                      <div
                        key={lote.id}
                        className="p-2.5 sm:p-3 bg-gray-50 rounded-lg border border-gray-200 hover:border-blue-400 transition cursor-pointer"
                      >
                        <div className="flex items-start justify-between mb-1.5 sm:mb-2">
                          <div>
                            <h4 className="font-semibold text-gray-900 text-sm">
                              {lote.nombre}
                            </h4>
                            <p className="text-[11px] sm:text-xs text-gray-500">
                              {lote.hectareas.toFixed(2)} ha
                            </p>
                          </div>
                          <div
                            className="w-5 h-5 sm:w-6 sm:h-6 rounded"
                            style={{
                              backgroundColor:
                                vistaActual === 'cultivo'
                                  ? lote.cultivos && lote.cultivos.length > 0
                                    ? COLORES_CULTIVOS[
                                        lote.cultivos[0].tipoCultivo
                                      ] || '#10b981'
                                    : '#D3D3D3'
                                  : vistaActual === 'ndvi' &&
                                    ndvi?.promedio !== null &&
                                    ndvi?.validPixels > 0
                                  ? getColorNDVI(ndvi.promedio)
                                  : vistaActual === 'ndvi'
                                  ? '#CCCCCC'
                                  : vistaActual === 'indice' && lote.moduloPastoreoId
                                  ? (() => {
                                      const moduloIndex = modulos.findIndex(m => m.id === lote.moduloPastoreoId)
                                      return moduloIndex !== -1 ? getColorModulo(moduloIndex) : '#1212dd'
                                    })()
                                  : '#1212dd',
                            }}
                          />
                        </div>

                        {vistaActual === 'ndvi' && (
                          <>
                            {ndvi?.promedio !== null && ndvi?.validPixels > 0 ? (
                              <div className="mb-1.5 bg-green-50 rounded px-2 py-1">
                                <div className="text-[11px] sm:text-xs text-gray-600">
                                  📊 NDVI:{' '}
                                  <span className="font-semibold">
                                    {ndvi.promedio.toFixed(3)}
                                  </span>
                                  <span className="text-gray-500 ml-1">
                                    {ndvi.promedio >= 0.7
                                      ? '(Excelente)'
                                      : ndvi.promedio >= 0.5
                                      ? '(Bueno)'
                                      : ndvi.promedio >= 0.3
                                      ? '(Regular)'
                                      : '(Bajo)'}
                                  </span>
                                </div>
                              </div>
                            ) : (
                              <div className="mb-1.5 bg-red-50 rounded px-2 py-1">
                                <div className="text-[11px] sm:text-xs text-red-600">
                                  ⚠️ Sin datos satelitales disponibles
                                </div>
                              </div>
                            )}
                          </>
                        )}

                        {vistaActual === 'cultivo' && (
                          <div className="mb-1.5">
                            {lote.cultivos && lote.cultivos.length > 0 ? (
                              <div className="text-[11px] sm:text-xs text-gray-600">
                                🌾 {lote.cultivos.map((c) => c.tipoCultivo).join(', ')}
                              </div>
                            ) : (
                              <div className="text-[11px] sm:text-xs text-gray-400 italic">
                                Sin cultivos
                              </div>
                            )}
                          </div>
                        )}

                        {vistaActual === 'indice' && (
                          <div className="mb-1.5">
                            {lote.moduloPastoreoId ? (
                              <div className="text-[11px] sm:text-xs text-gray-600">
                                📦 {modulos.find(m => m.id === lote.moduloPastoreoId)?.nombre || 'Módulo'}
                              </div>
                            ) : (
                              <div className="text-[11px] sm:text-xs text-gray-400 italic">
                                Sin módulo asignado
                              </div>
                            )}
                          </div>
                        )}

                        {totalAnimales > 0 ? (
                          <div className="text-[11px] sm:text-xs text-gray-600">
                            🐄 {totalAnimales}{' '}
                            {lote.animalesLote && lote.animalesLote.length > 0 && (
                              <span className="text-gray-500">
                                (
                                {lote.animalesLote
                                  .map((a) => a.categoria)
                                  .join(', ')}
                                )
                              </span>
                            )}
                          </div>
                        ) : (
                          <div className="text-[11px] sm:text-xs text-gray-400 italic">
                            Sin animales
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}







-----------------------



el otro:




/app/components/MapaPoligono.tsx


'use client'

import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet-draw/dist/leaflet.draw.css'
import * as turf from '@turf/turf'


if (typeof window !== 'undefined') {
  require('leaflet-draw')
  require('leaflet-geometryutil')

  // Agregar estilos para tooltips sin fondo
  if (!document.getElementById('leaflet-tooltip-override')) {
    const style = document.createElement('style')
    style.id = 'leaflet-tooltip-override'
    style.innerHTML = `
      .potrero-label-transparent {
        background: transparent !important;
        border: none !important;
        box-shadow: none !important;
        padding: 0 !important;
        margin: 0 !important;
      }
      .potrero-label-transparent::before {
        display: none !important;
      }
      .leaflet-editing-icon {
        width: 8px !important;
        height: 8px !important;
        margin-left: -4px !important;
        margin-top: -4px !important;
        border-radius: 50% !important;
        background: white !important;
        border: 2px solid #3b82f6 !important;
      }
      .leaflet-touch-icon {
        width: 12px !important;
        height: 12px !important;
        margin-left: -6px !important;
        margin-top: -6px !important;
      }
      .leaflet-draw-guide-dash {
        stroke: #3b82f6 !important;
        stroke-opacity: 0.6 !important;
        stroke-dasharray: 5, 5 !important;
      }
      /* 📍 MOVER CONTROLES DE LEAFLET HACIA ABAJO para no superponerse con pantalla completa */
      .leaflet-top.leaflet-left {
        top: 50px !important;
      }
      /* 📏 Quitar fondo azul de los marcadores de medición */
      .medicion-label {
        background: transparent !important;
        border: none !important;
      }
      .medicion-label::before {
        display: none !important;
      }
      .leaflet-marker-icon.medicion-label {
        background: transparent !important;
        border: none !important;
      }
        /* 📐 Quitar punto azul del marcador de área */
      .medicion-area {
        background: transparent !important;
        border: none !important;
      }
      .medicion-area::before {
        display: none !important;
      }
      .leaflet-marker-icon.medicion-area {
        background: transparent !important;
        border: none !important;
      }
    `
    document.head.appendChild(style)
  }
}


// 🎨 Colores por módulo de pastoreo (mismos que en page.tsx)
const COLORES_MODULOS: string[] = [
  '#8B5CF6', // Violeta
  '#EC4899', // Rosa
  '#F59E0B', // Ámbar
  '#10B981', // Esmeralda
  '#3B82F6', // Azul
  '#EF4444', // Rojo
  '#14B8A6', // Teal
  '#F97316', // Naranja
  '#6366F1', // Índigo
  '#84CC16', // Lima
]

interface ModuloLeyenda {
  id: string
  nombre: string
  color: string
  cantidadPotreros: number
  hectareas: number
  totalAnimales?: number
  animalesPorCategoria?: Record<string, number>
}

interface MapaPoligonoProps {
  onPolygonComplete?: (coordinates: number[][], areaHectareas: number) => void
  initialCenter?: [number, number]
  initialZoom?: number
  existingPolygons?: Array<{
  id: string
  nombre: string
  coordinates: number[][]
  color?: string
  moduloPastoreoId?: string | null
  isDashed?: boolean      // 🆕 NUEVO
  isEditing?: boolean     // 🆕 NUEVO
  info?: {
    hectareas?: number
    cultivos?: any[]
    animales?: any[]
    ndviMatriz?: any
  }
}>
  readOnly?: boolean
  modulosLeyenda?: ModuloLeyenda[]
  mostrarLeyendaModulos?: boolean
  mostrarCurvasNivel?: boolean
  mostrarConeat?: boolean
  opacidadCurvas?: number
  onOpacidadCurvasChange?: (opacity: number) => void
}

function calcularAreaPoligono(latlngs: any[]): number {
  if (latlngs.length < 3) return 0
  
  // ✅ TURF.JS - MÁXIMA PRECISIÓN GEODÉSICA
  // Convertir a formato GeoJSON [lng, lat]
  const coords = latlngs.map(ll => [ll.lng, ll.lat])
  coords.push(coords[0]) // Cerrar el polígono
  
  const polygon = turf.polygon([coords])
  return turf.area(polygon) // Retorna m² con precisión geodésica
}

// 🎨 FUNCIÓN PROFESIONAL: Renderizar NDVI con Canvas
function crearImagenNDVI(
  ndviData: any,
  poligonoCoords: number[][]
) {
  if (!ndviData.matriz || ndviData.matriz.length === 0) return null

  const { matriz, width, height, bbox } = ndviData
  const [west, south, east, north] = bbox

  console.log('🎨 Creando imagen NDVI profesional:', {
    dimensiones: `${width}x${height}`,
    bbox: bbox,
    totalPixels: width * height
  })

// ✅ Función para verificar si un punto está dentro del polígono
  // coords viene en formato [lng, lat]
  function puntoEnPoligono(lat: number, lng: number, coords: number[][]): boolean {
    let dentro = false
    for (let i = 0, j = coords.length - 1; i < coords.length; j = i++) {
      const xi = coords[i][0], yi = coords[i][1]  // [0] = lng, [1] = lat
      const xj = coords[j][0], yj = coords[j][1]
      
      const intersecta = ((yi > lat) !== (yj > lat)) &&
        (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi)
      
      if (intersecta) dentro = !dentro
    }
    return dentro
  }

  // 🎨 Colores basados en estándares científicos NDVI
  function getColorFromNDVI(ndvi: number): { r: number, g: number, b: number, a: number } {
    if (ndvi < 0) return { r: 0, g: 0, b: 255, a: 180 }           // Azul (agua)
    if (ndvi < 0.1) return { r: 165, g: 42, b: 42, a: 220 }       // Marrón oscuro
    if (ndvi < 0.2) return { r: 210, g: 105, b: 30, a: 220 }      // Chocolate
    if (ndvi < 0.3) return { r: 218, g: 165, b: 32, a: 220 }      // Dorado
    if (ndvi < 0.4) return { r: 255, g: 215, b: 0, a: 220 }       // Amarillo
    if (ndvi < 0.5) return { r: 173, g: 255, b: 47, a: 220 }      // Verde-amarillo
    if (ndvi < 0.6) return { r: 127, g: 255, b: 0, a: 220 }       // Verde lima
    if (ndvi < 0.7) return { r: 50, g: 205, b: 50, a: 220 }       // Verde medio
    if (ndvi < 0.8) return { r: 34, g: 139, b: 34, a: 220 }       // Verde bosque
    return { r: 0, g: 100, b: 0, a: 220 }                         // Verde oscuro
  }

  let minValue = Infinity
  let maxValue = -Infinity
  let validCount = 0
  let pixelesDentro = 0

  // Crear canvas
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!

  // ✅ Pintar pixel por pixel
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const value = matriz[y][x]
      
      const lng = west + (x / width) * (east - west)
      const lat = north - (y / height) * (north - south)
      
      if (puntoEnPoligono(lat, lng, poligonoCoords)) {
        pixelesDentro++
        
        if (value !== -999 && !isNaN(value)) {
          const color = getColorFromNDVI(value)
          ctx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a / 255})`
          ctx.fillRect(x, y, 1, 1)
          
          validCount++
          minValue = Math.min(minValue, value)
          maxValue = Math.max(maxValue, value)
        } else {
          ctx.fillStyle = 'rgba(128, 128, 128, 0.3)'
          ctx.fillRect(x, y, 1, 1)
        }
      }
    }
  }

  console.log('✅ Imagen NDVI renderizada:', {
    pixelesDentro: pixelesDentro,
    pixelesConDatos: validCount,
    cobertura: `${((validCount / pixelesDentro) * 100).toFixed(1)}%`,
    minNDVI: minValue.toFixed(3),
    maxNDVI: maxValue.toFixed(3)
  })

  if (validCount === 0) {
    console.warn('⚠️ No hay datos NDVI válidos dentro del polígono')
    return null
  }

  const bounds = (L as any).latLngBounds(
    [south, west],
    [north, east]
  )

  const imageOverlay = (L as any).imageOverlay(canvas.toDataURL(), bounds, {
    opacity: 0.75,
    interactive: false,
    crossOrigin: 'anonymous'
  })

  return imageOverlay
}

export default function MapaPoligono({
  onPolygonComplete,
  initialCenter = [-34.397, -56.165],
  initialZoom = 8,
  existingPolygons = [],
  readOnly = false,
  modulosLeyenda = [],
  mostrarLeyendaModulos = false,
  mostrarCurvasNivel = false,
  mostrarConeat = false,  // 🔥 NUEVO
  opacidadCurvas = 95,
  onOpacidadCurvasChange,
}: MapaPoligonoProps) {

  const mapRef = useRef<any>(null)
  const drawnItemsRef = useRef<any>(null)
  const existingLayersRef = useRef<any>(null)
  const locationLayersRef = useRef<any[]>([])
  const curvasLayerRef = useRef<any>(null)  // 🔥 NUEVO
  const coneatLayerRef = useRef<any>(null)  // 🔥 NUEVO

  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [searching, setSearching] = useState(false)
  const [areaHectareas, setAreaHectareas] = useState<number | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [ubicandoUsuario, setUbicandoUsuario] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  
  const [midiendo, setMidiendo] = useState(false)
  const [puntosMedicion, setPuntosMedicion] = useState<any[]>([])

  // 🖥️ Función para entrar/salir de pantalla completa
  const toggleFullscreen = () => {
    const mapContainer = document.getElementById('map-container')
    
    if (!document.fullscreenElement) {
      // Entrar en pantalla completa
      mapContainer?.requestFullscreen()
        .then(() => setIsFullscreen(true))
        .catch((err) => console.error('Error entrando en pantalla completa:', err))
    } else {
      // Salir de pantalla completa
      document.exitFullscreen()
        .then(() => setIsFullscreen(false))
        .catch((err) => console.error('Error saliendo de pantalla completa:', err))
    }
  }

  useEffect(() => {
    if (initialCenter) setIsReady(true)
  }, [initialCenter])

  // 🖥️ Detectar cuando el usuario sale de pantalla completa (ESC)
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }
    
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
    }
  }, [])

  /** Crear mapa */
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!isReady) return
    if (mapRef.current) return

    const map: any = L.map('map')
    map.setView(initialCenter, initialZoom)
    mapRef.current = map

    const satelitalLayer = L.tileLayer(
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  { attribution: '© Esri', maxZoom: 19 }
)

const osmLayer = L.tileLayer(
  'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  { attribution: '© OpenStreetMap', maxZoom: 19 }
)

const curvasLayer = L.tileLayer(
  'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
  { 
    attribution: '© OpenTopoMap', 
    maxZoom: 17,
    opacity: opacidadCurvas / 100,
    zIndex: 1000
  }
)

// 🔥 Capa de CONEAT - ArcGIS Dynamic MapServer del MGAP (sin esri-leaflet)
const coneatLayer = (L as any).tileLayer('', {
  opacity: 0.7,
  zIndex: 1000,
  attribution: '© MGAP Uruguay'
})

// Sobrescribir getTileUrl para generar URLs de ArcGIS Export
coneatLayer.getTileUrl = function(coords: any) {
  const map = this._map
  const bounds = this._tileCoordsToBounds(coords)
  const sw = map.options.crs.project(bounds.getSouthWest())
  const ne = map.options.crs.project(bounds.getNorthEast())
  
  const url = 'https://dgrn.mgap.gub.uy/arcgis/rest/services/CONEAT/SuelosConeat/MapServer/export'
  const params = new URLSearchParams({
    bbox: `${sw.x},${sw.y},${ne.x},${ne.y}`,
    bboxSR: '3857',
    imageSR: '3857',
    size: '256,256',
    dpi: '96',
    format: 'png8',
    transparent: 'true',
    layers: 'show:1',
    f: 'image'
  })
  
  return `${url}?${params.toString()}`
}

// Agregar capa base por defecto
satelitalLayer.addTo(map)

// Control de capas base
L.control.layers({ 'Satélite': satelitalLayer, 'Mapa': osmLayer }).addTo(map)



    const existingLayers = new L.FeatureGroup()
    map.addLayer(existingLayers)
    existingLayersRef.current = existingLayers

    existingPolygons.forEach((potrero) => {
  if (!potrero.coordinates?.length) return

  // 🔥 CONVERTIR de [lng, lat] a [lat, lng] para Leaflet
  const coordsParaMapa = potrero.coordinates.map(coord => [coord[1], coord[0]])

  // 🗺️ PRIMERO: Agregar imagen NDVI si hay datos (solo si NO está editando)
  if (potrero.info?.ndviMatriz?.matriz?.length > 0 && !potrero.isEditing) {
    const imageOverlay = crearImagenNDVI(
      potrero.info.ndviMatriz,
      potrero.coordinates
    )
    if (imageOverlay) {
      existingLayersRef.current.addLayer(imageOverlay)
    }
  }

  // DESPUÉS: Dibujar el polígono encima (borde visible)
  const polygon = (L as any).polygon(coordsParaMapa, {
    color: potrero.isEditing ? '#9ca3af' : (potrero.color || '#10b981'), // 🔥 Gris si está editando
    fillColor: potrero.isEditing ? '#e5e7eb' : 'transparent', // 🔥 Gris claro si está editando
    fillOpacity: potrero.isEditing ? 0.15 : 0, // 🔥 Ligeramente visible si está editando
    weight: potrero.isEditing ? 2 : 3, // 🔥 Más delgado si está editando
    opacity: potrero.isEditing ? 0.6 : 1, // 🔥 Más transparente si está editando
    dashArray: potrero.isDashed ? '10, 10' : undefined, // 🔥 LÍNEA PUNTEADA
  })

  existingLayersRef.current.addLayer(polygon)
    })

    if (existingPolygons.length > 0 && existingLayers.getLayers().length > 0) {
      const bounds = (existingLayers as any).getBounds()
      map.fitBounds(bounds, { padding: [100, 100], maxZoom: 16 })
    }

    if (!readOnly) {
      const drawnItems = new L.FeatureGroup()
      map.addLayer(drawnItems)
      drawnItemsRef.current = drawnItems

      const drawControl = new (L.Control as any).Draw({
  draw: {
    polygon: {
      allowIntersection: false,
      showArea: false,  // ✅ DESHABILITAR para evitar confusión
      metric: ['ha', 'm'],
            shapeOptions: { color: '#3b82f6', weight: 3 },
            icon: new (L as any).DivIcon({
              iconSize: new (L as any).Point(8, 8),
              className: 'leaflet-div-icon leaflet-editing-icon'
            }),
            touchIcon: new (L as any).DivIcon({
              iconSize: new (L as any).Point(8, 8),
              className: 'leaflet-div-icon leaflet-editing-icon leaflet-touch-icon'
            }),
            guidelineDistance: 20,
            showLength: true,
          },
          polyline: false,
          rectangle: false,
          circle: false,
          marker: false,
          circlemarker: false,
        },
        edit: { 
          featureGroup: drawnItems, 
          remove: true,
          poly: {
            icon: new (L as any).DivIcon({
              iconSize: new (L as any).Point(8, 8),
              className: 'leaflet-div-icon leaflet-editing-icon'
            })
          }
        },
      })
      map.addControl(drawControl)

      const DrawEvent = (L as any).Draw.Event

      map.on(DrawEvent.CREATED, (event: any) => {
        const layer = event.layer
        drawnItems.clearLayers()
        drawnItems.addLayer(layer)

        const latlngs = layer.getLatLngs()[0]
        const areaM2 = calcularAreaPoligono(latlngs)
        const areaHa = areaM2 / 10000
        setAreaHectareas(areaHa)
      })

      map.on(DrawEvent.EDITED, (event: any) => {
        event.layers.eachLayer((layer: any) => {
          const latlngs = layer.getLatLngs()[0]
          const areaM2 = calcularAreaPoligono(latlngs)
          setAreaHectareas(areaM2 / 10000)
        })
      })

      map.on(DrawEvent.DELETED, () => setAreaHectareas(null))
    }
  // 🔥 Guardar referencias a las capas en refs
    curvasLayerRef.current = curvasLayer
    coneatLayerRef.current = coneatLayer
    console.log('📦 Referencia de curvas guardada:', curvasLayer)
    console.log('📦 Referencia de CONEAT guardada:', coneatLayer)

    return () => {
  // Limpiar handlers antes de destruir el mapa
  if (mapRef.current) {
    mapRef.current.off('zoomend')
    mapRef.current.off('moveend')
    mapRef.current._tooltipZoomHandler = false
  }
  map.remove()
  mapRef.current = null
}
  }, [isReady, initialCenter, initialZoom, readOnly, existingPolygons])

  /**
   * 🔄 Redibujar polígonos cuando cambian
   */
  useEffect(() => {
  if (!mapRef.current || !existingLayersRef.current) return
  if (!isReady) return
  
  // Verificar que el mapa sigue siendo válido
  try {
    mapRef.current.getCenter()
  } catch (e) {
    console.warn('Mapa no disponible, saltando actualización')
    return
  }

    existingLayersRef.current.clearLayers()

    existingPolygons.forEach((potrero) => {
      if (!potrero.coordinates?.length) return
     // 🔥 CONVERTIR de [lng, lat] a [lat, lng]
  const coordsParaMapa = potrero.coordinates.map(coord => [coord[1], coord[0]])

      // 🗺️ PRIMERO: Agregar imagen NDVI si hay datos
      if (potrero.info?.ndviMatriz?.matriz?.length > 0) {
        const imageOverlay = crearImagenNDVI(
          potrero.info.ndviMatriz,
          potrero.coordinates
        )
        if (imageOverlay) {
          existingLayersRef.current.addLayer(imageOverlay)
        }
      }

      // DESPUÉS: Dibujar el polígono encima (borde visible)
      const polygon = (L as any).polygon(coordsParaMapa, {
        color: potrero.color || '#10b981',
        fillColor: 'transparent', // ✅ Totalmente transparente para ver el NDVI
        fillOpacity: 0,
        weight: 3,
      })

      existingLayersRef.current.addLayer(polygon)

      // 🏷️ Tooltip con nombre Y DETALLE COMPLETO de animales
const center = polygon.getBounds().getCenter()

let animalesText = ''
if (potrero.info?.animales?.length) {
  const lineas = potrero.info.animales
    .map((a: any) => `${a.categoria}: ${a.cantidad}`)
    .join('<br>')
  animalesText = lineas
}

// Función para determinar tamaño según zoom
const getFontSizes = () => {
  const currentZoom = mapRef.current?.getZoom() || 14
  
  if (currentZoom >= 16) return { nombre: '20px', animales: '18px' }
  if (currentZoom >= 14) return { nombre: '18px', animales: '16px' }
  if (currentZoom >= 13) return { nombre: '16px', animales: '14px' }
  return { nombre: '14px', animales: '12px' }
}

const sizes = getFontSizes()

const tooltipContent = `
  <div style="
    font-family: system-ui, -apple-system, sans-serif;
    text-align: center;
    white-space: nowrap;
  ">
    <div style="
      font-weight: bold; 
      font-size: ${sizes.nombre}; 
      color: black; 
      text-shadow: 
        -1px -1px 0 white,
        1px -1px 0 white,
        -1px 1px 0 white,
        1px 1px 0 white,
        -2px 0 0 white,
        2px 0 0 white,
        0 -2px 0 white,
        0 2px 0 white;
      margin-bottom: 2px;
    ">
      ${potrero.nombre}
    </div>
    <div style="
      font-size: ${sizes.animales}; 
      color: black; 
      text-shadow: 
        -1px -1px 0 white,
        1px -1px 0 white,
        -1px 1px 0 white,
        1px 1px 0 white;
      line-height: 1.3;
    ">
      ${animalesText}
    </div>
  </div>
`

// 🔥 NO mostrar tooltip si está editando
if (!potrero.isEditing) {
  const tooltip = (L as any).tooltip({
    permanent: true,
    direction: 'center',
    className: 'potrero-label-transparent',
    opacity: 1,
  }).setContent(tooltipContent)

  // Guardar metadata en el tooltip para decisiones de visibilidad
  tooltip._potreroData = {
    id: potrero.id,
    hectareas: potrero.info?.hectareas || 0,
    center: center
  }

  tooltip.setLatLng(center)
  existingLayersRef.current.addLayer(tooltip)

  // 🎯 MAGIA: Ocultar/mostrar tooltips según zoom para evitar superposición
  if (!mapRef.current._tooltipZoomHandler) {
    mapRef.current._tooltipZoomHandler = true
    mapRef.current.on('zoomend', () => {
      const currentZoom = mapRef.current.getZoom()
      
      existingLayersRef.current.eachLayer((layer: any) => {
        if (layer instanceof (L as any).Tooltip) {
          // Ocultar en zoom bajo, mostrar en zoom medio/alto
          if (currentZoom < 13) {
            layer.setOpacity(0) // Invisible en zoom bajo
          } else {
            layer.setOpacity(1) // Visible en zoom medio/alto
          }
        }
      })
    })
  }

  // Aplicar visibilidad inicial según zoom actual
  const initialZoom = mapRef.current?.getZoom() || 14
  if (initialZoom < 13) {
    tooltip.setOpacity(0)
  }
}
    })
    
    // 🎯 SISTEMA INTELIGENTE: Gestionar visibilidad de tooltips según zoom
const gestionarVisibilidadTooltips = () => {
  if (!mapRef.current) return
  
  const currentZoom = mapRef.current.getZoom()
  const mapCenter = mapRef.current.getCenter()
  
  // Recopilar todos los tooltips
  const tooltips: any[] = []
  existingLayersRef.current.eachLayer((layer: any) => {
    if (layer instanceof (L as any).Tooltip && layer._potreroData) {
      tooltips.push(layer)
    }
  })
  
  if (tooltips.length === 0) return
  
  // 🔍 ZOOM BAJO (< 13): Mostrar solo el potrero MÁS GRANDE
  if (currentZoom < 13) {
    // Encontrar el potrero más grande
    let mayorTooltip = tooltips[0]
    tooltips.forEach(t => {
      if (t._potreroData.hectareas > mayorTooltip._potreroData.hectareas) {
        mayorTooltip = t
      }
    })
    
    // Ocultar todos excepto el más grande
    tooltips.forEach(t => {
      if (t === mayorTooltip) {
        t.setOpacity(1)
      } else {
        t.setOpacity(0)
      }
    })
  }
  // 🔍 ZOOM MEDIO (13-15): Evitar colisiones
  else if (currentZoom < 15) {
    // Ordenar por tamaño (más grandes primero)
    tooltips.sort((a, b) => b._potreroData.hectareas - a._potreroData.hectareas)
    
    const visibles: any[] = []
    
    tooltips.forEach(tooltip => {
      const pos = mapRef.current.latLngToContainerPoint(tooltip._potreroData.center)
      
      // Verificar si colisiona con algún tooltip ya visible
      let colisiona = false
      const margen = 80 // píxeles de separación mínima
      
      for (const visible of visibles) {
        const visiblePos = mapRef.current.latLngToContainerPoint(visible._potreroData.center)
        const distancia = Math.sqrt(
          Math.pow(pos.x - visiblePos.x, 2) + 
          Math.pow(pos.y - visiblePos.y, 2)
        )
        
        if (distancia < margen) {
          colisiona = true
          break
        }
      }
      
      if (!colisiona) {
        tooltip.setOpacity(1)
        visibles.push(tooltip)
      } else {
        tooltip.setOpacity(0)
      }
    })
  }
  // 🔍 ZOOM ALTO (≥ 15): Mostrar TODOS
  else {
    tooltips.forEach(t => t.setOpacity(1))
  }
}

// Aplicar lógica inicial
gestionarVisibilidadTooltips()

// Actualizar cuando cambia el zoom o se mueve el mapa
if (!mapRef.current._tooltipZoomHandler) {
  mapRef.current._tooltipZoomHandler = true
  mapRef.current.on('zoomend', gestionarVisibilidadTooltips)
  mapRef.current.on('moveend', gestionarVisibilidadTooltips)
}
    if (existingPolygons.length > 0 && existingLayersRef.current.getLayers().length > 0) {
      try {
        const bounds = (existingLayersRef.current as any).getBounds()
        mapRef.current.fitBounds(bounds, { padding: [100, 100], maxZoom: 16 })
      } catch {}
    }
   }, [existingPolygons, isReady])

  /**
   * 🗺️ Controlar capa de curvas de nivel
   */
  useEffect(() => {
    console.log('🔄 useEffect curvas ejecutado. mostrarCurvasNivel:', mostrarCurvasNivel, 'isReady:', isReady)
    
    if (!isReady || !mapRef.current) {
      console.log('⚠️ Esperando que el mapa esté listo... isReady:', isReady, 'mapRef:', !!mapRef.current)
      return
    }
    
    const curvasLayer = curvasLayerRef.current
    
    if (!curvasLayer) {
      console.log('⚠️ No hay capa de curvas guardada')
      return
    }
    
    if (mostrarCurvasNivel) {
      console.log('🗺️ Intentando mostrar curvas...')
      
      if (!mapRef.current.hasLayer(curvasLayer)) {
        console.log('➕ Agregando capa de curvas al mapa...')
        curvasLayer.addTo(mapRef.current)
        curvasLayer.setZIndex(1000)
        curvasLayer.setOpacity(opacidadCurvas / 100) // 🔥 AGREGADO
        console.log('✅ Capa de curvas agregada exitosamente con opacidad:', opacidadCurvas) // 🔥 MODIFICADO
      } else {
        console.log('ℹ️ La capa de curvas ya estaba en el mapa')
      }
    } else {
      console.log('🗺️ Ocultando curvas...')
      
      if (mapRef.current.hasLayer(curvasLayer)) {
        console.log('➖ Removiendo capa de curvas del mapa...')
        mapRef.current.removeLayer(curvasLayer)
        console.log('✅ Capa de curvas removida exitosamente')
      } else {
        console.log('ℹ️ La capa de curvas no estaba en el mapa')
      }
    }
  }, [mostrarCurvasNivel, isReady, opacidadCurvas])

  /**
   * 🌱 Controlar capa de CONEAT
   */
  useEffect(() => {
    console.log('🔄 useEffect CONEAT ejecutado. mostrarConeat:', mostrarConeat, 'isReady:', isReady)
    
    if (!isReady || !mapRef.current) {
      console.log('⚠️ Esperando que el mapa esté listo... isReady:', isReady, 'mapRef:', !!mapRef.current)
      return
    }
    
    const coneatLayer = coneatLayerRef.current
    
    if (!coneatLayer) {
      console.log('⚠️ No hay capa de CONEAT guardada')
      return
    }
    
    if (mostrarConeat) {
      console.log('🌱 Intentando mostrar CONEAT...')
      
      if (!mapRef.current.hasLayer(coneatLayer)) {
        console.log('➕ Agregando capa CONEAT al mapa...')
        coneatLayer.addTo(mapRef.current)
        coneatLayer.setZIndex(1000)
        console.log('✅ Capa CONEAT agregada exitosamente')
      } else {
        console.log('ℹ️ La capa CONEAT ya estaba en el mapa')
      }
    } else {
      console.log('🌱 Ocultando CONEAT...')
      
      if (mapRef.current.hasLayer(coneatLayer)) {
        console.log('➖ Removiendo capa CONEAT del mapa...')
        mapRef.current.removeLayer(coneatLayer)
        console.log('✅ Capa CONEAT removida exitosamente')
      } else {
        console.log('ℹ️ La capa CONEAT no estaba en el mapa')
      }
    }
  }, [mostrarConeat, isReady])

  /**
   * 🎨 Actualizar opacidad de curvas dinámicamente
   */
  useEffect(() => {
    const curvasLayer = curvasLayerRef.current
    if (curvasLayer) {
      curvasLayer.setOpacity(opacidadCurvas / 100)
      console.log('🎨 Opacidad actualizada a:', opacidadCurvas)
    }
  }, [opacidadCurvas])
  

  /**
   * 📏 Manejar clicks para medición
   */
  useEffect(() => {
    if (!mapRef.current) return
    
    const handleClick = (e: any) => {
      if (!midiendo) return
      
      // Verificar si clickeó cerca del primer punto (cerrar polígono)
      const primerPunto = puntosMedicion[0]
      const distanciaAlPrimero = primerPunto ? e.latlng.distanceTo(primerPunto) : Infinity
      const esCierre = puntosMedicion.length >= 3 && distanciaAlPrimero < 20 // 20 metros de tolerancia
      
      let newPuntos
      if (esCierre) {
        // Cerrar el polígono
        newPuntos = [...puntosMedicion, primerPunto]
      } else {
        newPuntos = [...puntosMedicion, e.latlng]
      }
      
      setPuntosMedicion(newPuntos)
      
      if (newPuntos.length > 1) {
  // Dibujar la línea completa
  const linea = (L as any).polyline(newPuntos, {
    color: '#3b82f6',
    weight: 3,
    className: 'linea-medicion',
    fill: esCierre,
    fillColor: '#3b82f6',
    fillOpacity: 0.1
  }).addTo(mapRef.current)
  
  // Dibujar tooltips para cada segmento
  for (let i = 0; i < newPuntos.length - 1; i++) {
    const p1 = newPuntos[i]
    const p2 = newPuntos[i + 1]
    
    // ✅ Usar Turf.js para distancia geodésica precisa
    const from = turf.point([p1.lng, p1.lat])
    const to = turf.point([p2.lng, p2.lat])
    const distanciaMetros = turf.distance(from, to, { units: 'meters' })
    
    const puntoMedio = (L as any).latLng(
      (p1.lat + p2.lat) / 2,
      (p1.lng + p2.lng) / 2
    )
    
    let textoDistancia = ""
    if (distanciaMetros > 1000) {
      textoDistancia = (distanciaMetros / 1000).toFixed(2) + " km"
    } else {
      textoDistancia = Math.round(distanciaMetros) + " m"
    }
          
          // Tooltip para cada segmento
          (L as any).marker(puntoMedio, {
            icon: (L as any).divIcon({
              className: 'medicion-label',
              html: `<span style="background: #3b82f6; color: white; padding: 3px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; white-space: nowrap; box-shadow: 0 2px 4px rgba(0,0,0,0.2); display: inline-block;">${textoDistancia}</span>`,
              iconSize: [0, 0]
            }),
            className: 'linea-medicion',
            interactive: false
          }).addTo(mapRef.current)
        }
        
        // Si es polígono cerrado, mostrar área
if (esCierre) {
  // ✅ Usar Turf.js para consistencia
  const coords = newPuntos.map((p: any) => [p.lng, p.lat])
  coords.push(coords[0])
  const polygon = turf.polygon([coords])
  const area = turf.area(polygon)
  const areaHa = area / 10000
  const centroide = linea.getBounds().getCenter()
          
          const areaNum = Number(area) || 0
          let textoArea = ""
          if (areaHa > 1) {
            textoArea = areaHa.toFixed(2) + " ha"
          } else {
            textoArea = Math.round(areaNum) + " m²"
          }
          
          (L as any).marker(centroide, {
            icon: (L as any).divIcon({
              className: 'medicion-area',
              html: `<span style="background: #3b82f6; color: white; padding: 4px 8px; border-radius: 6px; font-size: 12px; font-weight: bold; white-space: nowrap; display: inline-block; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">📐 ${textoArea}</span>`,
              iconSize: [0, 0]
            }),
            className: 'linea-medicion',
            interactive: false
          }).addTo(mapRef.current)
          
          // Terminar medición automáticamente
          setTimeout(() => {
            setMidiendo(false)
          }, 100)
        }
      }
      
      // Agregar marcador en el punto (excepto si es cierre)
      if (!esCierre) {
        (L as any).circleMarker(e.latlng, {
          radius: 5,
          color: '#3b82f6',
          fillColor: '#ffffff',
          fillOpacity: 1,
          weight: 2,
          className: 'linea-medicion'
        }).addTo(mapRef.current)
      }
    }
    
    if (midiendo) {
      mapRef.current.on('click', handleClick)
    }
    
    return () => {
      if (mapRef.current) {
        mapRef.current.off('click', handleClick)
      }
    }
  }, [midiendo, puntosMedicion])

  

  const buscarUbicacion = async () => {
    if (!searchQuery.trim()) return

    setSearching(true)
    try {
      const r = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          searchQuery
        )}&countrycodes=uy&limit=5`
      )
      setSearchResults(await r.json())
    } finally {
      setSearching(false)
    }
  }
  
  const ubicarUsuario = async () => {
    if (!mapRef.current) return
    
    setUbicandoUsuario(true)

    if (!navigator.geolocation) {
      alert('Tu navegador no soporta geolocalización')
      setUbicandoUsuario(false)
      return
    }

    // 🔐 VERIFICAR PERMISOS PRIMERO (si el navegador lo soporta)
    try {
      if ('permissions' in navigator) {
        const permission = await (navigator as any).permissions.query({ name: 'geolocation' })
        
        if (permission.state === 'denied') {
          alert('❌ Permiso de ubicación denegado.\n\n📍 Para habilitarlo:\n1. Hacé clic en el ícono 🔒 o ⓘ en la barra de direcciones\n2. Buscá "Ubicación" y cambialo a "Permitir"\n3. Recargá la página')
          setUbicandoUsuario(false)
          return
        }
      }
    } catch (e) {
      // Si no soporta la API de permisos, continuar igual
      console.log('API de permisos no disponible, continuando...')
    }

    // 📍 OBTENER UBICACIÓN
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords

        try {
          // 🧹 LIMPIAR MARCADORES ANTERIORES
          locationLayersRef.current.forEach(layer => {
            mapRef.current.removeLayer(layer)
          })
          locationLayersRef.current = []

          // Centrar mapa
          mapRef.current.setView([latitude, longitude], 17)

          // Círculo de precisión
          const precisionCircle = (L as any).circle([latitude, longitude], {
            radius: accuracy,
            color: '#4285f4',
            fillColor: '#4285f4',
            fillOpacity: 0.1,
            weight: 1
          })
          precisionCircle.addTo(mapRef.current)
          locationLayersRef.current.push(precisionCircle)

          // Punto azul
          const marker = (L as any).circleMarker([latitude, longitude], {
            radius: 10,
            fillColor: '#4285f4',
            color: 'white',
            weight: 3,
            opacity: 1,
            fillOpacity: 1
          })
          marker.addTo(mapRef.current)
          locationLayersRef.current.push(marker)

          setUbicandoUsuario(false)
        } catch (error) {
          console.error('Error mostrando ubicación:', error)
          alert('Error mostrando la ubicación en el mapa')
          setUbicandoUsuario(false)
        }
      },
      (error) => {
        console.error('Error de geolocalización:', error)
        
        let mensaje = ''
        switch (error.code) {
          case error.PERMISSION_DENIED:
            mensaje = '❌ Permiso de ubicación denegado.\n\n📍 Para habilitarlo:\n1. Hacé clic en el ícono 🔒 en la barra de direcciones\n2. Buscá "Ubicación" y cambialo a "Permitir"\n3. Volvé a intentar'
            break
          case error.POSITION_UNAVAILABLE:
            mensaje = '📍 No se pudo determinar tu ubicación.\nAsegurate de tener GPS/WiFi activado.'
            break
          case error.TIMEOUT:
            mensaje = '⏱️ Se agotó el tiempo esperando la ubicación.\nIntentá de nuevo.'
            break
          default:
            mensaje = '❌ Error desconocido obteniendo ubicación.'
        }
        
        alert(mensaje)
        setUbicandoUsuario(false)
      },
      { 
        enableHighAccuracy: true, 
        timeout: 15000,
        maximumAge: 0 
      }
    )
  }

  const confirmarPoligono = () => {
    if (!drawnItemsRef.current) return
    if (drawnItemsRef.current.getLayers().length === 0)
      return alert('Dibuje el potrero primero')

    const layer = drawnItemsRef.current.getLayers()[0]
    const latlngs = layer.getLatLngs()[0]
    // ✅ Convertir a [lng, lat] - formato GeoJSON estándar
    const coordinates = latlngs.map((ll: any) => [ll.lng, ll.lat])

    if (areaHectareas && onPolygonComplete) {
      onPolygonComplete(coordinates, areaHectareas)
    }
  }
  
  // 📏 Activar/desactivar medición
  const toggleMedicion = () => {
    setMidiendo(!midiendo)
    setPuntosMedicion([])
    
    // Limpiar líneas anteriores
    if (mapRef.current) {
      mapRef.current.eachLayer((layer: any) => {
        if ((layer as any).options?.className === 'linea-medicion') {
          mapRef.current?.removeLayer(layer)
        }
      })
    }
  }

  return (
    <div id="map-container" className="relative w-full h-full flex flex-col">
      
      {/* 🖥️ BOTÓN DE PANTALLA COMPLETA - Arriba a la izquierda */}
<button
  onClick={toggleFullscreen}
  className="hidden sm:flex absolute top-3 left-3 z-[10] bg-white rounded-lg shadow-lg hover:shadow-xl transition-all w-[34px] h-[34px] sm:w-[36px] sm:h-[36px] items-center justify-center border-2 border-gray-300"
  title={isFullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
>
        {isFullscreen ? (
          // Ícono para SALIR de pantalla completa
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="sm:stroke-current stroke-gray-700">
            <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
          </svg>
        ) : (
          // Ícono para ENTRAR en pantalla completa
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="sm:stroke-current stroke-gray-700">
            <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
          </svg>
        )}
      </button>
      {/* 📏 BOTÓN DE MEDICIÓN - Solo visible en modo lectura */}
{readOnly && (
  <button
    onClick={toggleMedicion}
    className={`absolute top-3 left-3 z-[10] rounded-lg shadow-lg hover:shadow-xl transition-all w-[34px] h-[34px] sm:w-[36px] sm:h-[36px] flex items-center justify-center border-2 text-lg ${
      midiendo 
        ? 'bg-blue-600 border-blue-600' 
        : 'bg-white border-gray-300'
    }`}
    style={{ marginTop: '124px' }}
    title={midiendo ? "Terminar medición" : "Medir distancia"}
  >
    📏
  </button>
)}

      {/* 🎯 BOTÓN DE UBICACIÓN - Debajo del control de capas */}
      <button
        onClick={ubicarUsuario}
        disabled={ubicandoUsuario}
        className="absolute top-[70px] right-3 z-[10] bg-white rounded-lg shadow-lg hover:shadow-xl transition-all w-[34px] h-[34px] sm:w-[36px] sm:h-[36px] flex items-center justify-center disabled:opacity-50 border-2 border-gray-300"
        title="Mi ubicación"
      >
        {ubicandoUsuario ? (
          <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="sm:stroke-current stroke-gray-700">
            <circle cx="12" cy="12" r="2"/>
            <circle cx="12" cy="12" r="9"/>
            <line x1="12" y1="2" x2="12" y2="5"/>
            <line x1="12" y1="19" x2="12" y2="22"/>
            <line x1="2" y1="12" x2="5" y2="12"/>
            <line x1="19" y1="12" x2="22" y2="12"/>
          </svg>
        )}
      </button>

      {/* 🎨 CONTROL DE OPACIDAD - Solo en pantalla completa y vista Curvas */}
      {isFullscreen && mostrarCurvasNivel && (
        <div className="absolute top-[120px] right-3 z-[10] bg-white/95 backdrop-blur-sm rounded-xl shadow-2xl border border-gray-200 p-4 w-[280px]">
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-semibold text-gray-800">
              📏 Opacidad Curvas
            </label>
            <span className="text-sm font-bold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-lg">
              {opacidadCurvas}%
            </span>
          </div>
          <input 
            type="range" 
            min="10" 
            max="100" 
            value={opacidadCurvas}
            onChange={(e) => {
              const newOpacity = Number(e.target.value)
              if (onOpacidadCurvasChange) {
                onOpacidadCurvasChange(newOpacity)
              }
            }}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-amber-600"
            style={{
              background: `linear-gradient(to right, #d97706 0%, #d97706 ${opacidadCurvas}%, #e5e7eb ${opacidadCurvas}%, #e5e7eb 100%)`
            }}
          />
          <div className="flex justify-between text-xs text-gray-500 mt-2">
            <span>Transparente</span>
            <span>Opaco</span>
          </div>
        </div>
      )}

      {/* 📦 LEYENDA DE MÓDULOS - Solo visible en PANTALLA COMPLETA */}
{isFullscreen && mostrarLeyendaModulos && modulosLeyenda.length > 0 && (
  <div className="absolute top-[120px] right-3 z-[1000] bg-white/95 backdrop-blur-sm rounded-xl shadow-2xl border border-gray-200 p-4 max-w-[320px]">
    <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
      <span>📦</span> Módulos de Pastoreo
    </h3>
    <div className="space-y-3">
      {modulosLeyenda.map((modulo) => (
        <div
          key={modulo.id}
          className="p-3 rounded-lg transition-colors"
          style={{
            backgroundColor: `${modulo.color}15`,
          }}
        >
          {/* Header del módulo */}
          <div className="flex items-center gap-3 mb-2">
            <div
              className="w-4 h-4 rounded flex-shrink-0"
              style={{ backgroundColor: modulo.color }}
            />
            <span className="font-semibold text-gray-900 text-sm">
              {modulo.nombre}
            </span>
          </div>
          
          {/* Stats en pills */}
          <div className="flex flex-wrap gap-1.5">
            <span className="px-2 py-0.5 bg-white/80 rounded-full text-xs text-gray-600">
              {modulo.cantidadPotreros} potrero{modulo.cantidadPotreros !== 1 ? 's' : ''}
            </span>
            <span className="px-2 py-0.5 bg-white/80 rounded-full text-xs text-gray-600">
              {modulo.hectareas.toFixed(0)} ha
            </span>
            {modulo.totalAnimales && modulo.totalAnimales > 0 && (
              <span className="px-2 py-0.5 bg-white/80 rounded-full text-xs text-gray-600">
                {modulo.totalAnimales} animales
              </span>
            )}
          </div>
          
          {/* Desglose de animales */}
          {modulo.animalesPorCategoria && Object.keys(modulo.animalesPorCategoria).length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {Object.entries(modulo.animalesPorCategoria).map(([categoria, cantidad]) => (
                <span 
                  key={categoria}
                  className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium"
                >
                  {cantidad} {categoria}
                </span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  </div>
)}

      {!readOnly && (
        <div className="absolute top-4 left-4 right-4 z-[10] md:left-16 md:w-96">
          <div className="bg-white rounded-lg shadow-lg p-3">
            <div className="flex gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && buscarUbicacion()}
                placeholder="Buscar ubicación..."
                className="flex-1 px-3 py-2 border rounded-lg text-sm"
              />
              <button onClick={buscarUbicacion} className="px-4 py-2 bg-blue-600 text-white rounded-lg">
                {searching ? '⏳' : '🔍'}
              </button>
            </div>

            {searchResults.length > 0 && (
              <div className="mt-2 max-h-48 overflow-y-auto">
                {searchResults.map((r, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      if (mapRef.current) {
                        mapRef.current.setView([parseFloat(r.lat), parseFloat(r.lon)], 16)
                      }
                      setSearchResults([])
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-gray-100 rounded text-sm border-b"
                  >
                    {r.display_name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}


      {!readOnly && areaHectareas !== null && (
        <div className="absolute top-4 right-4 z-[10] bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg">
          <div className="text-sm">Área:</div>
          <div className="text-xl font-bold">{areaHectareas.toFixed(2)} ha</div>
        </div>
      )}

      <div id="map" className="flex-1 w-full h-full relative z-0" />

      {!readOnly && (
        <div className="absolute bottom-4 left-4 right-4 z-[10] flex flex-col sm:flex-row gap-3">
          <button
            onClick={confirmarPoligono}
            className="flex-1 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg"
          >
            Confirmar Potrero
          </button>
        </div>
      )}
    </div>
  )
}