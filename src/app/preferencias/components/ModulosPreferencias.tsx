'use client'

import { useState, useEffect } from 'react'

export default function ModulosPreferencias() {
  const [estado, setEstado] = useState('cargando')
  const [datos, setDatos] = useState<any>(null)

  useEffect(() => {
    console.log('🚀 ModulosPreferencias montado')
    
    fetch('/api/modulos-pastoreo')
      .then(res => {
        console.log('📡 Response status:', res.status)
        return res.json()
      })
      .then(data => {
        console.log('📦 Datos recibidos:', data)
        setDatos(data)
        setEstado('ok')
      })
      .catch(err => {
        console.error('❌ Error:', err)
        setEstado('error')
      })
  }, [])

  console.log('🎨 Renderizando, estado:', estado)

  return (
    <div className="p-6 bg-yellow-50 border-2 border-yellow-500 rounded-lg">
      <h2 className="text-2xl font-bold mb-4">DEBUG - Módulos de Pastoreo</h2>
      
      <div className="space-y-2 text-sm">
        <p><strong>Estado:</strong> {estado}</p>
        <p><strong>Datos:</strong></p>
        <pre className="bg-white p-2 rounded text-xs overflow-auto">
          {JSON.stringify(datos, null, 2)}
        </pre>
      </div>

      {estado === 'cargando' && <p className="mt-4 text-blue-600">⏳ Cargando...</p>}
      {estado === 'error' && <p className="mt-4 text-red-600">❌ ERROR - Ver consola (F12)</p>}
      {estado === 'ok' && <p className="mt-4 text-green-600">✅ Datos cargados correctamente</p>}
    </div>
  )
}