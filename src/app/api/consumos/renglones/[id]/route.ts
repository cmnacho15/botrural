// app/api/consumos/renglones/[id]/route.ts

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"

// ====================================================
// PATCH – ACTUALIZAR PESO Y PRECIO DE RENGLÓN
// ====================================================
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id)
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })

    const usuario = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { campoId: true },
    })

    if (!usuario?.campoId)
      return NextResponse.json({ error: "Usuario sin campo" }, { status: 400 })

    const { id } = await params
    const body = await request.json()

    // Verificar que el renglón pertenece al campo del usuario
    const renglon = await prisma.consumoRenglon.findFirst({
      where: {
        id,
        consumo: {
          campoId: usuario.campoId
        }
      },
    })

    if (!renglon)
      return NextResponse.json(
        { error: "Renglón no encontrado" },
        { status: 404 }
      )

    // Preparar datos actualizados
    const pesoPromedio = body.pesoPromedio !== undefined 
      ? (body.pesoPromedio ? parseFloat(body.pesoPromedio) : null)
      : renglon.pesoPromedio

    const precioKgUSD = body.precioKgUSD !== undefined
      ? (body.precioKgUSD ? parseFloat(body.precioKgUSD) : null)
      : renglon.precioKgUSD

    // Recalcular valores derivados
    const precioAnimalUSD = pesoPromedio && precioKgUSD
      ? pesoPromedio * precioKgUSD
      : null

    const pesoTotalKg = pesoPromedio && renglon.cantidad
      ? pesoPromedio * renglon.cantidad
      : null

    const valorTotalUSD = pesoTotalKg && precioKgUSD
      ? pesoTotalKg * precioKgUSD
      : null

    // Actualizar renglón
    const renglonActualizado = await prisma.consumoRenglon.update({
      where: { id },
      data: {
        pesoPromedio,
        precioKgUSD,
        precioAnimalUSD,
        pesoTotalKg,
        valorTotalUSD,
      },
    })

    return NextResponse.json(renglonActualizado, { status: 200 })

  } catch (error) {
    console.error("ERROR EN PATCH /api/consumos/renglones/[id]:", error)
    return NextResponse.json(
      {
        error: "Error al actualizar renglón",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}

// ====================================================
// DELETE – ELIMINAR RENGLÓN
// ====================================================
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id)
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })

    const usuario = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { campoId: true },
    })

    if (!usuario?.campoId)
      return NextResponse.json({ error: "Usuario sin campo" }, { status: 400 })

    const { id } = await params

    // Verificar que el renglón pertenece al campo del usuario
    const renglon = await prisma.consumoRenglon.findFirst({
      where: {
        id,
        consumo: {
          campoId: usuario.campoId
        }
      },
      include: {
        consumo: {
          include: {
            renglones: true
          }
        }
      }
    })

    if (!renglon)
      return NextResponse.json(
        { error: "Renglón no encontrado" },
        { status: 404 }
      )

    // Eliminar el renglón
    await prisma.consumoRenglon.delete({
      where: { id }
    })

    // Si era el último renglón del consumo, eliminar el consumo también
    if (renglon.consumo.renglones.length === 1) {
      await prisma.consumo.delete({
        where: { id: renglon.consumoId }
      })
    }

    return NextResponse.json({ success: true, message: "Renglón eliminado" }, { status: 200 })

  } catch (error) {
    console.error("ERROR EN DELETE /api/consumos/renglones/[id]:", error)
    return NextResponse.json(
      {
        error: "Error al eliminar renglón",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}