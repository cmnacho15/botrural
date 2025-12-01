'use client';

import { useState, useEffect, useMemo } from 'react';
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface InventarioItem {
  id?: string;
  categoria: string;
  cantidadInicial: number; // 1/7 año inicio
  cantidadFinal: number;   // 30/6 año fin
  peso: number | null;
  precioKg: number | null;
}

export default function InventarioPage() {
  // ==========================================
  // 🗓️ CÁLCULO AUTOMÁTICO DEL EJERCICIO FISCAL
  // ==========================================
  const { FECHA_INICIAL, FECHA_FINAL, añoInicio, añoFin } = useMemo(() => {
    const hoy = new Date();
    const mesActual = hoy.getMonth(); // 0-11 (enero=0, julio=6)
    const añoActual = hoy.getFullYear();

    // Si estamos entre julio-diciembre, el ejercicio empezó este año
    // Si estamos entre enero-junio, el ejercicio empezó el año pasado
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

  // Cargar inventario inicial
  const { data: invInicial, mutate: mutateInicial } = useSWR(
    `/api/inventario?fecha=${FECHA_INICIAL}`, 
    fetcher
  );
  
  // Cargar inventario final
  const { data: invFinal, mutate: mutateFinal } = useSWR(
    `/api/inventario?fecha=${FECHA_FINAL}`, 
    fetcher
  );

  // Combinar ambos inventarios cuando se carguen
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
          peso: final?.peso || inicial?.peso || null,
          precioKg: final?.precioKg || inicial?.precioKg || null,
        };
      });

      setItems(merged);
    }
  }, [invInicial, invFinal]);

  // ==========================================
  // REGENERAR DESDE POTREROS
  // ==========================================
  async function regenerarDesdePotreros(destino: 'INICIO' | 'FIN') {
    try {
      const res = await fetch('/api/inventario/regenerar', { method: 'POST' });
      const data = await res.json();

      if (res.ok) {
        // Crear mapa de categorías existentes
        const categoriasExistentes = new Map(items.map(item => [item.categoria, item]));

        // Actualizar o agregar categorías desde potreros
        const nuevosItems: InventarioItem[] = data.map((item: any) => {
          const existente = categoriasExistentes.get(item.categoria);
          
          if (destino === 'INICIO') {
            return {
              categoria: item.categoria,
              cantidadInicial: item.cantidad,
              cantidadFinal: existente?.cantidadFinal || 0,
              peso: existente?.peso || null,
              precioKg: existente?.precioKg || null,
            };
          } else {
            return {
              categoria: item.categoria,
              cantidadInicial: existente?.cantidadInicial || 0,
              cantidadFinal: item.cantidad,
              peso: existente?.peso || null,
              precioKg: existente?.precioKg || null,
            };
          }
        });

        // Agregar categorías que están en la tabla pero NO en potreros
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
        
        alert(`Stock de potreros cargado en ${fechaTexto}. Completá peso y precio manualmente.`);
      }
    } catch (error) {
      console.error('Error regenerando:', error);
      alert('Error al regenerar inventario');
    }
  }

  // ==========================================
  // AGREGAR CATEGORÍA MANUAL
  // ==========================================
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
      peso: null,
      precioKg: null,
    }]);

    setNuevaCategoria('');
    setModalAgregar(false);
  }

  // ==========================================
  // GUARDAR INVENTARIO
  // ==========================================
  async function guardarInventario() {
    setGuardando(true);

    try {
      // Guardar inventario inicial
      const invInicialData = items
        .filter(item => item.cantidadInicial > 0 || item.cantidadFinal > 0)
        .map(item => ({
          categoria: item.categoria,
          cantidad: item.cantidadInicial,
          peso: item.peso,
          precioKg: item.precioKg,
        }));

      await fetch('/api/inventario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fecha: FECHA_INICIAL,
          inventarios: invInicialData,
        }),
      });

      // Guardar inventario final
      const invFinalData = items
        .filter(item => item.cantidadInicial > 0 || item.cantidadFinal > 0)
        .map(item => ({
          categoria: item.categoria,
          cantidad: item.cantidadFinal,
          peso: item.peso,
          precioKg: item.precioKg,
        }));

      await fetch('/api/inventario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fecha: FECHA_FINAL,
          inventarios: invFinalData,
        }),
      });

      // Recargar datos
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

  // ==========================================
  // ACTUALIZAR VALORES
  // ==========================================
  function actualizarItem(index: number, campo: keyof InventarioItem, valor: any) {
    const nuevosItems = [...items];
    nuevosItems[index] = { ...nuevosItems[index], [campo]: valor };
    setItems(nuevosItems);
  }

  // ==========================================
  // ELIMINAR FILA
  // ==========================================
  function eliminarFila(index: number) {
    if (confirm(`¿Eliminar ${items[index].categoria}?`)) {
      setItems(items.filter((_, i) => i !== index));
    }
  }

  // ==========================================
  // CÁLCULOS AUTOMÁTICOS
  // ==========================================
  function calcularFila(item: InventarioItem) {
    const difAnimales = item.cantidadFinal - item.cantidadInicial;
    const kgStock2024 = item.cantidadInicial * (item.peso || 0);
    const kgStock2025 = item.cantidadFinal * (item.peso || 0);
    const difKg = kgStock2025 - kgStock2024;
    const usdInicio = kgStock2024 * (item.precioKg || 0);
    const usdFinal = kgStock2025 * (item.precioKg || 0);
    const usdTotales = usdFinal - usdInicio;
    const precioAnimal = (item.peso || 0) * (item.precioKg || 0);

    return {
      difAnimales,
      kgStock2024,
      kgStock2025,
      difKg,
      usdInicio,
      usdFinal,
      usdTotales,
      precioAnimal,
    };
  }

  // Totales
  const totales = items.reduce((acc, item) => {
    const calc = calcularFila(item);
    return {
      cantidadInicial: acc.cantidadInicial + item.cantidadInicial,
      cantidadFinal: acc.cantidadFinal + item.cantidadFinal,
      difAnimales: acc.difAnimales + calc.difAnimales,
      kgStock2024: acc.kgStock2024 + calc.kgStock2024,
      kgStock2025: acc.kgStock2025 + calc.kgStock2025,
      difKg: acc.difKg + calc.difKg,
      usdInicio: acc.usdInicio + calc.usdInicio,
      usdFinal: acc.usdFinal + calc.usdFinal,
      usdTotales: acc.usdTotales + calc.usdTotales,
    };
  }, {
    cantidadInicial: 0,
    cantidadFinal: 0,
    difAnimales: 0,
    kgStock2024: 0,
    kgStock2025: 0,
    difKg: 0,
    usdInicio: 0,
    usdFinal: 0,
    usdTotales: 0,
  });

  return (
    <div className="bg-gray-50 min-h-screen p-4 sm:p-6 md:p-8">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">📦 Diferencia de Inventario</h1>
          <p className="text-gray-600 text-sm mt-1">
            Ejercicio fiscal: 1/7/{añoInicio} → 30/6/{añoFin}
          </p>
        </div>

        <div className="flex gap-3 flex-wrap">
          <button
            onClick={() => setModalRegenerar(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium"
          >
            🔄 Regenerar desde Potreros
          </button>
          <button
            onClick={() => setModalAgregar(true)}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm font-medium"
          >
            ➕ Agregar Categoría
          </button>
          <button
            onClick={guardarInventario}
            disabled={guardando}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition text-sm font-medium disabled:opacity-50"
          >
            {guardando ? '💾 Guardando...' : '💾 Guardar Inventario'}
          </button>
        </div>
      </div>

      {/* TABLA */}
      <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 border-b-2 border-gray-300">
            <tr>
              <th className="px-4 py-3 text-left font-bold text-gray-700 sticky left-0 bg-gray-100 z-10">
                Categoría
              </th>
              <th className="px-4 py-3 text-center font-bold text-gray-700 bg-yellow-50">
                Nº Anim<br/>1/7/{añoInicio}
              </th>
              <th className="px-4 py-3 text-center font-bold text-gray-700 bg-yellow-50">
                Nº Anim<br/>30/6/{añoFin}
              </th>
              <th className="px-4 py-3 text-center font-bold text-gray-700 bg-yellow-50">Peso</th>
              <th className="px-4 py-3 text-center font-bold text-gray-700 bg-yellow-50">U$/kg</th>
              <th className="px-4 py-3 text-center font-bold text-gray-700">Dif en<br/>animales</th>
              <th className="px-4 py-3 text-center font-bold text-gray-700">kg stock<br/>{añoInicio}</th>
              <th className="px-4 py-3 text-center font-bold text-gray-700">kg stock<br/>{añoFin}</th>
              <th className="px-4 py-3 text-center font-bold text-gray-700">Dif en kg</th>
              <th className="px-4 py-3 text-center font-bold text-gray-700">U$S<br/>Inicio</th>
              <th className="px-4 py-3 text-center font-bold text-gray-700">U$S<br/>Final</th>
              <th className="px-4 py-3 text-center font-bold text-gray-700">U$S<br/>Totales</th>
              <th className="px-4 py-3 text-center font-bold text-gray-700">Precio /<br/>animal</th>
              <th className="px-4 py-3 text-center font-bold text-gray-700">Acción</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-100">
            {items.map((item, index) => {
              const calc = calcularFila(item);

              return (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-medium text-gray-900 sticky left-0 bg-white">
                    {item.categoria}
                  </td>
                  
                  {/* EDITABLE: Cantidad Inicial */}
                  <td className="px-4 py-2 bg-yellow-50">
                    <input
                      type="number"
                      value={item.cantidadInicial}
                      onChange={(e) => actualizarItem(index, 'cantidadInicial', parseInt(e.target.value) || 0)}
                      className="w-20 px-2 py-1 border rounded text-center"
                    />
                  </td>

                  {/* EDITABLE: Cantidad Final */}
                  <td className="px-4 py-2 bg-yellow-50">
                    <input
                      type="number"
                      value={item.cantidadFinal}
                      onChange={(e) => actualizarItem(index, 'cantidadFinal', parseInt(e.target.value) || 0)}
                      className="w-20 px-2 py-1 border rounded text-center"
                    />
                  </td>

                  {/* EDITABLE: Peso */}
                  <td className="px-4 py-2 bg-yellow-50">
                    <input
                      type="number"
                      step="0.1"
                      value={item.peso || ''}
                      onChange={(e) => actualizarItem(index, 'peso', parseFloat(e.target.value) || null)}
                      className="w-20 px-2 py-1 border rounded text-center"
                      placeholder="0"
                    />
                  </td>

                  {/* EDITABLE: Precio */}
                  <td className="px-4 py-2 bg-yellow-50">
                    <input
                      type="number"
                      step="0.01"
                      value={item.precioKg || ''}
                      onChange={(e) => actualizarItem(index, 'precioKg', parseFloat(e.target.value) || null)}
                      className="w-20 px-2 py-1 border rounded text-center"
                      placeholder="0"
                    />
                  </td>

                  {/* CALCULADOS */}
                  <td className="px-4 py-2 text-center text-gray-700">{calc.difAnimales}</td>
                  <td className="px-4 py-2 text-center text-gray-700">{calc.kgStock2024.toFixed(0)}</td>
                  <td className="px-4 py-2 text-center text-gray-700">{calc.kgStock2025.toFixed(0)}</td>
                  <td className={`px-4 py-2 text-center font-medium ${calc.difKg < 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {calc.difKg.toFixed(0)}
                  </td>
                  <td className="px-4 py-2 text-center text-gray-700">{calc.usdInicio.toFixed(0)}</td>
                  <td className="px-4 py-2 text-center text-gray-700">{calc.usdFinal.toFixed(0)}</td>
                  <td className={`px-4 py-2 text-center font-bold ${calc.usdTotales < 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {calc.usdTotales.toFixed(0)}
                  </td>
                  <td className="px-4 py-2 text-center text-gray-700">{calc.precioAnimal.toFixed(0)}</td>

                  {/* ELIMINAR */}
                  <td className="px-4 py-2 text-center">
                    <button
                      onClick={() => eliminarFila(index)}
                      className="text-red-600 hover:text-red-800"
                      title="Eliminar"
                    >
                      🗑️
                    </button>
                  </td>
                </tr>
              );
            })}

            {/* FILA TOTALES */}
            <tr className="bg-green-100 font-bold text-gray-900">
              <td className="px-4 py-3 sticky left-0 bg-green-100">TOTALES</td>
              <td className="px-4 py-3 text-center">{totales.cantidadInicial}</td>
              <td className="px-4 py-3 text-center">{totales.cantidadFinal}</td>
              <td className="px-4 py-3"></td>
              <td className="px-4 py-3"></td>
              <td className="px-4 py-3 text-center">{totales.difAnimales}</td>
              <td className="px-4 py-3 text-center">{totales.kgStock2024.toFixed(0)}</td>
              <td className="px-4 py-3 text-center">{totales.kgStock2025.toFixed(0)}</td>
              <td className={`px-4 py-3 text-center ${totales.difKg < 0 ? 'text-red-600' : 'text-green-600'}`}>
                {totales.difKg.toFixed(0)}
              </td>
              <td className="px-4 py-3 text-center">{totales.usdInicio.toFixed(0)}</td>
              <td className="px-4 py-3 text-center">{totales.usdFinal.toFixed(0)}</td>
              <td className={`px-4 py-3 text-center ${totales.usdTotales < 0 ? 'text-red-600' : 'text-green-600'}`}>
                {totales.usdTotales.toFixed(0)}
              </td>
              <td className="px-4 py-3"></td>
              <td className="px-4 py-3"></td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* MODAL REGENERAR */}
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

      {/* MODAL AGREGAR */}
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