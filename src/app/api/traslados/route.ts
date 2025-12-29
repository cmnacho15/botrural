import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"

/**
 * GET - Obtener traslados del usuario (egresos e ingresos)
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }

    const usuario = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { campoId: true }
    })

    if (!usuario?.campoId) {
      return NextResponse.json({ error: "Sin campo asignado" }, { status: 400 })
    }

    // Obtener traslados donde el campo actual es origen O destino
    const traslados = await prisma.traslado.findMany({
      where: {
        OR: [
          { campoOrigenId: usuario.campoId },
          { campoDestinoId: usuario.campoId }
        ]
      },
      include: {
        campoOrigen: { select: { id: true, nombre: true } },
        campoDestino: { select: { id: true, nombre: true } },
        potreroOrigen: { select: { id: true, nombre: true } },
        potreroDestino: { select: { id: true, nombre: true } }
      },
      orderBy: { fecha: 'desc' }
    })

    // Separar en egresos e ingresos
    const egresos = traslados.filter(t => t.campoOrigenId === usuario.campoId)
    const ingresos = traslados.filter(t => t.campoDestinoId === usuario.campoId)

    return NextResponse.json({
      egresos,
      ingresos,
      campoActualId: usuario.campoId
    })
  } catch (error) {
    console.error("Error obteniendo traslados:", error)
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}

/**
 * POST - Crear traslado entre campos
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }

    const usuario = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, campoId: true }
    })

    if (!usuario?.campoId) {
      return NextResponse.json({ error: "Sin campo asignado" }, { status: 400 })
    }

    const body = await request.json()
    const {
      fecha,
      potreroOrigenId,
      campoDestinoId,
      potreroDestinoId,
      animales, // Array de { tipoAnimal, categoria, cantidad, pesoPromedio?, precioKgUSD? }
      notas
    } = body

    // Validaciones
    if (!fecha || !potreroOrigenId || !campoDestinoId || !potreroDestinoId) {
      return NextResponse.json({ error: "Faltan datos requeridos" }, { status: 400 })
    }

    if (!animales || animales.length === 0) {
      return NextResponse.json({ error: "Debe incluir al menos un animal" }, { status: 400 })
    }

    // Verificar que el usuario tiene acceso al campo destino
    const accesoDestino = await prisma.usuarioCampo.findFirst({
      where: {
        userId: usuario.id,
        campoId: campoDestinoId
      }
    })

    if (!accesoDestino) {
      return NextResponse.json({ error: "No tenés acceso al campo destino" }, { status: 403 })
    }

    // Verificar que el potrero origen pertenece al campo actual
    const potreroOrigen = await prisma.lote.findFirst({
      where: {
        id: potreroOrigenId,
        campoId: usuario.campoId
      },
      include: {
        animalesLote: true
      }
    })

    if (!potreroOrigen) {
      return NextResponse.json({ error: "Potrero origen no encontrado" }, { status: 404 })
    }

    // Verificar que el potrero destino pertenece al campo destino
    const potreroDestino = await prisma.lote.findFirst({
      where: {
        id: potreroDestinoId,
        campoId: campoDestinoId
      }
    })

    if (!potreroDestino) {
      return NextResponse.json({ error: "Potrero destino no encontrado" }, { status: 404 })
    }

    // Validar stock disponible
    for (const animal of animales) {
      const stockActual = potreroOrigen.animalesLote.find(
        a => a.categoria === animal.categoria
      )
      
      if (!stockActual || stockActual.cantidad < animal.cantidad) {
        return NextResponse.json({
          error: `Stock insuficiente de ${animal.categoria}. Disponible: ${stockActual?.cantidad || 0}`
        }, { status: 400 })
      }
    }

    // Crear traslados en transacción
    const resultado = await prisma.$transaction(async (tx) => {
      const trasladosCreados = []

      for (const animal of animales) {
        // Calcular valores
        const pesoTotalKg = animal.pesoPromedio ? animal.cantidad * animal.pesoPromedio : null
        const precioAnimalUSD = (animal.pesoPromedio && animal.precioKgUSD) 
          ? animal.pesoPromedio * animal.precioKgUSD 
          : null
        const totalUSD = precioAnimalUSD ? animal.cantidad * precioAnimalUSD : null

        // Crear traslado
        const traslado = await tx.traslado.create({
          data: {
            fecha: new Date(fecha),
            campoOrigenId: usuario.campoId!,
            potreroOrigenId,
            campoDestinoId,
            potreroDestinoId,
            tipoAnimal: animal.tipoAnimal,
            categoria: animal.categoria,
            cantidad: animal.cantidad,
            pesoPromedio: animal.pesoPromedio || null,
            precioKgUSD: animal.precioKgUSD || null,
            pesoTotalKg,
            precioAnimalUSD,
            totalUSD,
            stockDescontado: true,
            stockSumado: true,
            notas: notas || null
          }
        })

        trasladosCreados.push(traslado)

        // Descontar del potrero origen
        const animalLoteOrigen = await tx.animalLote.findFirst({
          where: {
            loteId: potreroOrigenId,
            categoria: animal.categoria
          }
        })

        if (animalLoteOrigen) {
          const nuevaCantidad = animalLoteOrigen.cantidad - animal.cantidad
          
          if (nuevaCantidad <= 0) {
            await tx.animalLote.delete({
              where: { id: animalLoteOrigen.id }
            })
          } else {
            await tx.animalLote.update({
              where: { id: animalLoteOrigen.id },
              data: { cantidad: nuevaCantidad }
            })
          }
        }

        // Sumar al potrero destino
        const animalLoteDestino = await tx.animalLote.findFirst({
          where: {
            loteId: potreroDestinoId,
            categoria: animal.categoria
          }
        })

        if (animalLoteDestino) {
          await tx.animalLote.update({
            where: { id: animalLoteDestino.id },
            data: { cantidad: animalLoteDestino.cantidad + animal.cantidad }
          })
        } else {
          await tx.animalLote.create({
            data: {
              loteId: potreroDestinoId,
              categoria: animal.categoria,
              cantidad: animal.cantidad,
              peso: animal.pesoPromedio || null
            }
          })
        }

        // Actualizar ultimoCambio en ambos potreros
        await tx.lote.update({
          where: { id: potreroOrigenId },
          data: { ultimoCambio: new Date() }
        })

        await tx.lote.update({
          where: { id: potreroDestinoId },
          data: { ultimoCambio: new Date() }
        })
      }

      return trasladosCreados
    })

    console.log(`✅ Traslado creado: ${resultado.length} categorías movidas`)

    return NextResponse.json({
      success: true,
      traslados: resultado
    }, { status: 201 })

  } catch (error) {
    console.error("Error creando traslado:", error)
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}

/**
 * PATCH - Actualizar peso/precio de un traslado
 */
