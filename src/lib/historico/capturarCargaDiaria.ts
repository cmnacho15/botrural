//src/lib/historico/capturarCargaDiaria.ts
import { prisma } from '@/lib/prisma'
import { calcularUGPotrero } from './calcularUGPotrero'

/**
 * Proceso de captura diaria de UG
 * Se ejecuta a las 00:00 cada día (zona horaria Uruguay)
 * 
 * OPTIMIZADO PARA 200+ CAMPOS:
 * - Bulk queries en lugar de N+1
 * - Procesamiento por lotes
 * - Bulk inserts
 */
export async function capturarCargaDiaria() {
  console.log('🕐 Iniciando captura diaria de UG...')
  const startTime = Date.now()

  try {
    const fecha = new Date()
    fecha.setHours(0, 0, 0, 0)

    // ✅ OPTIMIZACIÓN 1: Una sola query para todo
    const campos = await prisma.campo.findMany({
      select: {
        id: true,
        nombre: true,
        lotes: {
          select: { 
            id: true, 
            nombre: true,
          },
        },
      },
    })

    console.log(`📊 Procesando ${campos.length} campos...`)

    // ✅ OPTIMIZACIÓN 2: Obtener TODOS los últimos snapshots de una vez
    const todosLoteIds = campos.flatMap(c => c.lotes.map(l => l.id))
    
    const ultimosSnapshots = await prisma.cargaHistorica.findMany({
      where: {
        loteId: { in: todosLoteIds },
      },
      orderBy: { fecha: 'desc' },
      distinct: ['loteId'],
      select: {
        loteId: true,
        ugTotal: true,
        fecha: true,
      },
    })

    // Crear mapa para acceso rápido
    const snapshotsMap = new Map(
      ultimosSnapshots.map(s => [s.loteId, s])
    )

    // ✅ OPTIMIZACIÓN 3: Calcular UG y preparar inserts en batch
    const snapshotsAGuardar: Array<{
      fecha: Date
      loteId: string
      ugTotal: number
      campoId: string
    }> = []

    let potrerosRevisados = 0

    for (const campo of campos) {
      for (const lote of campo.lotes) {
        potrerosRevisados++

        try {
          const ugActual = await calcularUGPotrero(lote.id, campo.id)
          const ultimoSnapshot = snapshotsMap.get(lote.id)

          let debeGuardar = false

          if (!ultimoSnapshot) {
            debeGuardar = true
            console.log(
              `  ✨ Primera captura: ${campo.nombre} > ${lote.nombre} = ${ugActual.toFixed(2)} UG`
            )
          } else {
            const diferencia = Math.abs(ugActual - ultimoSnapshot.ugTotal)
            if (diferencia > 0.01) {
              debeGuardar = true
              console.log(
                `  📈 Cambio: ${campo.nombre} > ${lote.nombre} = ${ultimoSnapshot.ugTotal.toFixed(2)} → ${ugActual.toFixed(2)} UG`
              )
            }
          }

          if (debeGuardar) {
            snapshotsAGuardar.push({
              fecha,
              loteId: lote.id,
              ugTotal: ugActual,
              campoId: campo.id,
            })
          }
        } catch (error) {
          console.error(
            `  ❌ Error procesando ${campo.nombre} > ${lote.nombre}:`,
            error
          )
        }
      }
    }

    // ✅ OPTIMIZACIÓN 4: Guardar TODOS los snapshots en un solo INSERT
    let snapshotsGuardados = 0
    if (snapshotsAGuardar.length > 0) {
      const resultado = await prisma.cargaHistorica.createMany({
        data: snapshotsAGuardar,
        skipDuplicates: true,
      })
      snapshotsGuardados = resultado.count
    }

    const duracion = Date.now() - startTime
    console.log(`✅ Captura completada en ${duracion}ms`)
    console.log(`   - Potreros revisados: ${potrerosRevisados}`)
    console.log(`   - Snapshots guardados: ${snapshotsGuardados}`)
    console.log(
      `   - Snapshots omitidos: ${potrerosRevisados - snapshotsGuardados} (sin cambios)`
    )

    return {
      success: true,
      potrerosRevisados,
      snapshotsGuardados,
      duracion,
    }
  } catch (error) {
    console.error('💥 Error en captura diaria:', error)
    throw error
  }
}