// lib/costos/categoriasCostos.ts

/**
 * Categorías de COSTOS VARIABLES
 * Se distribuyen automáticamente según % de UG de cada especie
 * ⚠️ NO EDITABLE - Configuración interna del sistema
 */
export const CATEGORIAS_VARIABLES = [
  'Sanidad',
  'Alimentación',
  'Insumos Agrícolas',
  'Fertilizantes',
  'Labores',
  'Fitosanitarios',
] as const

/**
 * Categorías de COSTOS FIJOS
 * Se asignan manualmente a cada especie o quedan como "global"
 * ⚠️ NO EDITABLE - Configuración interna del sistema
 */
export const CATEGORIAS_FIJAS = [
  'Impuestos',
  'Administración',
  'Sueldos',
  'Seguros',
  'Maquinaria',
  'Combustible',
  'Alquiler',
  'Asesoramiento',
  'Estructuras',
  'Otros',
] as const

/**
 * Tipos de especie válidos para asignación de costos fijos
 */
export const ESPECIES_VALIDAS = ['VACUNOS', 'OVINOS', 'EQUINOS'] as const

export type CategoriaVariable = typeof CATEGORIAS_VARIABLES[number]
export type CategoriaFija = typeof CATEGORIAS_FIJAS[number]
export type EspecieValida = typeof ESPECIES_VALIDAS[number]

/**
 * Verifica si una categoría es variable (se distribuye automáticamente)
 */
export function esCategoriaVariable(categoria: string): boolean {
  return CATEGORIAS_VARIABLES.includes(categoria as CategoriaVariable)
}

/**
 * Verifica si una categoría es fija (requiere asignación manual)
 */
export function esCategoriaFija(categoria: string): boolean {
  return CATEGORIAS_FIJAS.includes(categoria as CategoriaFija)
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
  return 'bg-gray-100 text-gray-800'
}

/**
 * Obtiene el label del tipo de costo
 */
export function getLabelTipoCosto(categoria: string): string {
  if (esCategoriaVariable(categoria)) {
    return 'Variable'
  }
  if (esCategoriaFija(categoria)) {
    return 'Fijo'
  }
  return 'Otro'
}