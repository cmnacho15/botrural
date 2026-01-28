//src/app/api/campo-actual/route.ts
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const { error, user } = await requireAuth()
    if (error) return error

    const campo = await prisma.campo.findUnique({
      where: { id: user!.campoId! },
      select: {
        id: true,
        nombre: true,
        tipoCampo: true,
      },
    })

    if (!campo) {
      return NextResponse.json({ error: 'Campo no encontrado' }, { status: 404 })
    }

    return NextResponse.json(campo)
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Error al obtener campo' }, { status: 500 })
  }
}