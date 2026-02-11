import EvolucionUGDashboard from '@/app/components/EvolucionUGDashboard'
import Link from 'next/link'

export default function UGEvolutionPage() {
  return (
    <div className="min-h-screen px-3 py-4 sm:p-6" style={{ backgroundColor: '#f9fafb', colorScheme: 'light' }}>
      {/* 👇 BOTÓN DE VOLVER */}
      <div className="mb-4 sm:mb-6">
        <Link
          href="/dashboard/lotes"
          className="inline-flex items-center gap-2 px-3 py-2 sm:px-4 rounded-lg shadow-sm transition text-sm font-medium"
          style={{ backgroundColor: 'white', border: '1px solid #d1d5db', color: '#374151' }}
        >
          <span className="text-lg">←</span> <span className="hidden sm:inline">Volver a</span> Potreros
        </Link>
      </div>

      <EvolucionUGDashboard />
    </div>
  )
}