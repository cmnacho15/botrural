// src/lib/bcu-cotizacion.ts
// Servicio para obtener cotizaciones del dólar desde el BCU (Banco Central del Uruguay)

const BCU_URL = "https://cotizaciones.bcu.gub.uy/wscotizaciones/servlet/awsbcucotizaciones"
const CODIGO_DOLAR = 2225 // DLS USA BILLETE

// Cache de cotizaciones para evitar consultas repetidas
const cotizacionCache: Map<string, number | null> = new Map()

/**
 * Formatea una fecha a YYYY-MM-DD
 */
function formatFechaBCU(fecha: Date): string {
  const year = fecha.getFullYear()
  const month = String(fecha.getMonth() + 1).padStart(2, '0')
  const day = String(fecha.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Obtiene el día anterior a una fecha dada
 */
export function getDiaAnterior(fecha: Date): Date {
  const diaAnterior = new Date(fecha)
  diaAnterior.setDate(diaAnterior.getDate() - 1)
  return diaAnterior
}

/**
 * Construye el XML SOAP para la consulta al BCU
 */
function buildSoapRequest(fechaDesde: string, fechaHasta: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:cot="Cotiza">
<soapenv:Header />
<soapenv:Body>
<cot:wsbcucotizaciones.Execute>
<cot:Entrada>
<cot:Moneda>
<cot:item>${CODIGO_DOLAR}</cot:item>
</cot:Moneda>
<cot:FechaDesde>${fechaDesde}</cot:FechaDesde>
<cot:FechaHasta>${fechaHasta}</cot:FechaHasta>
<cot:Grupo>2</cot:Grupo>
</cot:Entrada>
</cot:wsbcucotizaciones.Execute>
</soapenv:Body>
</soapenv:Envelope>`
}

/**
 * Extrae el TCV (Tipo Cambio Venta) del XML de respuesta
 */
function extractTCV(xmlResponse: string): number | null {
  // Usar regex para extraer el TCV
  const match = xmlResponse.match(/<TCV>([\d.]+)<\/TCV>/)
  if (match && match[1]) {
    return parseFloat(match[1])
  }
  return null
}

/**
 * Obtiene la cotización del dólar para una fecha específica
 * Retorna el TCV (Tipo Cambio Venta) o null si no hay cotización
 */
export async function getCotizacionDolar(fecha: Date): Promise<number | null> {
  const fechaStr = formatFechaBCU(fecha)

  // Verificar cache primero
  if (cotizacionCache.has(fechaStr)) {
    return cotizacionCache.get(fechaStr) ?? null
  }

  try {
    const soapRequest = buildSoapRequest(fechaStr, fechaStr)

    const response = await fetch(BCU_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': '',
      },
      body: soapRequest,
      signal: AbortSignal.timeout(15000), // 15 segundos timeout
    })

    if (!response.ok) {
      console.error(`BCU API error: ${response.status}`)
      cotizacionCache.set(fechaStr, null)
      return null
    }

    const xmlResponse = await response.text()
    const tcv = extractTCV(xmlResponse)

    // Guardar en cache (incluso si es null para no reintentar)
    cotizacionCache.set(fechaStr, tcv)

    return tcv
  } catch (error) {
    console.error(`Error consultando BCU para ${fechaStr}:`, error)
    cotizacionCache.set(fechaStr, null)
    return null
  }
}

/**
 * Obtiene la cotización del día anterior a la fecha dada
 * Si el día anterior no tiene cotización (fin de semana/feriado), busca hasta 5 días atrás
 */
export async function getCotizacionDiaAnterior(fecha: Date): Promise<{ valor: number | null; fecha: string }> {
  let intentos = 0
  const maxIntentos = 5 // Buscar hasta 5 días atrás
  let fechaBusqueda = getDiaAnterior(fecha)

  while (intentos < maxIntentos) {
    const cotizacion = await getCotizacionDolar(fechaBusqueda)

    if (cotizacion !== null) {
      return {
        valor: cotizacion,
        fecha: formatFechaBCU(fechaBusqueda)
      }
    }

    // Si no hay cotización, retroceder un día más
    fechaBusqueda = getDiaAnterior(fechaBusqueda)
    intentos++

    // Pequeño delay entre intentos para no saturar el servicio
    await new Promise(resolve => setTimeout(resolve, 100))
  }

  return { valor: null, fecha: formatFechaBCU(getDiaAnterior(fecha)) }
}

/**
 * Obtiene cotizaciones para múltiples fechas de forma eficiente
 * Agrupa las fechas únicas y agrega delays para no saturar el servicio
 */
export async function getCotizacionesMultiples(fechas: Date[]): Promise<Map<string, number | null>> {
  const resultado = new Map<string, number | null>()

  // Obtener fechas únicas (día anterior de cada fecha)
  const fechasUnicas = new Map<string, Date>()
  for (const fecha of fechas) {
    const diaAnterior = getDiaAnterior(fecha)
    const key = formatFechaBCU(diaAnterior)
    if (!fechasUnicas.has(key)) {
      fechasUnicas.set(key, diaAnterior)
    }
  }

  // Consultar cada fecha única
  let count = 0
  for (const [key, fecha] of fechasUnicas) {
    // Verificar si ya está en cache
    if (cotizacionCache.has(key)) {
      resultado.set(key, cotizacionCache.get(key) ?? null)
      continue
    }

    // Consultar BCU
    const cotizacion = await getCotizacionDolar(fecha)
    resultado.set(key, cotizacion)

    // Delay entre requests (excepto el último)
    count++
    if (count < fechasUnicas.size) {
      await new Promise(resolve => setTimeout(resolve, 200)) // 200ms entre requests
    }
  }

  return resultado
}

/**
 * Limpia el cache de cotizaciones
 */
export function clearCotizacionCache(): void {
  cotizacionCache.clear()
}

/**
 * Obtiene el tamaño actual del cache
 */
export function getCacheSize(): number {
  return cotizacionCache.size
}
