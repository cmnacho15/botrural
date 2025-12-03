import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'
import { MAPEO_CATEGORIAS_INICIAL } from '@/lib/costos-estructurados'

/**
 * POST - Aplicar mapeo inicial sugerido a todas las categorías compatibles
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.campoId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Obtener todas las categorías del usuario
    const categorias = await prisma.categoriaGasto.findMany({
      where: {
        campoId: session.user.campoId,
        activo: true,
      },
    })

    const actualizaciones: any[] = []
    let categoriasActualizadas = 0

    for (const categoria of categorias) {
      // Buscar si hay mapeo sugerido para esta categoría
      const mapeoSugerido = MAPEO_CATEGORIAS_INICIAL[categoria.nombre as keyof typeof MAPEO_CATEGORIAS_INICIAL]

      if (mapeoSugerido) {
        actualizaciones.push(
          prisma.categoriaGasto.update({
            where: { id: categoria.id },
            data: {
              mapeadaACostos: true,
              categoriaCostoEstructurado: mapeoSugerido.categoria,
              subcategoriaCosto: mapeoSugerido.subcategoria,
              porcentajeVacuno: mapeoSugerido.distribucion.vacuno,
              porcentajeOvino: mapeoSugerido.distribucion.ovino,
              porcentajeEquino: mapeoSugerido.distribucion.equino,
              porcentajeDesperdicios: mapeoSugerido.distribucion.desperdicios,
            },
          })
        )
        categoriasActualizadas++
      }
    }

    if (actualizaciones.length > 0) {
      await Promise.all(actualizaciones)
    }

    return NextResponse.json({
      success: true,
      message: `Mapeo inicial aplicado a ${categoriasActualizadas} categorías`,
      categoriasActualizadas,
      categoriasTotal: categorias.length,
    })
  } catch (error) {
    console.error('Error al aplicar mapeo inicial:', error)
    return NextResponse.json(
      { error: 'Error al aplicar mapeo inicial' },
      { status: 500 }
    )
  }
}