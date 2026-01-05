// ✅ CATEGORÍAS DE GASTOS CON METADATA (21 categorías finales)
export const CATEGORIAS_GASTOS_DEFAULT = [
  // 🐄 COSTOS VARIABLES DIRECTOS - GANADERÍA
  { nombre: 'Alimentación', color: '#ef4444', tipo: 'VARIABLE', subtipo: 'GANADERIA', orden: 0 },
  { nombre: 'Genética', color: '#ec4899', tipo: 'VARIABLE', subtipo: 'GANADERIA', orden: 1 },
  { nombre: 'Sanidad y Manejo', color: '#dc2626', tipo: 'VARIABLE', subtipo: 'GANADERIA', orden: 2 },
  { nombre: 'Insumos Pasturas', color: '#84cc16', tipo: 'VARIABLE', subtipo: 'GANADERIA', orden: 3 },

  // 🌾 COSTOS VARIABLES DIRECTOS - AGRICULTURA
  { nombre: 'Insumos de Cultivos', color: '#22c55e', tipo: 'VARIABLE', subtipo: 'AGRICULTURA', orden: 4 },

  // 🔀 COSTOS VARIABLES DIRECTOS - MIXTOS
  { nombre: 'Combustible', color: '#f97316', tipo: 'VARIABLE', subtipo: 'MIXTO', orden: 5 },
  { nombre: 'Flete', color: '#f59e0b', tipo: 'VARIABLE', subtipo: 'MIXTO', orden: 6 },
  { nombre: 'Labores', color: '#eab308', tipo: 'VARIABLE', subtipo: 'MIXTO', orden: 7 },

  // 🤖 COSTOS VARIABLES DIRECTOS - AUTOMÁTICOS
  { nombre: 'Gastos Comerciales', color: '#a855f7', tipo: 'VARIABLE', subtipo: 'AUTOMATICO', orden: 8 },

  // 🏢 COSTOS FIJOS - FIJOS PUROS
  { nombre: 'Administración', color: '#3b82f6', tipo: 'FIJO', subtipo: 'PURO', orden: 9 },
  { nombre: 'Asesoramiento', color: '#06b6d4', tipo: 'FIJO', subtipo: 'PURO', orden: 10 },
  { nombre: 'Impuestos', color: '#8b5cf6', tipo: 'FIJO', subtipo: 'PURO', orden: 11 },
  { nombre: 'Seguro/Patente', color: '#0ea5e9', tipo: 'FIJO', subtipo: 'PURO', orden: 12 },
  { nombre: 'Estructuras', color: '#64748b', tipo: 'FIJO', subtipo: 'PURO', orden: 13 },
  { nombre: 'Otros', color: '#6b7280', tipo: 'FIJO', subtipo: 'PURO', orden: 14 },

  // 🔧 COSTOS FIJOS - ASIGNABLES
  { nombre: 'Sueldos', color: '#7c3aed', tipo: 'FIJO', subtipo: 'ASIGNABLE', orden: 15 },
  { nombre: 'Maquinaria', color: '#78716c', tipo: 'FIJO', subtipo: 'ASIGNABLE', orden: 16 },
  { nombre: 'Electricidad', color: '#14b8a6', tipo: 'FIJO', subtipo: 'ASIGNABLE', orden: 17 },
  { nombre: 'Mantenimiento', color: '#65a30d', tipo: 'FIJO', subtipo: 'ASIGNABLE', orden: 18 },

  // 🏦 COSTOS FINANCIEROS
  { nombre: 'Renta', color: '#6366f1', tipo: 'FINANCIERO', subtipo: null, orden: 19 },
  { nombre: 'Intereses', color: '#4f46e5', tipo: 'FINANCIERO', subtipo: null, orden: 20 },
]

// ✅ Mantener compatibilidad con código antiguo
export const CATEGORIAS_GASTOS = CATEGORIAS_GASTOS_DEFAULT.map(c => c.nombre)

export const METODOS_PAGO = [
  'Efectivo',
  'Transferencia',
  'Tarjeta',
  'Cheque',
]

export const CULTIVOS = [
  'Maíz',
  'Soja',
  'Trigo',
  'Sorgo',
  'Avena',
  'Girasol',
  'Cebada',
  'Otro',
]



import { TipoAnimal } from '@prisma/client'

export const CATEGORIAS_ANIMALES_DEFAULT = [
  // BOVINOS
  { nombreSingular: 'Toros', nombrePlural: 'Toros', tipoAnimal: TipoAnimal.BOVINO },
  { nombreSingular: 'Vacas', nombrePlural: 'Vacas', tipoAnimal: TipoAnimal.BOVINO },
  { nombreSingular: 'Vacas Gordas', nombrePlural: 'Vacas Gordas', tipoAnimal: TipoAnimal.BOVINO },
  { nombreSingular: 'Novillos +3 años', nombrePlural: 'Novillos +3 años', tipoAnimal: TipoAnimal.BOVINO },
  { nombreSingular: 'Novillos 2–3 años', nombrePlural: 'Novillos 2–3 años', tipoAnimal: TipoAnimal.BOVINO },
  { nombreSingular: 'Novillos 1–2 años', nombrePlural: 'Novillos 1–2 años', tipoAnimal: TipoAnimal.BOVINO },
  { nombreSingular: 'Vaquillonas +2 años', nombrePlural: 'Vaquillonas +2 años', tipoAnimal: TipoAnimal.BOVINO },
  { nombreSingular: 'Vaquillonas 1–2 años', nombrePlural: 'Vaquillonas 1–2 años', tipoAnimal: TipoAnimal.BOVINO },
  { nombreSingular: 'Terneros', nombrePlural: 'Terneros', tipoAnimal: TipoAnimal.BOVINO }, // 🆕 NUEVO
  { nombreSingular: 'Terneras', nombrePlural: 'Terneras', tipoAnimal: TipoAnimal.BOVINO }, // 🆕 NUEVO
  { nombreSingular: 'Terneros nacidos', nombrePlural: 'Terneros nacidos', tipoAnimal: TipoAnimal.BOVINO },
  
  // OVINOS
  { nombreSingular: 'Carneros', nombrePlural: 'Carneros', tipoAnimal: TipoAnimal.OVINO },
  { nombreSingular: 'Ovejas', nombrePlural: 'Ovejas', tipoAnimal: TipoAnimal.OVINO },
  { nombreSingular: 'Capones', nombrePlural: 'Capones', tipoAnimal: TipoAnimal.OVINO },
  { nombreSingular: 'Borregas 2–4 dientes', nombrePlural: 'Borregas 2–4 dientes', tipoAnimal: TipoAnimal.OVINO },
  { nombreSingular: 'Corderas DL', nombrePlural: 'Corderas DL', tipoAnimal: TipoAnimal.OVINO },
  { nombreSingular: 'Corderos DL', nombrePlural: 'Corderos DL', tipoAnimal: TipoAnimal.OVINO },
  { nombreSingular: 'Corderos/as Mamones', nombrePlural: 'Corderos/as Mamones', tipoAnimal: TipoAnimal.OVINO },
  
  // EQUINOS
  { nombreSingular: 'Padrillos', nombrePlural: 'Padrillos', tipoAnimal: TipoAnimal.EQUINO },
  { nombreSingular: 'Yeguas', nombrePlural: 'Yeguas', tipoAnimal: TipoAnimal.EQUINO },
  { nombreSingular: 'Caballos', nombrePlural: 'Caballos', tipoAnimal: TipoAnimal.EQUINO },
  { nombreSingular: 'Potrillos', nombrePlural: 'Potrillos', tipoAnimal: TipoAnimal.EQUINO },
] as const