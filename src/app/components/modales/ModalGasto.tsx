'use client'

import { useState, useEffect } from 'react'
import { METODOS_PAGO } from '@/lib/constants'
import { obtenerFechaLocal } from '@/lib/fechas'
import { esCategoriaVariable, ESPECIES_VALIDAS } from '@/lib/costos/categoriasCostos'

type ModalGastoProps = {
  onClose: () => void
  onSuccess: () => void
}

type ItemGasto = {
  id: string
  item: string
  categoria: string
  precio: number
  iva: number
  precioFinal: number
  especies: string[]
  loteId: string | null
}

export default function ModalGasto({ onClose, onSuccess }: ModalGastoProps) {
  const [fecha, setFecha] = useState(obtenerFechaLocal())
  const [proveedor, setProveedor] = useState('')
  const [proveedoresPrevios, setProveedoresPrevios] = useState<string[]>([])
  const [mostrarSugerencias, setMostrarSugerencias] = useState(false)
  const [moneda, setMoneda] = useState('USD')
  const [metodoPago, setMetodoPago] = useState(METODOS_PAGO[0])
  const [notas, setNotas] = useState('')
  const [loading, setLoading] = useState(false)

  // PAGO A PLAZO
  const [esPlazo, setEsPlazo] = useState(false)
  const [diasPlazo, setDiasPlazo] = useState(0)
  const [pagado, setPagado] = useState(false)

  // 🆕 CATEGORÍAS DINÁMICAS
  const [categorias, setCategorias] = useState<string[]>([])

  // 🌾 Lotes agrícolas (no pastoreables con cultivo)
  const [lotesAgricolas, setLotesAgricolas] = useState<Array<{
    id: string
    nombre: string
    cultivos: Array<{ tipoCultivo: string }>
  }>>([])

  // 🌾 Cultivos seleccionados para Insumos de Cultivos
  const [cultivosDisponibles, setCultivosDisponibles] = useState<Array<{
    tipoCultivo: string
    hectareas: number
    lotes: string[]
  }>>([])
  const [cultivosSeleccionados, setCultivosSeleccionados] = useState<string[]>([])

  // 🏢 Multicampo - Gastos compartidos
  const [camposDelGrupo, setCamposDelGrupo] = useState<Array<{
    id: string
    nombre: string
    hectareas: number
  }>>([])
  const [esGastoGrupo, setEsGastoGrupo] = useState(false)
  const [grupoId, setGrupoId] = useState<string | null>(null)

  const [items, setItems] = useState<ItemGasto[]>([
    {
      id: '1',
      item: '',
      categoria: '',
      precio: 0,
      iva: 0,
      precioFinal: 0,
      especies: [],
      loteId: null,
    },
  ])

  // CARGAR PROVEEDORES
  useEffect(() => {
    const cargarProveedores = async () => {
      try {
        const res = await fetch('/api/proveedores')
        if (res.ok) {
          const data = await res.json()

          const proveedoresLimpios = data
            .filter((p: any) => p && typeof p === 'string' && p.trim() !== '')
            .map((p: string) => p.trim())

          const unicos = Array.from(
            new Set(proveedoresLimpios.map((p: string) => p.toLowerCase()))
          )
            .map(lower =>
              proveedoresLimpios.find((p: string) => p.toLowerCase() === lower)
            )
            .filter(Boolean) as string[]

          setProveedoresPrevios(unicos)
        }
      } catch (err) {
        console.error('Error cargando proveedores:', err)
      }
    }
    cargarProveedores()
  }, [])

  // 🌾 Cargar lotes agrícolas (no pastoreables con cultivo)
  useEffect(() => {
    const cargarLotesAgricolas = async () => {
      try {
        const res = await fetch('/api/lotes')
        if (res.ok) {
          const lotes = await res.json()
          
          // Filtrar solo lotes NO pastoreables que tengan cultivos
          const agricolas = lotes.filter((l: any) => 
            l.esPastoreable === false && 
            l.cultivos && 
            l.cultivos.length > 0
          )
          
          setLotesAgricolas(agricolas)
          
          // 🌾 Agrupar cultivos por tipo con sus hectáreas totales
          const cultivosMap = new Map<string, { hectareas: number; lotes: string[] }>()
          
          agricolas.forEach((lote: any) => {
            lote.cultivos.forEach((cultivo: any) => {
              const tipo = cultivo.tipoCultivo
              if (!cultivosMap.has(tipo)) {
                cultivosMap.set(tipo, { hectareas: 0, lotes: [] })
              }
              const data = cultivosMap.get(tipo)!
              data.hectareas += cultivo.hectareas || 0
              if (!data.lotes.includes(lote.nombre)) {
                data.lotes.push(lote.nombre)
              }
            })
          })
          
          const cultivosArray = Array.from(cultivosMap.entries()).map(([tipo, data]) => ({
            tipoCultivo: tipo,
            hectareas: data.hectareas,
            lotes: data.lotes
          }))
          
          setCultivosDisponibles(cultivosArray)
        }
      } catch (err) {
        console.error('Error cargando lotes agrícolas:', err)
      }
    }
    cargarLotesAgricolas()
  }, [])

  // 🏢 Cargar campos del grupo (si tiene multicampo)
  useEffect(() => {
    const cargarCamposGrupo = async () => {
      try {
        const res = await fetch('/api/campos-grupo')
        if (res.ok) {
          const data = await res.json()
          
          if (data.camposDelGrupo && data.camposDelGrupo.length > 1) {
            setCamposDelGrupo(data.camposDelGrupo)
            setGrupoId(data.grupoId)
          }
        }
      } catch (err) {
        console.error('Error cargando campos del grupo:', err)
      }
    }
    cargarCamposGrupo()
  }, [])

  // 🆕 CARGAR CATEGORÍAS DINÁMICAS DESDE BACKEND
  useEffect(() => {
    const cargarCategorias = async () => {
      try {
        const res = await fetch('/api/categorias-gasto')
        if (res.ok) {
          const data = await res.json()
          const nombres = data.map((cat: any) => cat.nombre)
          setCategorias(nombres)

          // Setear primera categoría en el primer item
          if (nombres.length > 0 && items.length > 0 && !items[0].categoria) {
            setItems(prev =>
              prev.map((item, idx) =>
                idx === 0 ? { ...item, categoria: nombres[0] } : item
              )
            )
          }
        }
      } catch (err) {
        console.error('Error cargando categorías:', err)
      }
    }
    cargarCategorias()
  }, [])

  const calcularPrecioFinal = (precio: number, iva: number) =>
    precio + (precio * iva) / 100

  const handleItemChange = (id: string, field: keyof ItemGasto, value: any) => {
    setItems(prev =>
      prev.map(item => {
        if (item.id !== id) return item

        let updated = { ...item }

        if (field === 'precio') {
          const numValue = parseFloat(value)
          updated.precio = isNaN(numValue) ? 0 : numValue
          updated.precioFinal = calcularPrecioFinal(updated.precio, updated.iva)
        } else if (field === 'iva') {
          const numValue = parseFloat(value)
          updated.iva = isNaN(numValue) ? 0 : numValue
          updated.precioFinal = calcularPrecioFinal(updated.precio, updated.iva)
        } else if (field === 'categoria') {
          // ✅ Si cambia categoría, resetear especies y lote
          updated.categoria = value
          if (esCategoriaVariable(value)) {
            updated.especies = []
          } else {
            updated.loteId = null
          }
        } else {
          updated = { ...updated, [field]: value }
        }
        return updated
      })
    )
  }

  const agregarItem = () => {
    setItems(prev => [
      ...prev,
      {
        id: Date.now().toString(),
        item: '',
        categoria: categorias[0] || '',
        precio: 0,
        iva: 0,
        precioFinal: 0,
        especies: [],
        loteId: null,
      },
    ])
  }

  const eliminarItem = (id: string) => {
    if (items.length === 1) return
    setItems(prev => prev.filter(item => item.id !== id))
  }

  // 🌾 Toggle selección de cultivo
  const toggleCultivo = (tipoCultivo: string) => {
    setCultivosSeleccionados(prev => 
      prev.includes(tipoCultivo)
        ? prev.filter(c => c !== tipoCultivo)
        : [...prev, tipoCultivo]
    )
  }

  // 🌾 Seleccionar/deseleccionar todos
  const toggleTodosCultivos = () => {
    if (cultivosSeleccionados.length === cultivosDisponibles.length) {
      setCultivosSeleccionados([])
    } else {
      setCultivosSeleccionados(cultivosDisponibles.map(c => c.tipoCultivo))
    }
  }

  const montoTotal = items.reduce((sum, item) => sum + item.precioFinal, 0)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (items.some(item => !item.item || item.precio <= 0)) {
      alert('Completá todos los ítems con nombre y precio válido')
      return
    }

    // ✅ VALIDACIÓN: Variables de ganadería requieren al menos una especie
    const itemSinEspecie = items.find(item => 
      esCategoriaVariable(item.categoria) && 
      item.categoria !== 'Insumos de Cultivos' && 
      item.especies.length === 0
    )
    
    if (itemSinEspecie) {
      alert(`El item "${itemSinEspecie.item}" es un costo variable y requiere que asignes al menos una especie (Vacunos/Ovinos/Equinos)`)
      return
    }

    // ✅ VALIDACIÓN: Agricultura requiere cultivos seleccionados
    const tieneInsumoCultivos = items.some(item => item.categoria === 'Insumos de Cultivos')
    
    if (tieneInsumoCultivos && cultivosSeleccionados.length === 0) {
      alert('Debes seleccionar al menos un cultivo para "Insumos de Cultivos"')
      return
    }

    if (esPlazo && diasPlazo < 1) {
      alert('Si es pago a plazo, ingresá una cantidad de días válida')
      return
    }

    setLoading(true)

    try {
      for (let i = 0; i < items.length; i++) {
        const item = items[i]

        // 🌾 Si es "Insumos de Cultivos" con múltiples cultivos
        if (item.categoria === 'Insumos de Cultivos' && cultivosSeleccionados.length > 0) {
          const totalHectareas = cultivosDisponibles
            .filter(c => cultivosSeleccionados.includes(c.tipoCultivo))
            .reduce((sum, c) => sum + c.hectareas, 0)
          
          // Crear un gasto por cada cultivo seleccionado
          for (const tipoCultivo of cultivosSeleccionados) {
            const cultivo = cultivosDisponibles.find(c => c.tipoCultivo === tipoCultivo)
            if (!cultivo) continue
            
            const porcentaje = (cultivo.hectareas / totalHectareas) * 100
            const montoAsignado = item.precioFinal * (porcentaje / 100)
            
            const response = await fetch('/api/eventos', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                tipo: 'GASTO',
                fecha: fecha,
                descripcion: `${item.item} - ${tipoCultivo}${notas ? ` - ${notas}` : ''}`,
                categoria: item.categoria,
                monto: montoAsignado,
                moneda: moneda,
                metodoPago: esPlazo ? 'Plazo' : 'Contado',
                iva: item.iva,
                diasPlazo: esPlazo ? diasPlazo : null,
                pagado: esPlazo ? pagado : true,
                proveedor: proveedor.trim() || null,
                especies: [],
                loteId: null,
              }),
            })
            
            if (!response.ok) throw new Error('Error al crear gasto para ' + tipoCultivo)
          }
        } else {
          // Gasto normal
          const response = await fetch('/api/eventos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              tipo: 'GASTO',
              fecha: fecha,
              descripcion: `${item.item}${notas ? ` - ${notas}` : ''}`,
              categoria: item.categoria,
              monto: item.precioFinal,
              moneda: moneda,
              metodoPago: esPlazo ? 'Plazo' : 'Contado',
              iva: item.iva,
              diasPlazo: esPlazo ? diasPlazo : null,
              pagado: esPlazo ? pagado : true,
              proveedor: proveedor.trim() || null,
              especies: item.especies,
              loteId: item.loteId,
              // 🏢 Gastos compartidos
              esGastoGrupo: esGastoGrupo,
              grupoId: grupoId,
              camposDelGrupo: esGastoGrupo ? camposDelGrupo : null,
            }),
          })

          if (!response.ok) {
            const errorData = await response.json().catch(() => null)
            throw new Error(errorData?.error || 'Error al guardar')
          }
        }

        if (i < items.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100))
        }
      }

      onSuccess()
      onClose()
    } catch (error) {
      console.error('Error:', error)
      alert('Error al guardar los gastos')
    } finally {
      setLoading(false)
    }
  }

  const proveedoresFiltrados = proveedoresPrevios.filter(p =>
    p.toLowerCase().includes(proveedor.toLowerCase())
  )

  return (
    <form onSubmit={handleSubmit} className="p-6 max-h-[90vh] overflow-y-auto">
      {/* HEADER */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center text-2xl">
            💰
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Nuevo Gasto</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
        >
          ✕
        </button>
      </div>

      {/* INFO BÁSICA */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <h3 className="font-semibold text-gray-900 mb-3">
          Información Básica
        </h3>

        {/* FECHA */}
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fecha
            </label>
            <input
              type="date"
              value={fecha}
              onChange={e => setFecha(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          {/* PROVEEDOR + SUGERENCIAS */}
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Proveedor{' '}
              {proveedoresPrevios.length > 0 && (
                <span className="text-xs text-blue-600 font-semibold">
                  ({proveedoresPrevios.length} guardados)
                </span>
              )}
            </label>

            <input
              type="text"
              value={proveedor}
              onChange={e => {
                setProveedor(e.target.value)
                setMostrarSugerencias(true)
              }}
              onFocus={() => setMostrarSugerencias(true)}
              onBlur={() => setTimeout(() => setMostrarSugerencias(false), 300)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Ej: AgroSalto, Barraca del Campo..."
            />

            {mostrarSugerencias && proveedoresFiltrados.length > 0 && (
              <div className="absolute z-[9999] w-full mt-1 bg-white border-2 border-blue-500 rounded-lg shadow-2xl max-h-60 overflow-y-auto">
                <div className="p-2 bg-blue-50 border-b border-blue-200">
                  <p className="text-xs font-semibold text-blue-700">
                    {proveedoresFiltrados.length}{' '}
                    {proveedoresFiltrados.length === 1
                      ? 'resultado'
                      : 'resultados'}
                  </p>
                </div>

                {proveedoresFiltrados.map((p, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onMouseDown={e => {
                      e.preventDefault()
                      setProveedor(p)
                      setMostrarSugerencias(false)
                    }}
                    className="w-full text-left px-4 py-3 hover:bg-blue-100 text-sm text-gray-900 border-b last:border-b-0 transition-colors font-medium"
                  >
                    📦 {p}
                  </button>
                ))}
              </div>
            )}

            {mostrarSugerencias &&
              proveedor &&
              proveedoresFiltrados.length === 0 &&
              proveedoresPrevios.length > 0 && (
                <div className="absolute z-[9999] w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg p-3">
                  <p className="text-sm text-gray-600">
                    ❌ No existe "{proveedor}". Se guardará como nuevo.
                  </p>
                </div>
              )}
          </div>

          {/* MONEDA */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Moneda
            </label>
            <select
              value={moneda}
              onChange={e => setMoneda(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="UYU">UYU (Pesos Uruguayos)</option>
              <option value="USD">USD</option>
            </select>
          </div>
        </div>

        {/* CONDICIÓN DE PAGO */}
        <div className="mt-4 p-4 bg-white rounded-lg border border-gray-200">
          <h3 className="font-semibold text-gray-900 mb-3">
            Condición de Pago
          </h3>

          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="radio"
                  checked={!esPlazo}
                  onChange={() => setEsPlazo(false)}
                />
                Pago contado
              </label>

              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="radio"
                  checked={esPlazo}
                  onChange={() => setEsPlazo(true)}
                />
                Pago a plazo
              </label>
            </div>

            {esPlazo && (
              <>
                <div className="flex gap-3 items-center">
                  <label className="text-sm text-gray-700">Plazo (días):</label>
                  <input
                    type="number"
                    min={1}
                    value={diasPlazo}
                    onChange={e => setDiasPlazo(parseInt(e.target.value) || 0)}
                    className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="flex items-center gap-2 mt-2">
                  <input
                    type="checkbox"
                    checked={pagado}
                    onChange={e => setPagado(e.target.checked)}
                  />
                  <label className="text-sm text-gray-700">
                    Marcar como pagado
                  </label>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 🏢 GASTO COMPARTIDO ENTRE CAMPOS */}
      {camposDelGrupo.length > 1 && (
        <div className="mt-4 p-4 bg-purple-50 rounded-lg border-2 border-purple-200">
          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={esGastoGrupo}
              onChange={(e) => setEsGastoGrupo(e.target.checked)}
              className="mt-1 w-5 h-5 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
            />
            <div className="flex-1">
              <label className="font-semibold text-gray-900 cursor-pointer">
                ¿Es un gasto general del grupo?
              </label>
              <p className="text-xs text-gray-600 mt-1">
                Este gasto se distribuirá proporcionalmente entre los {camposDelGrupo.length} campos del grupo según hectáreas.
              </p>
              
              {esGastoGrupo && (
                <div className="mt-3 bg-white rounded-lg p-3 border border-purple-200">
                  <p className="text-xs font-semibold text-purple-800 mb-2">Distribución:</p>
                  <div className="space-y-1">
                    {(() => {
                      const totalHectareas = camposDelGrupo.reduce((sum, c) => sum + c.hectareas, 0)
                      return camposDelGrupo.map(campo => {
                        const porcentaje = (campo.hectareas / totalHectareas) * 100
                        const montoAsignado = montoTotal * (porcentaje / 100)
                        return (
                          <div key={campo.id} className="flex justify-between text-xs">
                            <span className="text-gray-700">{campo.nombre} ({campo.hectareas.toFixed(1)} ha)</span>
                            <span className="font-medium text-purple-700">
                              {porcentaje.toFixed(1)}% = ${montoAsignado.toFixed(2)}
                            </span>
                          </div>
                        )
                      })
                    })()}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ITEMS */}
      <div className="mb-6">
        <div className="bg-blue-50 rounded-lg p-3 mb-3 flex items-center gap-2">
          <span className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center font-bold">
            {items.length}
          </span>
          <h3 className="font-semibold text-gray-900">Items</h3>
        </div>

        <div className="space-y-3">
          {items.map(item => {
            const esVariable = esCategoriaVariable(item.categoria)
            
            return (
              <div
                key={item.id}
                className="border-l-4 border-blue-500 pl-4 py-3 bg-gray-50 rounded-r-lg relative"
              >
                {items.length > 1 && (
                  <button
                    type="button"
                    onClick={() => eliminarItem(item.id)}
                    className="absolute top-2 right-2 text-red-600 hover:text-red-800"
                  >
                    🗑️
                  </button>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                  <input
                    type="text"
                    value={item.item}
                    onChange={e =>
                      handleItemChange(item.id, 'item', e.target.value)
                    }
                    placeholder="Item"
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />

                  {/* CATEGORÍAS DINÁMICAS */}
                  <select
                    value={item.categoria}
                    onChange={e =>
                      handleItemChange(item.id, 'categoria', e.target.value)
                    }
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    disabled={categorias.length === 0}
                  >
                    {categorias.length === 0 ? (
                      <option value="">Cargando categorías...</option>
                    ) : (
                      categorias.map(cat => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                {/* ✅ CHECKBOXES ESPECIES (solo si es VARIABLE de GANADERÍA) */}
                {esVariable && item.categoria !== 'Insumos de Cultivos' && (
                  <div className="mb-3">
                    <label className="block text-xs text-gray-600 mb-2">
                      Especie/s (seleccioná una o varias)
                      <span className="ml-2 text-green-600 text-[10px] font-semibold">
                        COSTO VARIABLE DIRECTO
                      </span>
                    </label>
                    <div className="flex gap-4">
                      {ESPECIES_VALIDAS.map(esp => (
                        <label key={esp} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={item.especies.includes(esp)}
                            onChange={e => {
                              const nuevasEspecies = e.target.checked
                                ? [...item.especies, esp]
                                : item.especies.filter(e => e !== esp)
                              handleItemChange(item.id, 'especies', nuevasEspecies)
                            }}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700">
                            {esp.charAt(0) + esp.slice(1).toLowerCase()}
                          </span>
                        </label>
                      ))}
                    </div>
                    {item.especies.length > 1 && (
                      <p className="text-xs text-blue-600 mt-2">
                        💡 Se distribuirá proporcionalmente según % de UG
                      </p>
                    )}
                  </div>
                )}

                {/* 🌾 SELECCIÓN DE CULTIVOS (solo si es Agricultura) */}
                {item.categoria === 'Insumos de Cultivos' && (
                  <div className="mb-3 p-4 bg-green-50 rounded-lg border-2 border-green-200">
                    <div className="flex items-center justify-between mb-3">
                      <label className="text-sm font-medium text-gray-900">
                        🌾 ¿Para qué cultivos es este gasto?
                      </label>
                      {cultivosDisponibles.length > 1 && (
                        <button
                          type="button"
                          onClick={toggleTodosCultivos}
                          className="text-xs text-green-600 hover:text-green-700 font-medium"
                        >
                          {cultivosSeleccionados.length === cultivosDisponibles.length 
                            ? '✓ Deseleccionar todos' 
                            : 'Seleccionar todos'}
                        </button>
                      )}
                    </div>

                    {cultivosDisponibles.length === 0 ? (
                      <div className="text-center py-4">
                        <p className="text-sm text-amber-600 mb-2">
                          ⚠️ No hay lotes agrícolas con cultivos
                        </p>
                        <a 
                          href="/dashboard/lotes"
                          className="text-xs text-blue-600 hover:underline" 
                          target="_blank"
                        >
                          Crear lote agrícola →
                        </a>
                      </div>
                    ) : (
                      <>
                        <div className="space-y-2 mb-3">
                          {cultivosDisponibles.map((cultivo) => {
                            const isSelected = cultivosSeleccionados.includes(cultivo.tipoCultivo)
                            return (
                              <div
                                key={cultivo.tipoCultivo}
                                className={`flex items-center gap-3 p-3 rounded-lg border-2 transition cursor-pointer ${
                                  isSelected 
                                    ? 'bg-green-100 border-green-400' 
                                    : 'bg-white border-gray-200 hover:border-green-300'
                                }`}
                                onClick={() => toggleCultivo(cultivo.tipoCultivo)}
                              >
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => {}}
                                  className="w-5 h-5 text-green-600 border-gray-300 rounded focus:ring-green-500 pointer-events-none"
                                />
                                <div className="flex-1">
                                  <div className="font-medium text-gray-900">
                                    🌾 {cultivo.tipoCultivo}
                                  </div>
                                  <div className="text-xs text-gray-600">
                                    {cultivo.hectareas.toFixed(1)} ha • {cultivo.lotes.length} lote{cultivo.lotes.length !== 1 ? 's' : ''}
                                    {cultivo.lotes.length <= 2 && (
                                      <span className="ml-1">({cultivo.lotes.join(', ')})</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>

                        {/* Vista previa de distribución */}
                        {cultivosSeleccionados.length > 1 && (
                          <div className="p-3 bg-white rounded-lg border border-green-300">
                            <p className="text-xs font-semibold text-green-800 mb-2">
                              📊 Distribución del gasto:
                            </p>
                            <div className="space-y-1">
                              {(() => {
                                const totalHectareas = cultivosDisponibles
                                  .filter(c => cultivosSeleccionados.includes(c.tipoCultivo))
                                  .reduce((sum, c) => sum + c.hectareas, 0)
                                
                                return cultivosDisponibles
                                  .filter(c => cultivosSeleccionados.includes(c.tipoCultivo))
                                  .map(cultivo => {
                                    const porcentaje = (cultivo.hectareas / totalHectareas) * 100
                                    const montoAsignado = item.precioFinal * (porcentaje / 100)
                                    return (
                                      <div key={cultivo.tipoCultivo} className="flex justify-between text-xs">
                                        <span className="text-gray-700">
                                          {cultivo.tipoCultivo} ({cultivo.hectareas.toFixed(1)} ha)
                                        </span>
                                        <span className="font-medium text-green-700">
                                          {porcentaje.toFixed(1)}% = ${montoAsignado.toFixed(2)}
                                        </span>
                                      </div>
                                    )
                                  })
                              })()}
                            </div>
                            <p className="text-xs text-gray-500 mt-2 italic">
                              Se crearán {cultivosSeleccionados.length} gastos separados
                            </p>
                          </div>
                        )}

                        {cultivosSeleccionados.length === 0 && (
                          <p className="text-xs text-red-600 mt-2">
                            ⚠️ Debes seleccionar al menos un cultivo
                          </p>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* ✅ INFO para costos fijos */}
                {!esVariable && (
                  <div className="mb-3">
                    <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                      💼 Costo Fijo - Se distribuye automáticamente según % UG
                    </span>
                  </div>
                )}

                <div className="grid grid-cols-3 gap-3 items-center">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">
                      Precio
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={item.precio || ''}
                      onChange={e =>
                        handleItemChange(item.id, 'precio', e.target.value)
                      }
                      placeholder="0.00"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-gray-600 mb-1">
                      IVA
                    </label>
                    <select
                      value={item.iva}
                      onChange={e =>
                        handleItemChange(item.id, 'iva', e.target.value)
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="0">Sin IVA</option>
                      <option value="10">10%</option>
                      <option value="22">22%</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs text-gray-600 mb-1">
                      Precio Final
                    </label>
                    <input
                      type="text"
                      readOnly
                      value={item.precioFinal.toFixed(2)}
                      className="w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg text-gray-700 font-semibold"
                    />
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* AGREGAR ITEM */}
        <button
          type="button"
          onClick={agregarItem}
          className="mt-3 flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium"
        >
          <span className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm">
            +
          </span>
          Agregar Otro Item
        </button>
      </div>

      {/* MONTO TOTAL */}
      <div className="mb-6 p-4 bg-gray-100 rounded-lg flex justify-between items-center">
        <span className="font-semibold text-gray-900">Monto Total</span>
        <span className="text-2xl font-bold text-blue-600">
          {montoTotal.toLocaleString('es-UY', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}{' '}
          {moneda}
        </span>
      </div>

      {/* NOTAS */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Notas
        </label>
        <textarea
          value={notas}
          onChange={e => setNotas(e.target.value)}
          placeholder="Notas adicionales..."
          rows={3}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* BOTONES */}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium"
        >
          Cancelar
        </button>

        <button
          type="submit"
          disabled={loading}
          className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
        >
          {loading ? 'Guardando...' : 'Confirmar'}
        </button>
      </div>
    </form>
  )
}