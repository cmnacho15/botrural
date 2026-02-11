// API endpoint para importar gastos desde Excel
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'
import * as XLSX from 'xlsx'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

// Categorías disponibles - sincronizadas con vision-parser.ts
const CATEGORIAS_GASTOS = [
  // Variables - Ganadería
  "Alimentación",       // Alimentos animales, balanceados, forrajes
  "Genética",           // Semen, embriones, reproductores
  "Sanidad y Manejo",   // Veterinaria, vacunas, medicamentos
  "Insumos Pasturas",   // Semillas pasturas, fertilizantes praderas

  // Variables - Agricultura
  "Insumos de Cultivos", // Semillas, fertilizantes, agroquímicos para cultivos

  // Variables - Mixtos
  "Combustible",        // Gasoil, nafta
  "Flete",              // Transporte, logística
  "Labores",            // Servicios de maquinaria, contratistas

  // Fijos - Puros
  "Administración",     // Gastos administrativos, oficina
  "Asesoramiento",      // Consultoría, contadores, agrónomos
  "Impuestos",          // DGI, contribución inmobiliaria, IMEBA
  "Seguro/Patente",     // Seguros, patentes vehículos
  "Estructuras",        // Alambrados, galpones, construcciones
  "Otros",              // Lo que no encaje en ninguna

  // Fijos - Asignables
  "Sueldos",            // BPS, aportes patronales, salarios
  "Maquinaria",         // Compra/reparación maquinaria
  "Electricidad",       // UTE, energía eléctrica
  "Mantenimiento",      // Reparaciones generales

  // Financieros
  "Renta",              // Arrendamientos
  "Intereses",          // Intereses bancarios, financieros
]

