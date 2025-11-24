import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CATEGORIAS_DEFAULT = [
  { nombre: 'Alimentación', color: '#a855f7', orden: 1 },
  { nombre: 'Otros', color: '#22c55e', orden: 2 },
  { nombre: 'Administración', color: '#f97316', orden: 3 },
  { nombre: 'Alquiler', color: '#06b6d4', orden: 4 },
  { nombre: 'Asesoramiento', color: '#ec4899', orden: 5 },
  { nombre: 'Combustible', color: '#84cc16', orden: 6 },
  { nombre: 'Compras de Hacienda', color: '#3b82f6', orden: 7 },
  { nombre: 'Estructuras', color: '#ef4444', orden: 8 },
  { nombre: 'Fertilizantes', color: '#4ade80', orden: 9 },
  { nombre: 'Fitosanitarios', color: '#60a5fa', orden: 10 },
  { nombre: 'Gastos Comerciales', color: '#f87171', orden: 11 },
  { nombre: 'Impuestos', color: '#16a34a', orden: 12 },
  { nombre: 'Insumos Agrícolas', color: '#c084fc', orden: 13 },
  { nombre: 'Labores', color: '#eab308', orden: 14 },
  { nombre: 'Maquinaria', color: '#22d3ee', orden: 15 },
  { nombre: 'Sanidad', color: '#f472b6', orden: 16 },
  { nombre: 'Seguros', color: '#a3e635', orden: 17 },
  { nombre: 'Semillas', color: '#2563eb', orden: 18 },
  { nombre: 'Sueldos', color: '#dc2626', orden: 19 },
]

async function main() {
  console.log('Migrando categorías a la base de datos...')

  // Obtener todos los campos
  const campos = await prisma.campo.findMany()

  for (const campo of campos) {
    console.log(`Procesando campo: ${campo.nombre}`)

    for (const cat of CATEGORIAS_DEFAULT) {
      const existe = await prisma.categoriaGasto.findFirst({
        where: {
          nombre: cat.nombre,
          campoId: campo.id,
        },
      })

      if (!existe) {
        await prisma.categoriaGasto.create({
          data: {
            nombre: cat.nombre,
            color: cat.color,
            orden: cat.orden,
            campoId: campo.id,
          },
        })
        console.log(`  ✓ Creada: ${cat.nombre}`)
      } else {
        console.log(`  - Ya existe: ${cat.nombre}`)
      }
    }
  }

  console.log('✅ Migración completada')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })