'use client'

import {
  ModalLluvia,
  ModalHelada,
  ModalGasto,
  ModalIngreso,
  ModalUsoInsumos,
  ModalIngresoInsumos,
  ModalSiembra,
  ModalNacimiento,
} from '@/src/app/components/modales'

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
  if (!isOpen) return null

  // ✅ AGREGAR ESTA FUNCIÓN:
  const handleSuccess = () => {
    onSuccess()
    window.location.reload()
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
        {tipo === 'nacimiento' && <ModalNacimiento onClose={onClose} onSuccess={handleSuccess} />}
      </div>
    </div>
  )
}