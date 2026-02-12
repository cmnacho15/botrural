//src/app/components/ventas/resumenventas.tsx
'use client'

import { useState } from 'react'
import { useTipoCampo } from '@/app/contexts/TipoCampoContext'

interface ResumenVentasProps {
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
    lana: Array<{
      categoria: string
      pesoKg: number
      precioKg: number
      importeBruto: number
    }>
    granos?: Array<{
      cultivo: string
      hectareas: number
      toneladas: number
      precioTonelada: number
      precioHa: number
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
      lana?: {
        pesoTotal: number
        importeBruto: number
        precioKg: number
      }
      granos?: {
        hectareas: number
        toneladas: number
        importeBruto: number
        precioTonelada: number
        precioHa: number
      }
      general: {
        cantidad: number
        pesoTotal: number
        importeBruto: number
      }
    }
  }
}

export default function ResumenVentas({ resumen }: ResumenVentasProps) {
  const { esMixto } = useTipoCampo()
  const [cultivosExpandidos, setCultivosExpandidos] = useState<Set<string>>(new Set())

  const toggleCultivo = (cultivo: string) => {
    setCultivosExpandidos(prev => {
      const nuevo = new Set(prev)
      if (nuevo.has(cultivo)) {
        nuevo.delete(cultivo)
      } else {
        nuevo.add(cultivo)
      }
      return nuevo
    })
  }

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
            <table className="min-w-[600px] sm:min-w-full">
              <thead className="bg-gray-100 border-b border-gray-200">
                <tr>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-600 uppercase">Categoría</th>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-right text-[10px] sm:text-xs font-medium text-gray-600 uppercase">Nº Anim.</th>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-right text-[10px] sm:text-xs font-medium text-gray-600 uppercase">US$/kg</th>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-right text-[10px] sm:text-xs font-medium text-gray-600 uppercase">kg/anim</th>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-right text-[10px] sm:text-xs font-medium text-gray-600 uppercase">US$/anim</th>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-right text-[10px] sm:text-xs font-medium text-gray-600 uppercase">kg tot.</th>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-right text-[10px] sm:text-xs font-medium text-gray-600 uppercase">US$ bruto</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {resumen.bovino.map((item, idx) => {
                  const esBonificacion = item.categoria === "Bonificaciones"
                  return (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-2 sm:px-4 py-2 sm:py-3 font-medium text-gray-900 text-xs sm:text-sm">{item.categoria}</td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-right text-gray-700 text-xs sm:text-sm">
                      {esBonificacion ? '-' : item.cantidad}
                    </td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-right text-gray-700 text-xs sm:text-sm">
                      {esBonificacion ? '-' : formatNumber(item.precioKg)}
                    </td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-right text-gray-700 text-xs sm:text-sm">
                      {esBonificacion ? '-' : formatNumber(item.pesoPromedio)}
                    </td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-right text-gray-700 text-xs sm:text-sm">
                      {esBonificacion ? '-' : formatNumber(item.precioAnimal)}
                    </td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-right text-gray-700 text-xs sm:text-sm">
                      {esBonificacion ? '-' : formatNumber(item.pesoTotal)}
                    </td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-right font-semibold text-gray-900 text-xs sm:text-sm">{formatNumber(item.importeBruto)}</td>
                  </tr>
                  )
                })}
                {/* TOTAL BOVINO */}
                <tr className="bg-gray-100 font-bold">
                  <td className="px-2 sm:px-4 py-2 sm:py-3 text-gray-900 text-xs sm:text-sm">TOTAL</td>
                  <td className="px-2 sm:px-4 py-2 sm:py-3 text-right text-gray-900 text-xs sm:text-sm">{resumen.totales.bovino.cantidad}</td>
                  <td className="px-2 sm:px-4 py-2 sm:py-3 text-right text-gray-900 text-xs sm:text-sm">{formatNumber(resumen.totales.bovino.precioKg)}</td>
                  <td className="px-2 sm:px-4 py-2 sm:py-3 text-right text-gray-900 text-xs sm:text-sm">{formatNumber(resumen.totales.bovino.pesoPromedio)}</td>
                  <td className="px-2 sm:px-4 py-2 sm:py-3 text-right text-gray-900 text-xs sm:text-sm">{formatNumber(resumen.totales.bovino.precioAnimal)}</td>
                  <td className="px-2 sm:px-4 py-2 sm:py-3 text-right text-gray-900 text-xs sm:text-sm">{formatNumber(resumen.totales.bovino.pesoTotal)}</td>
                  <td className="px-2 sm:px-4 py-2 sm:py-3 text-right text-gray-900 text-xs sm:text-sm">{formatNumber(resumen.totales.bovino.importeBruto)}</td>
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
            <table className="min-w-[600px] sm:min-w-full">
              <thead className="bg-gray-100 border-b border-gray-200">
                <tr>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-600 uppercase">Categoría</th>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-right text-[10px] sm:text-xs font-medium text-gray-600 uppercase">Nº Anim.</th>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-right text-[10px] sm:text-xs font-medium text-gray-600 uppercase">US$/kg</th>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-right text-[10px] sm:text-xs font-medium text-gray-600 uppercase">kg/anim</th>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-right text-[10px] sm:text-xs font-medium text-gray-600 uppercase">US$/anim</th>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-right text-[10px] sm:text-xs font-medium text-gray-600 uppercase">kg tot.</th>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-right text-[10px] sm:text-xs font-medium text-gray-600 uppercase">US$ bruto</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {resumen.ovino.map((item, idx) => {
                  const esBonificacion = item.categoria === "Bonificaciones"
                  return (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-2 sm:px-4 py-2 sm:py-3 font-medium text-gray-900 text-xs sm:text-sm">{item.categoria}</td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-right text-gray-700 text-xs sm:text-sm">
                      {esBonificacion ? '-' : item.cantidad}
                    </td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-right text-gray-700 text-xs sm:text-sm">
                      {esBonificacion ? '-' : formatNumber(item.precioKg)}
                    </td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-right text-gray-700 text-xs sm:text-sm">
                      {esBonificacion ? '-' : formatNumber(item.pesoPromedio)}
                    </td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-right text-gray-700 text-xs sm:text-sm">
                      {esBonificacion ? '-' : formatNumber(item.precioAnimal)}
                    </td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-right text-gray-700 text-xs sm:text-sm">
                      {esBonificacion ? '-' : formatNumber(item.pesoTotal)}
                    </td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-right font-semibold text-gray-900 text-xs sm:text-sm">{formatNumber(item.importeBruto)}</td>
                  </tr>
                  )
                })}
                {/* TOTAL OVINO */}
                <tr className="bg-gray-100 font-bold">
                  <td className="px-2 sm:px-4 py-2 sm:py-3 text-gray-900 text-xs sm:text-sm">TOTAL</td>
                  <td className="px-2 sm:px-4 py-2 sm:py-3 text-right text-gray-900 text-xs sm:text-sm">{resumen.totales.ovino.cantidad}</td>
                  <td className="px-2 sm:px-4 py-2 sm:py-3 text-right text-gray-900 text-xs sm:text-sm">{formatNumber(resumen.totales.ovino.precioKg)}</td>
                  <td className="px-2 sm:px-4 py-2 sm:py-3 text-right text-gray-900 text-xs sm:text-sm">{formatNumber(resumen.totales.ovino.pesoPromedio)}</td>
                  <td className="px-2 sm:px-4 py-2 sm:py-3 text-right text-gray-900 text-xs sm:text-sm">{formatNumber(resumen.totales.ovino.precioAnimal)}</td>
                  <td className="px-2 sm:px-4 py-2 sm:py-3 text-right text-gray-900 text-xs sm:text-sm">{formatNumber(resumen.totales.ovino.pesoTotal)}</td>
                  <td className="px-2 sm:px-4 py-2 sm:py-3 text-right text-gray-900 text-xs sm:text-sm">{formatNumber(resumen.totales.ovino.importeBruto)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TABLA LANA */}
      {resumen.lana.length > 0 && (
        <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
          <div className="bg-cyan-400 px-3 sm:px-6 py-2 sm:py-3">
            <h2 className="text-sm sm:text-lg font-bold text-gray-900">LANA</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[400px] sm:min-w-full">
              <thead className="bg-gray-100 border-b border-gray-200">
                <tr>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-600 uppercase">Categoría</th>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-right text-[10px] sm:text-xs font-medium text-gray-600 uppercase">kg totales</th>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-right text-[10px] sm:text-xs font-medium text-gray-600 uppercase">US$/kg</th>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-right text-[10px] sm:text-xs font-medium text-gray-600 uppercase">US$ bruto</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {resumen.lana.map((item, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-2 sm:px-4 py-2 sm:py-3 font-medium text-gray-900 text-xs sm:text-sm">{item.categoria}</td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-right text-gray-700 text-xs sm:text-sm">{formatNumber(item.pesoKg)}</td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-right text-gray-700 text-xs sm:text-sm">{formatNumber(item.precioKg)}</td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-right font-semibold text-gray-900 text-xs sm:text-sm">{formatNumber(item.importeBruto)}</td>
                  </tr>
                ))}
                {/* TOTAL LANA */}
                <tr className="bg-gray-100 font-bold">
                  <td className="px-2 sm:px-4 py-2 sm:py-3 text-gray-900 text-xs sm:text-sm">TOTAL</td>
                  <td className="px-2 sm:px-4 py-2 sm:py-3 text-right text-gray-900 text-xs sm:text-sm">
                    {formatNumber(resumen.lana.reduce((sum, item) => sum + item.pesoKg, 0))}
                  </td>
                  <td className="px-2 sm:px-4 py-2 sm:py-3 text-right text-gray-900 text-xs sm:text-sm">
                    {formatNumber(
                      resumen.lana.reduce((sum, item) => sum + item.importeBruto, 0) /
                      resumen.lana.reduce((sum, item) => sum + item.pesoKg, 0)
                    )}
                  </td>
                  <td className="px-2 sm:px-4 py-2 sm:py-3 text-right text-gray-900 text-xs sm:text-sm">
                    {formatNumber(resumen.lana.reduce((sum, item) => sum + item.importeBruto, 0))}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TABLA GRANOS - Solo para campos mixtos */}
      {esMixto && resumen.granos && resumen.granos.length > 0 && (
        <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
          <div className="bg-green-400 px-3 sm:px-6 py-2 sm:py-3">
            <h2 className="text-sm sm:text-lg font-bold text-gray-900">🌾 GRANOS</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[600px] sm:min-w-full">
              <thead className="bg-gray-100 border-b border-gray-200">
                <tr>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-600 uppercase">Cultivo</th>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-right text-[10px] sm:text-xs font-medium text-gray-600 uppercase">Ha</th>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-right text-[10px] sm:text-xs font-medium text-gray-600 uppercase">Ton</th>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-right text-[10px] sm:text-xs font-medium text-gray-600 uppercase">Ton/Ha</th>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-right text-[10px] sm:text-xs font-medium text-gray-600 uppercase">US$/Ton</th>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-right text-[10px] sm:text-xs font-medium text-gray-600 uppercase">US$/Ha</th>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-right text-[10px] sm:text-xs font-medium text-gray-600 uppercase">US$ bruto</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {resumen.granos.map((item, idx) => {
                  const tonPorHa = item.hectareas > 0 ? item.toneladas / item.hectareas : 0
                  return (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-2 sm:px-4 py-2 sm:py-3 font-medium text-gray-900 text-xs sm:text-sm">🌾 {item.cultivo}</td>
                      <td className="px-2 sm:px-4 py-2 sm:py-3 text-right text-gray-700 text-xs sm:text-sm">{formatNumber(item.hectareas)}</td>
                      <td className="px-2 sm:px-4 py-2 sm:py-3 text-right text-gray-700 text-xs sm:text-sm">{formatNumber(item.toneladas)}</td>
                      <td className="px-2 sm:px-4 py-2 sm:py-3 text-right text-gray-700 text-xs sm:text-sm">{formatNumber(tonPorHa)}</td>
                      <td className="px-2 sm:px-4 py-2 sm:py-3 text-right text-gray-700 text-xs sm:text-sm">{formatNumber(item.precioTonelada)}</td>
                      <td className="px-2 sm:px-4 py-2 sm:py-3 text-right text-gray-700 text-xs sm:text-sm">{formatNumber(item.precioHa)}</td>
                      <td className="px-2 sm:px-4 py-2 sm:py-3 text-right font-semibold text-gray-900 text-xs sm:text-sm">{formatNumber(item.importeBruto)}</td>
                    </tr>
                  )
                })}
                {/* TOTAL GRANOS */}
                {resumen.totales.granos && (
                  <tr className="bg-gray-100 font-bold">
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-gray-900 text-xs sm:text-sm">TOTAL</td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-right text-gray-900 text-xs sm:text-sm">{formatNumber(resumen.totales.granos.hectareas)}</td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-right text-gray-900 text-xs sm:text-sm">{formatNumber(resumen.totales.granos.toneladas)}</td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-right text-gray-900 text-xs sm:text-sm">
                      {formatNumber(resumen.totales.granos.hectareas > 0 ? resumen.totales.granos.toneladas / resumen.totales.granos.hectareas : 0)}
                    </td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-right text-gray-900 text-xs sm:text-sm">{formatNumber(resumen.totales.granos.precioTonelada)}</td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-right text-gray-900 text-xs sm:text-sm">{formatNumber(resumen.totales.granos.precioHa)}</td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-right text-gray-900 text-xs sm:text-sm">{formatNumber(resumen.totales.granos.importeBruto)}</td>
                  </tr>
                )}
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
              <p className="text-[10px] sm:text-sm text-gray-600 mb-1">US$ Bruto</p>
              <p className="text-lg sm:text-3xl font-bold text-blue-600">{formatNumber(resumen.totales.general.importeBruto)}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}