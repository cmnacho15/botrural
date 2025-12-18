'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

interface SuperficieContextType {
  usarSPG: boolean
  setUsarSPG: (value: boolean) => void
}

const SuperficieContext = createContext<SuperficieContextType | undefined>(undefined)

export function SuperficieProvider({ children }: { children: ReactNode }) {
  const [usarSPG, setUsarSPGState] = useState(false)

  // Cargar desde localStorage al montar
  useEffect(() => {
    const saved = localStorage.getItem('usarSPG')
    if (saved !== null) {
      setUsarSPGState(saved === 'true')
    }
  }, [])

  // Wrapper que guarda en localStorage cuando cambia
  const setUsarSPG = (value: boolean) => {
    setUsarSPGState(value)
    localStorage.setItem('usarSPG', value.toString())
  }

  return (
    <SuperficieContext.Provider value={{ usarSPG, setUsarSPG }}>
      {children}
    </SuperficieContext.Provider>
  )
}

export function useSuperficie() {
  const context = useContext(SuperficieContext)
  if (!context) {
    throw new Error('useSuperficie debe usarse dentro de SuperficieProvider')
  }
  return context
}