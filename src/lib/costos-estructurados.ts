// src/lib/costos-estructurados.ts

export const CATEGORIAS_COSTOS_ESTRUCTURADOS = {
  COSTOS_FIJOS: {
    nombre: 'Costos Fijos',
    color: '#FFC107',
    orden: 1,
    subcategorias: [
      { id: 'impuestos_contribucion', nombre: 'Impuestos / Contribución', orden: 1 },
      { id: 'bps_rural', nombre: 'BPS Rural', orden: 2 },
      { id: 'primaria', nombre: 'Primaria', orden: 3 },
      { id: 'contribucion_rural', nombre: 'Contribución rural', orden: 4 },
      { id: 'comision_ventas', nombre: 'Comisión ventas - Ret INIA', orden: 5 },
      { id: 'imeba_iva', nombre: 'IMEBA e IVA', orden: 6 },
      { id: 'municipal', nombre: '1% Municipal', orden: 7 },
    ]
  },
  ADMINISTRACION: {
    nombre: 'Administración',
    color: '#FF9800',
    orden: 2,
    subcategorias: [
      { id: 'asesoramiento', nombre: 'Asesoramiento', orden: 1 },
      { id: 'otros', nombre: 'Otros', orden: 2 },
    ]
  },
  INVER_MEJ_MANT: {
    nombre: 'Inver-Mej-Mant',
    color: '#F44336',
    orden: 3,
    subcategorias: [
      { id: 'reparacion_estancia', nombre: 'Reparación Estancia', orden: 1 },
    ]
  },
  SUELDOS_INCENTIVOS: {
    nombre: 'Sueldos e incentivos',
    color: '#9C27B0',
    orden: 4,
    subcategorias: [
      { id: 'sueldo_personal', nombre: 'Sueldo Personal + Ag Licen', orden: 1 },
      { id: 'caja_capataz', nombre: 'Caja Capataz', orden: 2 },
      { id: 'gratificaciones', nombre: 'Gratificaciones Produccion', orden: 3 },
    ]
  },
  PATENTES_SEGUROS: {
    nombre: 'Patentes/Seguros',
    color: '#3F51B5',
    orden: 5,
    subcategorias: [
      { id: 'pat_seg_autos', nombre: 'Pat- Seg autos y camioneta', orden: 1 },
    ]
  },
  TEL_ANTEL_OSE: {
    nombre: 'TEL/ANTEL/OSE',
    color: '#2196F3',
    orden: 6,
    subcategorias: [
      { id: 'internet_tel', nombre: 'Internet Estanc +Tel Capataz', orden: 1 },
      { id: 'ute_estancia', nombre: 'Ute Estancia', orden: 2 },
    ]
  },
  COMESTIBLES: {
    nombre: 'Comestibles',
    color: '#00BCD4',
    orden: 7,
    subcategorias: [
      { id: 'comestibles', nombre: 'Comestibles', orden: 1 },
      { id: 'verduleria', nombre: 'Verduleria', orden: 2 },
      { id: 'panaderia', nombre: 'Panaderia', orden: 3 },
    ]
  },
  COMBUSTIBLES: {
    nombre: 'Combustibles',
    color: '#009688',
    orden: 8,
    subcategorias: [
      { id: 'gas_oil', nombre: 'Gas Oil Para Servicios', orden: 1 },
    ]
  },
  MECANICA_MAQUINARIA: {
    nombre: 'Mecanica / Maquinaria',
    color: '#4CAF50',
    orden: 9,
    subcategorias: [
      { id: 'respuestos_tractor', nombre: 'Respuestos Tractor', orden: 1 },
      { id: 'respuestos_generales', nombre: 'Respuestos Generales', orden: 2 },
      { id: 'ferreteria', nombre: 'Ferreteria', orden: 3 },
      { id: 'services_toyota', nombre: 'Services Toyota', orden: 4 },
      { id: 'reparaciones_general', nombre: 'Reparaciones en General', orden: 5 },
      { id: 'compra_maquinaria', nombre: 'Compra Maquinaria', orden: 6 },
    ]
  },
  GASTOS_VERDEOS: {
    nombre: 'Gastos Verdeos y Praderas',
    color: '#8BC34A',
    orden: 10,
    subcategorias: [
      { id: 'semillas', nombre: 'Semillas', orden: 1 },
      { id: 'fertilizantes', nombre: 'Fertilizantes', orden: 2 },
      { id: 'herbicidas', nombre: 'Herbicidas', orden: 3 },
      { id: 'trabajos_contratados', nombre: 'Trabajos Contratados', orden: 4 },
    ]
  },
  IMPUESTOS: {
    nombre: 'Impuestos',
    color: '#CDDC39',
    orden: 11,
    subcategorias: [
      { id: 'contribucion_rural', nombre: 'Contribucion Rural', orden: 1 },
      { id: 'contribucion_inmobiliaria', nombre: 'Contribucion Inmobiliaria', orden: 2 },
      { id: 'guias_ventas', nombre: 'Guias e Impuestos a Ventas', orden: 3 },
      { id: 'bps', nombre: 'BPS', orden: 4 },
      { id: 'ip', nombre: 'IP', orden: 5 },
      { id: 'irae', nombre: 'IRAE', orden: 6 },
      { id: 'patentes', nombre: 'Patentes', orden: 7 },
    ]
  },
  GASTOS_EQUINOS: {
    nombre: 'Gastos Equinos',
    color: '#795548',
    orden: 12,
    subcategorias: [
      { id: 'sueldo_equinos', nombre: 'Sueldo Equinos', orden: 1 },
      { id: 'fletes_equinos', nombre: 'Fletes Equinos', orden: 2 },
      { id: 'gastos_compra', nombre: 'Gastos Compra Equinos', orden: 3 },
      { id: 'compra_caballo', nombre: 'Compra Caballo', orden: 4 },
      { id: 'sanidad_equina', nombre: 'Sanidad Equina', orden: 5 },
      { id: 'raciones_equinas', nombre: 'Raciones Equinas', orden: 6 },
      { id: 'ret_ventas', nombre: 'Ret Ventas Equinas', orden: 7 },
      { id: 'gastos_remate', nombre: 'Gastos Remate', orden: 8 },
      { id: 'gasto_equino', nombre: 'Gasto Equino', orden: 9 },
    ]
  },
  GASTOS_FAMILIA: {
    nombre: 'Gastos Familia',
    color: '#607D8B',
    orden: 13,
    subcategorias: [
      { id: 'locomocion_fla', nombre: 'Locomocion Fla/Seguros', orden: 1 },
      { id: 'gastos_reparacion', nombre: 'Gastos Reparacion Vehiculo Fla', orden: 2 },
      { id: 'nafta_peaje', nombre: 'Nafta y Peaje Familia', orden: 3 },
      { id: 'seguros_familia', nombre: 'Seguros Familia', orden: 4 },
      { id: 'sueldo_hijos', nombre: 'Sueldo Hijos', orden: 5 },
      { id: 'sueldo_gabriela', nombre: 'Sueldo Gabriela + Ernesto', orden: 6 },
      { id: 'antel', nombre: 'Antel', orden: 7 },
      { id: 'sueldo_ag_empleada', nombre: 'Sueldo + Ag Empleada Fla', orden: 8 },
      { id: 'salud_fla', nombre: 'Salud Fla', orden: 9 },
      { id: 'retiros_familia', nombre: 'Retiros Familia', orden: 10 },
      { id: 'gastos_compras', nombre: 'Gastos Compras Auto304', orden: 11 },
    ]
  },
  GASTOS_ABUSC_CECLE: {
    nombre: 'Gastos ABU-SC y CECLE',
    color: '#9E9E9E',
    orden: 14,
    subcategorias: [
      { id: 'total_gastos_empresa', nombre: 'TOTAL Gastos Empresa', orden: 1 },
    ]
  },
  COSTOS_VARIABLES: {
    nombre: 'Costos variables y directos',
    color: '#FF5722',
    orden: 15,
    subcategorias: [
      { id: 'sanidad_vacuna', nombre: 'Sanidad Vacuna', orden: 1 },
      { id: 'racion_vacunos', nombre: 'Racion Vacunos', orden: 2 },
      { id: 'pasturas', nombre: 'Pasturas', orden: 3 },
      { id: 'fletes_varios', nombre: 'Fletes Varios', orden: 4 },
      { id: 'sanidad_ovina', nombre: 'Sanidad Ovina', orden: 5 },
      { id: 'racion_ovina', nombre: 'Racion Ovina', orden: 6 },
      { id: 'esquila_sul', nombre: 'Esquila/SUL', orden: 7 },
      { id: 'gasto_equino', nombre: 'Gasto Equino', orden: 8 },
      { id: 'compra_caballo', nombre: 'Compra Caballo', orden: 9 },
    ]
  },
} as const

