import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "../auth/[...nextauth]/route"

// ==============================================
// 🔹 Configuración de categorías e íconos
// ==============================================
const categoriaPorTipo: Record<string, string> = {
  MOVIMIENTO: "animales",
  TRATAMIENTO: "animales",
  VENTA: "animales",
  COMPRA: "animales",
  TRASLADO: "animales",
  NACIMIENTO: "animales",
  MORTANDAD: "animales",
  CONSUMO: "animales",
  ABORTO: "animales",
  DESTETE: "animales",
  TACTO: "animales",
  RECATEGORIZACION: "animales",
  SIEMBRA: "agricultura",
  PULVERIZACION: "agricultura",
  REFERTILIZACION: "agricultura",
  RIEGO: "agricultura",
  MONITOREO: "agricultura",
  COSECHA: "agricultura",
  OTROS_LABORES: "agricultura",
  LLUVIA: "clima",
  HELADA: "clima",
  GASTO: "finanzas",
  INGRESO: "finanzas",
}

const iconoPorTipo: Record<string, string> = {
  MOVIMIENTO: "🔄",
  TRATAMIENTO: "💉",
  VENTA: "💰",
  COMPRA: "🛒",
  TRASLADO: "🚛",
  NACIMIENTO: "🐣",
  MORTANDAD: "💀",
  CONSUMO: "🍖",
  ABORTO: "❌",
  DESTETE: "🔀",
  TACTO: "✋",
  RECATEGORIZACION: "🏷️",
  SIEMBRA: "🌱",
  PULVERIZACION: "💦",
  REFERTILIZACION: "🌿",
  RIEGO: "💧",
  MONITOREO: "🔍",
  COSECHA: "🌾",
  OTROS_LABORES: "🔧",
  LLUVIA: "🌧️",
  HELADA: "❄️",
  GASTO: "💸",
  INGRESO: "💰",
}

// ==============================================
// 🔹 GET: Unificar eventos, gastos e insumos
// ==============================================
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }

    const usuario = await prisma.user.findUnique({
      where: { id: session.user.id },
    })

    if (!usuario?.campoId) {
      return NextResponse.json(
        { error: "Usuario sin campo asignado" },
        { status: 400 }
      )
    }

    const { searchParams } = new URL(request.url)
    const categoria = searchParams.get("categoria")
    const fechaDesde = searchParams.get("fechaDesde")
    const fechaHasta = searchParams.get("fechaHasta")
    const busqueda = searchParams.get("busqueda")

    // ==============================
    // 1️⃣ Obtener datos base
    // ==============================
    const [eventos, gastos, movimientosInsumos] = await Promise.all([
      prisma.evento.findMany({
        where: {
          campoId: usuario.campoId,
          tipo: { not: "GASTO" },
        },
        include: {
          usuario: { select: { name: true } },
          lote: { select: { nombre: true } },
        },
        orderBy: { fecha: "desc" },
      }),

      prisma.gasto.findMany({
        where: { campoId: usuario.campoId },
        include: { lote: { select: { nombre: true } } },
        orderBy: { fecha: "desc" },
      }),

      prisma.movimientoInsumo.findMany({
        where: { insumo: { campoId: usuario.campoId } },
        include: {
          insumo: { select: { nombre: true, unidad: true } },
          lote: { select: { nombre: true } },
        },
        orderBy: { fecha: "desc" },
      }),
    ])

    // ==============================
    // 2️⃣ Unificar todos los datos
    // ==============================
    const datosUnificados: any[] = []

    // 🎯 EVENTOS
    eventos.forEach((evento) => {
      datosUnificados.push({
        id: evento.id,
        fecha: evento.fecha,
        createdAt: evento.createdAt,
        tipo: evento.tipo,
        categoria: categoriaPorTipo[evento.tipo] || "otros",
        descripcion: evento.descripcion,
        icono: iconoPorTipo[evento.tipo] || "📌",
        color: "gray",
        usuario: evento.usuario?.name || null,
        lote: evento.lote?.nombre || null,
        detalles: {
          cantidad: evento.cantidad,
          categoriaEvento: evento.categoria,
        },
      })
    })

    // 💸 GASTOS
    gastos.forEach((gasto) => {
      datosUnificados.push({
        id: gasto.id,
        fecha: gasto.fecha,
        createdAt: gasto.createdAt,
        tipo: "GASTO",
        categoria: "finanzas",
        descripcion: gasto.descripcion || `Gasto en ${gasto.categoria}`,
        icono: "💸",
        color: "red",
        usuario: null,
        lote: gasto.lote?.nombre || null,
        detalles: {
          monto:
            gasto.monto !== null ? parseFloat(gasto.monto.toString()) : undefined,
          categoriaGasto: gasto.categoria,
          metodoPago: gasto.metodoPago,
        },
      })
    })

    // 🧪 MOVIMIENTOS DE INSUMOS
    movimientosInsumos.forEach((mov) => {
      datosUnificados.push({
        id: mov.id,
        fecha: mov.fecha,
        createdAt: mov.createdAt,
        tipo: mov.tipo,
        categoria: "insumos",
        descripcion: `${mov.tipo === "INGRESO" ? "Ingreso" : "Uso"} de ${
          mov.insumo.nombre
        }: ${mov.cantidad} ${mov.insumo.unidad}`,
        icono: mov.tipo === "INGRESO" ? "📥" : "📤",
        color: mov.tipo === "INGRESO" ? "green" : "red",
        usuario: null,
        lote: mov.lote?.nombre || null,
        detalles: {
          insumo: mov.insumo.nombre,
          cantidad: mov.cantidad,
          unidad: mov.insumo.unidad,
          notas: mov.notas,
        },
      })
    })

    // ✅ ORDENAR: primero por fecha del modal, luego por creación
    datosUnificados.sort((a, b) => {
      const fechaA = new Date(a.fecha).getTime()
      const fechaB = new Date(b.fecha).getTime()
      if (fechaB !== fechaA) return fechaB - fechaA
      const creadoA = a.createdAt ? new Date(a.createdAt).getTime() : 0
      const creadoB = b.createdAt ? new Date(b.createdAt).getTime() : 0
      return creadoB - creadoA
    })

    // ==============================
    // 3️⃣ Filtros
    // ==============================
    let datosFiltrados = [...datosUnificados]

    if (categoria && categoria !== "todos") {
      datosFiltrados = datosFiltrados.filter((d) => d.categoria === categoria)
    }

    if (fechaDesde) {
      datosFiltrados = datosFiltrados.filter(
        (d) => new Date(d.fecha) >= new Date(fechaDesde)
      )
    }

    if (fechaHasta) {
      datosFiltrados = datosFiltrados.filter(
        (d) => new Date(d.fecha) <= new Date(fechaHasta)
      )
    }

    if (busqueda) {
      const q = busqueda.toLowerCase()
      datosFiltrados = datosFiltrados.filter(
        (d) =>
          d.descripcion?.toLowerCase().includes(q) ||
          (d.tipo && d.tipo.toLowerCase().includes(q))
      )
    }

    return NextResponse.json(datosFiltrados)
  } catch (error) {
    console.error("💥 Error al obtener datos:", error)
    return NextResponse.json(
      { error: "Error al obtener datos" },
      { status: 500 }
    )
  }
}