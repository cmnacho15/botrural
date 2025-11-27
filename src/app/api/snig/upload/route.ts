import { NextResponse } from "next/server"

// Regex para caravanas del SNIG
const CARAVANA_REGEX = /\|([A]\d{10,30})\|/;

// Regex para fecha y hora SNIG
const FECHA_REGEX = /\|(\d{8})\|(\d{6})\|/;

function parseFechaSnig(fechaStr: string, horaStr: string) {
  try {
    const dia = fechaStr.substring(0, 2)
    const mes = fechaStr.substring(2, 4)
    const anio = fechaStr.substring(4, 8)

    const hora = horaStr.substring(0, 2)
    const min = horaStr.substring(2, 4)
    const seg = horaStr.substring(4, 6)

    return new Date(`${anio}-${mes}-${dia}T${hora}:${min}:${seg}Z`);
  } catch (e) {
    return null
  }
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData()
    const file = formData.get("file") as File | null

    if (!file) {
      return NextResponse.json(
        { error: "No se recibió ningún archivo" },
        { status: 400 }
      )
    }

    const text = await file.text()

    if (!text || text.trim().length === 0) {
      return NextResponse.json(
        { error: "El archivo está vacío" },
        { status: 400 }
      )
    }

    // Extraer caravanas
    const caravanas: string[] = []
    let match

    const lines = text.split("\n")

    for (const line of lines) {
      match = CARAVANA_REGEX.exec(line)
      if (match) caravanas.push(match[1])
    }

    if (caravanas.length === 0) {
      return NextResponse.json(
        { error: "No se encontraron caravanas en el archivo" },
        { status: 400 }
      )
    }

    // Extraer fecha SNIG (tomamos la primera línea válida)
    let fechaSnig: Date | null = null

    for (const line of lines) {
      const m = FECHA_REGEX.exec(line)
      if (m) {
        fechaSnig = parseFechaSnig(m[1], m[2])
        break
      }
    }

    // Si no se pudo parsear, usamos fecha actual pero lo avisamos
    const fechaUsada = fechaSnig ?? new Date()
    const fechaWarning = fechaSnig ? null : "Fecha del SNIG inválida o ausente. Se usó fecha actual."

    // Detectar tipo de archivo
    // Regla:
    // STOCK INICIAL → cuando todas las caravanas YA EXISTEN en la base (lo haremos en fase 2)
    // MOVIMIENTO → cuando hay caravanas nuevas
    //
    // Por ahora devolvemos tipo = "DESCONOCIDO"
    // Como base para la siguiente fase.

    return NextResponse.json({
      ok: true,
      caravanas,
      cantidad: caravanas.length,
      fechaSnig: fechaUsada,
      warningFecha: fechaWarning,
      tipo: "PENDIENTE_CONFIRMACION", // el usuario elegirá si es stock, compra, venta, caravaneo, etc.
      accionesPosibles: [
        "STOCK_INICIAL",
        "NACIMIENTO",
        "COMPRA",
        "VENTA",
        "MORTANDAD",
        "TRASLADO"
      ]
    })

  } catch (error) {
    console.error("Error procesando archivo SNIG:", error)
    return NextResponse.json(
      { error: "Error interno procesando el archivo" },
      { status: 500 }
    )
  }
}