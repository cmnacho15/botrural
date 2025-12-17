'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
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

export default function EditarLotePage() {
  const router = useRouter()
  const params = useParams()
  const loteId = params.id as string

  const [loading, setLoading] = useState(false)
  const [cargando, setCargando] = useState(true)
  const [nombre, setNombre] = useState('')
  const [hectareasManual, setHectareasManual] = useState('')
  const [showMap, setShowMap] = useState(false)
  const [poligono, setPoligono] = useState<number[][] | null>(null)
  const [hectareasCalculadas, setHectareasCalculadas] = useState<number | null>(null)
  const [lotesExistentes, setLotesExistentes] = useState<LoteExistente[]>([])
  const [mapCenter, setMapCenter] = useState<[number, number] | undefined>(undefined)
  const [esPastoreable, setEsPastoreable] = useState(true)
  const [cultivos, setCultivos] = useState<Cultivo[]>([])
  const [animales, setAnimales] = useState<Animal[]>([])
  const [cultivosDisponibles, setCultivosDisponibles] = useState<string[]>([])
  const [categoriasDisponibles, setCategoriasDisponibles] = useState<Array<{nombre: string, tipo: string}>>([])

  // 🆕 NUEVOS ESTADOS PARA DÍAS DE AJUSTE
  const [diasPastoreoAjuste, setDiasPastoreoAjuste] = useState<string>('')
  const [diasDescansoAjuste, setDiasDescansoAjuste] = useState<string>('')

  // 📦 Estados para módulos
  const [modulos, setModulos] = useState<Array<{id: string, nombre: string}>>([])
  const [moduloSeleccionado, setModuloSeleccionado] = useState<string>('')
  const [crearNuevoModulo, setCrearNuevoModulo] = useState(false)
  const [nuevoModuloNombre, setNuevoModuloNombre] = useState('')
  const [nuevoModuloDescripcion, setNuevoModuloDescripcion] = useState('')

  // CARGAR DATOS DEL LOTE
  useEffect(() => {
    cargarLote()
    cargarLotesExistentes()
  }, [loteId])
  
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

    if (typeof window !== 'undefined') {
      const savedCenter = localStorage.getItem('lastPotreroCenter')
      if (savedCenter) setMapCenter(JSON.parse(savedCenter))
      else setMapCenter([-32.5228, -55.7658])
    }
  }, [lotesExistentes])

  async function cargarLote() {
    console.log("Cargando lote:", loteId);

    try {
      const response = await fetch('/api/lotes');
      console.log("GET /api/lotes status:", response.status);

      if (response.ok) {
        const lotes = await response.json();
        console.log("Lotes recibidos:", lotes);

        const lote = lotes.find((l: any) => l.id === loteId);
        console.log("Lote encontrado:", lote);

        if (lote) {
          setNombre(lote.nombre);
          setHectareasManual(parseFloat(lote.hectareas).toFixed(2));
          setPoligono(lote.poligono || null);
          setEsPastoreable(lote.esPastoreable ?? true);
          
          // 🔥 CARGAR MÓDULO ACTUAL
          setModuloSeleccionado(lote.moduloPastoreoId || '')

          // 🆕 CARGAR AJUSTES DE DÍAS
          setDiasPastoreoAjuste(lote.diasPastoreoAjuste?.toString() || '')
          setDiasDescansoAjuste(lote.diasDescansoAjuste?.toString() || '')

          // Cultivos
          console.log("Cultivos del lote:", lote.cultivos);
          if (lote.cultivos?.length > 0) {
            setCultivos(
              lote.cultivos.map((c: any) => ({
                id: c.id,
                tipoCultivo: c.tipoCultivo,
                fechaSiembra: new Date(c.fechaSiembra).toISOString().split('T')[0],
                hectareas: c.hectareas.toString()
              }))
            );
          }

          // Animales
          console.log("Animales del lote:", lote.animalesLote);
          if (lote.animalesLote?.length > 0) {
            setAnimales(
              lote.animalesLote.map((a: any) => ({
                id: a.id,
                categoria: a.categoria,
                cantidad: a.cantidad.toString(),
                peso: a.peso?.toString() || ''
              }))
            );
          }
        }
      } else {
        console.log("Error cargando lotes:", await response.text());
      }
    } catch (error) {
      console.error('ERROR cargando lote:', error);
      alert('Error al cargar el lote');
    } finally {
      setCargando(false);
    }
  }

  async function cargarLotesExistentes() {
    try {
      const response = await fetch('/api/lotes')
      if (response.ok) {
        const data = await response.json()
        setLotesExistentes(data.filter((l: any) => l.id !== loteId))
      }
    } catch (error) {
      console.error('Error cargando lotes:', error)
    }
  }

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
    e.preventDefault();

    console.log("handleSubmit iniciado");

    if (!poligono) {
      alert('Dibujá la ubicación del potrero en el mapa');
      console.log("No hay polígono");
      return;
    }

    setLoading(true);

    try {
      // 🔥 CREAR MÓDULO NUEVO SI ES NECESARIO
      let moduloIdFinal = moduloSeleccionado || null
      
      if (crearNuevoModulo) {
        const moduloNuevoId = await crearModuloSiEsNecesario()
        if (moduloNuevoId) {
          moduloIdFinal = moduloNuevoId
        } else {
          setLoading(false)
          return
        }
      }

      const hectareasFinales = hectareasCalculadas || parseFloat(hectareasManual);
      const cultivosValidos = cultivos
        .filter(c => c.tipoCultivo)
        .map(c => ({
          ...c,
          hectareas: c.hectareas || hectareasFinales.toString()
        }))
      const animalesValidos = animales.filter(a => a.categoria && a.cantidad);

      console.log('📤 ENVIANDO AL BACKEND:');
      console.log('Cultivos válidos:', cultivosValidos);
      console.log('Animales válidos:', animalesValidos);
      console.log('👉 Módulo ID:', moduloIdFinal);

      const payload = {
        nombre,
        hectareas: hectareasFinales,
        poligono,
        esPastoreable,
        cultivos: cultivosValidos,
        animales: animalesValidos,
        moduloPastoreoId: moduloIdFinal,
        // 🆕 AGREGAR AJUSTES DE DÍAS AL PAYLOAD (solo el que corresponde según estado)
diasPastoreoAjuste: tieneAnimales && diasPastoreoAjuste ? parseInt(diasPastoreoAjuste) : undefined,
diasDescansoAjuste: !tieneAnimales && diasDescansoAjuste ? parseInt(diasDescansoAjuste) : undefined,
      };

      // 🔍 LOGS DE DEPURACIÓN - AGREGAR AQUÍ
console.log('📦 PAYLOAD COMPLETO:', JSON.stringify(payload, null, 2));
console.log('🐄 Tiene animales:', tieneAnimales);
console.log('📅 Días pastoreo ajuste:', diasPastoreoAjuste);
console.log('📅 Días descanso ajuste:', diasDescansoAjuste);

      console.log('📦 PAYLOAD COMPLETO:', JSON.stringify(payload, null, 2));

      const url = `/api/lotes/${loteId}`;
      console.log("PUT URL:", url);

      const response = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      console.log("📥 RESPUESTA DEL SERVIDOR:", response.status);

      if (!response.ok) {
        const text = await response.text();
        console.log("❌ ERROR cuerpo de respuesta:", text);
        alert("Error al actualizar el potrero:\n" + text);
        return;
      }

      console.log("✅ PUT exitoso");

      router.push('/dashboard/lotes');
      router.refresh();

    } catch (error) {
      console.error("💥 ERROR en handleSubmit:", error);
      alert("Error al actualizar el potrero");
    } finally {
      setLoading(false);
    }
  }

  const handlePolygonComplete = (coordinates: number[][], areaHectareas: number) => {
    setPoligono(coordinates)
    setHectareasCalculadas(areaHectareas)
    setShowMap(false)
    alert(`¡Potrero dibujado! Área: ${areaHectareas.toFixed(2)} ha`)
  }

  const potrerosParaMapa = [
    ...(poligono ? [{
      id: loteId,
      nombre: `${nombre} (editando)`,
      coordinates: poligono,
      color: '#9ca3af',
      isDashed: true,
      isEditing: true,
    }] : []),
    
    ...lotesExistentes
      .filter(l => l.poligono && l.poligono.length > 0)
      .map((l, i) => ({
        id: l.id,
        nombre: l.nombre,
        coordinates: l.poligono,
        color: ['#ef4444', '#84cc16', '#06b6d4', '#8b5cf6'][i % 4],
        isDashed: false,
        isEditing: false,
      }))
  ]

  if (cargando) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
        <p className="text-gray-600">Cargando potrero...</p>
      </div>
    )
  }

  // 🆕 CALCULAR SI MOSTRAR EL CAMPO DE AJUSTE
  const tieneAnimales = animales.some(a => a.categoria && a.cantidad)
  const mostrarAjusteDias = esPastoreable && (tieneAnimales || !tieneAnimales)

  return (
    <div className="min-h-screen bg-gray-50 p-6 text-gray-900">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Editar Potrero</h1>
        <p className="text-gray-600 text-sm">
          Modificá los datos, cultivos y animales del potrero
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
          
          {/* Checkbox Es Pastoreable */}
          <div className="bg-purple-50 rounded-lg p-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={esPastoreable}
                onChange={(e) => setEsPastoreable(e.target.checked)}
                className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
              />
              <div>
                <span className="text-sm font-medium text-gray-900">Es pastoreable</span>
                <p className="text-xs text-gray-600 mt-1">
                  Si está marcado, este potrero se incluirá en el cálculo de SPG (Superficie de Pastoreo Ganadero)
                </p>
              </div>
            </label>
          </div>

          {/* CULTIVOS */}
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

          {/* ANIMALES */}
          <div className="bg-blue-50 rounded-lg p-4">
            <h3 className="font-medium text-gray-900 mb-3">🐄 Animales</h3>
            {animales.length === 0 && (
              <p className="text-sm text-gray-600 italic mb-3">No hay animales aún</p>
            )}
            <div className="space-y-3">
              {animales.map(a => (
                <div key={a.id} className="grid grid-cols-[100px_1fr_120px_40px] gap-2 bg-white p-3 rounded-lg items-center">
                  <input
                    type="number"
                    value={a.cantidad}
                    onChange={e => actualizarAnimal(a.id, 'cantidad', e.target.value)}
                    placeholder="Cant."
                    className="border border-gray-300 rounded px-3 py-2"
                  />
                  
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
                          {categoriasTipo.map((cat) => (
                            <option key={cat.nombre} value={cat.nombre}>{cat.nombre}</option>
                          ))}
                        </optgroup>
                      )
                    })}
                  </select>

                  <input
                    type="number"
                    value={a.peso || ''}
                    onChange={e => actualizarAnimal(a.id, 'peso', e.target.value)}
                    placeholder="Peso (kg)"
                    className="border border-gray-300 rounded px-3 py-2 text-sm"
                  />

                  <button 
                    onClick={() => eliminarAnimal(a.id)} 
                    type="button" 
                    className="text-red-600 hover:bg-red-50 p-2 rounded transition"
                  >
                    🗑️
                  </button>
                </div>
              ))}
            </div>
            <button type="button" onClick={agregarAnimal} className="text-blue-600 text-sm mt-2 hover:underline">
              + Agregar animales
            </button>
          </div>

          {/* 🆕 AJUSTE DE DÍAS DE PASTOREO/DESCANSO */}
          {mostrarAjusteDias && (
            <div className="bg-amber-50 rounded-lg p-4 border-2 border-amber-200">
              <h3 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                📅 {tieneAnimales ? 'Días de Pastoreo' : 'Días de Descanso'}
              </h3>
              <p className="text-xs text-gray-600 mb-3">
                {tieneAnimales 
                  ? '¿Los animales ya estaban aquí antes de hoy? Indicá cuántos días atrás para ajustar el conteo.'
                  : 'Si este potrero ya estaba en descanso antes de hoy, indicá cuántos días atrás comenzó.'
                }
              </p>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  value={tieneAnimales ? diasPastoreoAjuste : diasDescansoAjuste}
                  onChange={(e) => tieneAnimales 
                    ? setDiasPastoreoAjuste(e.target.value)
                    : setDiasDescansoAjuste(e.target.value)
                  }
                  min="0"
                  className="flex-1 border border-gray-300 rounded-lg px-4 py-2.5"
                  placeholder="Ej: 15 (días adicionales)"
                />
                <span className="text-sm text-gray-600 whitespace-nowrap">días atrás</span>
              </div>
              <p className="text-xs text-gray-500 mt-2 italic">
                💡 Ejemplo: Si ponés "15", significa que {tieneAnimales ? 'los animales están aquí' : 'está en descanso'} desde hace 15 días.
              </p>
            </div>
          )}

          {/* SELECTOR DE MÓDULO */}
          <div className="bg-purple-50 rounded-lg p-4">
            <h3 className="font-medium text-gray-900 mb-3">📦 Módulo de Pastoreo</h3>
            
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

          {/* MAPA */}
          {poligono && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-green-700 font-medium">
                ✅ Ubicación guardada ({poligono.length} puntos)
              </p>
              <button
                type="button"
                onClick={() => setShowMap(true)}
                className="mt-2 text-blue-600 hover:underline text-sm"
              >
                Ver/Editar ubicación en mapa
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
              {loading ? 'Guardando...' : 'Guardar Cambios'}
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
              <h2 className="text-lg font-bold">Ubicación de {nombre}</h2>
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