export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }

    const usuario = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { campoId: true }
    })

    if (!usuario?.campoId) {
      return NextResponse.json({ error: "Sin campo asignado" }, { status: 400 })
    }

    const body = await request.json()
    const { id, pesoPromedio, precioKgUSD } = body

    if (!id) {
      return NextResponse.json({ error: "ID requerido" }, { status: 400 })
    }

    // Verificar que el traslado pertenece a uno de los campos del usuario
    const traslado = await prisma.traslado.findFirst({
      where: {
        id,
        OR: [
          { campoOrigenId: usuario.campoId },
          { campoDestinoId: usuario.campoId }
        ]
      }
    })

    if (!traslado) {
      return NextResponse.json({ error: "Traslado no encontrado" }, { status: 404 })
    }

    // Calcular nuevos valores
    const pesoTotalKg = pesoPromedio ? traslado.cantidad * pesoPromedio : null
    const precioAnimalUSD = (pesoPromedio && precioKgUSD) ? pesoPromedio * precioKgUSD : null
    const totalUSD = precioAnimalUSD ? traslado.cantidad * precioAnimalUSD : null

    const actualizado = await prisma.traslado.update({
      where: { id },
      data: {
        pesoPromedio: pesoPromedio || null,
        precioKgUSD: precioKgUSD || null,
        pesoTotalKg,
        precioAnimalUSD,
        totalUSD
      }
    })

    return NextResponse.json({ success: true, traslado: actualizado })
  } catch (error) {
    console.error("Error actualizando traslado:", error)
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}