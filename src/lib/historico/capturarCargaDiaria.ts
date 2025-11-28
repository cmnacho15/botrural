import { prisma } from '@/lib/prisma'
import { calcularUGPotrero } from './calcularUGPotrero'

/**
 * Proceso de captura diaria de UG
 * Se ejecuta a las 00:00 cada día (zona horaria Uruguay)
 */
export async function capturarCargaDiaria() {
  console.log('🕐 Iniciando captura diaria de UG...')
  const startTime = Date.now()

  try {
    // Obtener todos los campos activos
    const campos = await prisma.campo.findMany({
      select: {
        id: true,
        nombre: true,
        lotes: {
          select: { id: true, nombre: true },
        },
      },
    })

    console.log(`📊 Procesando ${campos.length} campos...`)

    let snapshotsGuardados = 0
    let potrerosRevisados = 0
    const fecha = new Date()
    fecha.setHours(0, 0, 0, 0) // Fecha sin hora

    for (const campo of campos) {
      for (const lote of campo.lotes) {
        potrerosRevisados++

        try {
          // 1. Calcular UG actual del potrero
          const ugActual = await calcularUGPotrero(lote.id)

          // 2. Buscar el último snapshot guardado
          const ultimoSnapshot = await prisma.cargaHistorica.findFirst({
            where: {
              loteId: lote.id,
              campoId: campo.id,
            },
            orderBy: { fecha: 'desc' },
            select: { ugTotal: true, fecha: true },
          })

          // 3. Decidir si guardar
          let debeGuardar = false

          if (!ultimoSnapshot) {
            // Es el primer snapshot del potrero
            debeGuardar = true
            console.log(
              `  ✨ Primera captura: ${campo.nombre} > ${lote.nombre} = ${ugActual.toFixed(2)} UG`
            )
          } else {
            // Comparar con el último snapshot
            const diferencia = Math.abs(ugActual - ultimoSnapshot.ugTotal)

            if (diferencia > 0.01) {
              debeGuardar = true
              console.log(
                `  📈 Cambio detectado: ${campo.nombre} > ${lote.nombre} = ${ultimoSnapshot.ugTotal.toFixed(2)} → ${ugActual.toFixed(2)} UG (Δ ${diferencia.toFixed(2)})`
              )
            }
          }

          // 4. Guardar snapshot si cambió
          if (debeGuardar) {
            await prisma.cargaHistorica.create({
              data: {
                fecha,
                loteId: lote.id,
                ugTotal: ugActual,
                campoId: campo.id,
              },
            })
            snapshotsGuardados++
          }
        } catch (error) {
          console.error(
            `  ❌ Error procesando ${campo.nombre} > ${lote.nombre}:`,
            error
          )
          // Continuar con el siguiente potrero
        }
      }
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