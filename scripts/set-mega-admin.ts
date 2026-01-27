/**
 * Script para asignar rol MEGA_ADMIN a un usuario
 *
 * Uso: npx ts-node scripts/set-mega-admin.ts <email>
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const email = process.argv[2]

  if (!email) {
    console.error('❌ Uso: npx ts-node scripts/set-mega-admin.ts <email>')
    process.exit(1)
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, name: true, role: true }
    })

    if (!user) {
      console.error(`❌ Usuario con email "${email}" no encontrado`)
      process.exit(1)
    }

    console.log(`\n👤 Usuario encontrado:`)
    console.log(`   ID: ${user.id}`)
    console.log(`   Email: ${user.email}`)
    console.log(`   Nombre: ${user.name}`)
    console.log(`   Rol actual: ${user.role}`)

    if (user.role === 'MEGA_ADMIN') {
      console.log('\n✅ El usuario ya es MEGA_ADMIN')
      return
    }

    const updated = await prisma.user.update({
      where: { email },
      data: { role: 'MEGA_ADMIN' }
    })

    console.log(`\n✅ Usuario actualizado a MEGA_ADMIN`)
    console.log(`   Nuevo rol: ${updated.role}`)

  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
