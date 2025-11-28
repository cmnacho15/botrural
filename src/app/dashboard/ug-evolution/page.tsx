import EvolucionUGDashboard from '@/app/components/EvolucionUGDashboard'
import Link from 'next/link'

export default function UGEvolutionPage() {
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* 👇 BOTÓN DE VOLVER */}
      <div className="mb-6">
        <Link
          href="/dashboard/lotes"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 shadow-sm transition text-sm font-medium"
        >
          <span className="text-lg">←</span> Volver a Potreros
        </Link>
      </div>

      <EvolucionUGDashboard />
    </div>
  )
}