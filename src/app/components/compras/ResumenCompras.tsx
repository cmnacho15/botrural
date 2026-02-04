'use client'

interface ResumenComprasProps {
  resumen: {
    bovino: Array<{
      categoria: string
      cantidad: number
      precioKg: number
      pesoPromedio: number
      precioAnimal: number
      pesoTotal: number
      importeBruto: number
    }>
    ovino: Array<{
      categoria: string
      cantidad: number
      precioKg: number
      pesoPromedio: number
      precioAnimal: number
      pesoTotal: number
      importeBruto: number
    }>
    totales: {
      bovino: {
        cantidad: number
        pesoTotal: number
        importeBruto: number
        precioKg: number
        pesoPromedio: number
        precioAnimal: number
      }
      ovino: {
        cantidad: number
        pesoTotal: number
        importeBruto: number
        precioKg: number
        pesoPromedio: number
        precioAnimal: number
      }
      general: {
        cantidad: number
        pesoTotal: number
        importeBruto: number
      }
    }
  }
}

export default function ResumenCompras({ resumen }: ResumenComprasProps) {
  const formatNumber = (num: number) => {
    return num.toLocaleString('es-UY', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* TABLA BOVINO */}
      {resumen.bovino.length > 0 && (
        <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
          <div className="bg-yellow-400 px-3 sm:px-6 py-2 sm:py-3">
            <h2 className="text-sm sm:text-lg font-bold text-gray-900">BOVINO</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[500px]">
              <thead className="bg-gray-100 border-b border-gray-200">
                <tr>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-600 uppercase">Categoría</th>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-right text-[10px] sm:text-xs font-medium text-gray-600 uppercase">Nº Anim.</th>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-right text-[10px] sm:text-xs font-medium text-gray-600 uppercase">US$/kg</th>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-right text-[10px] sm:text-xs font-medium text-gray-600 uppercase">Peso</th>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-right text-[10px] sm:text-xs font-medium text-gray-600 uppercase">US$/cab</th>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-right text-[10px] sm:text-xs font-medium text-gray-600 uppercase">kg Tot.</th>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-right text-[10px] sm:text-xs font-medium text-gray-600 uppercase">US$ Bruto</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {resumen.bovino.map((item, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm font-medium text-gray-900">{item.categoria}</td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-right text-xs sm:text-sm text-gray-700">{item.cantidad}</td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-right text-xs sm:text-sm text-gray-700">{formatNumber(item.precioKg)}</td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-right text-xs sm:text-sm text-gray-700">{formatNumber(item.pesoPromedio)}</td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-right text-xs sm:text-sm text-gray-700">{formatNumber(item.precioAnimal)}</td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-right text-xs sm:text-sm text-gray-700">{formatNumber(item.pesoTotal)}</td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-right text-xs sm:text-sm font-semibold text-gray-900">{formatNumber(item.importeBruto)}</td>
                  </tr>
                ))}
                {/* TOTAL BOVINO */}
                <tr className="bg-gray-100 font-bold">
                  <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-gray-900">TOTAL</td>
                  <td className="px-2 sm:px-4 py-2 sm:py-3 text-right text-xs sm:text-sm text-gray-900">{resumen.totales.bovino.cantidad}</td>
                  <td className="px-2 sm:px-4 py-2 sm:py-3 text-right text-xs sm:text-sm text-gray-900">{formatNumber(resumen.totales.bovino.precioKg)}</td>
                  <td className="px-2 sm:px-4 py-2 sm:py-3 text-right text-xs sm:text-sm text-gray-900">{formatNumber(resumen.totales.bovino.pesoPromedio)}</td>
                  <td className="px-2 sm:px-4 py-2 sm:py-3 text-right text-xs sm:text-sm text-gray-900">{formatNumber(resumen.totales.bovino.precioAnimal)}</td>
                  <td className="px-2 sm:px-4 py-2 sm:py-3 text-right text-xs sm:text-sm text-gray-900">{formatNumber(resumen.totales.bovino.pesoTotal)}</td>
                  <td className="px-2 sm:px-4 py-2 sm:py-3 text-right text-xs sm:text-sm text-gray-900">{formatNumber(resumen.totales.bovino.importeBruto)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TABLA OVINO */}
      {resumen.ovino.length > 0 && (
        <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
          <div className="bg-yellow-400 px-3 sm:px-6 py-2 sm:py-3">
            <h2 className="text-sm sm:text-lg font-bold text-gray-900">OVINO</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[500px]">
              <thead className="bg-gray-100 border-b border-gray-200">
                <tr>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-600 uppercase">Categoría</th>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-right text-[10px] sm:text-xs font-medium text-gray-600 uppercase">Nº Anim.</th>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-right text-[10px] sm:text-xs font-medium text-gray-600 uppercase">US$/kg</th>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-right text-[10px] sm:text-xs font-medium text-gray-600 uppercase">Peso</th>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-right text-[10px] sm:text-xs font-medium text-gray-600 uppercase">US$/cab</th>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-right text-[10px] sm:text-xs font-medium text-gray-600 uppercase">kg Tot.</th>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-right text-[10px] sm:text-xs font-medium text-gray-600 uppercase">US$ Bruto</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {resumen.ovino.map((item, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm font-medium text-gray-900">{item.categoria}</td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-right text-xs sm:text-sm text-gray-700">{item.cantidad}</td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-right text-xs sm:text-sm text-gray-700">{formatNumber(item.precioKg)}</td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-right text-xs sm:text-sm text-gray-700">{formatNumber(item.pesoPromedio)}</td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-right text-xs sm:text-sm text-gray-700">{formatNumber(item.precioAnimal)}</td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-right text-xs sm:text-sm text-gray-700">{formatNumber(item.pesoTotal)}</td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-right text-xs sm:text-sm font-semibold text-gray-900">{formatNumber(item.importeBruto)}</td>
                  </tr>
                ))}
                {/* TOTAL OVINO */}
                <tr className="bg-gray-100 font-bold">
                  <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-gray-900">TOTAL</td>
                  <td className="px-2 sm:px-4 py-2 sm:py-3 text-right text-xs sm:text-sm text-gray-900">{resumen.totales.ovino.cantidad}</td>
                  <td className="px-2 sm:px-4 py-2 sm:py-3 text-right text-xs sm:text-sm text-gray-900">{formatNumber(resumen.totales.ovino.precioKg)}</td>
                  <td className="px-2 sm:px-4 py-2 sm:py-3 text-right text-xs sm:text-sm text-gray-900">{formatNumber(resumen.totales.ovino.pesoPromedio)}</td>
                  <td className="px-2 sm:px-4 py-2 sm:py-3 text-right text-xs sm:text-sm text-gray-900">{formatNumber(resumen.totales.ovino.precioAnimal)}</td>
                  <td className="px-2 sm:px-4 py-2 sm:py-3 text-right text-xs sm:text-sm text-gray-900">{formatNumber(resumen.totales.ovino.pesoTotal)}</td>
                  <td className="px-2 sm:px-4 py-2 sm:py-3 text-right text-xs sm:text-sm text-gray-900">{formatNumber(resumen.totales.ovino.importeBruto)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TOTAL GENERAL */}
      <div className="bg-white rounded-xl shadow-md border-2 border-gray-900 overflow-hidden">
        <div className="bg-gray-900 px-3 sm:px-6 py-2 sm:py-3">
          <h2 className="text-sm sm:text-lg font-bold text-white">TOTAL GENERAL</h2>
        </div>
        <div className="p-3 sm:p-6">
          <div className="grid grid-cols-3 gap-2 sm:gap-6">
            <div className="text-center">
              <p className="text-[10px] sm:text-sm text-gray-600 mb-1">Total Animales</p>
              <p className="text-lg sm:text-3xl font-bold text-gray-900">{resumen.totales.general.cantidad}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] sm:text-sm text-gray-600 mb-1">kg Totales</p>
              <p className="text-lg sm:text-3xl font-bold text-gray-900">{formatNumber(resumen.totales.general.pesoTotal)}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] sm:text-sm text-gray-600 mb-1">US$ Totales Bruto</p>
              <p className="text-lg sm:text-3xl font-bold text-green-600">{formatNumber(resumen.totales.general.importeBruto)}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}