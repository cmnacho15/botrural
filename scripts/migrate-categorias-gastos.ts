import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

/**
 * ✅ CATEGORÍAS DE GASTOS - DEFINICIÓN LOCAL
 * (Copiado de constants.ts para evitar problemas de importación)
 */
const CATEGORIAS_GASTOS_DEFAULT = [
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
  { nombre: 'Seguros', color: '#0ea5e9', tipo: 'FIJO', subtipo: 'PURO', orden: 12 },
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

/**
 * 🔄 SCRIPT DE MIGRACIÓN DE CATEGORÍAS DE GASTOS
 * 
 * Este script:
 * 1. Renombra "Sanidad" → "Sanidad y Manejo"
 * 2. Reagrupa categorías agrícolas → "Insumos de Cultivos"
 * 3. Elimina "Compras de Hacienda"
 * 4. Agrega nuevas categorías (Genética, Insumos Pasturas, Flete, Electricidad, Mantenimiento, Intereses)
 * 5. Actualiza gastos existentes con las categorías renombradas/reagrupadas
 */

async function main() {
  console.log('🚀 Iniciando migración de categorías de gastos...\n')

  const campos = await prisma.campo.findMany({
    where: {
      nombre: {
        in: ['El Estribo', 'Don Pepe', 'Manya', 'Mirasol']
      }
    }
  })
  
  for (const campo of campos) {
    console.log(`\n📂 Procesando campo: ${campo.nombre} (ID: ${campo.id})`)
    
    // ---------------------------------------------------------
    // 1️⃣ RENOMBRAR "Sanidad" → "Sanidad y Manejo"
    // ---------------------------------------------------------
    const categoriasSanidad = await prisma.categoriaGasto.findMany({
      where: { campoId: campo.id, nombre: 'Sanidad' }
    })
    
    if (categoriasSanidad.length > 0) {
      console.log('  ✏️  Renombrando "Sanidad" → "Sanidad y Manejo"')
      
      await prisma.categoriaGasto.updateMany({
        where: { campoId: campo.id, nombre: 'Sanidad' },
        data: { nombre: 'Sanidad y Manejo' }
      })
      
      await prisma.gasto.updateMany({
        where: { campoId: campo.id, categoria: 'Sanidad' },
        data: { categoria: 'Sanidad y Manejo' }
      })
    }
    
    // ---------------------------------------------------------
    // 2️⃣ REAGRUPAR CATEGORÍAS AGRÍCOLAS → "Insumos de Cultivos"
    // ---------------------------------------------------------
    const categoriasAgricolas = ['Fertilizantes', 'Semillas', 'Fitosanitarios', 'Insumos Agrícolas']
    
    for (const catAgricola of categoriasAgricolas) {
      const existe = await prisma.categoriaGasto.findFirst({
        where: { campoId: campo.id, nombre: catAgricola }
      })
      
      if (existe) {
        console.log(`  🔀 Reagrupando "${catAgricola}" → "Insumos de Cultivos"`)
        
        // Actualizar gastos
        await prisma.gasto.updateMany({
          where: { campoId: campo.id, categoria: catAgricola },
          data: { categoria: 'Insumos de Cultivos' }
        })
        
        // Eliminar categoría antigua
        await prisma.categoriaGasto.deleteMany({
          where: { campoId: campo.id, nombre: catAgricola }
        })
      }
    }
    
    // Crear "Insumos de Cultivos" si no existe
    const insumosCultivos = await prisma.categoriaGasto.findFirst({
      where: { campoId: campo.id, nombre: 'Insumos de Cultivos' }
    })
    
    if (!insumosCultivos) {
      const catConfig = CATEGORIAS_GASTOS_DEFAULT.find(c => c.nombre === 'Insumos de Cultivos')!
      await prisma.categoriaGasto.create({
        data: {
          nombre: 'Insumos de Cultivos',
          color: catConfig.color,
          campoId: campo.id,
          orden: catConfig.orden,
          activo: true,
        }
      })
      console.log('  ✅ Creada categoría "Insumos de Cultivos"')
    }
    
    // ---------------------------------------------------------
    // 3️⃣ ELIMINAR "Compras de Hacienda"
    // ---------------------------------------------------------
    const comprasHacienda = await prisma.categoriaGasto.findFirst({
      where: { campoId: campo.id, nombre: 'Compras de Hacienda' }
    })
    
    if (comprasHacienda) {
      console.log('  ❌ Eliminando "Compras de Hacienda" (NO es gasto)')
      
      // Reasignar gastos a "Otros"
      const gastosCompras = await prisma.gasto.count({
        where: { campoId: campo.id, categoria: 'Compras de Hacienda' }
      })
      
      if (gastosCompras > 0) {
        console.log(`  ⚠️  Reasignando ${gastosCompras} gastos a "Otros"`)
        await prisma.gasto.updateMany({
          where: { campoId: campo.id, categoria: 'Compras de Hacienda' },
          data: { categoria: 'Otros' }
        })
      }
      
      await prisma.categoriaGasto.deleteMany({
        where: { campoId: campo.id, nombre: 'Compras de Hacienda' }
      })
    }
    
    // ---------------------------------------------------------
    // 4️⃣ AGREGAR NUEVAS CATEGORÍAS
    // ---------------------------------------------------------
    const nuevasCategorias = [
      'Genética',
      'Insumos Pasturas',
      'Flete',
      'Electricidad',
      'Mantenimiento',
      'Intereses',
    ]
    
    for (const nombreCat of nuevasCategorias) {
      const existe = await prisma.categoriaGasto.findFirst({
        where: { campoId: campo.id, nombre: nombreCat }
      })
      
      if (!existe) {
        const catConfig = CATEGORIAS_GASTOS_DEFAULT.find(c => c.nombre === nombreCat)!
        await prisma.categoriaGasto.create({
          data: {
            nombre: nombreCat,
            color: catConfig.color,
            campoId: campo.id,
            orden: catConfig.orden,
            activo: true,
          }
        })
        console.log(`  ✅ Creada categoría "${nombreCat}"`)
      }
    }
    
    // ---------------------------------------------------------
    // 5️⃣ ACTUALIZAR ORDEN DE TODAS LAS CATEGORÍAS
    // ---------------------------------------------------------
    console.log('  🔢 Actualizando orden de categorías...')
    const categoriasExistentes = await prisma.categoriaGasto.findMany({
      where: { campoId: campo.id }
    })
    
    console.log(`  📊 Encontradas ${categoriasExistentes.length} categorías`)
    
    for (const cat of categoriasExistentes) {
      const config = CATEGORIAS_GASTOS_DEFAULT.find(c => c.nombre === cat.nombre)
      if (config && cat.orden !== config.orden) {
        await prisma.categoriaGasto.update({
          where: { id: cat.id },
          data: { orden: config.orden }
        })
        console.log(`    ✓ Actualizado orden de "${cat.nombre}"`)
      }
    }
    
    console.log(`  ✅ Campo "${campo.nombre}" actualizado correctamente`)
  }
  
  console.log('\n✅ Migración completada exitosamente\n')
}

main()
  .catch((e) => {
    console.error('❌ Error en la migración:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })