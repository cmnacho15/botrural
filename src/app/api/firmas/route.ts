import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'

// ==========================================
// GET - Listar firmas del campo
// ==========================================
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.campoId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const firmas = await prisma.firma.findMany({
      where: { campoId: session.user.campoId },
      orderBy: [
        { esPrincipal: 'desc' }, // Principal primero
        { razonSocial: 'asc' }
      ]
    })

    return NextResponse.json(firmas)
  } catch (error) {
    console.error('❌ Error al cargar firmas:', error)
    return NextResponse.json(
      { error: 'Error al cargar firmas' },
      { status: 500 }
    )
  }
}

// ==========================================
// POST - Crear nueva firma
// ==========================================
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.campoId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { rut, razonSocial, esPrincipal } = body

    // Validaciones
    if (!rut || !razonSocial) {
      return NextResponse.json(
        { error: 'RUT y Razón Social son obligatorios' },
        { status: 400 }
      )
    }

    // Verificar si ya existe ese RUT en el campo
    const firmaExistente = await prisma.firma.findUnique({
      where: {
        rut_campoId: {
          rut,
          campoId: session.user.campoId
        }
      }
    })

    if (firmaExistente) {
      return NextResponse.json(
        { error: 'Ya existe una firma con ese RUT' },
        { status: 400 }
      )
    }

    // Si se marca como principal, quitar el flag de las demás
    if (esPrincipal) {
      await prisma.firma.updateMany({
        where: { campoId: session.user.campoId },
        data: { esPrincipal: false }
      })
    }

    // Crear la firma
    const nuevaFirma = await prisma.firma.create({
      data: {
        campoId: session.user.campoId,
        rut,
        razonSocial,
        esPrincipal: esPrincipal || false
      }
    })

    return NextResponse.json(nuevaFirma, { status: 201 })
  } catch (error) {
    console.error('❌ Error al crear firma:', error)
    return NextResponse.json(
      { error: 'Error al crear firma' },
      { status: 500 }
    )
  }
}