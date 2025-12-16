// Categorías de gastos (sincronizadas con GastosPage)
export const CATEGORIAS_GASTOS = [
  'Alimentación',
  'Otros',
  'Administración',
  'Renta',
  'Asesoramiento',
  'Combustible',
  'Compras de Hacienda',
  'Estructuras',
  'Fertilizantes',
  'Fitosanitarios',
  'Gastos Comerciales',
  'Impuestos',
  'Insumos Agrícolas',
  'Labores',
  'Maquinaria',
  'Sanidad',
  'Seguros',
  'Semillas',
  'Sueldos',
]

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
  { nombreSingular: 'Novillos +3 años', nombrePlural: 'Novillos +3 años', tipoAnimal: TipoAnimal.BOVINO },
  { nombreSingular: 'Novillos 2–3 años', nombrePlural: 'Novillos 2–3 años', tipoAnimal: TipoAnimal.BOVINO },
  { nombreSingular: 'Novillos 1–2 años', nombrePlural: 'Novillos 1–2 años', tipoAnimal: TipoAnimal.BOVINO },
  { nombreSingular: 'Vaquillonas +2 años', nombrePlural: 'Vaquillonas +2 años', tipoAnimal: TipoAnimal.BOVINO },
  { nombreSingular: 'Vaquillonas 1–2 años', nombrePlural: 'Vaquillonas 1–2 años', tipoAnimal: TipoAnimal.BOVINO },
  { nombreSingular: 'Terneros/as', nombrePlural: 'Terneros/as', tipoAnimal: TipoAnimal.BOVINO },
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