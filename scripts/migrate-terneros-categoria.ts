import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🔄 Iniciando migración de categoría Terneros/as...')

  // 1️⃣ Obtener todos los campos
  const campos = await prisma.campo.findMany({
    include: {
      categoriasAnimal: true,  // ✅ CORREGIDO
      lotes: true  // ✅ AGREGADO para poder acceder a los IDs
    }
  })

  for (const campo of campos) {
    console.log(`\n📍 Campo: ${campo.nombre} (ID: ${campo.id})`)

    // 2️⃣ Buscar si existe la categoría antigua
    const categoriaAntigua = campo.categoriasAnimal.find(  // ✅ CORREGIDO
      c => c.nombreSingular === 'Terneros/as'
    )

    if (!categoriaAntigua) {
      console.log('  ⚠️  No tiene la categoría Terneros/as')
      continue
    }

    // 3️⃣ Crear las nuevas categorías
    const nuevasCategorias = await prisma.categoriaAnimal.createMany({
      data: [
        {
          nombreSingular: 'Terneros',
          nombrePlural: 'Terneros',
          tipoAnimal: 'BOVINO',
          campoId: campo.id,
          activo: true,
          esPredeterminado: true,
        },
        {
          nombreSingular: 'Terneras',
          nombrePlural: 'Terneras',
          tipoAnimal: 'BOVINO',
          campoId: campo.id,
          activo: true,
          esPredeterminado: true,
        }
      ],
      skipDuplicates: true
    })

    console.log(`  ✅ Creadas nuevas categorías: Terneros y Terneras`)

    // 4️⃣ Obtener IDs de las nuevas categorías
    const categoriaTereneros = await prisma.categoriaAnimal.findFirst({
      where: { campoId: campo.id, nombreSingular: 'Terneros' }
    })
    
    const categoriaTerneras = await prisma.categoriaAnimal.findFirst({
      where: { campoId: campo.id, nombreSingular: 'Terneras' }
    })

    if (!categoriaTereneros || !categoriaTerneras) {
      console.log('  ❌ Error al obtener nuevas categorías')
      continue
    }

    // 5️⃣ Actualizar AnimalLote (dividir 50/50 entre Terneros y Terneras)
    const animalesLote = await prisma.animalLote.findMany({  // ✅ CORREGIDO
      where: { 
        loteId: { in: campo.lotes.map(l => l.id) },
        categoria: 'Terneros/as'
      }
    })

    for (const animal of animalesLote) {
      const mitad = Math.floor(animal.cantidad / 2)
      const resto = animal.cantidad % 2

      // Crear Terneros
      await prisma.animalLote.create({  // ✅ CORREGIDO
        data: {
          loteId: animal.loteId,
          categoria: 'Terneros',
          cantidad: mitad + resto,
          peso: animal.peso,
          fechaIngreso: animal.fechaIngreso
        }
      })

      // Crear Terneras
      await prisma.animalLote.create({  // ✅ CORREGIDO
        data: {
          loteId: animal.loteId,
          categoria: 'Terneras',
          cantidad: mitad,
          peso: animal.peso,
          fechaIngreso: animal.fechaIngreso
        }
      })

      // Eliminar el antiguo
      await prisma.animalLote.delete({  // ✅ CORREGIDO
        where: { id: animal.id }
      })
    }

    console.log(`  ✅ Migrados ${animalesLote.length} registros de AnimalLote`)

    // 6️⃣ Actualizar Eventos
    const eventosAfectados = await prisma.evento.updateMany({
      where: {
        campoId: campo.id,
        categoria: 'Terneros/as'
      },
      data: {
        categoria: 'Terneros' // Por defecto los ponemos en Terneros
      }
    })

    console.log(`  ✅ Actualizados ${eventosAfectados.count} eventos`)

    // 7️⃣ Actualizar VentaRenglon (no RenglonesVenta)
    const ventasAfectadas = await prisma.ventaRenglon.updateMany({  // ✅ CORREGIDO
      where: {
        venta: { campoId: campo.id },
        categoria: 'Terneros/as'
      },
      data: {
        categoria: 'Terneros'
      }
    })

    console.log(`  ✅ Actualizados ${ventasAfectadas.count} renglones de venta`)

    // 8️⃣ Actualizar CompraRenglon (no RenglonesCompra)
    const comprasAfectadas = await prisma.compraRenglon.updateMany({  // ✅ CORREGIDO
      where: {
        compra: { campoId: campo.id },
        categoria: 'Terneros/as'
      },
      data: {
        categoria: 'Terneros'
      }
    })

    console.log(`  ✅ Actualizados ${comprasAfectadas.count} renglones de compra`)

    // 9️⃣ Actualizar ConsumoRenglon (no RenglonesConsumo)
    const consumosAfectados = await prisma.consumoRenglon.updateMany({  // ✅ CORREGIDO
      where: {
        consumo: { campoId: campo.id },
        categoria: 'Terneros/as'
      },
      data: {
        categoria: 'Terneros'
      }
    })

    console.log(`  ✅ Actualizados ${consumosAfectados.count} renglones de consumo`)

    // 🔟 Desactivar la categoría antigua (NO borrarla por historial)
    await prisma.categoriaAnimal.update({
      where: { id: categoriaAntigua.id },
      data: { activo: false }
    })

    console.log(`  ✅ Desactivada categoría antigua: Terneros/as`)
  }

  console.log('\n✅ Migración completada')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())