// POST - Procesar importación de gastos
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const usuario = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, campoId: true },
    })

    if (!usuario?.campoId) {
      return NextResponse.json({ error: 'Usuario sin campo' }, { status: 400 })
    }

    // Obtener el FormData
    const formData = await request.formData()
    const file = formData.get('file') as File
    const mapeoColumnas = JSON.parse(formData.get('mapeoColumnas') as string)
    const tasaCambio = formData.get('tasaCambio') ? parseFloat(formData.get('tasaCambio') as string) : null

    if (!file) {
      return NextResponse.json({ error: 'No se envió ningún archivo' }, { status: 400 })
    }

    // Leer el archivo Excel
    const buffer = Buffer.from(await file.arrayBuffer())
    const workbook = XLSX.read(buffer, { type: 'buffer' })
    const sheetName = workbook.SheetNames[0]
    const sheet = workbook.Sheets[sheetName]
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false }) as any[][]

    // Obtener categorías existentes
    const categorias = await prisma.categoriaGasto.findMany({
      where: { campoId: usuario.campoId },
      select: { nombre: true }
    })
    const categoriasNombres = categorias.map(c => c.nombre.toLowerCase())

    // Procesar filas
    const headers = data[0] as string[]
    const filas = data.slice(1)
    const gastosCreados: any[] = []
    const errores: { fila: number; error: string }[] = []

    for (let i = 0; i < filas.length; i++) {
      const fila = filas[i]
      if (!fila || fila.length === 0) continue

      try {
        // Extraer valores según mapeo (mapeoColumnas ya son índices)
        const fecha = fila[mapeoColumnas.fecha]
        const monto = fila[mapeoColumnas.monto]
        const proveedor = mapeoColumnas.proveedor !== undefined ? fila[mapeoColumnas.proveedor] : null
        const descripcion = mapeoColumnas.descripcion !== undefined ? fila[mapeoColumnas.descripcion] : null
        const categoria = mapeoColumnas.categoria !== undefined ? fila[mapeoColumnas.categoria] : null
        const moneda = mapeoColumnas.moneda !== undefined ? fila[mapeoColumnas.moneda] : 'USD'

        // Validar fecha y monto
        if (!fecha || !monto) {
          errores.push({ fila: i + 2, error: 'Fecha o monto vacío' })
          continue
        }

        // Parsear fecha (DD/MM/YY o DD/MM/YYYY)
        let fechaParsed: Date
        try {
          const [dia, mes, anio] = fecha.split('/')
          const anioCompleto = anio.length === 2 ? `20${anio}` : anio
          fechaParsed = new Date(`${anioCompleto}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`)
          if (isNaN(fechaParsed.getTime())) throw new Error('Fecha inválida')
        } catch {
          errores.push({ fila: i + 2, error: 'Formato de fecha inválido' })
          continue
        }

        // Parsear monto
        const montoFloat = parseFloat(String(monto).replace(/[^0-9.-]/g, ''))
        if (isNaN(montoFloat) || montoFloat <= 0) {
          errores.push({ fila: i + 2, error: 'Monto inválido' })
          continue
        }

        // Asignar categoría (buscar coincidencia o usar "Sin categoría")
        let categoriaFinal = 'Sin categoría'
        if (categoria) {
          const categoriaLower = categoria.toLowerCase()
          const match = categoriasNombres.find(c =>
            c === categoriaLower ||
            c.includes(categoriaLower) ||
            categoriaLower.includes(c)
          )
          if (match) {
            categoriaFinal = categorias.find(c => c.nombre.toLowerCase() === match)?.nombre || 'Sin categoría'
          }
        }

        // Detectar si es INGRESO o GASTO
        const textoCompleto = `${proveedor || ''} ${descripcion || ''}`.toLowerCase()
        const palabrasClaveIngreso = [
          'venta', 'ingreso', 'cobro', 'factura a', 'cliente',
          'renta', 'alquiler ingreso', 'pastoreo ingreso', 'deudor',
          'pago factura a', 'cobro de', 'venta de'
        ]
        const esIngreso = palabrasClaveIngreso.some(palabra => textoCompleto.includes(palabra))

        // Calcular montos según moneda
        const esUYU = moneda?.toUpperCase() === 'UYU' || moneda?.toUpperCase() === '$U'
        const montoOriginal = montoFloat
        const montoEnUSD = esUYU && tasaCambio ? montoFloat / tasaCambio : montoFloat
        const montoEnUYU = esUYU ? montoFloat : (tasaCambio ? montoFloat * tasaCambio : montoFloat * 40) // fallback tasa

        gastosCreados.push({
          fecha: fechaParsed,
          monto: montoEnUSD, // deprecated pero requerido
          montoOriginal,
          montoEnUSD,
          montoEnUYU,
          moneda: esUYU ? 'UYU' : 'USD',
          tasaCambio: esUYU ? tasaCambio : null,
          proveedor: proveedor || null,
          descripcion: descripcion || null,
          categoria: categoriaFinal,
          tipo: esIngreso ? 'INGRESO' : 'GASTO',
          pagado: true,
          campoId: usuario.campoId,
          comprador: esIngreso ? proveedor : null, // Si es ingreso, el proveedor es el comprador
        })
      } catch (error) {
        errores.push({ fila: i + 2, error: 'Error al procesar fila' })
      }
    }

    // 🤖 Clasificación inteligente de categorías con IA (solo para GASTOS)
    const gastosParaClasificar = gastosCreados.filter(g => g.tipo === 'GASTO')

    if (gastosParaClasificar.length > 0) {
      try {
        console.log(`🤖 [IMPORT-IA] Clasificando ${gastosParaClasificar.length} gastos con IA...`)

        // Preparar datos para clasificación batch
        const gastosResumen = gastosParaClasificar.map((g, idx) => ({
          indice: idx,
          proveedor: g.proveedor || '',
          descripcion: g.descripcion || '',
          montoUSD: g.montoEnUSD
        }))

        const prompt = `Eres un sistema de clasificación de gastos para contabilidad agrícola uruguaya.

CATEGORÍAS DISPONIBLES:
${CATEGORIAS_GASTOS.map((cat, i) => `${i + 1}. ${cat}`).join('\n')}

REGLAS DE MAPEO (prioridad alta - usar estas reglas primero):
- UTE/electricidad → "Electricidad"
- BPS/aportes/aportes patronales → "Sueldos"
- DGI/impuestos/IMEBA/contribución inmobiliaria/contribución rural → "Impuestos"
- Veterinaria/medicamentos/vacunas/sanidad → "Sanidad y Manejo"
- Pinturas para marcar ganado (Celocheck) → "Sanidad y Manejo"
- Semillas pasturas/semillas para praderas → "Insumos Pasturas"
- Semillas agrícolas/semillas de soja/maíz/trigo → "Insumos de Cultivos"
- Alambres/postes/varillas/bebederos/tanques/tubos/caños/galpón/alambrado → "Estructuras"
- Balanceados/forrajes/alimento animal/ración → "Alimentación"
- Gasoil/nafta/combustible → "Combustible"
- Flete/transporte/logística → "Flete"
- Contador/agrónomo/asesor/consultoría → "Asesoramiento"
- Seguro/patente → "Seguro/Patente"
- Arrendamiento/arriendo → "Renta"
- Maquinaria/tractor/cosechadora/reparación máquina → "Maquinaria"
- Fertilizantes/agroquímicos/herbicidas/insecticidas → "Insumos de Cultivos"

GASTOS A CLASIFICAR (total: ${gastosParaClasificar.length}):
${gastosResumen.map(g =>
  `[${g.indice}] Proveedor: "${g.proveedor}" | Descripción: "${g.descripcion}" | USD: ${g.montoUSD.toFixed(2)}`
).join('\n')}

INSTRUCCIONES:
1. Para cada gasto, analiza el proveedor y descripción
2. Aplica las REGLAS DE MAPEO primero (máxima prioridad)
3. Si no hay coincidencia en las reglas, usa lógica y contexto agrícola uruguayo
4. Si no estás seguro, usa "Otros"
5. Responde SOLO con un array JSON de objetos con formato: {"indice": número, "categoria": "Nombre Categoría"}
6. El array debe tener EXACTAMENTE ${gastosParaClasificar.length} elementos
7. NO uses markdown, SOLO el JSON

FORMATO DE RESPUESTA:
[
  {"indice": 0, "categoria": "Electricidad"},
  {"indice": 1, "categoria": "Combustible"},
  ...
]`

        const message = await anthropic.messages.create({
          model: 'claude-sonnet-4-5-20250929',
          max_tokens: 4000,
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
        })

        const responseText = message.content[0].type === 'text' ? message.content[0].text : ''
        // Buscar array JSON entre el primer [ y el último ]
        const startIdx = responseText.indexOf('[')
        const endIdx = responseText.lastIndexOf(']')
        const jsonMatch = startIdx !== -1 && endIdx !== -1 && endIdx > startIdx
          ? [responseText.substring(startIdx, endIdx + 1)]
          : null

        if (jsonMatch) {
          const clasificaciones = JSON.parse(jsonMatch[0]) as Array<{ indice: number; categoria: string }>

          console.log(`✅ [IMPORT-IA] Clasificaciones recibidas: ${clasificaciones.length}`)

          // Aplicar categorías clasificadas
          clasificaciones.forEach(({ indice, categoria }) => {
            const gastoOriginalIdx = gastosCreados.findIndex(g =>
              g.tipo === 'GASTO' && gastosParaClasificar[indice] === g
            )

            if (gastoOriginalIdx !== -1) {
              // Validar que la categoría existe
              if (CATEGORIAS_GASTOS.includes(categoria)) {
                gastosCreados[gastoOriginalIdx].categoria = categoria
              } else {
                gastosCreados[gastoOriginalIdx].categoria = 'Otros'
              }
            }
          })

          console.log(`✅ [IMPORT-IA] ${clasificaciones.length} gastos clasificados exitosamente`)
        } else {
          console.log('⚠️ [IMPORT-IA] No se pudo parsear respuesta IA, usando categorías por defecto')
        }

        // Registrar uso de IA
        const inputTokens = message.usage.input_tokens
        const outputTokens = message.usage.output_tokens
        const totalTokens = inputTokens + outputTokens
        const costUSD = (inputTokens / 1000000) * 3 + (outputTokens / 1000000) * 15

        await prisma.aIUsage.create({
          data: {
            userId: usuario.id,
            provider: 'CLAUDE',
            model: 'claude-sonnet-4-5-20250929',
            feature: 'IMPORTACION_GASTOS_CLASIFICACION',
            inputTokens,
            outputTokens,
            totalTokens,
            costUSD,
            metadata: {
              nombreArchivo: file.name,
              totalGastos: gastosParaClasificar.length,
            },
          },
        })

        console.log(`💰 [IMPORT-IA] Costo: $${costUSD.toFixed(4)} USD`)
      } catch (iaError) {
        console.error('❌ [IMPORT-IA] Error en clasificación IA:', iaError)
        console.log('⚠️ [IMPORT-IA] Continuando con categorías por defecto')
        // No bloqueamos la importación si falla la IA
      }
    }

    // Crear importación y gastos en transacción
    const importacion = await prisma.importacionGastos.create({
      data: {
        campoId: usuario.campoId,
        usuarioId: usuario.id,
        nombreArchivo: file.name,
        totalFilas: filas.length,
        filasImportadas: gastosCreados.length,
        filasConError: errores.length,
        errores: errores.length > 0 ? errores : null,
        estado: 'COMPLETADA',
        gastos: {
          create: gastosCreados.map(g => ({
            ...g,
            importacionId: undefined, // Se asigna automáticamente por la relación
          }))
        }
      },
      include: {
        gastos: true
      }
    })

    // Contar gastos e ingresos
    const totalGastos = gastosCreados.filter(g => g.tipo === 'GASTO').length
    const totalIngresos = gastosCreados.filter(g => g.tipo === 'INGRESO').length

    return NextResponse.json({
      success: true,
      importacion: {
        id: importacion.id,
        totalFilas: importacion.totalFilas,
        filasImportadas: importacion.filasImportadas,
        filasConError: importacion.filasConError,
        errores: importacion.errores,
        totalGastos,
        totalIngresos,
      }
    })
  } catch (error) {
    console.error('Error al importar gastos:', error)
    return NextResponse.json(
      { error: 'Error al importar gastos' },
      { status: 500 }
    )
  }
}

// GET - Obtener historial de importaciones
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

    const importaciones = await prisma.importacionGastos.findMany({
      where: { campoId: usuario.campoId },
      include: {
        usuario: {
          select: { name: true, email: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json(importaciones)
  } catch (error) {
    console.error('Error al obtener importaciones:', error)
    return NextResponse.json(
      { error: 'Error al obtener importaciones' },
      { status: 500 }
    )
  }
}
