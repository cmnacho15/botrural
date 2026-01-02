'use client'

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
  peso?: string
}

export default function NuevoLotePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [nombre, setNombre] = useState('')
const [esPastoreable, setEsPastoreable] = useState(true)
  const [showMap, setShowMap] = useState(false)
  const [poligono, setPoligono] = useState<number[][] | null>(null)
  const [hectareasCalculadas, setHectareasCalculadas] = useState<number | null>(null)
  const [lotesExistentes, setLotesExistentes] = useState<LoteExistente[]>([])
  const [cargandoLotes, setCargandoLotes] = useState(true)
  const [mapCenter, setMapCenter] = useState<[number, number] | undefined>(undefined)

  // 🌾 Estados de cultivos y animales
  const [cultivos, setCultivos] = useState<Cultivo[]>([])
  const [animales, setAnimales] = useState<Animal[]>([])
  const [cultivosDisponibles, setCultivosDisponibles] = useState<string[]>([])
  const [categoriasDisponibles, setCategoriasDisponibles] = useState<Array<{nombre: string, tipo: string}>>([])

  // 📦 Estados para módulos
  const [modulos, setModulos] = useState<Array<{id: string, nombre: string}>>([])
  const [moduloSeleccionado, setModuloSeleccionado] = useState<string>('')
  const [crearNuevoModulo, setCrearNuevoModulo] = useState(false)
  const [nuevoModuloNombre, setNuevoModuloNombre] = useState('')
  const [nuevoModuloDescripcion, setNuevoModuloDescripcion] = useState('')

  // 🆕 NUEVOS ESTADOS PARA DÍAS DE AJUSTE
  const [diasPastoreoAjuste, setDiasPastoreoAjuste] = useState<string>('')
  const [diasDescansoAjuste, setDiasDescansoAjuste] = useState<string>('')

  // Cargar lotes
  useEffect(() => {
    cargarLotesExistentes()
  }, [])
  
  // Cargar cultivos disponibles
  useEffect(() => {
    fetch('/api/tipos-cultivo')
      .then((res) => res.json())
      .then((data) => {
        const nombres = data.map((c: any) => c.nombre)
        setCultivosDisponibles(nombres)
      })
      .catch(() => {
        console.error('Error cargando cultivos')
      })
  }, [])

  // Cargar categorías de animales disponibles
  useEffect(() => {
    fetch('/api/categorias-animal')
      .then((res) => res.json())
      .then((data) => {
        const activas = data
          .filter((c: any) => c.activo)
          .map((c: any) => ({
            nombre: c.nombreSingular,
            tipo: c.tipoAnimal
          }))
        setCategoriasDisponibles(activas)
      })
      .catch(() => {
        console.error('Error cargando categorías')
      })
  }, [])

  // Cargar módulos disponibles
  useEffect(() => {
    fetch('/api/modulos-pastoreo')
      .then((res) => res.json())
      .then((data) => {
        setModulos(data)
      })
      .catch(() => {
        console.error('Error cargando módulos')
      })
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

    // Si NO hay potreros, limpiar el localStorage y mostrar vista de Uruguay
    if (typeof window !== 'undefined') {
      if (lotesExistentes.length === 0) {
        localStorage.removeItem('lastPotreroCenter')
      }
      setMapCenter([-32.5228, -55.7658]) // Vista de Uruguay completa
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
      { id: Date.now().toString(), categoria: '', cantidad: '', peso: '' }
    ])
  }

  const eliminarAnimal = (id: string) => setAnimales(animales.filter(a => a.id !== id))
  const actualizarAnimal = (id: string, campo: string, valor: string) =>
    setAnimales(animales.map(a => (a.id === id ? { ...a, [campo]: valor } : a)))

  // 📦 Crear nuevo módulo si es necesario
  async function crearModuloSiEsNecesario(): Promise<string | null> {
    if (!crearNuevoModulo || !nuevoModuloNombre.trim()) return null

    try {
      const response = await fetch('/api/modulos-pastoreo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: nuevoModuloNombre.trim(),
          descripcion: nuevoModuloDescripcion.trim() || null,
        }),
      })

      if (response.ok) {
        const moduloCreado = await response.json()
        console.log('✅ Módulo creado:', moduloCreado.nombre)
        return moduloCreado.id
      } else {
        const error = await response.json()
        alert(error.error || 'Error al crear el módulo')
        return null
      }
    } catch (error) {
      console.error('Error creando módulo:', error)
      alert('Error al crear el módulo')
      return null
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!poligono) return alert('Dibujá la ubicación del potrero en el mapa')

    setLoading(true)

    try {
      // 🔥 CREAR MÓDULO NUEVO SI ES NECESARIO
      let moduloIdFinal = moduloSeleccionado || null
      
      if (crearNuevoModulo) {
        const moduloNuevoId = await crearModuloSiEsNecesario()
        if (moduloNuevoId) {
          moduloIdFinal = moduloNuevoId
        } else {
          setLoading(false)
          return // Falló la creación del módulo
        }
      }

      const hectareasFinales = hectareasCalculadas!
      const cultivosValidos = cultivos
        .filter(c => c.tipoCultivo)
        .map(c => ({
          ...c,
          hectareas: c.hectareas || hectareasFinales.toString()
        }))
      const animalesValidos = animales.filter(a => a.categoria && a.cantidad)

      const tieneAnimales = animalesValidos.length > 0;  // 🆕 NUEVO

      console.log('📤 ENVIANDO AL BACKEND...')
      console.log('👉 Cultivos válidos:', cultivosValidos)
      console.log('👉 Animales válidos:', animalesValidos)
      console.log('👉 Módulo ID:', moduloIdFinal)

      const payload = {
        nombre,
        hectareas: hectareasFinales,
        poligono,
        esPastoreable,
        cultivos: cultivosValidos,
        animales: animalesValidos,
        moduloPastoreoId: moduloIdFinal,
        // 🆕 AGREGAR AJUSTES DE DÍAS AL PAYLOAD
        diasPastoreoAjuste: tieneAnimales && diasPastoreoAjuste ? parseInt(diasPastoreoAjuste) : undefined,
        diasDescansoAjuste: !tieneAnimales && diasDescansoAjuste ? parseInt(diasDescansoAjuste) : undefined,
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

          {/* Las hectáreas se calculan automáticamente al dibujar el polígono */}

          {/* 🆕 SELECTOR PASTOREABLE / NO PASTOREABLE */}
<div className="bg-purple-50 rounded-lg p-4">
  <label className="block text-sm font-medium text-gray-900 mb-3">
    Tipo de potrero
  </label>
  
  <div className="flex gap-4">
    {/* OPCIÓN: PASTOREABLE */}
    <label className="flex-1 cursor-pointer">
      <div className={`border-2 rounded-lg p-4 transition ${
        esPastoreable 
          ? 'border-green-500 bg-green-50' 
          : 'border-gray-300 bg-white hover:border-gray-400'
      }`}>
        <div className="flex items-center gap-3">
          <input
            type="radio"
            name="pastoreable"
            checked={esPastoreable}
            onChange={() => setEsPastoreable(true)}
            className="w-5 h-5 text-green-600"
          />
          <div>
            <div className="font-medium text-gray-900">🌾 Pastoreable</div>
            <div className="text-xs text-gray-600 mt-1">
              Se incluye en el cálculo de SPG
            </div>
          </div>
        </div>
      </div>
    </label>

    {/* OPCIÓN: NO PASTOREABLE */}
    <label className="flex-1 cursor-pointer">
      <div className={`border-2 rounded-lg p-4 transition ${
        !esPastoreable 
          ? 'border-gray-500 bg-gray-50' 
          : 'border-gray-300 bg-white hover:border-gray-400'
      }`}>
        <div className="flex items-center gap-3">
          <input
            type="radio"
            name="pastoreable"
            checked={!esPastoreable}
            onChange={() => setEsPastoreable(false)}
            className="w-5 h-5 text-gray-600"
          />
          <div>
            <div className="font-medium text-gray-900">🔒 No pastoreable</div>
            <div className="text-xs text-gray-600 mt-1">
              No se usa para animales
            </div>
          </div>
        </div>
      </div>
    </label>
  </div>
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
                    {cultivosDisponibles.map((cultivo) => (
                      <option key={cultivo} value={cultivo}>{cultivo}</option>
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
{esPastoreable && (
  <div className="bg-blue-50 rounded-lg p-4">
    <h3 className="font-medium text-gray-900 mb-3">🐄 Animales</h3>
    {animales.length === 0 && (
      <p className="text-sm text-gray-600 italic mb-3">No hay animales aún</p>
    )}
    <div className="space-y-3">
      {animales.map(a => {
        const categoriasYaUsadas = animales.filter(an => an.id !== a.id && an.categoria).map(an => an.categoria);
        
        return (
          <div key={a.id} className="grid grid-cols-[100px_1fr_120px_40px] gap-2 bg-white p-3 rounded-lg items-center">
            {/* Cantidad */}
            <input
              type="number"
              value={a.cantidad}
              onChange={e => actualizarAnimal(a.id, 'cantidad', e.target.value)}
              placeholder="Cant."
              className="border border-gray-300 rounded px-3 py-2"
            />
            
            {/* Tipo de animal */}
            <select
              value={a.categoria}
              onChange={e => actualizarAnimal(a.id, 'categoria', e.target.value)}
              className="border border-gray-300 rounded px-3 py-2"
            >
              <option value="">Seleccionar categoría</option>
              
              {['BOVINO', 'OVINO', 'EQUINO', 'OTRO'].map(tipo => {
                const categoriasTipo = categoriasDisponibles.filter(c => c.tipo === tipo)
                if (categoriasTipo.length === 0) return null
                
                const labels = {
                  BOVINO: '🐄 BOVINOS',
                  OVINO: '🐑 OVINOS',
                  EQUINO: '🐴 EQUINOS',
                  OTRO: '📦 OTROS'
                }
                
                return (
                  <optgroup key={tipo} label={labels[tipo as keyof typeof labels]}>
                    {categoriasTipo.map((cat) => {
                      const yaUsada = categoriasYaUsadas.includes(cat.nombre);
                      return (
                        <option 
                          key={cat.nombre} 
                          value={cat.nombre}
                          disabled={yaUsada}
                        >
                          {cat.nombre}{yaUsada ? ' (ya existente - editá la existente)' : ''}
                        </option>
                      );
                    })}
                  </optgroup>
                )
              })}
            </select>

                  {/* Peso (Opcional) */}
                  <input
                    type="number"
                    value={a.peso || ''}
                    onChange={e => actualizarAnimal(a.id, 'peso', e.target.value)}
                    placeholder="Peso (kg)"
                    className="border border-gray-300 rounded px-3 py-2 text-sm"
                  />

                  {/* Botón eliminar */}
                  <button 
                    onClick={() => eliminarAnimal(a.id)} 
                    type="button" 
                    className="text-red-600 hover:bg-red-50 p-2 rounded transition"
                  >
                    🗑️
                  </button>
                </div>
              );
            })}
            </div>
            <button type="button" onClick={agregarAnimal} className="text-blue-600 text-sm mt-2 hover:underline">
              + Agregar animales
            </button>
          </div>
          )}
          
          

          {/* 🆕 AJUSTE DE DÍAS DE PASTOREO/DESCANSO */}
          {esPastoreable && (
            <div className="bg-amber-50 rounded-lg p-4 border-2 border-amber-200">
              <h3 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                📅 {animales.some(a => a.categoria && a.cantidad) ? 'Días de Pastoreo' : 'Días de Descanso'} <span className="text-gray-500 text-sm font-normal">(opcional)</span>
              </h3>
              <p className="text-xs text-gray-600 mb-3">
                {animales.some(a => a.categoria && a.cantidad)
                  ? '¿Los animales ya estaban aquí antes de hoy? Indicá cuántos días atrás para ajustar el conteo.'
                  : 'Si este potrero ya estaba en descanso antes de hoy, indicá hace cuántos días atrás comenzó.'
                }
              </p>
              <div className="flex items-center gap-3">
                <input
  type="number"
  value={diasPastoreoAjuste || diasDescansoAjuste}
  onChange={(e) => {
    setDiasPastoreoAjuste(e.target.value)
    setDiasDescansoAjuste(e.target.value)
  }}
  min="0"
  className="flex-1 border border-gray-300 rounded-lg px-4 py-2.5"
  placeholder="Ej: 15 días"
/>
                <span className="text-sm text-gray-600 whitespace-nowrap">días atrás</span>
              </div>
              <p className="text-xs text-gray-500 mt-2 italic">
                💡 Ejemplo: Si ponés "15", significa que {animales.some(a => a.categoria && a.cantidad) ? 'hay animales presentes en este potrero' : 'está en descanso'} desde hace 15 días.
              </p>
            </div>
          )}

          

          {/* 📦 SELECTOR DE MÓDULO */}
          {esPastoreable && (
          <div className="bg-purple-50 rounded-lg p-4">
            <h3 className="font-medium text-gray-900 mb-2">📦 Módulo de Pastoreo <span className="text-gray-500 text-sm font-normal">(opcional)</span></h3>
            <p className="text-xs text-gray-600 mb-3">
              Útil en pastoreo rotativo para visualizar informes de carga y pastoreo por módulo/s.
            </p>
            
            {!crearNuevoModulo ? (
              <div className="space-y-3">
                <select
                  value={moduloSeleccionado}
                  onChange={(e) => setModuloSeleccionado(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5"
                >
                  <option value="">Sin módulo asignado</option>
                  {modulos.map((mod) => (
                    <option key={mod.id} value={mod.id}>
                      {mod.nombre}
                    </option>
                  ))}
                </select>
                
                <button
                  type="button"
                  onClick={() => setCrearNuevoModulo(true)}
                  className="text-purple-600 text-sm hover:underline"
                >
                  + Crear nuevo módulo
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <input
                  type="text"
                  value={nuevoModuloNombre}
                  onChange={(e) => setNuevoModuloNombre(e.target.value)}
                  placeholder="Nombre del módulo"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5"
                />
                <input
                  type="text"
                  value={nuevoModuloDescripcion}
                  onChange={(e) => setNuevoModuloDescripcion(e.target.value)}
                  placeholder="Descripción (opcional)"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5"
                />
                <button
                  type="button"
                  onClick={() => {
                    setCrearNuevoModulo(false)
                    setNuevoModuloNombre('')
                    setNuevoModuloDescripcion('')
                  }}
                  className="text-gray-600 text-sm hover:underline"
                >
                  ← Seleccionar módulo existente
                </button>
              </div>
            )}
          </div>
          )}


          
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
                initialZoom={lotesExistentes.length > 0 ? 16 : 6}
                existingPolygons={potrerosParaMapa}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}