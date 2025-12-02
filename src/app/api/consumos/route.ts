// app/api/consumos/route.ts

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"

// ====================================================
// FUNCIÓN AUXILIAR PARA DETERMINAR TIPO DE ANIMAL
// ====================================================
function determinarTipoAnimal(categoria: string): string {
  const categoriaLower = categoria.toLowerCase()
  
  // BOVINOS
  if (categoriaLower.includes('vaca') || 
      categoriaLower.includes('toro') || 
      categoriaLower.includes('novillo') || 
      categoriaLower.includes('vaquillona') ||
      categoriaLower.includes('ternero') || 
      categoriaLower.includes('ternera')) {
    return 'BOVINO'
  }
  
  // OVINOS
  if (categoriaLower.includes('oveja') || 
      categoriaLower.includes('carnero') || 
      categoriaLower.includes('cordero') || 
      categoriaLower.includes('capón')) {
    return 'OVINO'
  }
  
  // EQUINOS
  if (categoriaLower.includes('caballo') || 
      categoriaLower.includes('yegua') || 
      categoriaLower.includes('potrillo') || 
      categoriaLower.includes('potro')) {
    return 'EQUINO'
  }
  
  return 'OTRO'
}

// ====================================================
// POST – CREAR CONSUMO
// ====================================================
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    console.log('🔐 Session:', session?.user?.id)

    if (!session?.user?.id)
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })

    const usuario = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { campoId: true },
    })
    console.log('👤 Usuario campoId:', usuario?.campoId)

    if (!usuario?.campoId)
      return NextResponse.json({ error: "Usuario sin campo" }, { status: 400 })

    const body = await request.json()
    console.log('📦 Body recibido:', JSON.stringify(body, null, 2))
    
    const { fecha, descripcion, notas, renglon } = body

    // Validar datos del renglón
    if (!renglon?.categoria || !renglon?.cantidad || !renglon?.animalLoteId) {
      return NextResponse.json(
        { error: "Faltan datos del renglón (categoria, cantidad, animalLoteId)" },
        { status: 400 }
      )
    }

    // Verificar que hay suficientes animales disponibles
    const animalLote = await prisma.animalLote.findUnique({
      where: { id: renglon.animalLoteId },
      include: { lote: true }
    })

    if (!animalLote) {
      return NextResponse.json(
        { error: "Animal lote no encontrado" },
        { status: 404 }
      )
    }

    if (animalLote.cantidad < renglon.cantidad) {
      return NextResponse.json(
        { error: `Solo hay ${animalLote.cantidad} ${renglon.categoria} disponibles` },
        { status: 400 }
      )
    }

    // Calcular valores automáticos
    const pesoPromedio = renglon.pesoPromedio ? parseFloat(renglon.pesoPromedio) : null
    const precioKgUSD = renglon.precioKgUSD ? parseFloat(renglon.precioKgUSD) : null
    
    const precioAnimalUSD = pesoPromedio && precioKgUSD 
      ? pesoPromedio * precioKgUSD 
      : null
    
    const pesoTotalKg = pesoPromedio && renglon.cantidad
      ? pesoPromedio * renglon.cantidad
      : null
    
    const valorTotalUSD = pesoTotalKg && precioKgUSD
      ? pesoTotalKg * precioKgUSD
      : null

    // ✅ DETERMINAR TIPO DE ANIMAL AUTOMÁTICAMENTE
    const tipoAnimal = determinarTipoAnimal(renglon.categoria)
    console.log(`🐄 Tipo detectado: ${tipoAnimal} para categoría: ${renglon.categoria}`)

    // Crear consumo con renglón en una transacción
    const consumo = await prisma.$transaction(async (tx) => {
      // 1. Crear el consumo con fecha corregida (evitar problema de zona horaria)
      const fechaLocal = new Date(fecha + 'T12:00:00')
      
      const nuevoConsumo = await tx.consumo.create({
        data: {
          campoId: usuario.campoId!,
          fecha: fechaLocal,
          descripcion: descripcion || null,
          notas: notas || null,
        }
      })

      // 2. Crear el renglón con el tipo correcto
      await tx.consumoRenglon.create({
        data: {
          consumoId: nuevoConsumo.id,
          tipoAnimal, // ✅ AHORA USA EL TIPO DETECTADO
          categoria: renglon.categoria,
          cantidad: renglon.cantidad,
          pesoPromedio,
          precioKgUSD,
          precioAnimalUSD,
          pesoTotalKg,
          valorTotalUSD,
          descontadoDeStock: true,
          animalLoteId: renglon.animalLoteId,
          fechaDescuento: new Date(),
        }
      })

      // 3. Descontar del stock
      const nuevaCantidad = animalLote.cantidad - renglon.cantidad
      
      if (nuevaCantidad === 0) {
        await tx.animalLote.delete({
          where: { id: renglon.animalLoteId }
        })
      } else {
        await tx.animalLote.update({
          where: { id: renglon.animalLoteId },
          data: { cantidad: nuevaCantidad }
        })
      }

      // 4. Actualizar ultimoCambio del potrero
      await tx.lote.update({
        where: { id: animalLote.loteId },
        data: { ultimoCambio: new Date() }
      })

      return nuevoConsumo
    })

    return NextResponse.json(consumo, { status: 201 })

  } catch (error) {
    console.error("ERROR EN POST /api/consumos:", error)
    return NextResponse.json(
      {
        error: "Error al crear consumo",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}

// ====================================================
// GET – OBTENER CONSUMOS
// ====================================================
export async function GET(request: Request) {
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

    const consumos = await prisma.consumo.findMany({
      where: {
        campoId: usuario.campoId
      },
      include: {
        renglones: {
          include: {
            animalLote: {
              include: {
                lote: {
                  select: {
                    nombre: true
                  }
                }
              }
            }
          }
        }
      },
      orderBy: {
        fecha: 'desc'
      }
    })

    return NextResponse.json(consumos, { status: 200 })

  } catch (error) {
    console.error("ERROR EN GET /api/consumos:", error)
    return NextResponse.json(
      {
        error: "Error al obtener consumos",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}