'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

interface SuperficieContextType {
  usarSPG: boolean
  setUsarSPG: (value: boolean) => void
}

const SuperficieContext = createContext<SuperficieContextType | undefined>(undefined)

export function SuperficieProvider({ children }: { children: ReactNode }) {
  // Inicializar desde localStorage inmediatamente
  const [usarSPG, setUsarSPGState] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('usarSPG')
      return saved === 'true'
    }
    return false
  })

  // Wrapper que guarda en localStorage cuando cambia
  const setUsarSPG = (value: boolean) => {
    setUsarSPGState(value)
    if (typeof window !== 'undefined') {
      localStorage.setItem('usarSPG', value.toString())
    }
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