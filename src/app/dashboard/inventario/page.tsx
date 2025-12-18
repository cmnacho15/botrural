'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface InventarioItem {
  id?: string;
  categoria: string;
  cantidadInicial: number;
  cantidadFinal: number;
  pesoInicio: number | null;
  pesoFinal: number | null;
  precioKg: number | null;
  precioKgFin: number | null;
}

export default function InventarioPage() {
  const formatearNumero = (numero: number): string => {
    return Math.round(numero).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  };

  const { FECHA_INICIAL, FECHA_FINAL, añoInicio, añoFin } = useMemo(() => {
    const hoy = new Date();
    const mesActual = hoy.getMonth();
    const añoActual = hoy.getFullYear();
    const añoInicio = mesActual >= 6 ? añoActual : añoActual - 1;
    const añoFin = añoInicio + 1;

    return {
      FECHA_INICIAL: `${añoInicio}-07-01`,
      FECHA_FINAL: `${añoFin}-06-30`,
      añoInicio,
      añoFin
    };
  }, []);

  const [items, setItems] = useState<InventarioItem[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [modalRegenerar, setModalRegenerar] = useState(false);
  const [modalAgregar, setModalAgregar] = useState(false);
  const [nuevaCategoria, setNuevaCategoria] = useState('');

  const [valoresLocales, setValoresLocales] = useState<{ [key: string]: any }>({});
  const timeoutRefs = useRef<{ [key: string]: NodeJS.Timeout }>({});

  const { data: invInicial, mutate: mutateInicial } = useSWR(
    `/api/inventario?fecha=${FECHA_INICIAL}`, 
    fetcher
  );
  
  const { data: invFinal, mutate: mutateFinal } = useSWR(
    `/api/inventario?fecha=${FECHA_FINAL}`, 
    fetcher
  );

  useEffect(() => {
    if (invInicial && invFinal) {
      const categorias = new Set<string>();
      
      invInicial.forEach((item: any) => categorias.add(item.categoria));
      invFinal.forEach((item: any) => categorias.add(item.categoria));

      const merged: InventarioItem[] = Array.from(categorias).map(categoria => {
        const inicial = invInicial.find((i: any) => i.categoria === categoria);
        const final = invFinal.find((i: any) => i.categoria === categoria);

        return {
          categoria,
          cantidadInicial: inicial?.cantidad || 0,
          cantidadFinal: final?.cantidad || 0,
          pesoInicio: inicial?.peso || null,
          pesoFinal: final?.peso || null,
          precioKg: inicial?.precioKg || null,
          precioKgFin: final?.precioKgFin || null,
        };
      });

      setItems(merged);
    }
  }, [invInicial, invFinal]);

  const itemsOvinos = useMemo(() => {
    return items.filter(item => {
      const cat = item.categoria.toLowerCase();
      return cat.includes('oveja') || cat.includes('carnero') || cat.includes('cordero') || 
             cat.includes('capon') || cat.includes('borrego') || cat.includes('borrega');
    });
  }, [items]);

  const itemsBovinos = useMemo(() => {
    return items.filter(item => {
      const cat = item.categoria.toLowerCase();
      return cat.includes('vaca') || cat.includes('toro') || cat.includes('novillo') || 
             cat.includes('vaquillona') || cat.includes('ternero') || cat.includes('ternera');
    });
  }, [items]);

  async function regenerarDesdePotreros(destino: 'INICIO' | 'FIN') {
    try {
      const res = await fetch('/api/inventario/regenerar', { method: 'POST' });
      const data = await res.json();

      if (res.ok) {
        const categoriasExistentes = new Map(items.map(item => [item.categoria, item]));

        const nuevosItems: InventarioItem[] = data.map((item: any) => {
          const existente = categoriasExistentes.get(item.categoria);
          
          if (destino === 'INICIO') {
            return {
              categoria: item.categoria,
              cantidadInicial: item.cantidad,
              cantidadFinal: existente?.cantidadFinal || 0,
              pesoInicio: existente?.pesoInicio || null,
              pesoFinal: existente?.pesoFinal || null,
              precioKg: existente?.precioKg || null,
              precioKgFin: existente?.precioKgFin || null,
            };
          } else {
            return {
              categoria: item.categoria,
              cantidadInicial: existente?.cantidadInicial || 0,
              cantidadFinal: item.cantidad,
              pesoInicio: existente?.pesoInicio || null,
              pesoFinal: existente?.pesoFinal || null,
              precioKg: existente?.precioKg || null,
              precioKgFin: existente?.precioKgFin || null,
            };
          }
        });

        items.forEach(item => {
          if (!data.find((d: any) => d.categoria === item.categoria)) {
            if (destino === 'INICIO') {
              nuevosItems.push({
                ...item,
                cantidadInicial: 0,
              });
            } else {
              nuevosItems.push({
                ...item,
                cantidadFinal: 0,
              });
            }
          }
        });

        setItems(nuevosItems);
        setModalRegenerar(false);
        
        const fechaTexto = destino === 'INICIO' 
          ? `1 de julio ${añoInicio}` 
          : `30 de junio ${añoFin}`;
        
        alert(`Stock de potreros cargado en ${fechaTexto}. Completá peso y precios manualmente.`);
      }
    } catch (error) {
      console.error('Error regenerando:', error);
      alert('Error al regenerar inventario');
    }
  }

  function agregarCategoriaManual() {
    if (!nuevaCategoria.trim()) {
      alert('Ingresa un nombre de categoría');
      return;
    }

    if (items.some(i => i.categoria.toLowerCase() === nuevaCategoria.toLowerCase())) {
      alert('Esta categoría ya existe');
      return;
    }

    setItems([...items, {
      categoria: nuevaCategoria.trim(),
      cantidadInicial: 0,
      cantidadFinal: 0,
      pesoInicio: null,
      pesoFinal: null,
      precioKg: null,
      precioKgFin: null,
    }]);

    setNuevaCategoria('');
    setModalAgregar(false);
  }

  async function guardarInventario() {
    setGuardando(true);

    try {
      const invInicialData = items
        .filter(item => item.cantidadInicial > 0 || item.cantidadFinal > 0)
        .map(item => ({
          categoria: item.categoria,
          cantidad: item.cantidadInicial,
          peso: item.pesoInicio,
          precioKg: item.precioKg,
          precioKgFin: item.precioKgFin,
        }));

      await fetch('/api/inventario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fecha: FECHA_INICIAL,
          inventarios: invInicialData,
        }),
      });

      const invFinalData = items
        .filter(item => item.cantidadInicial > 0 || item.cantidadFinal > 0)
        .map(item => ({
          categoria: item.categoria,
          cantidad: item.cantidadFinal,
          peso: item.pesoFinal,
          precioKg: item.precioKg,
          precioKgFin: item.precioKgFin,
        }));

      await fetch('/api/inventario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fecha: FECHA_FINAL,
          inventarios: invFinalData,
        }),
      });

      mutateInicial();
      mutateFinal();

      alert('✅ Inventario guardado correctamente');
    } catch (error) {
      console.error('Error guardando:', error);
      alert('❌ Error al guardar inventario');
    } finally {
      setGuardando(false);
    }
  }

  function actualizarItemPorCategoria(categoria: string, campo: keyof InventarioItem, valorString: string) {
    setValoresLocales(prev => ({
      ...prev,
      [`${categoria}-${campo}`]: valorString
    }));

    const timeoutKey = `${categoria}-${campo}`;
    if (timeoutRefs.current[timeoutKey]) {
      clearTimeout(timeoutRefs.current[timeoutKey]);
    }

    timeoutRefs.current[timeoutKey] = setTimeout(() => {
      let valorFinal: any;
      
      if (campo === 'cantidadInicial' || campo === 'cantidadFinal') {
        const cleanValue = valorString.replace(/\./g, '');
        const parsed = parseInt(cleanValue);
        valorFinal = isNaN(parsed) || valorString === '' ? 0 : parsed;
      } else {
        const cleanValue = valorString.replace(/\./g, '').replace(',', '.');
        const parsed = parseFloat(cleanValue);
        valorFinal = isNaN(parsed) || valorString === '' ? null : parsed;
      }
      
      setItems(prevItems => 
        prevItems.map(item => 
          item.categoria === categoria 
            ? { ...item, [campo]: valorFinal }
            : item
        )
      );

      setValoresLocales(prev => {
        const newState = { ...prev };
        delete newState[`${categoria}-${campo}`];
        return newState;
      });
    }, 500);
  }

  function eliminarFila(categoria: string) {
    if (confirm(`¿Eliminar ${categoria}?`)) {
      setItems(items.filter(item => item.categoria !== categoria));
    }
  }

  function calcularFila(item: InventarioItem) {
    const difAnimales = item.cantidadFinal - item.cantidadInicial;
    const usdInicio = item.cantidadInicial * (item.pesoInicio || 0) * (item.precioKg || 0);
    const usdFinal = item.cantidadFinal * (item.pesoFinal || 0) * (item.precioKgFin || 0);
    const usdTotales = usdFinal - usdInicio;
    const kgStockInicio = item.cantidadInicial * (item.pesoInicio || 0);
    const kgStockFinal = item.cantidadFinal * (item.pesoFinal || 0);
    const difKg = kgStockFinal - kgStockInicio;
    const pesoPromedio = ((item.pesoInicio || 0) + (item.pesoFinal || 0)) / 2;
    const precioPromedio = ((item.precioKg || 0) + (item.precioKgFin || 0)) / 2;
    const precioAnimal = pesoPromedio * precioPromedio;

    return {
      difAnimales,
      kgStockInicio,
      kgStockFinal,
      difKg,
      usdInicio,
      usdFinal,
      usdTotales,
      precioAnimal,
    };
  }

  const totalesOvinos = itemsOvinos.reduce((acc, item) => {
    const calc = calcularFila(item);
    return {
      cantidadInicial: acc.cantidadInicial + item.cantidadInicial,
      cantidadFinal: acc.cantidadFinal + item.cantidadFinal,
      difAnimales: acc.difAnimales + calc.difAnimales,
      kgStockInicio: acc.kgStockInicio + calc.kgStockInicio,
      kgStockFinal: acc.kgStockFinal + calc.kgStockFinal,
      difKg: acc.difKg + calc.difKg,
      usdInicio: acc.usdInicio + calc.usdInicio,
      usdFinal: acc.usdFinal + calc.usdFinal,
      usdTotales: acc.usdTotales + calc.usdTotales,
    };
  }, {
    cantidadInicial: 0, cantidadFinal: 0, difAnimales: 0,
    kgStockInicio: 0, kgStockFinal: 0, difKg: 0,
    usdInicio: 0, usdFinal: 0, usdTotales: 0,
  });

  const totalesBovinos = itemsBovinos.reduce((acc, item) => {
    const calc = calcularFila(item);
    return {
      cantidadInicial: acc.cantidadInicial + item.cantidadInicial,
      cantidadFinal: acc.cantidadFinal + item.cantidadFinal,
      difAnimales: acc.difAnimales + calc.difAnimales,
      kgStockInicio: acc.kgStockInicio + calc.kgStockInicio,
      kgStockFinal: acc.kgStockFinal + calc.kgStockFinal,
      difKg: acc.difKg + calc.difKg,
      usdInicio: acc.usdInicio + calc.usdInicio,
      usdFinal: acc.usdFinal + calc.usdFinal,
      usdTotales: acc.usdTotales + calc.usdTotales,
    };
  }, {
    cantidadInicial: 0, cantidadFinal: 0, difAnimales: 0,
    kgStockInicio: 0, kgStockFinal: 0, difKg: 0,
    usdInicio: 0, usdFinal: 0, usdTotales: 0,
  });

  const TablaInventario = ({ 
    items, 
    totales, 
    titulo, 
    colorBg 
  }: { 
    items: InventarioItem[], 
    totales: any, 
    titulo: string, 
    colorBg: string 
  }) => (
    <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden mb-6">
      <div className={`px-4 py-3 ${colorBg} border-b-2 border-gray-300`}>
        <h2 className="text-lg font-bold text-gray-900">{titulo}</h2>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-xs sm:text-sm border-collapse">
          <thead className="bg-gray-100 border-b-2 border-gray-300">
            <tr>
              <th className="px-3 py-2 text-left font-bold text-gray-700 sticky left-0 bg-gray-100 z-20 min-w-[120px]">
                Categoría
              </th>
              <th className="px-2 py-2 text-center font-bold text-gray-700 bg-yellow-50 min-w-[80px]">
                Nº Anim<br/>1/7/{añoInicio.toString().slice(-2)}
              </th>
              <th className="px-2 py-2 text-center font-bold text-gray-700 bg-yellow-50 min-w-[80px]">
                Nº Anim<br/>30/6/{añoFin.toString().slice(-2)}
              </th>
              <th className="px-2 py-2 text-center font-bold text-gray-700 bg-yellow-50 min-w-[70px]">
                Peso<br/>Inicio
              </th>
              <th className="px-2 py-2 text-center font-bold text-gray-700 bg-yellow-50 min-w-[70px]">
                Peso<br/>Final
              </th>
              <th className="px-2 py-2 text-center font-bold text-gray-700 bg-yellow-50 min-w-[70px]">
                U$/kg<br/>Inicio
              </th>
              <th className="px-2 py-2 text-center font-bold text-gray-700 bg-yellow-50 min-w-[70px]">
                U$/kg<br/>Fin
              </th>
              <th className="px-2 py-2 text-center font-bold text-gray-700 min-w-[70px]">
                Dif en<br/>animales
              </th>
              <th className="px-2 py-2 text-center font-bold text-gray-700 min-w-[80px]">
                kg stock<br/>Inicio
              </th>
              <th className="px-2 py-2 text-center font-bold text-gray-700 min-w-[80px]">
                kg stock<br/>Final
              </th>
              <th className="px-2 py-2 text-center font-bold text-gray-700 min-w-[70px]">
                Dif en kg
              </th>
              <th className="px-2 py-2 text-center font-bold text-gray-700 min-w-[80px]">
                U$S<br/>Inicio
              </th>
              <th className="px-2 py-2 text-center font-bold text-gray-700 min-w-[80px]">
                U$S<br/>Final
              </th>
              <th className="px-2 py-2 text-center font-bold text-gray-700 min-w-[80px]">
                U$S<br/>Totales
              </th>
              <th className="px-2 py-2 text-center font-bold text-gray-700 min-w-[80px]">
                Precio /<br/>animal
              </th>
              <th className="px-2 py-2 text-center font-bold text-gray-700 min-w-[50px]"></th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-100">
            {items.map((item) => {
              const calc = calcularFila(item);

              return (
                <tr key={item.categoria} className="hover:bg-gray-50">
                  <td className="px-3 py-2 font-medium text-gray-900 sticky left-0 bg-white z-10">
                    {item.categoria}
                  </td>
                  
                  <td className="px-2 py-2 bg-yellow-50">
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={valoresLocales[`${item.categoria}-cantidadInicial`] ?? item.cantidadInicial}
                      onChange={(e) => actualizarItemPorCategoria(item.categoria, 'cantidadInicial', e.target.value)}
                      className="w-full px-2 py-1 border rounded text-center text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </td>

                  <td className="px-2 py-2 bg-yellow-50">
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={valoresLocales[`${item.categoria}-cantidadFinal`] ?? item.cantidadFinal}
                      onChange={(e) => actualizarItemPorCategoria(item.categoria, 'cantidadFinal', e.target.value)}
                      className="w-full px-2 py-1 border rounded text-center text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </td>

                  <td className="px-2 py-2 bg-yellow-50">
                    <input
                      type="text"
                      inputMode="decimal"
                      pattern="[0-9]*[.,]?[0-9]+"
                      value={valoresLocales[`${item.categoria}-pesoInicio`] ?? (item.pesoInicio ?? '')}
                      onChange={(e) => actualizarItemPorCategoria(item.categoria, 'pesoInicio', e.target.value)}
                      placeholder="0"
                      className="w-full px-2 py-1 border rounded text-center text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </td>

                  <td className="px-2 py-2 bg-yellow-50">
                    <input
                      type="text"
                      inputMode="decimal"
                      pattern="[0-9]*[.,]?[0-9]+"
                      value={valoresLocales[`${item.categoria}-pesoFinal`] ?? (item.pesoFinal ?? '')}
                      onChange={(e) => actualizarItemPorCategoria(item.categoria, 'pesoFinal', e.target.value)}
                      placeholder="0"
                      className="w-full px-2 py-1 border rounded text-center text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </td>

                  <td className="px-2 py-2 bg-yellow-50">
                    <input
                      type="text"
                      inputMode="decimal"
                      pattern="[0-9]*[.,]?[0-9]+"
                      value={valoresLocales[`${item.categoria}-precioKg`] ?? (item.precioKg ?? '')}
                      onChange={(e) => actualizarItemPorCategoria(item.categoria, 'precioKg', e.target.value)}
                      placeholder="0"
                      className="w-full px-2 py-1 border rounded text-center text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </td>

                  <td className="px-2 py-2 bg-yellow-50">
                    <input
                      type="text"
                      inputMode="decimal"
                      pattern="[0-9]*[.,]?[0-9]+"
                      value={valoresLocales[`${item.categoria}-precioKgFin`] ?? (item.precioKgFin ?? '')}
                      onChange={(e) => actualizarItemPorCategoria(item.categoria, 'precioKgFin', e.target.value)}
                      placeholder="0"
                      className="w-full px-2 py-1 border rounded text-center text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </td>

                  <td className="px-2 py-2 text-center text-gray-700">{formatearNumero(calc.difAnimales)}</td>
                  <td className="px-2 py-2 text-center text-gray-700">{formatearNumero(calc.kgStockInicio)}</td>
                  <td className="px-2 py-2 text-center text-gray-700">{formatearNumero(calc.kgStockFinal)}</td>
                  <td className={`px-2 py-2 text-center font-medium ${calc.difKg < 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {formatearNumero(calc.difKg)}
                  </td>
                  <td className="px-2 py-2 text-center text-gray-700">{formatearNumero(calc.usdInicio)}</td>
                  <td className="px-2 py-2 text-center text-gray-700">{formatearNumero(calc.usdFinal)}</td>
                  <td className={`px-2 py-2 text-center font-bold ${calc.usdTotales < 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {formatearNumero(calc.usdTotales)}
                  </td>
                  <td className="px-2 py-2 text-center text-gray-700">{formatearNumero(calc.precioAnimal)}</td>

                  <td className="px-2 py-2 text-center">
                    <button
                      onClick={() => eliminarFila(item.categoria)}
                      className="text-red-600 hover:text-red-800 text-lg"
                      title="Eliminar"
                    >
                      🗑️
                    </button>
                  </td>
                </tr>
              );
            })}

            <tr className="bg-green-100 font-bold text-gray-900">
              <td className="px-3 py-3 sticky left-0 bg-green-100 z-10">TOTALES</td>
              <td className="px-2 py-3 text-center">{formatearNumero(totales.cantidadInicial)}</td>
              <td className="px-2 py-3 text-center">{formatearNumero(totales.cantidadFinal)}</td>
              <td className="px-2 py-3"></td>
              <td className="px-2 py-3"></td>
              <td className="px-2 py-3"></td>
              <td className="px-2 py-3"></td>
              <td className="px-2 py-3 text-center">{formatearNumero(totales.difAnimales)}</td>
              <td className="px-2 py-3 text-center">{formatearNumero(totales.kgStockInicio)}</td>
              <td className="px-2 py-3 text-center">{formatearNumero(totales.kgStockFinal)}</td>
              <td className={`px-2 py-3 text-center ${totales.difKg < 0 ? 'text-red-600' : 'text-green-600'}`}>
                {formatearNumero(totales.difKg)}
              </td>
              <td className="px-2 py-3 text-center">{formatearNumero(totales.usdInicio)}</td>
              <td className="px-2 py-3 text-center">{formatearNumero(totales.usdFinal)}</td>
              <td className={`px-2 py-3 text-center ${totales.usdTotales < 0 ? 'text-red-600' : 'text-green-600'}`}>
                {formatearNumero(totales.usdTotales)}
              </td>
              <td className="px-2 py-3"></td>
              <td className="px-2 py-3"></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="bg-gray-50 min-h-screen p-4 sm:p-6 md:p-8">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">📦 Diferencia de Inventario</h1>
          <p className="text-gray-600 text-sm mt-1">
            Ejercicio fiscal: 1/7/{añoInicio} → 30/6/{añoFin}
          </p>
          <div className="mt-3 bg-indigo-50 border border-indigo-200 rounded-lg px-4 py-2 flex items-start gap-2">
            <span className="text-indigo-600 text-lg">⚠️</span>
            <p className="text-indigo-800 text-sm font-medium">
              No olvides presionar <strong>Guardar</strong> si hacés algún cambio
            </p>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setModalRegenerar(true)}
            className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium"
          >
            🔄 Regenerar desde Potreros
          </button>
          <button
            onClick={() => setModalAgregar(true)}
            className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm font-medium"
          >
            ➕ Agregar Categoría
          </button>
          <button
            onClick={guardarInventario}
            disabled={guardando}
            className="px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition text-sm font-medium disabled:opacity-50"
          >
            {guardando ? '💾 Guardando...' : '💾 Guardar'}
          </button>
        </div>
      </div>

      <TablaInventario 
        items={itemsBovinos}
        totales={totalesBovinos}
        titulo="BOVINO"
        colorBg="bg-orange-100"
      />

      <TablaInventario 
        items={itemsOvinos}
        totales={totalesOvinos}
        titulo="OVINO"
        colorBg="bg-yellow-100"
      />

      {modalRegenerar && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold mb-4">🔄 Regenerar desde Potreros</h2>
            <p className="text-gray-700 mb-6">
              ¿A qué fecha querés cargar el stock actual de tus potreros?
            </p>
            
            <div className="space-y-3 mb-6">
              <button
                onClick={() => regenerarDesdePotreros('INICIO')}
                className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium text-left"
              >
                📅 Inicio de Ejercicio
                <div className="text-sm opacity-90">1 de julio {añoInicio}</div>
              </button>
              
              <button
                onClick={() => regenerarDesdePotreros('FIN')}
                className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium text-left"
              >
                📅 Fin de Ejercicio
                <div className="text-sm opacity-90">30 de junio {añoFin}</div>
              </button>
            </div>

            <button
              onClick={() => setModalRegenerar(false)}
              className="w-full px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {modalAgregar && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold mb-4">➕ Agregar Categoría Manual</h2>
            <input
              type="text"
              value={nuevaCategoria}
              onChange={(e) => setNuevaCategoria(e.target.value)}
              placeholder="Ej: Terneros especiales"
              className="w-full px-4 py-2 border rounded-lg mb-4"
              onKeyDown={(e) => e.key === 'Enter' && agregarCategoriaManual()}
            />
            <div className="flex gap-3">
              <button
                onClick={() => setModalAgregar(false)}
                className="flex-1 px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
              >
                Cancelar
              </button>
              <button
                onClick={agregarCategoriaManual}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Agregar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}