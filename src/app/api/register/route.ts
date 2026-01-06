//src/app/api/register/route.ts

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { CATEGORIAS_ANIMALES_DEFAULT } from "@/lib/constants"

import { CATEGORIAS_GASTOS_DEFAULT } from '@/lib/constants'

export async function POST(request: Request) {
  try {
    const { name, email, password, campoNombre, telefono, tipoCampo } = await request.json()

    if (!name || !email || !password || !campoNombre) {
      return NextResponse.json(
        { error: "Todos los campos son requeridos" },
        { status: 400 }
      )
    }

    // Verificar email duplicado
    const existingUser = await prisma.user.findUnique({
      where: { email },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: "El email ya está registrado" },
        { status: 400 }
      )
    }

    // Hash
    const hashedPassword = await bcrypt.hash(password, 10)

    // Crear grupo + campo + usuario admin + categorías predeterminadas
    const result = await prisma.$transaction(async (tx) => {
      // 1. Crear grupo (usa el nombre del campo como nombre del grupo)
      const grupo = await tx.grupo.create({
        data: { nombre: campoNombre },
      })

      // 2. Crear campo asociado al grupo
      const campo = await tx.campo.create({
        data: { 
          nombre: campoNombre,
          tipoCampo: tipoCampo || 'MIXTO',
          grupoId: grupo.id,
        },
      })

      // 3. Crear usuario admin
      const user = await tx.user.create({
        data: {
          name,
          email,
          password: hashedPassword,
          role: "ADMIN_GENERAL",
          accesoFinanzas: true,
          campoId: campo.id,
          onboardingStartedAt: new Date(),
          telefono: telefono || null,
        },
      })

      // 4. Crear relación UsuarioGrupo
      await tx.usuarioGrupo.create({
        data: {
          userId: user.id,
          grupoId: grupo.id,
          rol: "ADMIN_GENERAL",
          esActivo: true,
        },
      })

      // 5. Crear relación UsuarioCampo
      await tx.usuarioCampo.create({
        data: {
          userId: user.id,
          campoId: campo.id,
          rol: "ADMIN_GENERAL",
          esActivo: true,
        },
      })

      // 6. Crear categorías de gastos predeterminadas según tipo de campo
      const categoriasFiltradas = tipoCampo === 'GANADERO'
        ? CATEGORIAS_GASTOS_DEFAULT.filter(cat => cat.nombre !== 'Insumos de Cultivos')
        : CATEGORIAS_GASTOS_DEFAULT

      await tx.categoriaGasto.createMany({
        data: categoriasFiltradas.map((cat) => ({
          nombre: cat.nombre,
          color: cat.color,
          campoId: campo.id,
          orden: cat.orden,
          activo: true,
        })),
        skipDuplicates: true,
      })

      // 7. Crear categorías de animales predeterminadas
      await tx.categoriaAnimal.createMany({
        data: CATEGORIAS_ANIMALES_DEFAULT.map(cat => ({
          nombreSingular: cat.nombreSingular,
          nombrePlural: cat.nombrePlural,
          tipoAnimal: cat.tipoAnimal,
          campoId: campo.id,
          activo: true,
          esPredeterminado: true,
        })),
        skipDuplicates: true,
      })

      return { user, campo, grupo }
    })

    // Calcular cuántas categorías se crearon
    const cantidadCategorias = tipoCampo === 'GANADERO'
      ? CATEGORIAS_GASTOS_DEFAULT.length - 1
      : CATEGORIAS_GASTOS_DEFAULT.length

    console.log(`✅ Registro completo:`)
    console.log(`   - Grupo: ${result.grupo.nombre}`)
    console.log(`   - Campo: ${result.campo.nombre}`)
    console.log(`   - Usuario: ${result.user.email}`)
    console.log(`   - ${cantidadCategorias} categorías de gastos`)
    console.log(`   - ${CATEGORIAS_ANIMALES_DEFAULT.length} categorías de animales`)

    return NextResponse.json(
      {
        message: "Registro exitoso",
        user: {
          id: result.user.id,
          name: result.user.name,
          email: result.user.email,
          role: result.user.role,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    console.error("💥 Error en /api/register:", error)
    return NextResponse.json(
      { error: "Error interno al registrar usuario" },
      { status: 500 }
    )
  }
}