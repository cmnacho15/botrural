'use client'
//hola
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import dynamic from 'next/dynamic'

const MapaPoligono = dynamic(() => import('@/app/components/MapaPoligono'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[500px] flex items-center justify-center bg-gray-100 rounded-lg">
      <p>Cargando mapa...</p>
    </div>
  ),
})

interface LoteExistente {
  id: string
  nombre: string
  hectareas: number
  poligono: number[][]
}

interface Cultivo {
  id: string
  tipoCultivo: string
  fechaSiembra: string
  hectareas: string
}

interface Animal {
  id: string
  categoria: string
  cantidad: string
}

// 🌾 Tipos de cultivos
const TIPOS_CULTIVO = [
  'Soja', 'Maíz', 'Trigo', 'Girasol', 'Sorgo',
  'Cebada', 'Avena', 'Arroz', 'Alfalfa', 'Pradera'
]

// 🐄 Categorías animales actualizadas
const CATEGORIAS_ANIMAL = {
  'VACUNOS': [
    'Toros',
    'Vacas',
    'Novillos +3 años',
    'Novillos 2–3 años',
    'Novillos 1–2 años',
    'Vaquillonas +2 años',
    'Vaquillonas 1–2 años',
    'Terneros/as'
  ],
  'OVINOS': [
    'Carneros',
    'Ovejas',
    'Capones',
    'Borregas 2–4 dientes',
    'Corderas DL',
    'Corderos DL',
    'Corderos/as Mamones'
  ],
  'YEGUARIZOS': [
    'Padrillos',
    'Yeguas',
    'Caballos',
    'Potrillos'
  ]
}


console.log('🔍 CATEGORIAS_ANIMAL VERSION:', JSON.stringify(CATEGORIAS_ANIMAL).substring(0, 100))

