'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type DatoUnificado = {
  id: string;
  fecha: Date;
  tipo: string;
  categoria: 'animales' | 'agricultura' | 'clima' | 'finanzas' | 'insumos';
  categoriaAnimal?: string;  // ✅ AGREGADO
  descripcion: string;
  icono: string;
  color: string;
  usuario?: string;
  lote?: string;
  rodeo?: string;  // ✅ AGREGADO
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
  rodeos: string[];
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
  'Terneros/as': ['Terneros/as', 'Terneros', 'Terneras', 'Terneros/as Mamones'],
  'Terneros': ['Terneros'],  // ✅ AGREGADO
  'Terneras': ['Terneras'],  // ✅ AGREGADO
  'Terneros nacidos': ['Terneros nacidos'],  // ✅ AGREGADO
  'Corderos': ['Corderos DL', 'Corderas DL', 'Corderos/as Mamones', 'Corderos', 'Corderas'],
  'Corderos/as Mamones': ['Corderos/as Mamones'],  // ✅ AGREGADO
  'Borregas': ['Borregas 2–4 dientes', 'Borregas', 'Borregos'],
  'Vacas': ['Vacas'],
  'Vaca Gorda': ['Vaca Gorda'],
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
// 🧠 FUNCIÓN MEJORADA PARA MATCHING
// ===============================
function coincideConFiltroAnimal(
  descripcion: string | undefined,
  categoriaAnimal: string | undefined,  // ✅ AGREGADO
  tipo: string,
  filtrosAnimales: string[]
): boolean {
  if (filtrosAnimales.length === 0) return true;

  const descripcionLower = descripcion?.toLowerCase() || '';
  const categoriaAnimalLower = categoriaAnimal?.toLowerCase() || '';

  // ✅ CASO ESPECIAL: RECATEGORIZACIÓN
  if (tipo === 'RECATEGORIZACION') {
    const match = descripcionLower.match(/de\s+\d+\s+([^a]+?)\s+a\s+([^e]+?)\s+en/);
    
    if (match) {
      const categoriaOrigen = match[1].trim();
      const categoriaDestino = match[2].trim();
      
      return filtrosAnimales.some(categoriaFiltro => {
        const subcategorias = AGRUPACION_ANIMALES[categoriaFiltro] || [categoriaFiltro];
        
        return subcategorias.some(sub => {
          const subLower = sub.toLowerCase();
          return categoriaOrigen.includes(subLower) || 
                 subLower.includes(categoriaOrigen) ||
                 categoriaDestino.includes(subLower) || 
                 subLower.includes(categoriaDestino);
        });
      });
    }
  }

  // ✅ VERIFICAR PRIMERO SI EL categoriaAnimal COINCIDE EXACTAMENTE
  if (categoriaAnimal) {
    const coincideExacto = filtrosAnimales.some(categoriaFiltro => {
      const subcategorias = AGRUPACION_ANIMALES[categoriaFiltro] || [categoriaFiltro];
      return subcategorias.some(sub => 
        sub.toLowerCase() === categoriaAnimalLower ||
        categoriaAnimalLower.includes(sub.toLowerCase()) ||
        sub.toLowerCase().includes(categoriaAnimalLower)
      );
    });
    
    if (coincideExacto) return true;
  }

  // ✅ CASO NORMAL: Buscar en descripción
  return filtrosAnimales.some(categoriaFiltro => {
    const subcategorias = AGRUPACION_ANIMALES[categoriaFiltro] || [categoriaFiltro];
    return subcategorias.some(sub =>
      descripcionLower.includes(sub.toLowerCase()) ||
      sub.toLowerCase().includes(descripcionLower)
    );
  });
}

const DatosContext = createContext<DatosContextType | undefined>(undefined);

export function DatosProvider({ children }: { children: ReactNode }) {
  const [datos, setDatos] = useState<DatoUnificado[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ✅ Estados para categorías y cultivos activos
  const [categoriasActivas, setCategoriasActivas] = useState<string[]>([])
  const [cultivosActivos, setCultivosActivos] = useState<string[]>([])

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
    rodeos: [],
  });

  // ✅ Cargar categorías y cultivos activos al montar
  useEffect(() => {
    // Cargar categorías activas de animales
    fetch('/api/categorias-animal')
      .then(r => r.json())
      .then(categorias => {
        const activas = categorias
          .filter((c: any) => c.activo)
          .map((c: any) => c.nombreSingular)
        setCategoriasActivas(activas)
      })
      .catch(err => console.error('Error cargando categorías:', err))

    // Cargar cultivos activos
    fetch('/api/tipos-cultivo')
      .then(r => r.json())
      .then(cultivos => {
        const nombres = cultivos.map((c: any) => c.nombre)
        setCultivosActivos(nombres)
      })
      .catch(err => console.error('Error cargando cultivos:', err))
  }, [])

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
          (d.comprador ?? '').toLowerCase().includes(b) ||
          (d.categoriaAnimal ?? '').toLowerCase().includes(b)  // ✅ AGREGADO
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

      // 🐄 ANIMALES (con soporte para recategorización y solo activos)
      if (filtros.animales.length > 0) {
        filtrados = filtrados.filter((d) => {
          const descripcion = d.descripcion ?? ''
          const categoriaAnimal = d.categoriaAnimal  // ✅ OBTENER categoriaAnimal
          
          // Verificar que mencione un animal activo O tenga categoriaAnimal activa
          const mencionaAnimalActivo = categoriaAnimal 
            ? categoriasActivas.some(cat => cat.toLowerCase() === categoriaAnimal.toLowerCase())
            : categoriasActivas.some(cat => descripcion.toLowerCase().includes(cat.toLowerCase()))
          
          // Si es evento de animales y no menciona ningún animal activo, no mostrar
          if (!mencionaAnimalActivo && d.categoria === 'animales') return false
          
          // Si menciona un animal activo, verificar si coincide con el filtro
          return coincideConFiltroAnimal(descripcion, categoriaAnimal, d.tipo, filtros.animales)  // ✅ PASAR categoriaAnimal
        });
      }

      // 🌾 CULTIVOS (solo mostrar si están activos)
      if (filtros.cultivos.length > 0) {
        filtrados = filtrados.filter((d) => {
          const desc = (d.descripcion ?? '').toLowerCase();
          
          // Verificar que el cultivo mencionado esté activo
          const mencionaCultivoActivo = cultivosActivos.some(cultivo =>
            desc.includes(cultivo.toLowerCase())
          )
          
          // Si es evento de agricultura y no menciona ningún cultivo activo, no mostrar
          if (!mencionaCultivoActivo && d.categoria === 'agricultura') return false
          
          // Si menciona un cultivo activo, verificar si coincide con el filtro
          return filtros.cultivos.some(cultivo => desc.includes(cultivo.toLowerCase()));
        });
      }

      // 🐮 RODEOS
      if (filtros.rodeos.length > 0) {
        filtrados = filtrados.filter((d) => {
          const rodeoDelDato = d.rodeo;
          if (!rodeoDelDato) return false;
          
          return filtros.rodeos.includes(rodeoDelDato);
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