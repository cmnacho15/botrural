import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "../auth/[...nextauth]/route"
import { prisma } from "@/lib/prisma"

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
      return NextResponse.json({ error: "Usuario sin campo" }, { status: 400 })
    }

    // 1. OBTENER NOMBRE DEL CAMPO
    const campo = await prisma.campo.findUnique({
      where: { id: usuario.campoId },
      select: { nombre: true }
    })

    // 2. OBTENER POTREROS CON ANIMALES Y CULTIVOS
    const potreros = await prisma.lote.findMany({
      where: { campoId: usuario.campoId },
      include: {
        animalesLote: {
          select: {
            categoria: true,
            cantidad: true
          }
        },
        cultivos: {
          select: {
            tipoCultivo: true,
            hectareas: true
          }
        }
      }
    })

    // Mapear potreros para el mapa
    const potrerosParaMapa = potreros.map(potrero => ({
      id: potrero.id,
      nombre: potrero.nombre,
      hectareas: potrero.hectareas,
      coordinates: potrero.poligono ? (potrero.poligono as any) : [],
      color: '#10b981',
      info: {
        hectareas: potrero.hectareas,
        animales: potrero.animalesLote.map(a => ({
          categoria: a.categoria,
          cantidad: a.cantidad
        })),
        cultivos: potrero.cultivos.map(c => ({
          tipo: c.tipoCultivo,
          hectareas: c.hectareas
        }))
      }
    }))

    // 3. CALCULAR GASTOS DEL MES ACTUAL
    const inicioMes = new Date()
    inicioMes.setDate(1)
    inicioMes.setHours(0, 0, 0, 0)

    const gastosDelMes = await prisma.gasto.aggregate({
      where: {
        campoId: usuario.campoId,
        tipo: "GASTO",
        fecha: {
          gte: inicioMes
        }
      },
      _sum: {
        montoEnUYU: true
      }
    })

    // 4. CONTAR INSUMOS
    const totalInsumos = await prisma.insumo.count({
      where: { campoId: usuario.campoId }
    })

    // 5. CONTAR DATOS REGISTRADOS (eventos del mes)
    const datosRegistrados = await prisma.evento.count({
      where: {
        campoId: usuario.campoId,
        fecha: {
          gte: inicioMes
        }
      }
    })

    // 6. OBTENER LLUVIAS DE LOS ÚLTIMOS 12 MESES
    const hace12Meses = new Date()
    hace12Meses.setMonth(hace12Meses.getMonth() - 12)

    const eventosLluvia = await prisma.evento.findMany({
      where: {
        campoId: usuario.campoId,
        tipo: "LLUVIA",
        fecha: {
          gte: hace12Meses
        }
      },
      select: {
        fecha: true,
        cantidad: true
      },
      orderBy: {
        fecha: 'asc'
      }
    })

    // Agrupar lluvias por mes
    const lluviaPorMes: { [key: string]: number } = {}
    const mesesOrdenados: string[] = []

    // Generar array de últimos 12 meses
    for (let i = 11; i >= 0; i--) {
      const fecha = new Date()
      fecha.setMonth(fecha.getMonth() - i)
      const mesKey = fecha.toLocaleDateString('es-UY', { month: 'short', year: '2-digit' })
      mesesOrdenados.push(mesKey)
      lluviaPorMes[mesKey] = 0
    }

    // Sumar lluvias por mes
    eventosLluvia.forEach(evento => {
      const mesKey = new Date(evento.fecha).toLocaleDateString('es-UY', { 
        month: 'short', 
        year: '2-digit' 
      })
      if (lluviaPorMes[mesKey] !== undefined) {
        lluviaPorMes[mesKey] += evento.cantidad || 0
      }
    })

    const lluvia12Meses = mesesOrdenados.map(mes => ({
      mes: mes,
      mm: lluviaPorMes[mes]
    }))

    // 7. CONSTRUIR RESPUESTA
    const dashboardData = {
      nombreCampo: campo?.nombre || "Campo Sin Nombre",
      potreros: potrerosParaMapa,
      resumen: {
        totalPotreros: potreros.length,
        totalGastosMes: gastosDelMes._sum.montoEnUYU || 0,
        totalInsumos: totalInsumos,
        totalDatos: datosRegistrados
      },
      lluvia12Meses: lluvia12Meses
    }

    return NextResponse.json(dashboardData)

  } catch (error) {
    console.error("Error en /api/dashboard-data:", error)
    return NextResponse.json(
      { 
        error: "Error obteniendo datos del dashboard",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    )
  }
}