export default function NuevoLotePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [nombre, setNombre] = useState('')
  const [hectareasManual, setHectareasManual] = useState('')
  const [showMap, setShowMap] = useState(false)
  const [poligono, setPoligono] = useState<number[][] | null>(null)
  const [hectareasCalculadas, setHectareasCalculadas] = useState<number | null>(null)
  const [lotesExistentes, setLotesExistentes] = useState<LoteExistente[]>([])
  const [cargandoLotes, setCargandoLotes] = useState(true)
  const [mapCenter, setMapCenter] = useState<[number, number] | undefined>(undefined)

  // 🌾 Estados de cultivos y animales
  const [cultivos, setCultivos] = useState<Cultivo[]>([])
  const [animales, setAnimales] = useState<Animal[]>([])

  // Cargar lotes
  useEffect(() => {
    cargarLotesExistentes()
  }, [])

  useEffect(() => {
    if (lotesExistentes.length > 0) {
      const todosLosPuntos = lotesExistentes
        .flatMap(l => l.poligono || [])
        .filter(c => c.length === 2)

      if (todosLosPuntos.length > 0) {
        const center = todosLosPuntos
          .reduce((acc, p) => [acc[0] + p[0], acc[1] + p[1]], [0, 0])
          .map(v => v / todosLosPuntos.length) as [number, number]
        setMapCenter(center)
        return
      }
    }

    if (typeof window !== 'undefined') {
      const savedCenter = localStorage.getItem('lastPotreroCenter')
      if (savedCenter) setMapCenter(JSON.parse(savedCenter))
      else setMapCenter([-32.5228, -55.7658]) // Uruguay
    }
  }, [lotesExistentes])

  async function cargarLotesExistentes() {
    try {
      const response = await fetch('/api/lotes')
      if (response.ok) {
        const data = await response.json()
        setLotesExistentes(data)
      }
    } catch (error) {
      console.error('Error cargando lotes:', error)
    } finally {
      setCargandoLotes(false)
    }
  }

  // 🌾 Agregar cultivo
  const agregarCultivo = () => {
    setCultivos([
      ...cultivos,
      {
        id: Date.now().toString(),
        tipoCultivo: '',
        fechaSiembra: new Date().toISOString().split('T')[0],
        hectareas: ''
      }
    ])
  }

  const eliminarCultivo = (id: string) => setCultivos(cultivos.filter(c => c.id !== id))
  const actualizarCultivo = (id: string, campo: string, valor: string) =>
    setCultivos(cultivos.map(c => (c.id === id ? { ...c, [campo]: valor } : c)))

  // 🐄 Animales
  const agregarAnimal = () => {
    setAnimales([
      ...animales,
      { id: Date.now().toString(), categoria: '', cantidad: '' }
    ])
  }

  const eliminarAnimal = (id: string) => setAnimales(animales.filter(a => a.id !== id))
  const actualizarAnimal = (id: string, campo: string, valor: string) =>
    setAnimales(animales.map(a => (a.id === id ? { ...a, [campo]: valor } : a)))

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!poligono) return alert('Dibujá la ubicación del potrero en el mapa')

    setLoading(true)

    try {
      const hectareasFinales = hectareasCalculadas || parseFloat(hectareasManual)
      const cultivosValidos = cultivos
        .filter(c => c.tipoCultivo)
        .map(c => ({
          ...c,
          hectareas: c.hectareas || hectareasFinales.toString()
        }))
      const animalesValidos = animales.filter(a => a.categoria && a.cantidad)

      console.log('📤 ENVIANDO AL BACKEND...')
      console.log('👉 Cultivos válidos:', cultivosValidos)
      console.log('👉 Animales válidos:', animalesValidos)

      const payload = {
        nombre,
        hectareas: hectareasFinales,
        poligono,
        cultivos: cultivosValidos,
        animales: animalesValidos,
      }

      console.log('📦 PAYLOAD COMPLETO:', JSON.stringify(payload, null, 2))

      const response = await fetch('/api/lotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      console.log('📥 RESPUESTA DEL SERVER:', response.status)

      if (response.ok) {
        const result = await response.json()
        console.log('✅ LOTE CREADO:', result)

        if (poligono.length > 0) {
          const center = poligono
            .reduce((acc, point) => [acc[0] + point[0], acc[1] + point[1]], [0, 0])
            .map(v => v / poligono.length) as [number, number]

          localStorage.setItem('lastPotreroCenter', JSON.stringify(center))
        }

        router.push('/dashboard/lotes')
        router.refresh()
      } else {
        console.error('❌ ERROR:', await response.text())
        alert('Error al crear el potrero')
      }
    } catch (error) {
      console.error('💥 Error creando lote:', error)
      alert('Error al crear el potrero')
    } finally {
      setLoading(false)
    }
  }

  const handlePolygonComplete = (coordinates: number[][], areaHectareas: number) => {
    setPoligono(coordinates)
    setHectareasCalculadas(areaHectareas)
    setShowMap(false)
    alert(`¡Potrero dibujado! Área: ${areaHectareas.toFixed(2)} ha`)
  }

  const potrerosParaMapa = lotesExistentes
    .filter(l => l.poligono && l.poligono.length > 0)
    .map((l, i) => ({
      id: l.id,
      nombre: l.nombre,
      coordinates: l.poligono,
      color: ['#ef4444', '#84cc16', '#06b6d4', '#8b5cf6'][i % 4],
    }))

  return (
    <div className="min-h-screen bg-gray-50 p-6 text-gray-900">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Nuevo Potrero</h1>
        <p className="text-gray-600 text-sm">
          Ingresá los datos, cultivos, animales y ubicación del potrero
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6 max-w-4xl mx-auto">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* NOMBRE */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Nombre</label>
            <input
              type="text"
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              required
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5"
              placeholder="Ej: Potrero Norte"
            />
          </div>

          {/* HECTÁREAS */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Hectáreas</label>
            <input
              type="number"
              value={hectareasManual}
              onChange={e => setHectareasManual(e.target.value)}
              step="0.01"
              required
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5"
              placeholder="Ej: 25.5"
            />
          </div>

          {/* 🌾 CULTIVOS */}
          <div className="bg-blue-50 rounded-lg p-4">
            <h3 className="font-medium text-gray-900 mb-3">🌾 Cultivos</h3>
            {cultivos.length === 0 && (
              <p className="text-sm text-gray-600 italic mb-3">No hay cultivos aún</p>
            )}
            <div className="space-y-3">
              {cultivos.map(c => (
                <div key={c.id} className="flex gap-2 bg-white p-3 rounded-lg items-center">
                  <select
                    value={c.tipoCultivo}
                    onChange={e => actualizarCultivo(c.id, 'tipoCultivo', e.target.value)}
                    className="flex-1 border border-gray-300 rounded px-3 py-2"
                  >
                    <option value="">Tipo de cultivo</option>
                    {TIPOS_CULTIVO.map(t => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                  <input
                    type="date"
                    value={c.fechaSiembra}
                    onChange={e => actualizarCultivo(c.id, 'fechaSiembra', e.target.value)}
                    className="border border-gray-300 rounded px-3 py-2"
                  />
                  <input
                    type="number"
                    value={c.hectareas}
                    onChange={e => actualizarCultivo(c.id, 'hectareas', e.target.value)}
                    placeholder="(total potrero)"
                    className="w-24 border border-gray-300 rounded px-3 py-2"
                  />
                  <button onClick={() => eliminarCultivo(c.id)} type="button" className="text-red-600">🗑️</button>
                </div>
              ))}
            </div>
            <button type="button" onClick={agregarCultivo} className="text-blue-600 text-sm mt-2">
              + Agregar cultivo
            </button>
          </div>

          {/* 🐄 ANIMALES */}
          <div className="bg-blue-50 rounded-lg p-4">
            <h3 className="font-medium text-gray-900 mb-3">🐄 Animales</h3>
            {animales.length === 0 && (
              <p className="text-sm text-gray-600 italic mb-3">No hay animales aún</p>
            )}
            <div className="space-y-3">
              {animales.map(a => (
                <div key={a.id} className="flex gap-2 bg-white p-3 rounded-lg items-center">
                  <input
                    type="number"
                    value={a.cantidad}
                    onChange={e => actualizarAnimal(a.id, 'cantidad', e.target.value)}
                    placeholder="Cant."
                    className="w-24 border border-gray-300 rounded px-3 py-2"
                  />
                  <select
                    value={a.categoria}
                    onChange={e => actualizarAnimal(a.id, 'categoria', e.target.value)}
                    className="flex-1 border border-gray-300 rounded px-3 py-2"
                  >
                    <option value="">Seleccionar categoría</option>
                    
                    {/* VACUNOS */}
                    <optgroup label="🐄 VACUNOS">
                      {CATEGORIAS_ANIMAL.VACUNOS.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </optgroup>

                    {/* OVINOS */}
                    <optgroup label="🐑 OVINOS">
                      {CATEGORIAS_ANIMAL.OVINOS.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </optgroup>

                    {/* YEGUARIZOS */}
                    <optgroup label="🐴 YEGUARIZOS">
                      {CATEGORIAS_ANIMAL.YEGUARIZOS.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </optgroup>
                  </select>
                  <button onClick={() => eliminarAnimal(a.id)} type="button" className="text-red-600">🗑️</button>
                </div>
              ))}
            </div>
            <button type="button" onClick={agregarAnimal} className="text-blue-600 text-sm mt-2">
              + Agregar animales
            </button>
          </div>

          {/* MAPA */}
          {!poligono && (
            <button
              type="button"
              onClick={() => setShowMap(true)}
              className="w-full bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700"
            >
              📍 Agregar ubicación en el mapa
            </button>
          )}

          {poligono && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-green-700 font-medium">
                ✅ Ubicación agregada ({poligono.length} puntos)
              </p>
              {hectareasCalculadas && (
                <p className="text-green-600 text-sm mt-1">
                  Área: <strong>{hectareasCalculadas.toFixed(2)} ha</strong>
                </p>
              )}
              <button
                type="button"
                onClick={() => setShowMap(true)}
                className="mt-2 text-blue-600 hover:underline text-sm"
              >
                Editar ubicación
              </button>
            </div>
          )}

          {/* BOTONES */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <button
              type="submit"
              disabled={loading || !poligono}
              className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
            >
              {loading ? 'Guardando...' : 'Confirmar'}
            </button>
            <Link
              href="/dashboard/lotes"
              className="flex-1 bg-gray-100 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-200 text-center transition font-medium"
            >
              Cancelar
            </Link>
          </div>
        </form>
      </div>

      {/* MODAL MAPA */}
      {showMap && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-white w-full h-full md:rounded-xl md:w-full md:max-w-5xl md:h-[85vh] flex flex-col">
            <div className="p-4 border-b flex justify-between items-center">
              <h2 className="text-lg font-bold">Dibujar {nombre || 'potrero'}</h2>
              <button onClick={() => setShowMap(false)} className="text-gray-500 text-2xl">✕</button>
            </div>
            <div className="flex-1">
              <MapaPoligono
                onPolygonComplete={handlePolygonComplete}
                initialCenter={mapCenter}
                initialZoom={mapCenter ? 16 : 8}
                existingPolygons={potrerosParaMapa}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}