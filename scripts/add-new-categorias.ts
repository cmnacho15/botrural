import { PrismaClient } from '@prisma/client'
import { CATEGORIAS_ANIMALES_DEFAULT } from '../src/lib/constants'

const prisma = new PrismaClient()

async function main() {
  console.log('🔄 Agregando nuevas categorías de animales...')

  const campos = await prisma.campo.findMany({
    select: { id: true, nombre: true }
  })

  console.log(`📋 Encontrados ${campos.length} campos`)

  for (const campo of campos) {
    console.log(`\n🏕️  Procesando: ${campo.nombre}`)
    
    // Obtener categorías existentes
    const existentes = await prisma.categoriaAnimal.findMany({
      where: { campoId: campo.id },
      select: { nombreSingular: true }
    })
    
    const nombresExistentes = new Set(existentes.map(c => c.nombreSingular))
    
    // Filtrar solo las nuevas
    const nuevas = CATEGORIAS_ANIMALES_DEFAULT.filter(
      cat => !nombresExistentes.has(cat.nombreSingular)
    )
    
    if (nuevas.length === 0) {
      console.log(`   ✅ Ya tiene todas las categorías`)
      continue
    }

    // Crear solo las nuevas
    await prisma.categoriaAnimal.createMany({
      data: nuevas.map(cat => ({
        nombreSingular: cat.nombreSingular,
        nombrePlural: cat.nombrePlural,
        tipoAnimal: cat.tipoAnimal,
        campoId: campo.id,
        activo: true,
        esPredeterminado: true,
      })),
      skipDuplicates: true,
    })

    console.log(`   ✅ Agregadas ${nuevas.length} categorías nuevas`)
  }

  console.log('\n🎉 Actualización completada!')
}

main()
  .catch((e) => {
    console.error('❌ Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })