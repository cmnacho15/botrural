import { prisma } from '@/lib/prisma'
import { calcularUGPotrero } from '@/lib/historico/calcularUGPotrero'

async function recalcularHistorico() {
  console.log('🔄 Recalculando histórico de UG...')
  
  try {
    // Obtener todos los snapshots únicos por fecha y lote
    const snapshots = await prisma.cargaHistorica.findMany({
      orderBy: [{ fecha: 'asc' }, { loteId: 'asc' }],
      select: {
        id: true,
        fecha: true,
        loteId: true,
        campoId: true,
      },
    })

    console.log(`📊 Actualizando ${snapshots.length} snapshots...`)

    let actualizados = 0

    for (const snapshot of snapshots) {
      try {
        // Recalcular UG con la lógica corregida (ahora agrupa correctamente)
        const ugRecalculada = await calcularUGPotrero(snapshot.loteId)

        // Actualizar el snapshot
        await prisma.cargaHistorica.update({
          where: { id: snapshot.id },
          data: { ugTotal: ugRecalculada },
        })

        actualizados++

        if (actualizados % 100 === 0) {
          console.log(`   ✅ ${actualizados}/${snapshots.length} actualizados...`)
        }
      } catch (error) {
        console.error(`   ❌ Error en snapshot ${snapshot.id}:`, error)
      }
    }

    console.log(`\n✅ Recálculo completado: ${actualizados}/${snapshots.length} snapshots actualizados`)
  } catch (error) {
    console.error('💥 Error recalculando histórico:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

recalcularHistorico()