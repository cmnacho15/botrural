import { PrismaClient } from '@prisma/client'
import { CATEGORIAS_GASTOS_DEFAULT } from '../src/lib/constants'

const prisma = new PrismaClient()

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

  const campos = await prisma.campo.findMany()
  
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
    const categoriasExistentes = await prisma.categoriaGasto.findMany({
      where: { campoId: campo.id }
    })
    
    for (const cat of categoriasExistentes) {
      const config = CATEGORIAS_GASTOS_DEFAULT.find(c => c.nombre === cat.nombre)
      if (config) {
        await prisma.categoriaGasto.update({
          where: { id: cat.id },
          data: { orden: config.orden }
        })
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