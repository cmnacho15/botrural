import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"

// 🎨 Categorías predeterminadas con colores
const CATEGORIAS_GASTOS_DEFAULT = [
  { nombre: 'Alimentación', color: '#ef4444' },
  { nombre: 'Otros', color: '#6b7280' },
  { nombre: 'Administración', color: '#3b82f6' },
  { nombre: 'Renta', color: '#8b5cf6' },
  { nombre: 'Asesoramiento', color: '#06b6d4' },
  { nombre: 'Combustible', color: '#f97316' },
  { nombre: 'Compras de Hacienda', color: '#84cc16' },
  { nombre: 'Estructuras', color: '#64748b' },
  { nombre: 'Fertilizantes', color: '#22c55e' },
  { nombre: 'Fitosanitarios', color: '#14b8a6' },
  { nombre: 'Gastos Comerciales', color: '#a855f7' },
  { nombre: 'Impuestos', color: '#ec4899' },
  { nombre: 'Insumos Agrícolas', color: '#eab308' },
  { nombre: 'Labores', color: '#f59e0b' },
  { nombre: 'Maquinaria', color: '#78716c' },
  { nombre: 'Sanidad', color: '#dc2626' },
  { nombre: 'Seguros', color: '#0ea5e9' },
  { nombre: 'Semillas', color: '#65a30d' },
  { nombre: 'Sueldos', color: '#7c3aed' },
]

// 🐄 Categorías de animales predeterminadas
const CATEGORIAS_ANIMALES_DEFAULT = [
  // BOVINOS
  { nombreSingular: 'Toros', nombrePlural: 'Toros', tipoAnimal: 'BOVINO' },
  { nombreSingular: 'Vacas', nombrePlural: 'Vacas', tipoAnimal: 'BOVINO' },
  { nombreSingular: 'Novillos +3 años', nombrePlural: 'Novillos +3 años', tipoAnimal: 'BOVINO' },
  { nombreSingular: 'Novillos 2–3 años', nombrePlural: 'Novillos 2–3 años', tipoAnimal: 'BOVINO' },
  { nombreSingular: 'Novillos 1–2 años', nombrePlural: 'Novillos 1–2 años', tipoAnimal: 'BOVINO' },
  { nombreSingular: 'Vaquillonas +2 años', nombrePlural: 'Vaquillonas +2 años', tipoAnimal: 'BOVINO' },
  { nombreSingular: 'Vaquillonas 1–2 años', nombrePlural: 'Vaquillonas 1–2 años', tipoAnimal: 'BOVINO' },
  { nombreSingular: 'Terneros/as', nombrePlural: 'Terneros/as', tipoAnimal: 'BOVINO' },
  { nombreSingular: 'Terneros nacidos', nombrePlural: 'Terneros nacidos', tipoAnimal: 'BOVINO' },
  
  // OVINOS
  { nombreSingular: 'Carneros', nombrePlural: 'Carneros', tipoAnimal: 'OVINO' },
  { nombreSingular: 'Ovejas', nombrePlural: 'Ovejas', tipoAnimal: 'OVINO' },
  { nombreSingular: 'Capones', nombrePlural: 'Capones', tipoAnimal: 'OVINO' },
  { nombreSingular: 'Borregas 2–4 dientes', nombrePlural: 'Borregas 2–4 dientes', tipoAnimal: 'OVINO' },
  { nombreSingular: 'Corderas DL', nombrePlural: 'Corderas DL', tipoAnimal: 'OVINO' },
  { nombreSingular: 'Corderos DL', nombrePlural: 'Corderos DL', tipoAnimal: 'OVINO' },
  { nombreSingular: 'Corderos/as Mamones', nombrePlural: 'Corderos/as Mamones', tipoAnimal: 'OVINO' },
  
  // EQUINOS
  { nombreSingular: 'Padrillos', nombrePlural: 'Padrillos', tipoAnimal: 'EQUINO' },
  { nombreSingular: 'Yeguas', nombrePlural: 'Yeguas', tipoAnimal: 'EQUINO' },
  { nombreSingular: 'Caballos', nombrePlural: 'Caballos', tipoAnimal: 'EQUINO' },
  { nombreSingular: 'Potrillos', nombrePlural: 'Potrillos', tipoAnimal: 'EQUINO' },
]

export async function POST(request: Request) {
  try {
    const { name, email, password, campoNombre } = await request.json()

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

    // Crear campo + usuario admin + categorías predeterminadas
    const result = await prisma.$transaction(async (tx) => {
      // 1. Crear campo
      const campo = await tx.campo.create({
        data: { nombre: campoNombre },
      })

      // 2. Crear usuario admin
      const user = await tx.user.create({
        data: {
          name,
          email,
          password: hashedPassword,
          role: "ADMIN_GENERAL",
          accesoFinanzas: true,
          campoId: campo.id,
        },
      })

      // 3. Crear categorías de gastos predeterminadas
      await tx.categoriaGasto.createMany({
        data: CATEGORIAS_GASTOS_DEFAULT.map((cat, index) => ({
          nombre: cat.nombre,
          color: cat.color,
          campoId: campo.id,
          orden: index,
          activo: true,
        })),
      })

      // 🆕 4. Crear categorías de animales predeterminadas
await tx.categoriaAnimal.createMany({
  data: CATEGORIAS_ANIMALES_DEFAULT.map(cat => ({
    nombreSingular: cat.nombreSingular,
    nombrePlural: cat.nombrePlural,
    tipoAnimal: cat.tipoAnimal as any, // 👈 Agregá el "as any"
    campoId: campo.id,
    activo: true,
    esPredeterminado: true,
  })),
})
      return { user, campo }
    })

    console.log(`✅ Campo creado: ${result.campo.nombre}`)
    console.log(`   - ${CATEGORIAS_GASTOS_DEFAULT.length} categorías de gastos`)
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