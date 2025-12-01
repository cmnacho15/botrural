// components/ventas/ModalVentaGanado.tsx
'use client';

import { useState, useEffect } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';

interface ModalVentaGanadoProps {
  isOpen: boolean;
  onClose: () => void;
  onVentaCreada: () => void;
}

interface Renglon {
  id: string;
  tipoRenglon: 'GANADO' | 'LANA';
  tipoAnimal: 'BOVINO' | 'OVINO' | 'EQUINO' | 'OTRO';
  categoria: string;
  animalLoteId: string;
  cantidadVendida: number;
  pesoLoteKg: number;
  precioKgUSD: number;
  montoBrutoUSD: number;
  montoNetoUSD: number;
  // Campos específicos de lana
  esVentaLana?: boolean;
  kgVellon?: number;
  kgBarriga?: number;
  precioKgVellon?: number;
  precioKgBarriga?: number;
  numeroEsquilados?: number;
}

export default function ModalVentaGanado({ isOpen, onClose, onVentaCreada }: ModalVentaGanadoProps) {
  const [paso, setPaso] = useState(1);
  const [loading, setLoading] = useState(false);
  const [categorias, setCategorias] = useState<any[]>([]);
  const [lotes, setLotes] = useState<any[]>([]);
  const [tasaCambio, setTasaCambio] = useState<number>(40); // Tasa default

  // Datos generales de la boleta
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
  const [comprador, setComprador] = useState('');
  const [moneda, setMoneda] = useState<'USD' | 'UYU'>('USD');
  const [metodoPago, setMetodoPago] = useState('Contado');
  const [diasPlazo, setDiasPlazo] = useState(0);
  const [pagado, setPagado] = useState(false);
  const [notas, setNotas] = useState('');

  // Renglones de la boleta
  const [renglones, setRenglones] = useState<Renglon[]>([{
    id: crypto.randomUUID(),
    tipoRenglon: 'GANADO',
    tipoAnimal: 'BOVINO',
    categoria: '',
    animalLoteId: '',
    cantidadVendida: 0,
    pesoLoteKg: 0,
    precioKgUSD: 0,
    montoBrutoUSD: 0,
    montoNetoUSD: 0
  }]);

  // Cargar categorías y lotes
  useEffect(() => {
    if (isOpen) {
      cargarDatos();
    }
  }, [isOpen]);

  const cargarDatos = async () => {
    try {
      // Cargar categorías de animales
      const resCat = await fetch('/api/categorias-animal');
      if (resCat.ok) {
        const dataCat = await resCat.json();
        setCategorias(dataCat);
      }

      // Cargar lotes con stock (si tienes este endpoint)
      try {
        const resLotes = await fetch('/api/lotes');
        if (resLotes.ok) {
          const dataLotes = await resLotes.json();
          setLotes(dataLotes);
        }
      } catch (err) {
        console.log('No se pudo cargar lotes, continuando...');
      }

      // Obtener tasa de cambio actual
      const resTasa = await fetch('/api/tasa-cambio');
      if (resTasa.ok) {
        const dataTasa = await resTasa.json();
        if (dataTasa.success && dataTasa.tasa) {
          setTasaCambio(dataTasa.tasa);
        }
      }
    } catch (error) {
      console.error('Error al cargar datos:', error);
    }
  };

  const agregarRenglon = () => {
    setRenglones([...renglones, {
      id: crypto.randomUUID(),
      tipoRenglon: 'GANADO',
      tipoAnimal: 'BOVINO',
      categoria: '',
      animalLoteId: '',
      cantidadVendida: 0,
      pesoLoteKg: 0,
      precioKgUSD: 0,
      montoBrutoUSD: 0,
      montoNetoUSD: 0
    }]);
  };

  const eliminarRenglon = (id: string) => {
    if (renglones.length > 1) {
      setRenglones(renglones.filter(r => r.id !== id));
    }
  };

  const actualizarRenglon = (id: string, campo: string, valor: any) => {
    setRenglones(renglones.map(r => {
      if (r.id === id) {
        const actualizado = { ...r, [campo]: valor };
        
        // Si cambia el tipo de renglón, resetear campos
        if (campo === 'tipoRenglon') {
          if (valor === 'LANA') {
            return {
              ...actualizado,
              esVentaLana: true,
              categoria: 'Lana',
              kgVellon: 0,
              kgBarriga: 0,
              precioKgVellon: 0,
              precioKgBarriga: 0,
              numeroEsquilados: 0,
              montoBrutoUSD: 0
            };
          } else {
            return {
              ...actualizado,
              esVentaLana: false,
              cantidadVendida: 0,
              pesoLoteKg: 0,
              precioKgUSD: 0
            };
          }
        }
        
        // Calcular montos para LANA
        if (actualizado.tipoRenglon === 'LANA') {
          if (campo === 'kgVellon' || campo === 'kgBarriga' || 
              campo === 'precioKgVellon' || campo === 'precioKgBarriga') {
            const vellon = (actualizado.kgVellon || 0) * (actualizado.precioKgVellon || 0);
            const barriga = (actualizado.kgBarriga || 0) * (actualizado.precioKgBarriga || 0);
            actualizado.montoBrutoUSD = vellon + barriga;
            actualizado.montoNetoUSD = actualizado.montoBrutoUSD;
            actualizado.pesoLoteKg = (actualizado.kgVellon || 0) + (actualizado.kgBarriga || 0);
          }
        } 
        // Calcular montos para GANADO
        else {
          if (campo === 'pesoLoteKg' || campo === 'precioKgUSD') {
            actualizado.montoBrutoUSD = actualizado.pesoLoteKg * actualizado.precioKgUSD;
            actualizado.montoNetoUSD = actualizado.montoBrutoUSD;
          }
        }
        
        return actualizado;
      }
      return r;
    }));
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);

      // Validaciones
      if (!fecha || !comprador) {
        alert('Complete los campos obligatorios');
        return;
      }

      const ventasValidas = renglones.filter(r => {
        if (r.tipoRenglon === 'LANA') {
          return r.montoBrutoUSD > 0 && (r.kgVellon || 0) + (r.kgBarriga || 0) > 0;
        } else {
          return r.categoria && r.cantidadVendida > 0 && r.pesoLoteKg > 0;
        }
      });

      if (ventasValidas.length === 0) {
        alert('Debe agregar al menos un renglón válido');
        return;
      }

      // Validar stock disponible si viene de un lote
      for (const renglon of ventasValidas) {
        if (renglon.animalLoteId) {
          const lote = lotes.find(l => 
            l.animalesLote.some((al: any) => al.id === renglon.animalLoteId)
          );
          
          if (lote) {
            const animalLote = lote.animalesLote.find((al: any) => al.id === renglon.animalLoteId);
            
            if (animalLote && renglon.cantidadVendida > animalLote.cantidad) {
              alert(`No hay suficiente stock de ${renglon.categoria} en ${lote.nombre}. Disponibles: ${animalLote.cantidad}`);
              return;
            }
          }
        }
      }

      const response = await fetch('/api/ventas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fecha,
          comprador,
          moneda,
          metodoPago,
          diasPlazo: metodoPago === 'Plazo' ? diasPlazo : 0,
          pagado,
          notas,
          renglones: ventasValidas,
          tasaCambio: moneda === 'USD' ? tasaCambio : null
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al crear venta');
      }

      onVentaCreada();
      resetForm();
    } catch (error) {
      console.error('Error:', error);
      alert(error instanceof Error ? error.message : 'Error al crear la venta');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setPaso(1);
    setFecha(new Date().toISOString().split('T')[0]);
    setComprador('');
    setMoneda('USD');
    setMetodoPago('Contado');
    setDiasPlazo(0);
    setPagado(false);
    setNotas('');
    setRenglones([{
      id: crypto.randomUUID(),
      tipoRenglon: 'GANADO',
      tipoAnimal: 'BOVINO',
      categoria: '',
      animalLoteId: '',
      cantidadVendida: 0,
      pesoLoteKg: 0,
      precioKgUSD: 0,
      montoBrutoUSD: 0,
      montoNetoUSD: 0
    }]);
  };

  if (!isOpen) return null;

  const totalBruto = renglones.reduce((sum, r) => sum + r.montoBrutoUSD, 0);
  const totalNeto = renglones.reduce((sum, r) => sum + r.montoNetoUSD, 0);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-2xl font-bold">Nueva Venta de Ganado</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X size={24} />
          </button>
        </div>

        {/* Indicador de pasos */}
        <div className="flex items-center justify-center gap-4 p-4 bg-gray-50">
          <div className={`flex items-center gap-2 ${paso === 1 ? 'text-green-600 font-bold' : 'text-gray-400'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${paso === 1 ? 'bg-green-600 text-white' : 'bg-gray-300'}`}>
              1
            </div>
            <span>Datos Generales</span>
          </div>
          <div className="w-12 h-1 bg-gray-300"></div>
          <div className={`flex items-center gap-2 ${paso === 2 ? 'text-green-600 font-bold' : 'text-gray-400'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${paso === 2 ? 'bg-green-600 text-white' : 'bg-gray-300'}`}>
              2
            </div>
            <span>Detalle de Venta</span>
          </div>
        </div>

        {/* Contenido */}
        <div className="p-6">
          {paso === 1 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Fecha *</label>
                  <input
                    type="date"
                    value={fecha}
                    onChange={(e) => setFecha(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Comprador *</label>
                  <input
                    type="text"
                    value={comprador}
                    onChange={(e) => setComprador(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                    placeholder="Nombre del comprador"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Moneda</label>
                  <select
                    value={moneda}
                    onChange={(e) => setMoneda(e.target.value as 'USD' | 'UYU')}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                  >
                    <option value="USD">USD</option>
                    <option value="UYU">UYU</option>
                  </select>
                </div>

                {moneda === 'USD' && (
                  <div>
                    <label className="block text-sm font-medium mb-1">Tasa de Cambio</label>
                    <input
                      type="number"
                      step="0.01"
                      value={tasaCambio}
                      onChange={(e) => setTasaCambio(parseFloat(e.target.value))}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium mb-1">Método de Pago</label>
                  <select
                    value={metodoPago}
                    onChange={(e) => setMetodoPago(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                  >
                    <option value="Contado">Contado</option>
                    <option value="Plazo">Plazo</option>
                  </select>
                </div>

                {metodoPago === 'Plazo' && (
                  <div>
                    <label className="block text-sm font-medium mb-1">Días de Plazo</label>
                    <input
                      type="number"
                      value={diasPlazo}
                      onChange={(e) => setDiasPlazo(parseInt(e.target.value))}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={pagado}
                    onChange={(e) => setPagado(e.target.checked)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm font-medium">Venta pagada</span>
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Notas</label>
                <textarea
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                  rows={3}
                  placeholder="Observaciones adicionales..."
                />
              </div>
            </div>
          )}

          {paso === 2 && (
            <div className="space-y-4">
              {renglones.map((renglon, idx) => (
                <div key={renglon.id} className="border rounded-lg p-4 bg-gray-50">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-medium">Renglón {idx + 1}</h4>
                    {renglones.length > 1 && (
                      <button
                        onClick={() => eliminarRenglon(renglon.id)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <Trash2 size={20} />
                      </button>
                    )}
                  </div>

                  {/* Selector de tipo de renglón */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium mb-1">Tipo de venta</label>
                    <select
                      value={renglon.tipoRenglon}
                      onChange={(e) => actualizarRenglon(renglon.id, 'tipoRenglon', e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg"
                    >
                      <option value="GANADO">Ganado</option>
                      <option value="LANA">Lana</option>
                    </select>
                  </div>

                  {/* Formulario para GANADO */}
                  {renglon.tipoRenglon === 'GANADO' && (
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-1">Especie</label>
                        <select
                          value={renglon.tipoAnimal}
                          onChange={(e) => actualizarRenglon(renglon.id, 'tipoAnimal', e.target.value)}
                          className="w-full px-3 py-2 border rounded-lg"
                        >
                          <option value="BOVINO">Bovino</option>
                          <option value="OVINO">Ovino</option>
                          <option value="EQUINO">Equino</option>
                          <option value="OTRO">Otro</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-1">Categoría</label>
                        <select
                          value={renglon.categoria}
                          onChange={(e) => actualizarRenglon(renglon.id, 'categoria', e.target.value)}
                          className="w-full px-3 py-2 border rounded-lg"
                        >
                          <option value="">Seleccionar...</option>
                          {categorias
                            .filter(c => c.tipoAnimal === renglon.tipoAnimal && c.activo)
                            .map(c => (
                              <option key={c.id} value={c.nombreSingular}>
                                {c.nombrePlural}
                              </option>
                            ))
                          }
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-1">Lote de Origen (Opcional)</label>
                        <select
                          value={renglon.animalLoteId}
                          onChange={(e) => actualizarRenglon(renglon.id, 'animalLoteId', e.target.value)}
                          className="w-full px-3 py-2 border rounded-lg"
                        >
                          <option value="">Sin lote específico</option>
                          {lotes.map(lote => 
                            lote.animalesLote
                              .filter((al: any) => 
                                al.categoria === renglon.categoria && 
                                al.cantidad > 0
                              )
                              .map((al: any) => (
                                <option key={al.id} value={al.id}>
                                  {lote.nombre} - {al.categoria} ({al.cantidad} disponibles)
                                </option>
                              ))
                          )}
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-1">Cantidad</label>
                        <input
                          type="number"
                          value={renglon.cantidadVendida}
                          onChange={(e) => actualizarRenglon(renglon.id, 'cantidadVendida', parseInt(e.target.value) || 0)}
                          className="w-full px-3 py-2 border rounded-lg"
                          min="0"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-1">Peso Lote (kg)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={renglon.pesoLoteKg}
                          onChange={(e) => actualizarRenglon(renglon.id, 'pesoLoteKg', parseFloat(e.target.value) || 0)}
                          className="w-full px-3 py-2 border rounded-lg"
                          min="0"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-1">Precio/kg (USD)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={renglon.precioKgUSD}
                          onChange={(e) => actualizarRenglon(renglon.id, 'precioKgUSD', parseFloat(e.target.value) || 0)}
                          className="w-full px-3 py-2 border rounded-lg"
                          min="0"
                        />
                      </div>

                      <div className="bg-green-50 p-3 rounded-lg col-span-3">
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <span className="text-gray-600">Peso/animal:</span>
                            <span className="ml-2 font-medium">
                              {renglon.cantidadVendida > 0 
                                ? (renglon.pesoLoteKg / renglon.cantidadVendida).toFixed(0)
                                : 0} kg
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-600">Precio/animal:</span>
                            <span className="ml-2 font-medium">
                              ${renglon.cantidadVendida > 0 
                                ? (renglon.montoBrutoUSD / renglon.cantidadVendida).toFixed(0)
                                : 0}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-600">Monto Bruto:</span>
                            <span className="ml-2 font-bold text-green-700">
                              ${renglon.montoBrutoUSD.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Formulario para LANA */}
                  {renglon.tipoRenglon === 'LANA' && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium mb-1">Nº Animales Esquilados</label>
                          <input
                            type="number"
                            value={renglon.numeroEsquilados || 0}
                            onChange={(e) => actualizarRenglon(renglon.id, 'numeroEsquilados', parseInt(e.target.value) || 0)}
                            className="w-full px-3 py-2 border rounded-lg"
                            min="0"
                          />
                        </div>
                      </div>

                      <div className="bg-yellow-50 p-4 rounded-lg">
                        <h5 className="font-medium mb-3">Vellón (90%)</h5>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium mb-1">kg Vellón</label>
                            <input
                              type="number"
                              step="0.1"
                              value={renglon.kgVellon || 0}
                              onChange={(e) => actualizarRenglon(renglon.id, 'kgVellon', parseFloat(e.target.value) || 0)}
                              className="w-full px-3 py-2 border rounded-lg"
                              min="0"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-1">Precio/kg (USD)</label>
                            <input
                              type="number"
                              step="0.01"
                              value={renglon.precioKgVellon || 0}
                              onChange={(e) => actualizarRenglon(renglon.id, 'precioKgVellon', parseFloat(e.target.value) || 0)}
                              className="w-full px-3 py-2 border rounded-lg"
                              min="0"
                            />
                          </div>
                        </div>
                        <div className="mt-2 text-sm text-gray-600">
                          Subtotal: ${((renglon.kgVellon || 0) * (renglon.precioKgVellon || 0)).toFixed(2)}
                        </div>
                      </div>

                      <div className="bg-yellow-50 p-4 rounded-lg">
                        <h5 className="font-medium mb-3">Barriga (10%)</h5>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium mb-1">kg Barriga</label>
                            <input
                              type="number"
                              step="0.1"
                              value={renglon.kgBarriga || 0}
                              onChange={(e) => actualizarRenglon(renglon.id, 'kgBarriga', parseFloat(e.target.value) || 0)}
                              className="w-full px-3 py-2 border rounded-lg"
                              min="0"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-1">Precio/kg (USD)</label>
                            <input
                              type="number"
                              step="0.01"
                              value={renglon.precioKgBarriga || 0}
                              onChange={(e) => actualizarRenglon(renglon.id, 'precioKgBarriga', parseFloat(e.target.value) || 0)}
                              className="w-full px-3 py-2 border rounded-lg"
                              min="0"
                            />
                          </div>
                        </div>
                        <div className="mt-2 text-sm text-gray-600">
                          Subtotal: ${((renglon.kgBarriga || 0) * (renglon.precioKgBarriga || 0)).toFixed(2)}
                        </div>
                      </div>

                      <div className="bg-green-50 p-4 rounded-lg">
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <span className="text-gray-600">kg Totales:</span>
                            <span className="ml-2 font-medium">
                              {((renglon.kgVellon || 0) + (renglon.kgBarriga || 0)).toFixed(1)} kg
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-600">kg/cabeza:</span>
                            <span className="ml-2 font-medium">
                              {renglon.numeroEsquilados > 0
                                ? (((renglon.kgVellon || 0) + (renglon.kgBarriga || 0)) / renglon.numeroEsquilados).toFixed(2)
                                : 0} kg
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-600">Monto Total:</span>
                            <span className="ml-2 font-bold text-green-700">
                              ${renglon.montoBrutoUSD.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              <button
                onClick={agregarRenglon}
                className="flex items-center gap-2 px-4 py-2 text-green-600 border border-green-600 rounded-lg hover:bg-green-50 w-full justify-center"
              >
                <Plus size={20} />
                Agregar Renglón
              </button>

              <div className="bg-gray-100 p-4 rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-medium">Total Bruto:</span>
                  <span className="text-2xl font-bold text-green-700">
                    ${totalBruto.toFixed(2)}
                  </span>
                </div>
                {moneda === 'USD' && (
                  <div className="flex justify-between items-center mt-2 text-sm text-gray-600">
                    <span>En UYU (tasa {tasaCambio}):</span>
                    <span className="font-medium">
                      ${(totalBruto * tasaCambio).toFixed(2)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t bg-gray-50">
          {paso === 1 ? (
            <>
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg"
              >
                Cancelar
              </button>
              <button
                onClick={() => setPaso(2)}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Siguiente
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setPaso(1)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg"
              >
                Atrás
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400"
              >
                {loading ? 'Guardando...' : 'Crear Venta'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}