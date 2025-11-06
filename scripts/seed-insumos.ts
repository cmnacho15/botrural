import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Obtener o crear el campo
  let campo = await prisma.campo.findFirst()
  
  if (!campo) {
    campo = await prisma.campo.create({
      data: { nombre: 'El Porvenir' },
    })
  }

  // Crear insumos de ejemplo
  const insumosEjemplo = [
    { nombre: 'Gasoil', unidad: 'Litros' },
    { nombre: 'Rollos', unidad: 'Unidades' },
    { nombre: 'Maíz', unidad: 'Kilos' },
    { nombre: 'Balanceado', unidad: 'Kilos' },
    { nombre: 'Alambre', unidad: 'Metros' },
    { nombre: 'Hamburguesas', unidad: 'Unidades' },
  ]

  for (const insumo of insumosEjemplo) {
    const existe = await prisma.insumo.findFirst({
      where: {
        nombre: insumo.nombre,
        campoId: campo.id,
      },
    })

    if (!existe) {
      await prisma.insumo.create({
        data: {
          nombre: insumo.nombre,
          unidad: insumo.unidad,
          campoId: campo.id,
        },
      })
      console.log(`✅ Creado: ${insumo.nombre}`)
    } else {
      console.log(`⏭️  Ya existe: ${insumo.nombre}`)
    }
  }

  console.log('🎉 Insumos de ejemplo creados!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })