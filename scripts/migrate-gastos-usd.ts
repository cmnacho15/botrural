// scripts/migrate-gastos-usd.ts
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function migrateGastosUSD() {
  console.log('🚀 Iniciando migración de montoEnUSD...')

  const gastos = await prisma.gasto.findMany({
    select: {
      id: true,
      moneda: true,
      montoOriginal: true,
      tasaCambio: true,
    },
  })

  console.log(`📊 Encontrados ${gastos.length} gastos para migrar`)

  let updated = 0
  let errors = 0

  for (const gasto of gastos) {
    try {
      let montoEnUSD: number

      if (gasto.moneda === 'USD') {
        montoEnUSD = gasto.montoOriginal
      } else if (gasto.moneda === 'UYU') {
        if (!gasto.tasaCambio || gasto.tasaCambio === 0) {
          console.warn(`⚠️  Gasto ${gasto.id} en UYU sin tasa de cambio, usando 1`)
          montoEnUSD = gasto.montoOriginal
        } else {
          montoEnUSD = gasto.montoOriginal / gasto.tasaCambio
        }
      } else {
        console.warn(`⚠️  Moneda desconocida en gasto ${gasto.id}: ${gasto.moneda}`)
        montoEnUSD = gasto.montoOriginal
      }

      await prisma.gasto.update({
        where: { id: gasto.id },
        data: { montoEnUSD },
      })

      updated++
    } catch (error) {
      console.error(`❌ Error en gasto ${gasto.id}:`, error)
      errors++
    }
  }

  console.log(`✅ Migración completada: ${updated} actualizados, ${errors} errores`)
}

migrateGastosUSD()
  .catch(console.error)
  .finally(() => prisma.$disconnect())