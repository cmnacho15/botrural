'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type DatoUnificado = {
  id: string;
  fecha: Date;
  tipo: string;
  categoria: 'animales' | 'agricultura' | 'clima' | 'finanzas' | 'insumos';
  descripcion: string;
  icono: string;
  color: string;
  usuario?: string;
  lote?: string;
  detalles?: any;
  proveedor?: string;
  comprador?: string;
};

type FiltrosType = {
  categoria: string;
  tipoDato: string;
  fechaDesde: Date | null;
  fechaHasta: Date | null;
  busqueda: string;
  usuarios: string[];
  potreros: string[];
  animales: string[];
  cultivos: string[];
};

type DatosContextType = {
  datos: DatoUnificado[];
  loading: boolean;
  error: string | null;
  filtros: FiltrosType;
  setFiltros: (f: FiltrosType) => void;
  refetch: () => Promise<void>;
};

const DatosContext = createContext<DatosContextType | undefined>(undefined);

export function DatosProvider({ children }: { children: ReactNode }) {
  const [datos, setDatos] = useState<DatoUnificado[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filtros, setFiltros] = useState<FiltrosType>({
    categoria: 'todos',
    tipoDato: 'todos',
    fechaDesde: null,
    fechaHasta: null,
    busqueda: '',
    usuarios: [],
    potreros: [],
    animales: [],
    cultivos: [],
  });

  // ===========================================
  // 🔥 FETCH + FILTROS EN EL CLIENTE
  // ===========================================
  const fetchDatos = async () => {
    try {
      setLoading(true);
      setError(null);

      // 👉 Traés TODOS los datos SIN FILTROS
      const response = await fetch('/api/datos');
      if (!response.ok) throw new Error('Error al cargar datos');

      const datosOriginales: DatoUnificado[] = await response.json();
      let filtrados = [...datosOriginales];

      // 👉 Filtro por tipo de dato
      if (filtros.tipoDato !== 'todos') {
        filtrados = filtrados.filter((d) => d.tipo === filtros.tipoDato);
      }

      // 👉 Filtro por categoría
      if (filtros.categoria !== 'todos') {
        filtrados = filtrados.filter((d) => d.categoria === filtros.categoria);
      }

      // 👉 Filtro fecha desde
      if (filtros.fechaDesde) {
        filtrados = filtrados.filter(
          (d) => new Date(d.fecha) >= filtros.fechaDesde!
        );
      }

      // 👉 Filtro fecha hasta
      if (filtros.fechaHasta) {
        filtrados = filtrados.filter(
          (d) => new Date(d.fecha) <= filtros.fechaHasta!
        );
      }

      // 👉 Filtro búsqueda
      if (filtros.busqueda) {
        const b = filtros.busqueda.toLowerCase();
        filtrados = filtrados.filter((d) =>
          (d.descripcion ?? '').toLowerCase().includes(b) ||
          d.tipo.toLowerCase().includes(b) ||
          (d.proveedor ?? '').toLowerCase().includes(b) ||
          (d.comprador ?? '').toLowerCase().includes(b)
        );
      }

      // 👉 Filtro por usuarios
      if (filtros.usuarios.length > 0) {
        filtrados = filtrados.filter(
          (d) => d.usuario && filtros.usuarios.includes(d.usuario)
        );
      }

      // 👉 Filtro por potreros/lotes
      if (filtros.potreros.length > 0) {
        filtrados = filtrados.filter(
          (d) => d.lote && filtros.potreros.includes(d.lote)
        );
      }

      // 👉 Filtro por animales (futuro)
      if (filtros.animales.length > 0) {
        filtrados = filtrados.filter(
          (d) => d.detalles?.caravana && filtros.animales.includes(d.detalles.caravana)
        );
      }

      // 👉 Orden por fecha (más reciente primero)
      filtrados.sort(
        (a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()
      );

      setDatos(filtrados);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  // Ejecuta cada vez que cambian filtros
  useEffect(() => {
    fetchDatos();
  }, [filtros]);

  return (
    <DatosContext.Provider
      value={{
        datos,
        loading,
        error,
        filtros,
        setFiltros,
        refetch: fetchDatos,
      }}
    >
      {children}
    </DatosContext.Provider>
  );
}

export function useDatos() {
  const context = useContext(DatosContext);
  if (!context) throw new Error('useDatos debe usarse dentro de DatosProvider');
  return context;
}