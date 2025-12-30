// src/app/api/equivalencias-ug/route.ts
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

// 📋 PESOS DEFAULT (en kg) - Basados en las equivalencias UG originales
// Fórmula: pesoKg = equivalenciaUG * 380
export const PESOS_DEFAULT: Record<string, number> = {
  // 🐄 VACUNOS
  'Toros': 456,           // 1.20 * 380
  'Vacas': 380,           // 1.00 * 380
  'Vacas Gordas': 456,    // 1.20 * 380
  'Novillos +3 años': 456, // 1.20 * 380
  'Novillos 2–3 años': 380, // 1.00 * 380
  'Novillos 1–2 años': 266, // 0.70 * 380
  'Vaquillonas +2 años': 380, // 1.00 * 380
  'Vaquillonas 1–2 años': 266, // 0.70 * 380
  'Terneros': 152,        // 0.40 * 380
  'Terneras': 152,        // 0.40 * 380
  'Terneros nacidos': 0,  // 0 * 380
  
  // 🐑 OVINOS
  'Carneros': 65,         // 0.17 * 380 ≈ 64.6
  'Ovejas': 61,           // 0.16 * 380 ≈ 60.8
  'Capones': 53,          // 0.14 * 380 ≈ 53.2
  'Borregas 2–4 dientes': 61, // 0.16 * 380
  'Corderas DL': 38,      // 0.10 * 380
  'Corderos DL': 38,      // 0.10 * 380
  'Corderos/as Mamones': 38, // 0.10 * 380

  // 🐴 YEGUARIZOS
  'Padrillos': 456,       // 1.20 * 380
  'Yeguas': 456,          // 1.20 * 380
  'Caballos': 456,        // 1.20 * 380
  'Potrillos': 456,       // 1.20 * 380
}

// GET - Obtener equivalencias del campo (personalizadas + defaults)
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const usuario = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { campoId: true },
    })

    if (!usuario?.campoId) {
      return NextResponse.json({ error: 'Usuario sin campo' }, { status: 400 })
    }

    // Obtener equivalencias personalizadas del campo
    const personalizadas = await prisma.equivalenciaUG.findMany({
      where: { campoId: usuario.campoId }
    })

    // Crear mapa de personalizadas
    const personalizadasMap = new Map(
      personalizadas.map(eq => [eq.categoria, eq])
    )

    // Construir lista completa con defaults + personalizadas
    const equivalencias = Object.entries(PESOS_DEFAULT).map(([categoria, pesoDefault]) => {
      const personalizada = personalizadasMap.get(categoria)
      const pesoKg = personalizada?.pesoKg ?? pesoDefault
      const equivalenciaUG = pesoKg / 380

      return {
        categoria,
        pesoKg,
        pesoDefault,
        equivalenciaUG: Math.round(equivalenciaUG * 100) / 100, // 2 decimales
        esPersonalizada: !!personalizada,
        id: personalizada?.id ?? null
      }
    })

    return NextResponse.json({
      campoId: usuario.campoId,
      equivalencias,
      pesoReferencia: 380 // 1 UG = 380 kg
    })

  } catch (error) {
    console.error('Error al obtener equivalencias UG:', error)
    return NextResponse.json({ error: 'Error al obtener equivalencias' }, { status: 500 })
  }
}

// POST - Guardar/actualizar equivalencias personalizadas
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const usuario = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { campoId: true },
    })

    if (!usuario?.campoId) {
      return NextResponse.json({ error: 'Usuario sin campo' }, { status: 400 })
    }

    const body = await request.json()
    const { equivalencias } = body as { 
      equivalencias: Array<{ categoria: string; pesoKg: number }> 
    }

    if (!equivalencias || !Array.isArray(equivalencias)) {
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
    }

    // Upsert cada equivalencia
    const resultados = await Promise.all(
      equivalencias.map(async ({ categoria, pesoKg }) => {
        // Si el peso es igual al default, eliminar la personalización
        const pesoDefault = PESOS_DEFAULT[categoria]
        
        if (pesoKg === pesoDefault) {
          // Eliminar personalización si existe
          await prisma.equivalenciaUG.deleteMany({
            where: {
              campoId: usuario.campoId!,
              categoria
            }
          })
          return { categoria, action: 'reset' }
        }

        // Crear o actualizar
        const result = await prisma.equivalenciaUG.upsert({
          where: {
            campoId_categoria: {
              campoId: usuario.campoId!,
              categoria
            }
          },
          create: {
            campoId: usuario.campoId!,
            categoria,
            pesoKg
          },
          update: {
            pesoKg
          }
        })

        return { categoria, action: 'saved', id: result.id }
      })
    )

    return NextResponse.json({ 
      success: true, 
      resultados,
      message: 'Equivalencias guardadas correctamente'
    })

  } catch (error) {
    console.error('Error al guardar equivalencias UG:', error)
    return NextResponse.json({ error: 'Error al guardar equivalencias' }, { status: 500 })
  }
}

// DELETE - Resetear todas las equivalencias al default
export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const usuario = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { campoId: true },
    })

    if (!usuario?.campoId) {
      return NextResponse.json({ error: 'Usuario sin campo' }, { status: 400 })
    }

    // Eliminar todas las personalizaciones del campo
    const deleted = await prisma.equivalenciaUG.deleteMany({
      where: { campoId: usuario.campoId }
    })

    return NextResponse.json({ 
      success: true, 
      eliminadas: deleted.count,
      message: 'Equivalencias reseteadas a valores por defecto'
    })

  } catch (error) {
    console.error('Error al resetear equivalencias UG:', error)
    return NextResponse.json({ error: 'Error al resetear equivalencias' }, { status: 500 })
  }
}