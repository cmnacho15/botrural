'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

/** 
 * 🧾 Tipo de dato principal: Gasto o Ingreso
 */
type Gasto = {
  id: string
  tipo: 'GASTO' | 'INGRESO'
  monto: number
  fecha: string
  descripcion?: string
  categoria: string
  metodoPago?: string        // 'Contado' | 'A Plazo'
  diasPlazo?: number | null  // días del plazo (solo si es A Plazo)
  pagado?: boolean           // si está saldado
  proveedor?: string | null  // proveedor o cliente
  lote?: any
}

/**
 * 🎯 Contexto de gastos
 */
type GastosContextType = {
  gastos: Gasto[]
  isLoading: boolean
  error: string | null
  refreshGastos: () => Promise<void>
  addGasto: (data: Partial<Gasto>) => Promise<boolean>
  deleteGasto: (id: string) => Promise<boolean>
  markAsPaid: (id: string) => Promise<boolean>
}

const GastosContext = createContext<GastosContextType | undefined>(undefined)

/**
 * 💰 Provider principal
 */
export function GastosProvider({ children }: { children: ReactNode }) {
  const [gastos, setGastos] = useState<Gasto[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  /**
   * 🧾 Obtener todos los gastos/ingresos desde la API
   */
  const fetchGastos = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/gastos', {
        cache: 'no-store',
      })

      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`)

      const data = await res.json()
      console.log('✅ Gastos cargados:', data.length)

      // ✅ Normalizamos datos por si vienen sin campos nuevos
      const normalizados = Array.isArray(data)
        ? data.map((g) => ({
            ...g,
            metodoPago: g.metodoPago || 'Contado',
            diasPlazo: g.diasPlazo ?? null,
            pagado: g.pagado ?? false,
            proveedor: g.proveedor || null,
          }))
        : []

      setGastos(normalizados)
    } catch (error) {
      console.error('❌ Error cargando gastos:', error)
      setError('Error al cargar los gastos')
      setGastos([])
    } finally {
      setIsLoading(false)
    }
  }

  /**
   * 🔁 Refrescar manualmente
   */
  const refreshGastos = async () => {
    await fetchGastos()
  }

  /**
   * ➕ Agregar nuevo gasto o ingreso
   */
  const addGasto = async (data: Partial<Gasto>): Promise<boolean> => {
    try {
      const res = await fetch('/api/gastos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (res.ok) {
        await refreshGastos()
        return true
      }
      return false
    } catch (error) {
      console.error('Error agregando gasto:', error)
      return false
    }
  }

  /**
   * 🗑️ Eliminar gasto o ingreso
   */
  const deleteGasto = async (id: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/gastos?id=${id}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        await refreshGastos()
        return true
      }
      return false
    } catch (error) {
      console.error('Error eliminando gasto:', error)
      return false
    }
  }

  /**
   * 💵 Marcar gasto/compra como pagado manualmente
   */
  const markAsPaid = async (id: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/gastos/markPaid?id=${id}`, {
        method: 'PATCH',
      })

      if (res.ok) {
        await refreshGastos()
        return true
      }
      return false
    } catch (error) {
      console.error('Error marcando gasto como pagado:', error)
      return false
    }
  }

  useEffect(() => {
    fetchGastos()
  }, [])

  return (
    <GastosContext.Provider
      value={{
        gastos,
        isLoading,
        error,
        refreshGastos,
        addGasto,
        deleteGasto,
        markAsPaid,
      }}
    >
      {children}
    </GastosContext.Provider>
  )
}

/**
 * 🧠 Hook personalizado
 */
export function useGastos() {
  const context = useContext(GastosContext)
  if (context === undefined) {
    throw new Error('useGastos debe ser usado dentro de GastosProvider')
  }
  return context
}