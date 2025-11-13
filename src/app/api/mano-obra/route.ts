import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const mes = Number(searchParams.get('mes'))
  const anio = Number(searchParams.get('anio'))

  const data = await prisma.manoObra.findMany({
    where: { mes, anio },
    orderBy: { nombre: 'asc' }
  })

  return NextResponse.json(data)
}

// POST
export async function POST(req: Request) {
  const body = await req.json()
  const nuevo = await prisma.manoObra.create({
    data: body
  })
  return NextResponse.json(nuevo)
}

// PUT
export async function PUT(req: Request) {
  const body = await req.json()
  const { id, ...rest } = body

  const actualizado = await prisma.manoObra.update({
    where: { id },
    data: rest
  })

  return NextResponse.json(actualizado)
}

// DELETE
export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url)
  const id = Number(searchParams.get('id'))

  const eliminado = await prisma.manoObra.delete({
    where: { id }
  })

  return NextResponse.json(eliminado)
}