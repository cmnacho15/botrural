'use client'

import { useState, useEffect } from 'react'
import {
  ModalLluvia,
  ModalHelada,
  ModalGasto,
  ModalIngreso,
  ModalUsoInsumos,
  ModalIngresoInsumos,
  ModalSiembra,
  ModalNacimiento,
  ModalCambioPotrero,
  ModalRecategorizacion,
} from '@/app/components/modales'

type ModalNuevoDatoProps = {
  isOpen: boolean
  onClose: () => void
  tipo: string
  onSuccess: () => void
}

export default function ModalNuevoDato({
  isOpen,
  onClose,
  tipo,
  onSuccess,
}: ModalNuevoDatoProps) {
  const [lotes, setLotes] = useState([])

  useEffect(() => {
    if (isOpen && tipo === 'recategorizacion') {
      // Cargar lotes desde la API
      fetch('/api/lotes')
        .then((res) => res.json())
        .then((data) => setLotes(data))
        .catch((err) => console.error('Error cargando lotes:', err))
    }
  }, [isOpen, tipo])

  if (!isOpen) return null

  const handleSuccess = () => {
    onSuccess()
    window.location.reload()
  }

  const handleSubmit = async (data: any) => {
  // ModalRecategorizacion maneja su propio submit, no necesita este handler
  if (tipo === 'recategorizacion') {
    return
  }

  try {
    const response = await fetch('/api/eventos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })

    if (!response.ok) throw new Error('Error al crear evento')

    handleSuccess()
  } catch (error) {
    console.error('Error:', error)
    alert('Error al crear el evento')
  }
}

  return (
    <div className="fixed inset-0 backdrop-blur-md bg-white/30 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {tipo === 'lluvia' && <ModalLluvia onClose={onClose} onSuccess={handleSuccess} />}
        {tipo === 'helada' && <ModalHelada onClose={onClose} onSuccess={handleSuccess} />}
        {tipo === 'gasto' && <ModalGasto onClose={onClose} onSuccess={handleSuccess} />}
        {tipo === 'ingreso' && <ModalIngreso onClose={onClose} onSuccess={handleSuccess} />}
        {tipo === 'uso-insumos' && <ModalUsoInsumos onClose={onClose} onSuccess={handleSuccess} />}
        {tipo === 'ingreso-insumos' && <ModalIngresoInsumos onClose={onClose} onSuccess={handleSuccess} />}
        {tipo === 'siembra' && <ModalSiembra onClose={onClose} onSuccess={handleSuccess} />}
        {tipo === 'cambio-potrero' && <ModalCambioPotrero onClose={onClose} onSuccess={handleSuccess} />}
        {tipo === 'nacimiento' && <ModalNacimiento onClose={onClose} onSuccess={handleSuccess} />}
        
        {tipo === 'recategorizacion' && (
          <ModalRecategorizacion 
            isOpen={isOpen}
            onClose={onClose} 
            onSubmit={handleSubmit}
            lotes={lotes}
            onSuccess={handleSuccess} 
          />
        )}
      </div>
    </div>
  )
}