'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

type TipoCampo = 'GANADERO' | 'MIXTO'

interface TipoCampoContextType {
  tipoCampo: TipoCampo
  esMixto: boolean
  esGanadero: boolean
  loading: boolean
  actualizarTipo: (nuevoTipo: TipoCampo) => Promise<void>
}

const TipoCampoContext = createContext<TipoCampoContextType | undefined>(undefined)

export function TipoCampoProvider({ children }: { children: ReactNode }) {
  const [tipoCampo, setTipoCampo] = useState<TipoCampo>('MIXTO')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    cargarTipoCampo()
  }, [])

  async function cargarTipoCampo() {
    try {
      const res = await fetch('/api/campo-actual')
      if (res.ok) {
        const data = await res.json()
        setTipoCampo(data.tipoCampo || 'MIXTO')
      }
    } catch (error) {
      console.error('Error cargando tipo de campo:', error)
    } finally {
      setLoading(false)
    }
  }

  async function actualizarTipo(nuevoTipo: TipoCampo) {
    try {
      const res = await fetch('/api/campos', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipoCampo: nuevoTipo }),
      })

      if (res.ok) {
        setTipoCampo(nuevoTipo)
      }
    } catch (error) {
      console.error('Error actualizando tipo:', error)
      throw error
    }
  }

  return (
    <TipoCampoContext.Provider
      value={{
        tipoCampo,
        esMixto: tipoCampo === 'MIXTO',
        esGanadero: tipoCampo === 'GANADERO',
        loading,
        actualizarTipo,
      }}
    >
      {children}
    </TipoCampoContext.Provider>
  )
}

export function useTipoCampo() {
  const context = useContext(TipoCampoContext)
  if (!context) {
    throw new Error('useTipoCampo debe usarse dentro de TipoCampoProvider')
  }
  return context
}