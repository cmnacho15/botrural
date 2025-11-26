import { getServerSession } from "next-auth"
export const dynamic = 'force-dynamic'

import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { redirect } from "next/navigation"
import Link from "next/link"

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect("/login")
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* BIENVENIDA */}
      <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
          ¡Bienvenido de nuevo, {session.user?.name || "Usuario"}! 👋
        </h1>
        <p className="text-sm sm:text-base text-gray-600">
          Aquí está el resumen de tu campo RODAZO
        </p>
      </div>

      {/* TARJETAS DE RESUMEN */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
        {[
          { icon: "🏞️", label: "Potreros", value: "0", color: "bg-green-100" },
          { icon: "💰", label: "Gastos del mes", value: "$0", color: "bg-blue-100" },
          { icon: "📦", label: "Insumos", value: "0", color: "bg-purple-100" },
          { icon: "📝", label: "Datos registrados", value: "0", color: "bg-yellow-100" },
        ].map((item, i) => (
          <div
            key={i}
            className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6"
          >
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <div
                className={`w-10 h-10 sm:w-12 sm:h-12 rounded-lg ${item.color} flex items-center justify-center text-xl sm:text-2xl`}
              >
                {item.icon}
              </div>
            </div>
            <h3 className="text-xl sm:text-2xl font-bold text-gray-900">{item.value}</h3>
            <p className="text-xs sm:text-sm text-gray-600">{item.label}</p>
          </div>
        ))}
      </div>

      {/* ACCESOS RÁPIDOS */}
      <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
        <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-3 sm:mb-4">Accesos Rápidos</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
          <Link
            href="/dashboard/datos"
            className="flex items-center gap-3 p-3 sm:p-4 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            <span className="text-xl sm:text-2xl">📝</span>
            <div>
              <h3 className="font-semibold text-gray-900 text-sm sm:text-base">Datos</h3>
              <p className="text-xs sm:text-sm text-gray-600">
                Registra información del campo
              </p>
            </div>
          </Link>

          <Link
            href="/dashboard/lotes"
            className="flex items-center gap-3 p-3 sm:p-4 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            <span className="text-xl sm:text-2xl">🏞️</span>
            <div>
              <h3 className="font-semibold text-gray-900 text-sm sm:text-base">Potreros</h3>
              <p className="text-xs sm:text-sm text-gray-600">Gestiona tus potreros</p>
            </div>
          </Link>

          <Link
            href="/dashboard/gastos"
            className="flex items-center gap-3 p-3 sm:p-4 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            <span className="text-xl sm:text-2xl">💰</span>
            <div>
              <h3 className="font-semibold text-gray-900 text-sm sm:text-base">Gastos</h3>
              <p className="text-xs sm:text-sm text-gray-600">Controla tus gastos</p>
            </div>
          </Link>
        </div>
      </div>

      {/* CERRAR SESIÓN */}
      <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
          <div>
            <h3 className="font-semibold text-gray-900 text-sm sm:text-base">Sesión activa</h3>
            <p className="text-xs sm:text-sm text-gray-600">{session.user?.email}</p>
          </div>
          <Link
            href="/api/auth/signout"
            className="w-full sm:w-auto text-center px-4 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors text-sm sm:text-base"
          >
            Cerrar Sesión
          </Link>
        </div>
      </div>
    </div>
  )
}