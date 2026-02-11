//src/app/dashboard/mapa/page.tsx
'use client'

import { useState, useEffect, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { toast } from '@/app/components/Toast'

// 🗺️ MapLibre GL para todas las vistas (WebGL = mejor rendimiento)
const MapaPoligonoGL = dynamic(() => import('@/app/components/MapaPoligonoGL'), {
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

// 🎨 Colores por tipo de cultivo - Profesionales y bien diferenciados
const COLORES_CULTIVOS: Record<string, string> = {
  // Cultivos principales - colores distintivos
  Soja: '#FFD700',      // Amarillo dorado
  'Maíz': '#FF8C00',    // Naranja intenso
  Trigo: '#DAA520',     // Dorado
  Girasol: '#FFA500',   // Naranja
  Sorgo: '#CD853F',     // Marrón claro
  Cebada: '#D2691E',    // Chocolate
  Avena: '#F4A460',     // Sandy brown
  Arroz: '#00CED1',     // Turquesa (distintivo del verde natural)
  Alfalfa: '#9932CC',   // Púrpura (distintivo)
  Pradera: '#228B22',   // Verde bosque
  // Sin cultivo = verde natural
  Natural: '#10B981',   // Verde esmeralda - Campo natural sin sembrar
}

// 🎨 Paleta de colores adicionales GARANTIZADOS DISTINTOS para combinaciones no definidas
const COLORES_ADICIONALES: string[] = [
  '#E63946',  // Rojo coral
  '#457B9D',  // Azul acero
  '#2A9D8F',  // Verde azulado
  '#8338EC',  // Violeta brillante
  '#FB5607',  // Naranja fuego
  '#3A86FF',  // Azul eléctrico
  '#06D6A0',  // Verde menta
  '#EF476F',  // Rosa fucsia
  '#118AB2',  // Azul océano
  '#7209B7',  // Púrpura oscuro
  '#B5179E',  // Magenta
  '#264653',  // Azul petróleo
  '#3F37C9',  // Azul índigo
  '#F72585',  // Rosa intenso
  '#06AED5',  // Cian
  '#560BAD',  // Índigo
  '#4361EE',  // Azul real
  '#073B4C',  // Azul noche
  '#4895EF',  // Azul cielo
  '#4CC9F0',  // Celeste
]

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
  const [vistaActual, setVistaActual] = useState<'indice' | 'cultivo' | 'ndvi' | 'curvas' | 'coneat' | 'altimetria'>(
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
  const [cultivoSeleccionado, setCultivoSeleccionado] = useState<string | null>(null)
  // 🏔️ Estado para Altimetría
  const [loadingAltimetria, setLoadingAltimetria] = useState(false)
  const [altimetriaData, setAltimetriaData] = useState<Record<string, any>>({})
  const [subVistaAltimetria, setSubVistaAltimetria] = useState<'elevacion' | 'pendiente'>('elevacion')
  // 🏷️ Estados para controlar visibilidad de labels
  const [mostrarNombres, setMostrarNombres] = useState(true)
  const [mostrarAnimales, setMostrarAnimales] = useState(true)
  
  // Memorizar el key para que no cambie cuando solo cambia opacidad
  const mapaKey = useMemo(() =>
    `vista-${vistaActual}-${lotes.length}-${Object.keys(ndviData).length}-mapa`,
    [vistaActual, lotes.length, Object.keys(ndviData).length]
  )

  // 🎨 Calcular mapa de colores únicos para cada combinación de cultivo
  const coloresPorCultivo = useMemo(() => {
    const mapa: Record<string, string> = {}

    // Obtener todas las combinaciones únicas de cultivos
    const combinacionesUnicas = new Set<string>()
    lotes.forEach(lote => {
      if (lote.cultivos && lote.cultivos.length > 0) {
        const nombreCombinacion = lote.cultivos.map(c => c.tipoCultivo).sort().join(' + ')
        combinacionesUnicas.add(nombreCombinacion)
      }
    })

    // Ordenar alfabéticamente para asignación consistente
    const combinacionesOrdenadas = Array.from(combinacionesUnicas).sort()

    // Asignar colores: primero de COLORES_CULTIVOS, luego de COLORES_ADICIONALES
    let indiceAdicional = 0
    combinacionesOrdenadas.forEach(combinacion => {
      if (COLORES_CULTIVOS[combinacion]) {
        mapa[combinacion] = COLORES_CULTIVOS[combinacion]
      } else {
        mapa[combinacion] = COLORES_ADICIONALES[indiceAdicional % COLORES_ADICIONALES.length]
        indiceAdicional++
      }
    })

    return mapa
  }, [lotes])

  // Función para obtener color de un cultivo
  const getColorCultivo = (nombreCombinacion: string): string => {
    return coloresPorCultivo[nombreCombinacion] || COLORES_ADICIONALES[0]
  }

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

  // 🛰️ Obtener NDVI con mejor manejo de errores
  async function obtenerNDVIPotreros() {
    if (lotes.length === 0) return

    setLoadingNDVI(true)

    try {
      // Mostrar mensaje de inicio para campos grandes
      if (lotes.length > 15) {
        toast.info(`Procesando ${lotes.length} potreros... esto puede demorar.`)
      }

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
        const errorText = await response.text()
        console.error('Error response:', errorText)
        throw new Error('Error obteniendo NDVI')
      }

      const data = await response.json()

      console.log('📊 Datos NDVI recibidos:', Object.keys(data.ndvi).length, 'potreros')

      // Contar exitosos y fallidos
      let exitosos = 0
      let fallidos = 0

      Object.keys(data.ndvi).forEach((loteId) => {
        const ndvi = data.ndvi[loteId]
        if (ndvi.promedio !== null && !ndvi.error) {
          exitosos++
        } else {
          fallidos++
        }
      })

      setNdviData(data.ndvi)

      // Mostrar resultado
      if (fallidos === 0) {
        toast.success(`NDVI cargado para ${exitosos} potreros`)
      } else if (exitosos > 0) {
        toast.info(`NDVI: ${exitosos} OK, ${fallidos} sin datos`)
      } else {
        toast.error('No se pudieron obtener datos NDVI')
      }
    } catch (error) {
      console.error('Error obteniendo NDVI:', error)
      toast.error('Error obteniendo datos NDVI. Intenta de nuevo.')
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
      (!ndviData[l.id].imagenBase64 && !ndviData[l.id].imagenUrl) || // No tiene imagen
      ndviData[l.id].validPixels === 0          // Sin pixeles válidos
  );

  if (faltanDatos && !loadingNDVI) {
    obtenerNDVIPotreros();
  }
}, [vistaActual, lotes, ndviData]);

  // 🏔️ Obtener datos de altimetría - PROCESAR DE A UNO para evitar timeout
  async function obtenerAltimetriaPotreros() {
    if (lotes.length === 0) return

    setLoadingAltimetria(true)

    // Filtrar lotes que ya tienen datos en cache
    const lotesSinDatos = lotes.filter(l => !altimetriaData[l.id] || altimetriaData[l.id].error)

    if (lotesSinDatos.length === 0) {
      setLoadingAltimetria(false)
      return
    }

    // Estimar tiempo: ~15-20 seg por potrero
    const tiempoEstimado = Math.ceil(lotesSinDatos.length * 0.3) // minutos
    toast.info(`Generando mapas 3D profesionales... (${lotesSinDatos.length} potreros, ~${tiempoEstimado} min)`)

    const nuevosResultados: Record<string, any> = { ...altimetriaData }
    let exitosos = 0
    let fallidos = 0

    // Procesar de a uno para evitar timeout de Vercel
    for (let i = 0; i < lotesSinDatos.length; i++) {
      const lote = lotesSinDatos[i]

      try {
        const response = await fetch('/api/altimetria', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lotes: [{ id: lote.id, coordenadas: lote.poligono }],
          }),
        })

        if (response.ok) {
          const data = await response.json()
          const altData = data.altimetria[lote.id]

          if (altData && !altData.error) {
            nuevosResultados[lote.id] = altData
            exitosos++
            // Mostrar progreso
            toast.info(`Altimetría: ${exitosos}/${lotesSinDatos.length} potreros listos`)
          } else {
            fallidos++
          }
        } else {
          fallidos++
        }

        // Actualizar estado parcialmente para mostrar progreso
        setAltimetriaData({ ...nuevosResultados })

      } catch (error) {
        console.error(`Error altimetría ${lote.nombre}:`, error)
        fallidos++
      }
    }

    if (fallidos === 0) {
      toast.success(`Altimetría profesional lista para ${exitosos} potreros`)
    } else if (exitosos > 0) {
      toast.info(`Altimetría: ${exitosos} OK, ${fallidos} sin datos`)
    } else {
      toast.error('No se pudieron obtener datos de altimetría')
    }

    setLoadingAltimetria(false)
  }

  // Cargar altimetría cuando se pasa a vista altimetria
  useEffect(() => {
    if (vistaActual !== 'altimetria') return

    const faltanDatos = lotes.some(
      (l) => !altimetriaData[l.id] || altimetriaData[l.id].error
    )

    if (faltanDatos && !loadingAltimetria) {
      obtenerAltimetriaPotreros()
    }
  }, [vistaActual, lotes, altimetriaData])

  // 🎨 Color según NDVI - Paleta FieldData Natural
  // Naranja (seco) → Amarillo → Verde lima → Verde oscuro (vegetación densa)
  function getColorNDVI(ndvi: number): string {
    // Agua (NDVI negativo) → verde muy oscuro
    if (ndvi < 0) return '#143723'

    // Paleta natural: naranja → amarillo → verde
    const colors = [
      { ndvi: 0.00, hex: '#BE4B23' },   // Naranja rojizo (muy seco)
      { ndvi: 0.15, hex: '#DC6E28' },   // Naranja intenso
      { ndvi: 0.25, hex: '#F59637' },   // Naranja claro
      { ndvi: 0.35, hex: '#FABE46' },   // Amarillo anaranjado
      { ndvi: 0.45, hex: '#F5DC5A' },   // Amarillo dorado
      { ndvi: 0.55, hex: '#E1EB6E' },   // Amarillo verdoso
      { ndvi: 0.65, hex: '#C3E178' },   // Verde lima claro
      { ndvi: 0.75, hex: '#A0D278' },   // Verde claro
      { ndvi: 0.85, hex: '#78BE64' },   // Verde medio
      { ndvi: 0.95, hex: '#50A550' },   // Verde intenso
      { ndvi: 1.00, hex: '#1E6E2D' },   // Verde muy oscuro
    ]

    // Encontrar el color más cercano
    for (let i = colors.length - 1; i >= 0; i--) {
      if (ndvi >= colors[i].ndvi) {
        return colors[i].hex
      }
    }
    return colors[0].hex
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
      let isDimmed = false // 🔥 NUEVO: para atenuar potreros no seleccionados

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
          // Crear nombre de combinación ordenado alfabéticamente
          const nombreCombinacion = lote.cultivos
            .map(c => c.tipoCultivo)
            .sort()
            .join(' + ')
          
          // Obtener color único de la combinación
          color = getColorCultivo(nombreCombinacion)
          
          // 🔥 FILTRO: Verificar si este potrero debe atenuarse
          if (cultivoSeleccionado && nombreCombinacion !== cultivoSeleccionado) {
            isDimmed = true
          }
        } else {
          // Potreros sin cultivo = "Natural"
          color = COLORES_CULTIVOS['Natural']
          
          // 🔥 FILTRO: Atenuar "Natural" si hay otro cultivo seleccionado
          if (cultivoSeleccionado && cultivoSeleccionado !== 'Natural') {
            isDimmed = true
          }
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
        isDimmed, // 🔥 NUEVO
        info: {
          hectareas: lote.hectareas,
          cultivos: lote.cultivos,
          animales: lote.animalesLote,
          ndviMatriz:
            vistaActual === 'ndvi' ? ndviData[lote.id] || null : null,
          altimetriaData:
            vistaActual === 'altimetria' ? altimetriaData[lote.id] || null : null,
        },
      }
    })

  // Resumen cultivos - Agrupar por combinación
  const resumenCultivos = lotes.reduce((acc, lote) => {
    if (lote.cultivos && lote.cultivos.length > 0) {
      // Crear nombre de combinación ordenado
      const nombreCombinacion = lote.cultivos
        .map(c => c.tipoCultivo)
        .sort()
        .join(' + ')
      
      if (!acc[nombreCombinacion]) {
        acc[nombreCombinacion] = 0
      }
      acc[nombreCombinacion] += lote.hectareas
    }
    return acc
  }, {} as Record<string, number>)

  // 🌾 Preparar resumen de cultivos para el mapa (convertir a array con colores Y lista de potreros)
  const resumenCultivosParaMapa = [
    ...Object.entries(resumenCultivos).map(([tipo, hectareas]) => {
      const color = getColorCultivo(tipo)
      // 🔥 Obtener lista de potreros con este cultivo
      const potrerosConEsteCultivo = lotes
        .filter(l => {
          if (!l.cultivos || l.cultivos.length === 0) return false
          const nombreCombinacion = l.cultivos.map(c => c.tipoCultivo).sort().join(' + ')
          return nombreCombinacion === tipo
        })
        .map(l => ({ nombre: l.nombre, hectareas: l.hectareas }))

      return { tipo, hectareas, color, potreros: potrerosConEsteCultivo }
    }),
    // Agregar "Natural" si hay potreros sin cultivos
    (() => {
      const lotesNaturales = lotes.filter(l => !l.cultivos || l.cultivos.length === 0)
      const hectareasNaturales = lotesNaturales.reduce((sum, l) => sum + l.hectareas, 0)
      if (hectareasNaturales > 0) {
        const potrerosNaturales = lotesNaturales.map(l => ({ nombre: l.nombre, hectareas: l.hectareas }))
        return { tipo: 'Natural', hectareas: hectareasNaturales, color: COLORES_CULTIVOS['Natural'], potreros: potrerosNaturales }
      }
      return null
    })()
  ].filter(Boolean) as Array<{ tipo: string; hectareas: number; color: string; potreros: Array<{ nombre: string; hectareas: number }> }>

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
          <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
            <span className="hidden sm:inline text-sm text-gray-600 font-medium">
              Vista:
            </span>
            <div className="flex flex-wrap sm:flex-nowrap gap-1.5 sm:gap-0 w-full sm:w-auto sm:inline-flex sm:rounded-lg sm:border-2 sm:border-gray-200 sm:bg-white sm:overflow-hidden">
              <button
                onClick={() => setVistaActual('indice')}
                className={`flex-1 sm:flex-none px-2.5 sm:px-3 py-2 text-xs sm:text-sm font-medium transition rounded-lg sm:rounded-none ${
                  vistaActual === 'indice'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200 sm:border-0'
                }`}
              >
                🗺️ General
              </button>
              <button
                onClick={() => setVistaActual('cultivo')}
                className={`flex-1 sm:flex-none px-2.5 sm:px-3 py-2 text-xs sm:text-sm font-medium transition rounded-lg sm:rounded-none ${
                  vistaActual === 'cultivo'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200 sm:border-0'
                }`}
              >
                🌾 Cultivos
              </button>
              <button
                onClick={() => setVistaActual('ndvi')}
                disabled={loadingNDVI}
                className={`flex-1 sm:flex-none px-2.5 sm:px-3 py-2 text-xs sm:text-sm font-medium transition relative rounded-lg sm:rounded-none ${
                  vistaActual === 'ndvi'
                    ? 'bg-green-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200 sm:border-0'
                } ${loadingNDVI ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                🛰️ NDVI
                {loadingNDVI && (
                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full animate-pulse" />
                )}
              </button>
              <button
                onClick={() => setVistaActual('curvas')}
                className={`flex-1 sm:flex-none px-2.5 sm:px-3 py-2 text-xs sm:text-sm font-medium transition rounded-lg sm:rounded-none ${
                  vistaActual === 'curvas'
                    ? 'bg-amber-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200 sm:border-0'
                }`}
              >
                📏 Curvas
              </button>
              <button
                onClick={() => setVistaActual('coneat')}
                className={`flex-1 sm:flex-none px-2.5 sm:px-3 py-2 text-xs sm:text-sm font-medium transition rounded-lg sm:rounded-none ${
                  vistaActual === 'coneat'
                    ? 'bg-green-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200 sm:border-0'
                }`}
              >
                🌱 CONEAT
              </button>
              <button
                onClick={() => setVistaActual('altimetria')}
                disabled={loadingAltimetria}
                className={`flex-1 sm:flex-none px-2.5 sm:px-3 py-2 text-xs sm:text-sm font-medium transition relative rounded-lg sm:rounded-none ${
                  vistaActual === 'altimetria'
                    ? 'bg-amber-700 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200 sm:border-0'
                } ${loadingAltimetria ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                🏔️ Altimetría
                {loadingAltimetria && (
                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full animate-pulse" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* CONTROLES DE VISUALIZACIÓN - Toggles para nombres y animales */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 sm:px-6 py-3 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
            <span className="sm:hidden text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              Vista
            </span>
            <div className="flex flex-wrap gap-4 sm:gap-6">
              {/* Toggle Nombres */}
              <label className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={mostrarNombres}
                  onChange={(e) => setMostrarNombres(e.target.checked)}
                  className="w-4 h-4 text-blue-600 bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500 focus:ring-2 cursor-pointer"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300 select-none group-hover:text-gray-900 dark:group-hover:text-white transition">
                  Nombres y hectáreas
                </span>
              </label>

              {/* Toggle Animales */}
              <label className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={mostrarAnimales}
                  onChange={(e) => setMostrarAnimales(e.target.checked)}
                  className="w-4 h-4 text-blue-600 bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500 focus:ring-2 cursor-pointer"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300 select-none group-hover:text-gray-900 dark:group-hover:text-white transition">
                  Animales
                </span>
              </label>
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
                // 🗺️ MapLibre GL para todas las vistas (WebGL = mejor rendimiento)
                <MapaPoligonoGL
                  key={`gl-${mapaKey}`}
                  initialCenter={mapCenter}
                  initialZoom={14}
                  existingPolygons={poligonosParaMapa}
                  readOnly={true}
                  showNDVI={vistaActual === 'ndvi'}
                  showAltimetria={vistaActual === 'altimetria'}
                  subVistaAltimetria={subVistaAltimetria}
                  modulosLeyenda={modulosLeyendaParaMapa}
                  mostrarLeyendaModulos={vistaActual === 'indice'}
                  mostrarCurvasNivel={vistaActual === 'curvas'}
                  mostrarConeat={vistaActual === 'coneat'}
                  opacidadCurvas={opacidadCurvas}
                  onOpacidadCurvasChange={setOpacidadCurvas}
                  mostrarResumenCultivos={vistaActual === 'cultivo'}
                  resumenCultivos={resumenCultivosParaMapa}
                  cultivoSeleccionado={cultivoSeleccionado}
                  onCultivoClick={setCultivoSeleccionado}
                  mostrarNombres={mostrarNombres}
                  mostrarAnimales={mostrarAnimales}
                  onMostrarNombresChange={setMostrarNombres}
                  onMostrarAnimalesChange={setMostrarAnimales}
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
  {vistaActual === 'altimetria' && '🏔️ Altimetría del Terreno'}
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

                      {/* Escala NDVI - Gradiente continuo estilo FieldData Natural */}
                      <div className="mb-5">
                        <h3 className="text-xs sm:text-sm font-semibold text-gray-700 mb-2 sm:mb-3">
                          📊 Escala de Vegetación (NDVI)
                        </h3>

                        {/* Barra de gradiente continuo - Paleta Natural */}
                        <div className="mb-3">
                          <div
                            className="h-5 sm:h-6 rounded-lg shadow-inner"
                            style={{
                              background: `linear-gradient(to right,
                                rgb(190,75,35) 0%,
                                rgb(220,110,40) 10%,
                                rgb(245,150,55) 20%,
                                rgb(250,190,70) 30%,
                                rgb(245,220,90) 40%,
                                rgb(225,235,110) 50%,
                                rgb(195,225,120) 60%,
                                rgb(160,210,120) 70%,
                                rgb(120,190,100) 80%,
                                rgb(80,165,80) 90%,
                                rgb(30,110,45) 100%
                              )`
                            }}
                          />
                          <div className="flex justify-between mt-1 text-[10px] sm:text-xs text-gray-500">
                            <span>0.0</span>
                            <span>0.5</span>
                            <span>1.0</span>
                          </div>
                        </div>

                        {/* Leyenda descriptiva */}
                        <div className="space-y-1.5 text-[11px] sm:text-xs">
                          {[
                            ['rgb(30,110,45)', '0.8+ Vegetación densa'],
                            ['rgb(120,190,100)', '0.6-0.8 Saludable'],
                            ['rgb(195,225,120)', '0.4-0.6 Moderado'],
                            ['rgb(245,220,90)', '0.2-0.4 Estrés leve'],
                            ['rgb(190,75,35)', '<0.2 Suelo/Seco'],
                          ].map(([color, label]) => (
                            <div
                              key={label}
                              className="flex items-center gap-2 sm:gap-3"
                            >
                              <div
                                className="w-5 h-3 sm:w-6 sm:h-4 rounded"
                                style={{ backgroundColor: color as string }}
                              />
                              <span>{label}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <button
                        onClick={obtenerNDVIPotreros}
                        className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-xs sm:text-sm font-medium"
                      >
                        🔄 Actualizar Datos NDVI
                      </button>
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

              {/* VISTA ALTIMETRÍA */}
              {vistaActual === 'altimetria' && (
                <>
                  {loadingAltimetria ? (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 sm:p-4 mb-4">
                      <div className="flex items-center gap-3">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-amber-600" />
                        <p className="text-sm text-gray-700">
                          Descargando datos de elevación satelitales...
                        </p>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* 🏔️ Info de la fuente */}
                      <div className="mb-4 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-lg p-3 sm:p-4">
                        <h3 className="text-xs sm:text-sm font-semibold text-gray-800 mb-2">
                          🛰️ Información del Satélite
                        </h3>
                        <div className="space-y-2 text-xs sm:text-[13px]">
                          <div className="flex justify-between gap-2">
                            <span className="text-gray-600">🛰️ Fuente:</span>
                            <span className="font-semibold text-gray-900">Copernicus GLO-30</span>
                          </div>
                          <div className="flex justify-between gap-2">
                            <span className="text-gray-600">📐 Resolución:</span>
                            <span className="font-medium text-gray-800">30 metros/píxel</span>
                          </div>
                          <div className="flex justify-between gap-2">
                            <span className="text-gray-600">🏛️ Proveedor:</span>
                            <span className="font-medium text-gray-800">Agencia Espacial Europea</span>
                          </div>
                        </div>
                      </div>

                      {/* Toggle sub-vista: Elevación / Pendiente */}
                      <div className="mb-4">
                        <div className="flex rounded-lg border-2 border-gray-200 overflow-hidden">
                          <button
                            onClick={() => setSubVistaAltimetria('elevacion')}
                            className={`flex-1 px-3 py-2 text-xs sm:text-sm font-medium transition ${
                              subVistaAltimetria === 'elevacion'
                                ? 'bg-amber-600 text-white'
                                : 'bg-white text-gray-700 hover:bg-gray-50'
                            }`}
                          >
                            🏔️ Elevación
                          </button>
                          <button
                            onClick={() => setSubVistaAltimetria('pendiente')}
                            className={`flex-1 px-3 py-2 text-xs sm:text-sm font-medium transition ${
                              subVistaAltimetria === 'pendiente'
                                ? 'bg-amber-600 text-white'
                                : 'bg-white text-gray-700 hover:bg-gray-50'
                            }`}
                          >
                            📐 Pendiente
                          </button>
                        </div>
                      </div>

                      {/* Estadísticas generales del campo */}
                      {Object.keys(altimetriaData).length > 0 && (
                        <div className="mb-4 bg-white border border-gray-200 rounded-lg p-3 sm:p-4">
                          <h3 className="text-xs sm:text-sm font-semibold text-gray-700 mb-3">
                            📊 Resumen del Campo
                          </h3>
                          {(() => {
                            const valores = Object.values(altimetriaData).filter((d: any) => !d.error)
                            if (valores.length === 0) return null

                            const minGlobal = Math.min(...valores.map((d: any) => d.elevacionMin))
                            const maxGlobal = Math.max(...valores.map((d: any) => d.elevacionMax))
                            const promedioGlobal = valores.reduce((sum: number, d: any) => sum + d.elevacionPromedio, 0) / valores.length
                            const pendientePromGlobal = valores.reduce((sum: number, d: any) => sum + (d.pendientePromedio || 0), 0) / valores.length

                            return (
                              <div className="space-y-2.5 text-xs sm:text-[13px]">
                                <div className="flex justify-between items-center p-2 bg-green-50 rounded-lg">
                                  <span className="text-gray-700">⬇️ Punto más bajo:</span>
                                  <span className="font-bold text-green-700">{minGlobal.toFixed(0)} m</span>
                                </div>
                                <div className="flex justify-between items-center p-2 bg-amber-50 rounded-lg">
                                  <span className="text-gray-700">⬆️ Punto más alto:</span>
                                  <span className="font-bold text-amber-700">{maxGlobal.toFixed(0)} m</span>
                                </div>
                                <div className="flex justify-between items-center p-2 bg-blue-50 rounded-lg">
                                  <span className="text-gray-700">📍 Elevación promedio:</span>
                                  <span className="font-bold text-blue-700">{promedioGlobal.toFixed(0)} m</span>
                                </div>
                                <div className="flex justify-between items-center p-2 bg-purple-50 rounded-lg">
                                  <span className="text-gray-700">📐 Desnivel total:</span>
                                  <span className="font-bold text-purple-700">{(maxGlobal - minGlobal).toFixed(0)} m</span>
                                </div>
                                <div className="flex justify-between items-center p-2 bg-orange-50 rounded-lg">
                                  <span className="text-gray-700">↗️ Pendiente promedio:</span>
                                  <span className="font-bold text-orange-700">{pendientePromGlobal.toFixed(1)}°</span>
                                </div>
                              </div>
                            )
                          })()}
                        </div>
                      )}

                      {/* Escala de colores */}
                      <div className="mb-5">
                        <h3 className="text-xs sm:text-sm font-semibold text-gray-700 mb-2 sm:mb-3">
                          {subVistaAltimetria === 'elevacion' ? '📊 Escala de Elevación' : '📊 Escala de Pendiente'}
                        </h3>

                        {subVistaAltimetria === 'elevacion' ? (
                          <>
                            {/* Barra de gradiente elevación */}
                            <div className="mb-3">
                              <div
                                className="h-5 sm:h-6 rounded-lg shadow-inner"
                                style={{
                                  background: `linear-gradient(to right,
                                    rgb(34,139,34) 0%,
                                    rgb(144,238,144) 25%,
                                    rgb(255,255,150) 50%,
                                    rgb(255,200,100) 70%,
                                    rgb(210,105,30) 85%,
                                    rgb(139,90,43) 100%
                                  )`
                                }}
                              />
                              <div className="flex justify-between mt-1 text-[10px] sm:text-xs text-gray-500">
                                <span>Bajo</span>
                                <span>Medio</span>
                                <span>Alto</span>
                              </div>
                            </div>

                            {/* Leyenda elevación */}
                            <div className="space-y-1.5 text-[11px] sm:text-xs">
                              {[
                                ['rgb(139,90,43)', 'Zonas altas / Lomas'],
                                ['rgb(210,105,30)', 'Elevación media-alta'],
                                ['rgb(255,200,100)', 'Elevación media'],
                                ['rgb(144,238,144)', 'Zonas bajas'],
                                ['rgb(34,139,34)', 'Bajos / Cañadas'],
                              ].map(([color, label]) => (
                                <div key={label} className="flex items-center gap-2 sm:gap-3">
                                  <div
                                    className="w-5 h-3 sm:w-6 sm:h-4 rounded"
                                    style={{ backgroundColor: color as string }}
                                  />
                                  <span>{label}</span>
                                </div>
                              ))}
                            </div>
                          </>
                        ) : (
                          <>
                            {/* Barra de gradiente pendiente */}
                            <div className="mb-3">
                              <div
                                className="h-5 sm:h-6 rounded-lg shadow-inner"
                                style={{
                                  background: `linear-gradient(to right,
                                    rgb(34,139,34) 0%,
                                    rgb(144,238,144) 20%,
                                    rgb(255,255,0) 40%,
                                    rgb(255,165,0) 60%,
                                    rgb(255,69,0) 80%,
                                    rgb(139,0,0) 100%
                                  )`
                                }}
                              />
                              <div className="flex justify-between mt-1 text-[10px] sm:text-xs text-gray-500">
                                <span>0°</span>
                                <span>12°</span>
                                <span>25°+</span>
                              </div>
                            </div>

                            {/* Leyenda pendiente */}
                            <div className="space-y-1.5 text-[11px] sm:text-xs">
                              {[
                                ['rgb(34,139,34)', '0-2° Plano (ideal siembra)'],
                                ['rgb(144,238,144)', '2-5° Suave'],
                                ['rgb(255,255,0)', '5-10° Moderado'],
                                ['rgb(255,165,0)', '10-15° Inclinado'],
                                ['rgb(255,69,0)', '15-25° Empinado'],
                                ['rgb(139,0,0)', '>25° Muy empinado'],
                              ].map(([color, label]) => (
                                <div key={label} className="flex items-center gap-2 sm:gap-3">
                                  <div
                                    className="w-5 h-3 sm:w-6 sm:h-4 rounded"
                                    style={{ backgroundColor: color as string }}
                                  />
                                  <span>{label}</span>
                                </div>
                              ))}
                            </div>
                          </>
                        )}
                      </div>

                      {/* Usos prácticos */}
                      <div className="mb-5">
                        <h3 className="text-xs sm:text-sm font-semibold text-gray-700 mb-2 sm:mb-3">
                          💡 ¿Para qué sirve?
                        </h3>
                        <div className="space-y-2 text-xs sm:text-[13px]">
                          <div className="p-2.5 bg-white rounded-lg border border-gray-200">
                            <p className="font-medium text-gray-900 mb-1">💧 Planificar drenajes</p>
                            <p className="text-gray-600">Identificar bajos y cañadas donde acumula agua</p>
                          </div>
                          <div className="p-2.5 bg-white rounded-lg border border-gray-200">
                            <p className="font-medium text-gray-900 mb-1">🚜 Optimizar siembra</p>
                            <p className="text-gray-600">Pendientes suaves (0-5°) son ideales para agricultura</p>
                          </div>
                          <div className="p-2.5 bg-white rounded-lg border border-gray-200">
                            <p className="font-medium text-gray-900 mb-1">🐄 Manejo de pastoreo</p>
                            <p className="text-gray-600">Zonas altas secan más rápido, bajos retienen humedad</p>
                          </div>
                          <div className="p-2.5 bg-white rounded-lg border border-gray-200">
                            <p className="font-medium text-gray-900 mb-1">🌧️ Riesgo de erosión</p>
                            <p className="text-gray-600">Pendientes &gt;10° requieren prácticas de conservación</p>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
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
                      <div className="flex items-center justify-between mb-2 sm:mb-3">
                        <h3 className="text-xs sm:text-sm font-semibold text-gray-700">
                          🌾 Resumen de cultivos
                        </h3>
                        {cultivoSeleccionado && (
                          <button
                            onClick={() => setCultivoSeleccionado(null)}
                            className="text-[10px] sm:text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full hover:bg-red-200 transition"
                          >
                            ✕ Limpiar filtro
                          </button>
                        )}
                      </div>
                      <div className="space-y-2">
                        {resumenCultivosParaMapa.map((cultivo) => (
                          <button
                            key={cultivo.tipo}
                            onClick={() => setCultivoSeleccionado(cultivoSeleccionado === cultivo.tipo ? null : cultivo.tipo)}
                            className={`w-full text-left p-2.5 sm:p-3 rounded-lg border-2 transition-all cursor-pointer hover:scale-[1.02] hover:shadow-md ${
                              cultivoSeleccionado === cultivo.tipo
                                ? 'border-blue-500 shadow-lg ring-2 ring-blue-200'
                                : cultivoSeleccionado === null
                                ? 'border-transparent hover:border-gray-300'
                                : 'border-transparent opacity-40'
                            }`}
                            style={{
                              backgroundColor: `${cultivo.color}25`,
                            }}
                          >
                            {/* Header del cultivo */}
                            <div className="flex items-center justify-between mb-1.5">
                              <div className="flex items-center gap-2 sm:gap-2.5">
                                <div
                                  className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded flex-shrink-0"
                                  style={{
                                    backgroundColor: cultivo.color,
                                  }}
                                />
                                <span className="font-semibold text-gray-900 text-xs sm:text-sm">
                                  {cultivo.tipo}
                                </span>
                              </div>
                              <span className="text-[10px] sm:text-xs font-medium text-gray-700 bg-white/80 px-2 py-0.5 rounded-full">
                                {cultivo.hectareas.toFixed(1)} ha
                              </span>
                            </div>

                            {/* Lista de potreros */}
                            {cultivo.potreros && cultivo.potreros.length > 0 && (
                              <div className="text-[10px] sm:text-xs text-gray-600 leading-relaxed pl-5 sm:pl-6">
                                {cultivo.potreros.map((p, i) => (
                                  <span key={i}>
                                    {p.nombre} ({p.hectareas.toFixed(1)} ha){i < cultivo.potreros.length - 1 ? ', ' : ''}
                                  </span>
                                ))}
                              </div>
                            )}
                          </button>
                        ))}
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
                                    ? (() => {
                                        const nombreCombinacion = lote.cultivos
                                          .map(c => c.tipoCultivo)
                                          .sort()
                                          .join(' + ')
                                        return getColorCultivo(nombreCombinacion)
                                      })()
                                    : COLORES_CULTIVOS['Natural']
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

                        {vistaActual === 'ndvi' && ndvi?.promedio !== null && ndvi?.validPixels > 0 && (
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
                        )}

                        {vistaActual === 'cultivo' && (
                          <div className="mb-1.5">
                            {lote.cultivos && lote.cultivos.length > 0 ? (
                              <div className="text-[11px] sm:text-xs text-gray-600">
                                🌾 {lote.cultivos.map((c) => c.tipoCultivo).sort().join(' + ')}
                              </div>
                            ) : (
                              <div className="text-[11px] sm:text-xs text-gray-600 font-medium">
                                🌿 Natural
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

                        {vistaActual === 'altimetria' && altimetriaData[lote.id] && !altimetriaData[lote.id].error && (
                          <div className="mb-1.5 bg-amber-50 rounded px-2 py-1.5 space-y-1">
                            <div className="text-[11px] sm:text-xs text-gray-600 flex justify-between">
                              <span>🏔️ Elevación:</span>
                              <span className="font-semibold">
                                {altimetriaData[lote.id].elevacionMin?.toFixed(0)} - {altimetriaData[lote.id].elevacionMax?.toFixed(0)} m
                              </span>
                            </div>
                            <div className="text-[11px] sm:text-xs text-gray-600 flex justify-between">
                              <span>📐 Pendiente prom:</span>
                              <span className="font-semibold">
                                {altimetriaData[lote.id].pendientePromedio?.toFixed(1)}°
                              </span>
                            </div>
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