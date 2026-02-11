// API endpoint para analizar archivo Excel y sugerir mapeo de columnas con IA
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'
import * as XLSX from 'xlsx'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'No se envió ningún archivo' }, { status: 400 })
    }

    // Leer el archivo Excel
    const buffer = Buffer.from(await file.arrayBuffer())
    const workbook = XLSX.read(buffer, { type: 'buffer', raw: false })
    const sheetName = workbook.SheetNames[0]
    const sheet = workbook.Sheets[sheetName]
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false }) as any[][]

    if (data.length < 2) {
      return NextResponse.json({ error: 'El archivo debe tener al menos una fila de datos' }, { status: 400 })
    }

    const headers = data[0] as string[]
    const primerasTresFilas = data.slice(1, 4)

    // Usar IA para detectar el mapeo de columnas
    const prompt = `Analiza este archivo de gastos y determina qué columna corresponde a cada campo.

COLUMNAS DISPONIBLES:
${headers.map((h, i) => `${i}: "${h}"`).join('\n')}

PRIMERAS 3 FILAS DE DATOS:
${primerasTresFilas.map((fila, i) =>
  `Fila ${i + 1}: ${fila.map((val, j) => `[${j}]="${val}"`).join(', ')}`
).join('\n')}

CAMPOS A MAPEAR:
- fecha (OBLIGATORIO): La fecha del movimiento
- monto (OBLIGATORIO): El monto/importe
- proveedor (OPCIONAL): Nombre del proveedor/cliente/comercio
- descripcion (OPCIONAL): Descripción o concepto
- categoria (OPCIONAL): Categoría
- moneda (OPCIONAL): Moneda (USD, UYU, $U, etc)
- tipo (OPCIONAL): Columna que indica si es INGRESO o EGRESO

INSTRUCCIONES:
1. Identifica qué índice de columna corresponde a cada campo
2. Si una columna no existe, devuelve null para ese campo
3. Si hay columnas sin usar, inclúyelas en "columnasNoMapeadas"
4. IMPORTANTE: Analiza el contenido de las filas y detecta si hay INGRESOS (ventas, cobros, rentas) mezclados con GASTOS
5. Si detectas ingresos, agrega un campo "tieneIngresos": true y lista ejemplos en "ejemplosIngresos"
6. Responde SOLO con JSON, sin explicaciones adicionales

FORMATO DE RESPUESTA:
{
  "mapeo": {
    "fecha": 0,
    "monto": 2,
    "proveedor": 1,
    "descripcion": 3,
    "categoria": null,
    "moneda": null,
    "tipo": null
  },
  "columnasNoMapeadas": [4, 5],
  "confianza": "ALTA",
  "tieneIngresos": true,
  "ejemplosIngresos": ["Fila 29: venta hacienda", "Fila 50: ingreso pastoreo"]
}`

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 1000,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    })

    const responseText = message.content[0].type === 'text' ? message.content[0].text : ''
    const jsonMatch = responseText.match(/\{[\s\S]*\}/)

    if (!jsonMatch) {
      throw new Error('La IA no devolvió un JSON válido')
    }

    const analisis = JSON.parse(jsonMatch[0])

    // Registrar uso de IA
    const inputTokens = message.usage.input_tokens
    const outputTokens = message.usage.output_tokens
    const totalTokens = inputTokens + outputTokens

    // Costo de Claude Sonnet 4.5: $3 por 1M input tokens, $15 por 1M output tokens
    const costUSD = (inputTokens / 1000000) * 3 + (outputTokens / 1000000) * 15

    await prisma.aIUsage.create({
      data: {
        userId: session.user.id,
        provider: 'CLAUDE',
        model: 'claude-sonnet-4-5-20250929',
        feature: 'IMPORTACION_GASTOS_ANALISIS',
        inputTokens,
        outputTokens,
        totalTokens,
        costUSD,
        metadata: {
          nombreArchivo: file.name,
          totalFilas: data.length - 1,
        },
      },
    })

    // Convertir índices a nombres de columnas
    const mapeoFinal: Record<string, string | null> = {}
    for (const [campo, indice] of Object.entries(analisis.mapeo)) {
      if (indice !== null && typeof indice === 'number') {
        mapeoFinal[campo] = headers[indice]
      } else {
        mapeoFinal[campo] = null
      }
    }

    return NextResponse.json({
      headers,
      mapeo: mapeoFinal,
      columnasNoMapeadas: analisis.columnasNoMapeadas?.map((i: number) => headers[i]) || [],
      confianza: analisis.confianza || 'MEDIA',
      totalFilas: data.length - 1,
      vista: {
        headers,
        primeras5Filas: data.slice(1, 6)
      }
    })
  } catch (error) {
    console.error('Error al analizar archivo:', error)
    return NextResponse.json(
      { error: 'Error al analizar archivo' },
      { status: 500 }
    )
  }
}