// 🎨 MAPEO SUGERIDO INICIAL (usuarios pueden modificar después)
export const MAPEO_CATEGORIAS_INICIAL = {
  'Alimentación': {
    categoria: 'COSTOS_VARIABLES',
    subcategoria: 'racion_vacunos',
    distribucion: { vacuno: 70, ovino: 30, equino: 0, desperdicios: 0 }
  },
  'Administración': {
    categoria: 'ADMINISTRACION',
    subcategoria: 'otros',
    distribucion: { vacuno: 74, ovino: 23, equino: 3, desperdicios: 0 }
  },
  'Asesoramiento': {
    categoria: 'ADMINISTRACION',
    subcategoria: 'asesoramiento',
    distribucion: { vacuno: 74, ovino: 23, equino: 3, desperdicios: 0 }
  },
  'Combustible': {
    categoria: 'COMBUSTIBLES',
    subcategoria: 'gas_oil',
    distribucion: { vacuno: 74, ovino: 23, equino: 3, desperdicios: 0 }
  },
  'Estructuras': {
    categoria: 'INVER_MEJ_MANT',
    subcategoria: 'reparacion_estancia',
    distribucion: { vacuno: 74, ovino: 23, equino: 3, desperdicios: 0 }
  },
  'Fertilizantes': {
    categoria: 'GASTOS_VERDEOS',
    subcategoria: 'fertilizantes',
    distribucion: { vacuno: 74, ovino: 23, equino: 3, desperdicios: 0 }
  },
  'Fitosanitarios': {
    categoria: 'GASTOS_VERDEOS',
    subcategoria: 'herbicidas',
    distribucion: { vacuno: 74, ovino: 23, equino: 3, desperdicios: 0 }
  },
  'Impuestos': {
    categoria: 'IMPUESTOS',
    subcategoria: 'contribucion_rural',
    distribucion: { vacuno: 74, ovino: 23, equino: 3, desperdicios: 0 }
  },
  'Maquinaria': {
    categoria: 'MECANICA_MAQUINARIA',
    subcategoria: 'reparaciones_general',
    distribucion: { vacuno: 74, ovino: 23, equino: 3, desperdicios: 0 }
  },
  'Sanidad': {
    categoria: 'COSTOS_VARIABLES',
    subcategoria: 'sanidad_vacuna',
    distribucion: { vacuno: 100, ovino: 0, equino: 0, desperdicios: 0 }
  },
  'Seguros': {
    categoria: 'PATENTES_SEGUROS',
    subcategoria: 'pat_seg_autos',
    distribucion: { vacuno: 74, ovino: 23, equino: 3, desperdicios: 0 }
  },
  'Semillas': {
    categoria: 'GASTOS_VERDEOS',
    subcategoria: 'semillas',
    distribucion: { vacuno: 74, ovino: 23, equino: 3, desperdicios: 0 }
  },
  'Sueldos': {
    categoria: 'SUELDOS_INCENTIVOS',
    subcategoria: 'sueldo_personal',
    distribucion: { vacuno: 74, ovino: 23, equino: 3, desperdicios: 0 }
  },
} as const

// 🛠️ HELPERS

export type CategoriaCostoKey = keyof typeof CATEGORIAS_COSTOS_ESTRUCTURADOS

export const getAllSubcategorias = () => {
  const result: Array<{
    categoria: string
    subcategoria: string
    nombreCategoria: string
    nombreSubcategoria: string
    orden: number
  }> = []

  Object.entries(CATEGORIAS_COSTOS_ESTRUCTURADOS).forEach(([key, cat]) => {
    cat.subcategorias.forEach((sub) => {
      result.push({
        categoria: key,
        subcategoria: sub.id,
        nombreCategoria: cat.nombre,
        nombreSubcategoria: sub.nombre,
        orden: sub.orden,
      })
    })
  })

  return result
}

export const getCategoriaColor = (categoriaKey: string): string => {
  const cat = CATEGORIAS_COSTOS_ESTRUCTURADOS[categoriaKey as CategoriaCostoKey]
  return cat?.color || '#9E9E9E'
}

export const getNombreCategoria = (categoriaKey: string): string => {
  const cat = CATEGORIAS_COSTOS_ESTRUCTURADOS[categoriaKey as CategoriaCostoKey]
  return cat?.nombre || categoriaKey
}