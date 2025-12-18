'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

interface SuperficieContextType {
  usarSPG: boolean
  setUsarSPG: (value: boolean) => void
}

const SuperficieContext = createContext<SuperficieContextType | undefined>(undefined)

export function SuperficieProvider({ children }: { children: ReactNode }) {
  const [usarSPG, setUsarSPG] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('usarSPG')
      return saved === 'true'
    }
    return false
  })

  useEffect(() => {
    localStorage.setItem('usarSPG', usarSPG.toString())
  }, [usarSPG])

  return (
    <SuperficieContext.Provider value={{ usarSPG, setUsarSPG }}>
      {children}
    </SuperficieContext.Provider>
  )
}

export function useSuperficie() {
  const context = useContext(SuperficieContext)
  if (!context) {
    throw new Error('useSuperficie must be used within SuperficieProvider')
  }
  return context
}