'use client'

import { useState, useEffect } from 'react'
import { obtenerFechaLocal } from '@/lib/fechas'

type ModalVentaProps = {
  onClose: () => void
  onSuccess: () => void
}

type Renglon = {
  id: string
  tipoAnimal: string
  categoria: string
  cantidad: number
  precioKg: number
  pesoPromedio: number
  descontarStock: boolean
  animalLoteId: string | null
}

type RenglonLana = {
  id: string
  categoriaLana: string
  pesoKg: number
  precioKgUSD: number
}

type GastoLana = {
  id: string
  concepto: string
  importeUSD: number
}

const CATEGORIAS_LANA = [
  'Vellón',
  'Barriga',
  'Barriguera',
  'Pedazos',
  'Ajuste Barriga',
  'Otros'
]

const CONCEPTOS_GASTOS = [
  'ITEM',
  'DEVIR',
  'INIA',
  'Flete',
  'Comisión',
  'Otros'
]

export default function ModalVenta({ onClose, onSuccess }: ModalVentaProps) {
  const [paso, setPaso] = useState(1)
  const [loading, setLoading] = useState(false)

  // PASO 1: Datos generales
  const [fecha, setFecha] = useState(obtenerFechaLocal())
  const [comprador, setComprador] = useState('')
  const [consignatario, setConsignatario] = useState('')
  const [nroTropa, setNroTropa] = useState('')
  const [nroFactura, setNroFactura] = useState('')
  const [metodoPago, setMetodoPago] = useState('Contado')
  const [diasPlazo, setDiasPlazo] = useState(0)
  const [fechaVencimiento, setFechaVencimiento] = useState('')
  const [pagado, setPagado] = useState(false)
  const [notas, setNotas] = useState('')

  // Nuevo: Tipo de venta
  const [tipoVenta, setTipoVenta] = useState<'GANADO' | 'LANA' | null>(null)

  // Nuevo: Renglones de LANA
  const [renglonesLana, setRenglonesLana] = useState<RenglonLana[]>([
    {
      id: '1',
      categoriaLana: '',
      pesoKg: 0,
      precioKgUSD: 0,
    },
  ])

  // Nuevo: Gastos deducibles
  const [gastosLana, setGastosLana] = useState<GastoLana[]>([])

  // Firmas
  const [firmas, setFirmas] = useState<any[]>([])
  const [firmaId, setFirmaId] = useState<string>('')

  // PASO 2: Renglones
  const [renglones, setRenglones] = useState<Renglon[]>([
    {
      id: '1',
      tipoAnimal: 'BOVINO',
      categoria: '',
      cantidad: 0,
      precioKg: 0,
      pesoPromedio: 0,
      descontarStock: false,
      animalLoteId: null,
    },
  ])

  // Estado para trackear qué modo de cálculo usa cada renglón
  const [modoCalculo, setModoCalculo] = useState<{[key: string]: 'PIE' | 'CUARTA'}>({})
  const [datosTemporales, setDatosTemporales] = useState<{[key: string]: {
    pesoTotal4ta: number
    pesoTotalPie: number
    precio4ta: number
  }}>({})

  // Cargar categorías de animales
  const [categoriasBovinas, setCategoriasBovinas] = useState<string[]>([])
  const [categoriasOvinas, setCategoriasOvinas] = useState<string[]>([])

  // Cargar potreros con stock
  const [potreros, setPotreros] = useState<any[]>([])

  useEffect(() => {
    const cargarCategorias = async () => {
      try {
        const res = await fetch('/api/categorias-animal')
        if (res.ok) {
          const data = await res.json()
          const bovinas = data
            .filter((c: any) => c.tipoAnimal === 'BOVINO')
            .map((c: any) => c.nombreSingular)
          const ovinas = data
            .filter((c: any) => c.tipoAnimal === 'OVINO')
            .map((c: any) => c.nombreSingular)
          
          setCategoriasBovinas(bovinas.length > 0 ? bovinas : ['Vaca', 'Vaquillona', 'Novillo', 'Ternero', 'Toro'])
          setCategoriasOvinas(ovinas.length > 0 ? ovinas : ['Oveja', 'Cordero', 'Capón', 'Carnero'])
        }
      } catch (err) {
        console.error('Error cargando categorías:', err)
        setCategoriasBovinas(['Vaca', 'Vaquillona', 'Novillo', 'Ternero', 'Toro'])
        setCategoriasOvinas(['Oveja', 'Cordero', 'Capón', 'Carnero'])
      }
    }

    const cargarPotreros = async () => {
      try {
        const res = await fetch('/api/lotes')
        if (res.ok) {
          const data = await res.json()
          setPotreros(data)
        }
      } catch (err) {
        console.error('Error cargando potreros:', err)
      }
    }

    const cargarFirmas = async () => {
      try {
        const res = await fetch('/api/firmas')
        if (res.ok) {
          const data = await res.json()
          setFirmas(data)
          
          // Pre-seleccionar la firma principal
          const principal = data.find((f: any) => f.esPrincipal)
          if (principal) {
            setFirmaId(principal.id)
          }
        }
      } catch (err) {
        console.error('Error cargando firmas:', err)
      }
    }

    cargarCategorias()
    cargarPotreros()
    cargarFirmas()
  }, [])

  const handleRenglonChange = (id: string, field: keyof Renglon, value: any) => {
    setRenglones(prev =>
      prev.map(r => {
        if (r.id !== id) return r

        let updated = { ...r, [field]: value }

        // Si cambia el tipo de animal, resetear categoría
        if (field === 'tipoAnimal') {
          updated.categoria = ''
          updated.animalLoteId = null
        }

        // Si desmarca descontarStock, limpiar animalLoteId
        if (field === 'descontarStock' && !value) {
          updated.animalLoteId = null
        }

        return updated
      })
    )
  }

  const agregarRenglon = () => {
    setRenglones(prev => [
      ...prev,
      {
        id: Date.now().toString(),
        tipoAnimal: 'BOVINO',
        categoria: '',
        cantidad: 0,
        precioKg: 0,
        pesoPromedio: 0,
        descontarStock: false,
        animalLoteId: null,
      },
    ])
  }

  const eliminarRenglon = (id: string) => {
    if (renglones.length === 1) return
    setRenglones(prev => prev.filter(r => r.id !== id))
  }

  // Funciones para renglones de LANA
  const handleRenglonLanaChange = (id: string, field: keyof RenglonLana, value: any) => {
    setRenglonesLana(prev =>
      prev.map(r => (r.id === id ? { ...r, [field]: value } : r))
    )
  }

  const agregarRenglonLana = () => {
    setRenglonesLana(prev => [
      ...prev,
      {
        id: Date.now().toString(),
        categoriaLana: '',
        pesoKg: 0,
        precioKgUSD: 0,
      },
    ])
  }

  const eliminarRenglonLana = (id: string) => {
    if (renglonesLana.length === 1) return
    setRenglonesLana(prev => prev.filter(r => r.id !== id))
  }

  // Funciones para gastos
  const agregarGasto = () => {
    setGastosLana(prev => [
      ...prev,
      {
        id: Date.now().toString(),
        concepto: '',
        importeUSD: 0,
      },
    ])
  }

  const handleGastoChange = (id: string, field: keyof GastoLana, value: any) => {
    setGastosLana(prev =>
      prev.map(g => (g.id === id ? { ...g, [field]: value } : g))
    )
  }

  const eliminarGasto = (id: string) => {
    setGastosLana(prev => prev.filter(g => g.id !== id))
  }

  // Calcular precio y peso en pie desde datos de 4ta balanza
  const calcularDesdeCuarta = (renglonId: string) => {
    const datos = datosTemporales[renglonId]
    const renglon = renglones.find(r => r.id === renglonId)
    
    if (!datos || !renglon || renglon.cantidad === 0) return
    
    const { pesoTotal4ta, pesoTotalPie, precio4ta } = datos
    
    if (pesoTotal4ta > 0 && pesoTotalPie > 0 && precio4ta > 0) {
      // Calcular precio en pie
      const importeTotal = pesoTotal4ta * precio4ta
      const precioEnPie = importeTotal / pesoTotalPie
      
      // Calcular peso promedio en pie
      const pesoPromedioEnPie = pesoTotalPie / renglon.cantidad
      
      // Actualizar el renglón
      handleRenglonChange(renglonId, 'precioKg', precioEnPie)
      handleRenglonChange(renglonId, 'pesoPromedio', pesoPromedioEnPie)
    }
  }

  const handleDatosTemporalesChange = (renglonId: string, field: string, value: number) => {
    setDatosTemporales(prev => ({
      ...prev,
      [renglonId]: {
        ...prev[renglonId],
        [field]: value
      }
    }))
  }

  const calcularTotales = () => {
    if (tipoVenta === 'GANADO') {
      const subtotal = renglones.reduce((sum, r) => {
        const pesoTotal = r.cantidad * r.pesoPromedio
        const importe = pesoTotal * r.precioKg
        return sum + importe
      }, 0)

      return {
        subtotal,
        neto: subtotal,
      }
    }

    if (tipoVenta === 'LANA') {
      const subtotal = renglonesLana.reduce((sum, r) => {
        return sum + (r.pesoKg * r.precioKgUSD)
      }, 0)

      const totalGastos = gastosLana.reduce((sum, g) => sum + g.importeUSD, 0)

      return {
        subtotal,
        neto: subtotal + totalGastos, // Los gastos son negativos
      }
    }

    return { subtotal: 0, neto: 0 }
  }

  const totales = calcularTotales()

  const validarPaso1 = () => {
    if (!fecha || !comprador.trim()) {
      alert('Completá fecha y comprador')
      return false
    }

    if (metodoPago === 'Plazo' && diasPlazo < 1) {
      alert('Ingresá los días de plazo')
      return false
    }

    return true
  }

  const validarPaso2 = () => {
    if (tipoVenta === 'GANADO') {
      if (renglones.some(r => !r.categoria || r.cantidad <= 0 || r.precioKg <= 0 || r.pesoPromedio <= 0)) {
        alert('Completá todos los renglones con valores válidos')
        return false
      }

      // Validar stock disponible
      for (const renglon of renglones) {
        if (renglon.descontarStock && renglon.animalLoteId) {
          const potrero = potreros.find(p => 
            p.animalesLote.some((a: any) => a.id === renglon.animalLoteId)
          )
          
          if (potrero) {
            const animalLote = potrero.animalesLote.find((a: any) => a.id === renglon.animalLoteId)
            if (animalLote && animalLote.cantidad < renglon.cantidad) {
              alert(`Stock insuficiente en ${potrero.nombre}. Disponible: ${animalLote.cantidad}, Necesario: ${renglon.cantidad}`)
              return false
            }
          }
        }
      }

      return true
    }

    if (tipoVenta === 'LANA') {
      if (renglonesLana.some(r => !r.categoriaLana || r.pesoKg <= 0 || r.precioKgUSD <= 0)) {
        alert('Completá todos los renglones de lana con valores válidos')
        return false
      }

      // Validar gastos si existen
      if (gastosLana.length > 0 && gastosLana.some(g => !g.concepto.trim())) {
        alert('Completá el concepto de todos los gastos')
        return false
      }

      return true
    }

    return false
  }

  const handleSubmit = async () => {
    if (!validarPaso2()) return

    setLoading(true)

    try {
      const payload: any = {
        fecha,
        comprador: comprador.trim(),
        firmaId: firmaId || null,
        consignatario: consignatario.trim() || null,
        nroTropa: nroTropa.trim() || null,
        nroFactura: nroFactura.trim() || null,
        metodoPago,
        diasPlazo: metodoPago === 'Plazo' ? diasPlazo : null,
        fechaVencimiento: fechaVencimiento || null,
        pagado: metodoPago === 'Contado' ? true : pagado,
        moneda: 'USD',
        tasaCambio: null,
        subtotalUSD: totales.subtotal,
        totalImpuestosUSD: 0,
        totalNetoUSD: totales.neto,
        impuestos: null,
        imageUrl: null,
        imageName: null,
        notas: notas.trim() || null,
      }

      if (tipoVenta === 'GANADO') {
        payload.renglones = renglones.map(r => ({
          tipo: 'GANADO',
          tipoAnimal: r.tipoAnimal,
          categoria: r.categoria,
          raza: null,
          cantidad: r.cantidad,
          pesoPromedio: r.pesoPromedio,
          precioKgUSD: r.precioKg,
          descontarStock: r.descontarStock,
          animalLoteId: r.animalLoteId,
        }))
      }

      if (tipoVenta === 'LANA') {
        payload.renglones = renglonesLana.map(r => ({
          tipo: 'LANA',
          categoriaLana: r.categoriaLana,
          pesoKg: r.pesoKg,
          precioKgUSD: r.precioKgUSD,
        }))

        if (gastosLana.length > 0) {
          payload.gastosLana = gastosLana.map(g => ({
            concepto: g.concepto,
            importeUSD: g.importeUSD,
          }))
        }
      }

      const response = await fetch('/api/ventas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => null)
        throw new Error(errorData?.error || 'Error al crear venta')
      }

      onSuccess()
      onClose()
    } catch (error: any) {
      console.error('Error:', error)
      alert(error.message || 'Error al crear la venta')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 max-h-[90vh] overflow-y-auto">
      {/* HEADER */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-2xl">
            🐄
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Nueva Venta</h2>
            <p className="text-sm text-gray-600">
              {paso === 1 ? 'Paso 1: Datos generales' : 'Paso 2: Detalle de venta'}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
        >
          ✕
        </button>
      </div>

      {/* PASO 1: DATOS GENERALES */}
      {paso === 1 && (
        <div className="space-y-6">
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-4">Información de la Venta</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fecha de Venta *
                </label>
                <input
                  type="date"
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Comprador *
                </label>
                <input
                  type="text"
                  value={comprador}
                  onChange={(e) => setComprador(e.target.value)}
                  placeholder="Ej: Marfrig, Frigo Salto..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Firma / RUT
                </label>
                <select
                  value={firmaId}
                  onChange={(e) => setFirmaId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Sin asignar</option>
                  {firmas.map(firma => (
                    <option key={firma.id} value={firma.id}>
                      {firma.razonSocial} ({firma.rut})
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Asigna esta venta a una firma/RUT específica
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Consignatario
                </label>
                <input
                  type="text"
                  value={consignatario}
                  onChange={(e) => setConsignatario(e.target.value)}
                  placeholder="Opcional"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nro. Tropa
                </label>
                <input
                  type="text"
                  value={nroTropa}
                  onChange={(e) => setNroTropa(e.target.value)}
                  placeholder="Opcional"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nro. Factura
                </label>
                <input
                  type="text"
                  value={nroFactura}
                  onChange={(e) => setNroFactura(e.target.value)}
                  placeholder="Opcional"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* CONDICIÓN DE PAGO */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="font-semibold text-gray-900 mb-4">Condición de Pago</h3>
            
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="radio"
                    checked={metodoPago === 'Contado'}
                    onChange={() => setMetodoPago('Contado')}
                  />
                  Contado
                </label>

                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="radio"
                    checked={metodoPago === 'Plazo'}
                    onChange={() => setMetodoPago('Plazo')}
                  />
                  Plazo
                </label>
              </div>

              {metodoPago === 'Plazo' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Días de Plazo *
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={diasPlazo}
                      onChange={(e) => setDiasPlazo(parseInt(e.target.value) || 0)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Fecha Vencimiento
                    </label>
                    <input
                      type="date"
                      value={fechaVencimiento}
                      onChange={(e) => setFechaVencimiento(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={pagado}
                        onChange={(e) => setPagado(e.target.checked)}
                      />
                      Marcar como pagado
                    </label>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* NOTAS */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notas
            </label>
            <textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Observaciones adicionales..."
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
              type="button"
              onClick={() => {
                if (validarPaso1()) setPaso(2)
              }}
              className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
            >
              Siguiente →
            </button>
          </div>
        </div>
      )}

      {/* PASO 2: SELECTOR DE TIPO + DETALLE */}
      {paso === 2 && !tipoVenta && (
        <div className="space-y-6">
          <div className="text-center mb-6">
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              ¿Qué tipo de venta vas a registrar?
            </h3>
            <p className="text-sm text-gray-600">
              Seleccioná el tipo de venta para continuar
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* OPCIÓN GANADO */}
            <button
              type="button"
              onClick={() => setTipoVenta('GANADO')}
              className="p-6 border-2 border-gray-200 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition text-center group"
            >
              <div className="text-6xl mb-3">🐄</div>
              <h4 className="text-lg font-semibold text-gray-900 mb-2">
                Ganado en Pie
              </h4>
              <p className="text-sm text-gray-600">
                Vacunos y ovinos para faena o cría
              </p>
            </button>

            {/* OPCIÓN LANA */}
            <button
              type="button"
              onClick={() => setTipoVenta('LANA')}
              className="p-6 border-2 border-gray-200 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition text-center group"
            >
              <div className="text-6xl mb-3">🧶</div>
              <h4 className="text-lg font-semibold text-gray-900 mb-2">
                Lana
              </h4>
              <p className="text-sm text-gray-600">
                Vellón, barriga, barriguera, etc.
              </p>
            </button>
          </div>

          {/* BOTÓN ATRÁS */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setPaso(1)}
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium"
            >
              ← Atrás
            </button>
          </div>
        </div>
      )}

      {/* PASO 2: DETALLE GANADO */}
      {paso === 2 && tipoVenta === 'GANADO' && (
        <div className="space-y-6">
          <div className="bg-blue-50 rounded-lg p-3 mb-3 flex items-center gap-2">
            <span className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center font-bold">
              {renglones.length}
            </span>
            <h3 className="font-semibold text-gray-900">Renglones de Venta - Ganado</h3>
            <button
              type="button"
              onClick={() => setTipoVenta(null)}
              className="ml-auto text-xs text-blue-600 hover:text-blue-800"
            >
              Cambiar tipo
            </button>
          </div>

          <div className="space-y-4">
            {renglones.map((renglon, idx) => {
              const categorias = renglon.tipoAnimal === 'BOVINO' ? categoriasBovinas : categoriasOvinas
              const potrerosDisponibles = potreros.filter(p =>
                p.animalesLote.some((a: any) => a.categoria === renglon.categoria)
              )

              return (
                <div
                  key={renglon.id}
                  className="border-l-4 border-blue-500 pl-4 py-3 bg-gray-50 rounded-r-lg relative"
                >
                  {renglones.length > 1 && (
                    <button
                      type="button"
                      onClick={() => eliminarRenglon(renglon.id)}
                      className="absolute top-2 right-2 text-red-600 hover:text-red-800"
                    >
                      🗑️
                    </button>
                  )}

                  <div className="mb-2 font-medium text-gray-700">Renglón {idx + 1}</div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Tipo Animal</label>
                      <select
                        value={renglon.tipoAnimal}
                        onChange={(e) => handleRenglonChange(renglon.id, 'tipoAnimal', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="BOVINO">Bovino</option>
                        <option value="OVINO">Ovino</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Categoría</label>
                      <select
                        value={renglon.categoria}
                        onChange={(e) => handleRenglonChange(renglon.id, 'categoria', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Seleccionar...</option>
                        {categorias.map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* CANTIDAD */}
                  <div className="mb-3">
                    <label className="block text-xs text-gray-600 mb-1">Cantidad de animales *</label>
                    <input
                      type="number"
                      min={1}
                      value={renglon.cantidad || ''}
                      onChange={(e) => handleRenglonChange(renglon.id, 'cantidad', parseInt(e.target.value) || 0)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* SELECTOR DE MODO */}
                  <div className="mb-3 bg-blue-50 rounded-lg p-3 border border-blue-200">
                    <label className="block text-xs font-medium text-gray-700 mb-2">
                      ¿Cómo querés ingresar los datos?
                    </label>
                    <div className="flex gap-3">
                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <input
                          type="radio"
                          checked={modoCalculo[renglon.id] !== 'CUARTA'}
                          onChange={() => setModoCalculo(prev => ({ ...prev, [renglon.id]: 'PIE' }))}
                          className="text-blue-600"
                        />
                        📊 Datos en PIE (directo)
                      </label>
                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <input
                          type="radio"
                          checked={modoCalculo[renglon.id] === 'CUARTA'}
                          onChange={() => setModoCalculo(prev => ({ ...prev, [renglon.id]: 'CUARTA' }))}
                          className="text-blue-600"
                        />
                        🏭 Datos de 4ta balanza
                      </label>
                    </div>
                  </div>

                  {/* OPCIÓN A: DATOS EN PIE (DIRECTO) */}
                  {modoCalculo[renglon.id] !== 'CUARTA' && (
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">
                          Peso/animal EN PIE (kg) *
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          min={0}
                          value={renglon.pesoPromedio || ''}
                          onChange={(e) => handleRenglonChange(renglon.id, 'pesoPromedio', parseFloat(e.target.value) || 0)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          placeholder="ej: 502"
                        />
                      </div>

                      <div>
                        <label className="block text-xs text-gray-600 mb-1">
                          Precio/kg EN PIE (USD) *
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min={0}
                          value={renglon.precioKg || ''}
                          onChange={(e) => handleRenglonChange(renglon.id, 'precioKg', parseFloat(e.target.value) || 0)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          placeholder="ej: 2.80"
                        />
                      </div>
                    </div>
                  )}

                  {/* OPCIÓN B: DATOS DE 4TA BALANZA */}
                  {modoCalculo[renglon.id] === 'CUARTA' && (
                    <div className="space-y-3 mb-3">
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                        <p className="text-xs text-yellow-800 mb-3">
                          💡 Ingresá los datos de la boleta del frigorífico y calculamos automáticamente
                        </p>
                        
                        <div className="grid grid-cols-2 gap-3 mb-3">
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">
                              Peso total EN PIE (kg)
                            </label>
                            <input
                              type="number"
                              step="0.1"
                              min={0}
                              value={datosTemporales[renglon.id]?.pesoTotalPie || ''}
                              onChange={(e) => {
                                handleDatosTemporalesChange(renglon.id, 'pesoTotalPie', parseFloat(e.target.value) || 0)
                                calcularDesdeCuarta(renglon.id)
                              }}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500"
                              placeholder="ej: 4520"
                            />
                          </div>

                          <div>
                            <label className="block text-xs text-gray-600 mb-1">
                              Peso total 4TA BALANZA (kg)
                            </label>
                            <input
                              type="number"
                              step="0.1"
                              min={0}
                              value={datosTemporales[renglon.id]?.pesoTotal4ta || ''}
                              onChange={(e) => {
                                handleDatosTemporalesChange(renglon.id, 'pesoTotal4ta', parseFloat(e.target.value) || 0)
                                calcularDesdeCuarta(renglon.id)
                              }}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500"
                              placeholder="ej: 2409.70"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs text-gray-600 mb-1">
                            Precio/kg EN 4TA BALANZA (USD)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            min={0}
                            value={datosTemporales[renglon.id]?.precio4ta || ''}
                            onChange={(e) => {
                              handleDatosTemporalesChange(renglon.id, 'precio4ta', parseFloat(e.target.value) || 0)
                              calcularDesdeCuarta(renglon.id)
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500"
                            placeholder="ej: 5.25"
                          />
                        </div>
                      </div>

                      {/* RESULTADO CALCULADO */}
                      {renglon.pesoPromedio > 0 && renglon.precioKg > 0 && (
                        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                          <p className="text-xs font-medium text-green-800 mb-2">✅ Calculado automáticamente:</p>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div>
                              <span className="text-gray-600">Peso/animal en pie:</span>
                              <p className="font-semibold text-green-900">{renglon.pesoPromedio.toFixed(2)} kg</p>
                            </div>
                            <div>
                              <span className="text-gray-600">Precio/kg en pie:</span>
                              <p className="font-semibold text-green-900">{renglon.precioKg.toFixed(2)} USD/kg</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* CÁLCULOS AUTOMÁTICOS */}
                  {renglon.cantidad > 0 && renglon.precioKg > 0 && renglon.pesoPromedio > 0 && (
                    <div className="bg-white rounded-lg p-3 text-sm space-y-1">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Precio/animal:</span>
                        <span className="font-semibold">{(renglon.pesoPromedio * renglon.precioKg).toFixed(2)} USD</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Peso lote:</span>
                        <span className="font-semibold">{(renglon.cantidad * renglon.pesoPromedio).toFixed(2)} kg</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Importe:</span>
                        <span className="font-bold text-blue-600">{(renglon.cantidad * renglon.pesoPromedio * renglon.precioKg).toFixed(2)} USD</span>
                      </div>
                    </div>
                  )}

                  {/* DESCUENTO DE STOCK */}
                  <div className="mt-3 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                    <label className="flex items-center gap-2 text-sm text-gray-700 mb-2">
                      <input
                        type="checkbox"
                        checked={renglon.descontarStock}
                        onChange={(e) => handleRenglonChange(renglon.id, 'descontarStock', e.target.checked)}
                      />
                      <span className="font-medium">Descontar del stock</span>
                    </label>

                    {renglon.descontarStock && (
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">
                          Potrero
                        </label>
                        <select
                          value={renglon.animalLoteId || ''}
                          onChange={(e) => handleRenglonChange(renglon.id, 'animalLoteId', e.target.value || null)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                        >
                          <option value="">Seleccionar potrero...</option>
                          {potrerosDisponibles.map(p => {
                            const animalLote = p.animalesLote.find((a: any) => a.categoria === renglon.categoria)
                            return (
                              <option key={animalLote.id} value={animalLote.id}>
                                {p.nombre} ({animalLote.cantidad} disponibles)
                              </option>
                            )
                          })}
                        </select>
                        {potrerosDisponibles.length === 0 && (
                          <p className="text-xs text-red-600 mt-1">
                            No hay stock disponible de esta categoría
                          </p>
                        )}
                      </div>
                    )}

                    {!renglon.descontarStock && (
                      <p className="text-xs text-gray-600">
                        💡 Marcá esto solo si aún NO descontaste manualmente estos animales
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* AGREGAR RENGLÓN */}
          <button
            type="button"
            onClick={agregarRenglon}
            className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium"
          >
            <span className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm">
              +
            </span>
            Agregar Otro Renglón
          </button>

          {/* TOTALES */}
          <div className="bg-gray-100 rounded-lg p-4">
            <div className="flex justify-between items-center mb-2">
              <span className="font-semibold text-gray-900">Subtotal:</span>
              <span className="text-xl font-bold text-gray-900">
                {totales.subtotal.toLocaleString('es-UY', { minimumFractionDigits: 2 })} USD
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="font-semibold text-gray-900">Total Neto:</span>
              <span className="text-2xl font-bold text-blue-600">
                {totales.neto.toLocaleString('es-UY', { minimumFractionDigits: 2 })} USD
              </span>
            </div>
          </div>

          {/* BOTONES */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setTipoVenta(null)}
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium"
            >
              ← Atrás
            </button>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
            >
              {loading ? 'Guardando...' : 'Confirmar Venta'}
            </button>
          </div>
        </div>
      )}

      {/* PASO 2: DETALLE LANA */}
      {paso === 2 && tipoVenta === 'LANA' && (
        <div className="space-y-6">
          <div className="bg-blue-50 rounded-lg p-3 mb-3 flex items-center gap-2">
            <span className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center font-bold">
              {renglonesLana.length}
            </span>
            <h3 className="font-semibold text-gray-900">Renglones de Venta - Lana</h3>
            <button
              type="button"
              onClick={() => setTipoVenta(null)}
              className="ml-auto text-xs text-blue-600 hover:text-blue-800"
            >
              Cambiar tipo
            </button>
          </div>

          <div className="space-y-4">
            {renglonesLana.map((renglon, idx) => (
              <div
                key={renglon.id}
                className="border-l-4 border-green-500 pl-4 py-3 bg-gray-50 rounded-r-lg relative"
              >
                {renglonesLana.length > 1 && (
                  <button
                    type="button"
                    onClick={() => eliminarRenglonLana(renglon.id)}
                    className="absolute top-2 right-2 text-red-600 hover:text-red-800"
                  >
                    🗑️
                  </button>
                )}

                <div className="mb-2 font-medium text-gray-700">Renglón {idx + 1}</div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Tipo de Lana *</label>
                    <select
                      value={renglon.categoriaLana}
                      onChange={(e) => handleRenglonLanaChange(renglon.id, 'categoriaLana', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    >
                      <option value="">Seleccionar...</option>
                      {CATEGORIAS_LANA.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Peso (kg) *</label>
                    <input
                      type="number"
                      step="0.1"
                      min={0}
                      value={renglon.pesoKg || ''}
                      onChange={(e) => handleRenglonLanaChange(renglon.id, 'pesoKg', parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                      placeholder="ej: 4367"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Precio/kg (USD) *</label>
                    <input
                      type="number"
                      step="0.01"
                      min={0}
                      value={renglon.precioKgUSD || ''}
                      onChange={(e) => handleRenglonLanaChange(renglon.id, 'precioKgUSD', parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                      placeholder="ej: 5.81"
                    />
                  </div>
                </div>

                {/* CÁLCULO */}
                {renglon.pesoKg > 0 && renglon.precioKgUSD > 0 && (
                  <div className="mt-3 bg-white rounded-lg p-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Importe:</span>
                      <span className="font-bold text-green-600">
                        {(renglon.pesoKg * renglon.precioKgUSD).toFixed(2)} USD
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* AGREGAR RENGLÓN LANA */}
          <button
            type="button"
            onClick={agregarRenglonLana}
            className="flex items-center gap-2 text-green-600 hover:text-green-700 font-medium"
          >
            <span className="w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center text-sm">
              +
            </span>
            Agregar Otra Categoría de Lana
          </button>

          {/* GASTOS DEDUCIBLES */}
          <div className="bg-yellow-50 rounded-lg border border-yellow-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold text-gray-900">Gastos Deducibles</h4>
              <button
                type="button"
                onClick={agregarGasto}
                className="text-xs text-yellow-700 hover:text-yellow-800 font-medium"
              >
                + Agregar Gasto
              </button>
            </div>

            {gastosLana.length === 0 ? (
              <p className="text-sm text-gray-600">
                No hay gastos. Los gastos como ITEM, DEVIR, INIA se descuentan del total.
              </p>
            ) : (
              <div className="space-y-2">
                {gastosLana.map((gasto) => (
                  <div key={gasto.id} className="flex gap-2 items-center">
                    <select
                      value={gasto.concepto}
                      onChange={(e) => handleGastoChange(gasto.id, 'concepto', e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 text-sm"
                    >
                      <option value="">Concepto...</option>
                      {CONCEPTOS_GASTOS.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      step="0.01"
                      value={gasto.importeUSD || ''}
                      onChange={(e) => handleGastoChange(gasto.id, 'importeUSD', parseFloat(e.target.value) || 0)}
                      placeholder="-630.30"
                      className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => eliminarGasto(gasto.id)}
                      className="text-red-600 hover:text-red-800 text-sm"
                    >
                      🗑️
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* TOTALES */}
          <div className="bg-gray-100 rounded-lg p-4">
            <div className="flex justify-between items-center mb-2">
              <span className="font-semibold text-gray-900">Subtotal (bruto):</span>
              <span className="text-xl font-bold text-gray-900">
                {totales.subtotal.toLocaleString('es-UY', { minimumFractionDigits: 2 })} USD
              </span>
            </div>
            {gastosLana.length > 0 && (
              <div className="flex justify-between items-center mb-2 text-sm">
                <span className="text-gray-600">Gastos:</span>
                <span className="text-red-600">
                  {gastosLana.reduce((sum, g) => sum + g.importeUSD, 0).toLocaleString('es-UY', { minimumFractionDigits: 2 })} USD
                </span>
              </div>
            )}
            <div className="flex justify-between items-center pt-2 border-t border-gray-300">
              <span className="font-semibold text-gray-900">Total Neto:</span>
              <span className="text-2xl font-bold text-green-600">
                {totales.neto.toLocaleString('es-UY', { minimumFractionDigits: 2 })} USD
              </span>
            </div>
          </div>

          {/* BOTONES */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setTipoVenta(null)}
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium"
            >
              ← Atrás
            </button>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium"
            >
              {loading ? 'Guardando...' : 'Confirmar Venta'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}