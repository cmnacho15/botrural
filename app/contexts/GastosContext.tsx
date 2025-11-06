'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

type Gasto = {
  id: string
  tipo: string
  monto: number
  fecha: string
  descripcion?: string
  categoria: string
  metodoPago?: string
  lote?: any
}

type GastosContextType = {
  gastos: Gasto[]
  isLoading: boolean
  error: string | null
  refreshGastos: () => Promise<void>
  addGasto: (data: any) => Promise<boolean>
  deleteGasto: (id: string) => Promise<boolean>
}

const GastosContext = createContext<GastosContextType | undefined>(undefined)

export function GastosProvider({ children }: { children: ReactNode }) {
  const [gastos, setGastos] = useState<Gasto[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchGastos = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/gastos', {
        cache: 'no-store',
      })
      
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`)
      }
      
      const data = await res.json()
      console.log('✅ Gastos cargados:', data.length)
      setGastos(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('❌ Error cargando gastos:', error)
      setError('Error al cargar los gastos')
      setGastos([])
    } finally {
      setIsLoading(false)
    }
  }

  const refreshGastos = async () => {
    await fetchGastos()
  }

  const addGasto = async (data: any): Promise<boolean> => {
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
      }}
    >
      {children}
    </GastosContext.Provider>
  )
}

export function useGastos() {
  const context = useContext(GastosContext)
  if (context === undefined) {
    throw new Error('useGastos debe ser usado dentro de GastosProvider')
  }
  return context
}