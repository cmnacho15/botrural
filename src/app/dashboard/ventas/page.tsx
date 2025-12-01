// app/dashboard/ventas/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import ModalVentaGanado from '@/app/components/ventas/ModalVentaGanado';
import ResumenVentas from '@/app/components/ventas/ResumenVentas';
import TablaVentas from '@/app/components/ventas/TablaVentas';

export default function VentasPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [ventas, setVentas] = useState([]);
  const [resumen, setResumen] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Ejercicio fiscal: 1 de julio al 30 de junio
  const [ejercicio, setEjercicio] = useState('2024-2025');
  const [fechaDesde, setFechaDesde] = useState('2024-07-01');
  const [fechaHasta, setFechaHasta] = useState('2025-06-30');

  // Cargar ventas
  useEffect(() => {
    cargarVentas();
  }, [fechaDesde, fechaHasta]);

  const cargarVentas = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `/api/ventas?fechaDesde=${fechaDesde}&fechaHasta=${fechaHasta}`
      );
      
      if (!response.ok) throw new Error('Error al cargar ventas');
      
      const data = await response.json();
      setVentas(data.ventas);
      setResumen(data.resumen);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEjercicioChange = (nuevoEjercicio: string) => {
    setEjercicio(nuevoEjercicio);
    
    // Mapear ejercicio a fechas (ej: "2024-2025" → 1/7/2024 a 30/6/2025)
    const [anioInicio] = nuevoEjercicio.split('-');
    const anioFin = parseInt(anioInicio) + 1;
    
    setFechaDesde(`${anioInicio}-07-01`);
    setFechaHasta(`${anioFin}-06-30`);
  };

  const handleVentaCreada = () => {
    setIsModalOpen(false);
    cargarVentas();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg">Cargando ventas...</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Ventas de Ganado</h1>
          <p className="text-gray-600 mt-1">
            Ejercicio fiscal {ejercicio}
          </p>
        </div>
        
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
        >
          <Plus size={20} />
          Nueva Venta
        </button>
      </div>

      {/* Filtros */}
      <div className="bg-white p-4 rounded-lg shadow">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Selector de ejercicio */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Ejercicio Fiscal
            </label>
            <select
              value={ejercicio}
              onChange={(e) => handleEjercicioChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              <option value="2023-2024">2023-2024</option>
              <option value="2024-2025">2024-2025</option>
              <option value="2025-2026">2025-2026</option>
            </select>
          </div>

          {/* Fecha desde */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Desde
            </label>
            <input
              type="date"
              value={fechaDesde}
              onChange={(e) => setFechaDesde(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>

          {/* Fecha hasta */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Hasta
            </label>
            <input
              type="date"
              value={fechaHasta}
              onChange={(e) => setFechaHasta(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* Resumen por especie */}
      {resumen && (
        <ResumenVentas resumen={resumen} />
      )}

      {/* Tabla de ventas detalladas */}
      <TablaVentas ventas={ventas} />

      {/* Modal de nueva venta */}
      <ModalVentaGanado
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onVentaCreada={handleVentaCreada}
      />
    </div>
  );
}