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
};

type DatosContextType = {
  datos: DatoUnificado[];
  loading: boolean;
  error: string | null;
  filtros: {
    categoria: string;
    tipoDato: string; // ← AGREGÁ ESTO
    fechaDesde: Date | null;
    fechaHasta: Date | null;
    busqueda: string;
  };
  setFiltros: (filtros: any) => void;
  refetch: () => Promise<void>;
};

const DatosContext = createContext<DatosContextType | undefined>(undefined);

export function DatosProvider({ children }: { children: ReactNode }) {
  const [datos, setDatos] = useState<DatoUnificado[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtros, setFiltros] = useState({
    categoria: 'todos',
    tipoDato: 'todos', // ← AGREGÁ ESTO
    fechaDesde: null as Date | null,
    fechaHasta: null as Date | null,
    busqueda: '',
  });

  const fetchDatos = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (filtros.categoria !== 'todos') params.append('categoria', filtros.categoria);
      if (filtros.tipoDato !== 'todos') params.append('tipo', filtros.tipoDato); // ← AGREGÁ ESTO
      if (filtros.fechaDesde) params.append('fechaDesde', filtros.fechaDesde.toISOString());
      if (filtros.fechaHasta) params.append('fechaHasta', filtros.fechaHasta.toISOString());
      if (filtros.busqueda) params.append('busqueda', filtros.busqueda);

      const response = await fetch(`/api/datos?${params}`);
      if (!response.ok) throw new Error('Error al cargar datos');

      const data = await response.json();

      const datosOrdenados = data.sort(
        (a: any, b: any) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()
      );

      setDatos(datosOrdenados);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

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