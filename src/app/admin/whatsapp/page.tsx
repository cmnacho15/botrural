'use client'

export default function WhatsAppPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-white mb-2">Bot WhatsApp</h1>
      <p className="text-gray-400 mb-6">Monitoreo de mensajes y actividad del bot</p>

      <div className="bg-gray-800 rounded-xl p-12 border border-gray-700 text-center">
        <span className="text-6xl">🚧</span>
        <p className="text-gray-400 mt-4">En construcción - Fase 2</p>
        <p className="text-gray-500 text-sm mt-2">
          Aquí verás estadísticas de mensajes, usuarios activos del bot y errores.
        </p>
      </div>
    </div>
  )
}
