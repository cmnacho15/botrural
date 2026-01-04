// lib/costos/categoriasCostos.ts

/**
 * ✅ CATEGORÍAS DE COSTOS VARIABLES DIRECTOS
 * Se asignan 100% a la especie indicada (campo especie en gasto)
 */
export const CATEGORIAS_VARIABLES = [
  // 🐄 GANADERÍA
  'Alimentación',
  'Genética',
  'Sanidad y Manejo',
  'Insumos Pasturas',
  
  // 🌾 AGRICULTURA
  'Insumos de Cultivos',
  
  // 🔀 MIXTOS
  'Combustible',
  'Flete',
  'Labores',
  
  // 🤖 AUTOMÁTICOS
  'Gastos Comerciales',
] as const

/**
 * ✅ CATEGORÍAS DE COSTOS FIJOS
 * Se distribuyen automáticamente según % UG
 */
export const CATEGORIAS_FIJAS = [
  // 🏢 FIJOS PUROS
  'Administración',
  'Asesoramiento',
  'Impuestos',
  'Seguros',
  'Estructuras',
  'Otros',
  
  // 🔧 FIJOS ASIGNABLES
  'Sueldos',
  'Maquinaria',
  'Electricidad',
  'Mantenimiento',
] as const

/**
 * ✅ CATEGORÍAS DE COSTOS FINANCIEROS
 */
export const CATEGORIAS_FINANCIERAS = [
  'Renta',
  'Intereses',
] as const

/**
 * Tipos de especie válidos para asignación de costos variables
 */
export const ESPECIES_VALIDAS = ['VACUNOS', 'OVINOS', 'EQUINOS'] as const

export type CategoriaVariable = typeof CATEGORIAS_VARIABLES[number]
export type CategoriaFija = typeof CATEGORIAS_FIJAS[number]
export type CategoriaFinanciera = typeof CATEGORIAS_FINANCIERAS[number]
export type EspecieValida = typeof ESPECIES_VALIDAS[number]

/**
 * Verifica si una categoría es variable (requiere especie)
 */
export function esCategoriaVariable(categoria: string): boolean {
  return CATEGORIAS_VARIABLES.includes(categoria as CategoriaVariable)
}

/**
 * Verifica si una categoría es fija (se distribuye automáticamente)
 */
export function esCategoriaFija(categoria: string): boolean {
  return CATEGORIAS_FIJAS.includes(categoria as CategoriaFija)
}

/**
 * Verifica si una categoría es financiera
 */
export function esCategoriaFinanciera(categoria: string): boolean {
  return CATEGORIAS_FINANCIERAS.includes(categoria as CategoriaFinanciera)
}

/**
 * Obtiene el color de badge según el tipo de costo
 */
export function getColorTipoCosto(categoria: string): string {
  if (esCategoriaVariable(categoria)) {
    return 'bg-green-100 text-green-800'
  }
  if (esCategoriaFija(categoria)) {
    return 'bg-blue-100 text-blue-800'
  }
  if (esCategoriaFinanciera(categoria)) {
    return 'bg-purple-100 text-purple-800'
  }
  return 'bg-gray-100 text-gray-800'
}

/**
 * Obtiene el label del tipo de costo
 */
export function getLabelTipoCosto(categoria: string): string {
  if (esCategoriaVariable(categoria)) {
    return 'Variable Directo'
  }
  if (esCategoriaFija(categoria)) {
    return 'Fijo'
  }
  if (esCategoriaFinanciera(categoria)) {
    return 'Financiero'
  }
  return 'Otro'
}