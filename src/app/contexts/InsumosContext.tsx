'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

type Movimiento = {
  id: string
  tipo: 'INGRESO' | 'USO'
  cantidad: number
  fecha: string
  notas?: string | null
}

type Insumo = {
  id: string
  nombre: string
  unidad: string
  stock: number
  orden?: number  // 👈 NUEVO
  movimientos?: Movimiento[]
}

type InsumosContextType = {
  insumos: Insumo[]
  isLoading: boolean
  error: string | null
  refreshInsumos: () => Promise<void>
  addInsumo: (nombre: string, unidad: string) => Promise<boolean>
  registrarMovimiento: (
    insumoId: string,
    tipo: 'INGRESO' | 'USO',
    cantidad: string,
    fecha: string,
    notas: string,
    loteId?: string
  ) => Promise<boolean>
  updateInsumosOrder: (orderedIds: string[]) => Promise<boolean>  // 👈 NUEVO
}

const InsumosContext = createContext<InsumosContextType | undefined>(undefined)

export function InsumosProvider({ children }: { children: ReactNode }) {
  const [insumos, setInsumos] = useState<Insumo[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // 🔹 Cargar insumos desde la API
  const fetchInsumos = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/insumos', {
        cache: 'no-store',
        credentials: 'include',
      })

      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const data = await res.json()
      setInsumos(Array.isArray(data) ? data : [])
      console.log(`✅ Insumos cargados (${data.length})`)
    } catch (error) {
      console.error('❌ Error cargando insumos:', error)
      setError('Error al cargar los insumos')
      setInsumos([])
    } finally {
      setIsLoading(false)
    }
  }

  const refreshInsumos = async () => {
    await fetchInsumos()
  }

  // 🔹 Crear nuevo insumo
  const addInsumo = async (nombre: string, unidad: string): Promise<boolean> => {
    try {
      console.log('📤 Creando nuevo insumo...', { nombre, unidad })

      const res = await fetch('/api/insumos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre, unidad }),
        credentials: 'include',
      })

      if (!res.ok) throw new Error(`Error HTTP ${res.status}`)

      const nuevo = await res.json()
      console.log('✅ Insumo creado en backend:', nuevo)

      setInsumos((prev) => [nuevo, ...prev])
      return true
    } catch (error) {
      console.error('❌ Error agregando insumo:', error)
      setError('No se pudo agregar el insumo')
      return false
    }
  }

  // 🔹 Registrar movimiento (uso o ingreso)
  const registrarMovimiento = async (
    insumoId: string,
    tipo: 'INGRESO' | 'USO',
    cantidad: string,
    fecha: string,
    notas: string,
    loteId?: string
  ): Promise<boolean> => {
    try {
      console.log('📤 Enviando movimiento...', {
        tipo,
        cantidad,
        fecha,
        notas,
        insumoId,
        loteId,
      })

      const res = await fetch('/api/insumos/movimientos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo,
          cantidad,
          fecha,
          notas,
          insumoId,
          loteId: loteId || null,
        }),
        credentials: 'include',
      })

      const data = await res.json()
      console.log('📩 Respuesta backend movimiento:', data)

      if (!res.ok) {
        console.warn('⚠️ Error del servidor al registrar movimiento:', data)
        setError(data.error || 'Error registrando movimiento de insumo')
        return false
      }

      console.log('🔄 Recargando insumos después del movimiento...')
      await refreshInsumos()

      console.log(`✅ Movimiento registrado y datos actualizados`)
      return true
    } catch (error) {
      console.error('❌ Error registrando movimiento:', error)
      setError('Error registrando movimiento de insumo')
      return false
    }
  }

  // 🔹 NUEVO: Actualizar orden de insumos
  const updateInsumosOrder = async (orderedIds: string[]): Promise<boolean> => {
    try {
      console.log('📤 Actualizando orden de insumos...', orderedIds)

      const res = await fetch('/api/insumos/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderedIds }),
        credentials: 'include',
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Error actualizando orden')
      }

      console.log('✅ Orden actualizado en backend')
      
      // Refrescar insumos para obtener el orden actualizado
      await refreshInsumos()
      
      return true
    } catch (error) {
      console.error('❌ Error actualizando orden:', error)
      setError('No se pudo actualizar el orden')
      return false
    }
  }

  // Cargar al inicio
  useEffect(() => {
    fetchInsumos()
  }, [])

  return (
    <InsumosContext.Provider
      value={{
        insumos,
        isLoading,
        error,
        refreshInsumos,
        addInsumo,
        registrarMovimiento,
        updateInsumosOrder,  // 👈 NUEVO
      }}
    >
      {children}
    </InsumosContext.Provider>
  )
}

export function useInsumos() {
  const context = useContext(InsumosContext)
  if (context === undefined) {
    throw new Error('useInsumos debe ser usado dentro de un <InsumosProvider>')
  }
  return context
}