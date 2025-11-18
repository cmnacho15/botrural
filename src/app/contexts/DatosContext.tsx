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

// ===============================
// 🐄 AGRUPACIÓN DE ANIMALES
// ===============================
const AGRUPACION_ANIMALES: Record<string, string[]> = {
  'Novillos': ['Novillos +3 años', 'Novillos 2–3 años', 'Novillos 1–2 años', 'Novillos', 'Novillitos'],
  'Vaquillonas': ['Vaquillonas +2 años', 'Vaquillonas 1–2 años', 'Vaquillonas'],
  'Terneros/as': ['Terneros/as', 'Terneros', 'Terneras'],
  'Corderos': ['Corderos DL', 'Corderas DL', 'Corderos/as Mamones', 'Corderos', 'Corderas'],
  'Borregas': ['Borregas 2–4 dientes', 'Borregas', 'Borregos'],
  'Vacas': ['Vacas'],
  'Toros': ['Toros', 'Toritos'],
  'Carneros': ['Carneros'],
  'Ovejas': ['Ovejas'],
  'Capones': ['Capones'],
  'Padrillos': ['Padrillos'],
  'Yeguas': ['Yeguas'],
  'Caballos': ['Caballos'],
  'Potrillos': ['Potrillos']
};

// ===============================
// 🧠 FUNCIÓN CORRECTA
// ===============================
function coincideConFiltroAnimal(
  categoriaDato: string | undefined,
  filtrosAnimales: string[]
): boolean {
  if (!categoriaDato || filtrosAnimales.length === 0) return true;

  const categoriaLower = categoriaDato.toLowerCase();

  return filtrosAnimales.some(categoriaFiltro => {
    const subcategorias = AGRUPACION_ANIMALES[categoriaFiltro] || [categoriaFiltro];
    return subcategorias.some(sub =>
      categoriaLower.includes(sub.toLowerCase()) ||
      sub.toLowerCase().includes(categoriaLower)
    );
  });
}

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

  const fetchDatos = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/datos');
      if (!response.ok) throw new Error('Error al cargar datos');

      const datosOriginales: DatoUnificado[] = await response.json();
      let filtrados = [...datosOriginales];

      // Tipo
      if (filtros.tipoDato !== 'todos') {
        filtrados = filtrados.filter((d) => d.tipo === filtros.tipoDato);
      }

      // Categoría
      if (filtros.categoria !== 'todos') {
        filtrados = filtrados.filter((d) => d.categoria === filtros.categoria);
      }

      // Fechas
      if (filtros.fechaDesde) {
        filtrados = filtrados.filter((d) => new Date(d.fecha) >= filtros.fechaDesde!);
      }
      if (filtros.fechaHasta) {
        filtrados = filtrados.filter((d) => new Date(d.fecha) <= filtros.fechaHasta!);
      }

      // Búsqueda
      if (filtros.busqueda) {
        const b = filtros.busqueda.toLowerCase();
        filtrados = filtrados.filter((d) =>
          (d.descripcion ?? '').toLowerCase().includes(b) ||
          d.tipo.toLowerCase().includes(b) ||
          (d.proveedor ?? '').toLowerCase().includes(b) ||
          (d.comprador ?? '').toLowerCase().includes(b)
        );
      }

      // Usuarios
      if (filtros.usuarios.length > 0) {
        filtrados = filtrados.filter((d) => d.usuario && filtros.usuarios.includes(d.usuario));
      }

      // Potreros
      if (filtros.potreros.length > 0) {
        filtrados = filtrados.filter((d) => d.lote && filtros.potreros.includes(d.lote));
      }

      // 🐄 ANIMALES (ahora correcto)
      if (filtros.animales.length > 0) {
        filtrados = filtrados.filter((d) =>
          coincideConFiltroAnimal(d.descripcion ?? '', filtros.animales)
        );
      }

      // Cultivos
      if (filtros.cultivos.length > 0) {
        filtrados = filtrados.filter((d) => {
          const desc = (d.descripcion ?? '').toLowerCase();
          return filtros.cultivos.some(cultivo => desc.includes(cultivo.toLowerCase()));
        });
      }

      filtrados.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());

      setDatos(filtrados);
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