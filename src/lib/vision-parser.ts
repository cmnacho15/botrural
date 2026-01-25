// Vision API para procesar facturas src/lib/vision-parser.ts
// Usa Claude (Anthropic) para OCR de facturas - más permisivo con documentos comerciales

import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Categorías disponibles - sincronizadas con constants.ts
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
];

interface InvoiceItem {
  descripcion: string;
  categoria: string;
  precio: number;
  iva: number;
  precioFinal: number;
}

export interface ParsedInvoice {
  tipo: "GASTO" | "INGRESO";
  items: InvoiceItem[];
  proveedor: string;
  fecha: string;
  montoTotal: number;
  metodoPago: "Contado" | "Plazo";
  diasPlazo?: number;
  pagado: boolean;
  notas?: string;
  moneda: "USD" | "UYU";
}

/**
 * Convierte una URL de imagen a base64 para enviar a Claude
 */
type ImageMediaType = "image/jpeg" | "image/png" | "image/gif" | "image/webp";

async function urlToBase64(imageUrl: string): Promise<{ base64: string; mediaType: ImageMediaType } | null> {
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) {
      console.log('❌ Error fetching image:', response.status);
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64 = buffer.toString('base64');

    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const rawType = contentType.split(';')[0].toLowerCase();

    // Mapear a tipos válidos de Claude
    let mediaType: ImageMediaType = "image/jpeg";
    if (rawType === "image/png") mediaType = "image/png";
    else if (rawType === "image/gif") mediaType = "image/gif";
    else if (rawType === "image/webp") mediaType = "image/webp";

    return { base64, mediaType };
  } catch (error) {
    console.error('❌ Error converting URL to base64:', error);
    return null;
  }
}

export async function processInvoiceImage(
  imageUrl: string
): Promise<ParsedInvoice | null> {
  try {
    console.log('🔍 [VISION-GASTO] Iniciando procesamiento con Claude')
    console.log('📸 [VISION-GASTO] URL:', imageUrl)
    console.log('🔑 [VISION-GASTO] Anthropic API Key presente:', !!process.env.ANTHROPIC_API_KEY)

    // Convertir URL a base64 (Claude requiere base64)
    const imageData = await urlToBase64(imageUrl);
    if (!imageData) {
      console.log('❌ [VISION-GASTO] No se pudo obtener la imagen');
      return null;
    }

    console.log('📷 [VISION-GASTO] Imagen obtenida, tipo:', imageData.mediaType);

    const response = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 2000,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: imageData.mediaType,
                data: imageData.base64,
              },
            },
            {
              type: "text",
              text: `Eres un sistema de OCR para contabilidad agrícola uruguaya. Extrae los datos de esta factura/boleta.

IMPORTANTE - PROVEEDOR:
El "proveedor" es la EMPRESA que EMITE la factura, NO el cliente/titular.
- Factura de luz → "UTE"
- Factura BPS → "BPS"
- Factura DGI → "DGI"
- Otros → nombre del comercio/empresa emisora (buscar logo/membrete arriba)

IMPORTANTE - ITEMS:
Para facturas de SERVICIOS PÚBLICOS (UTE, BPS, DGI, OSE):
- Crear UN SOLO item con el total del servicio
- NO desglosar sub-conceptos (cargo fijo, consumo punta, etc.)
- Usar la sección SUBTOTALES o IMPORTE TOTAL para los montos
- Ejemplo UTE: un item "Consumo eléctrico mes XX/XXXX"

Para facturas de COMPRAS (ferreterías, veterinarias, agronomías):
- Crear un item por cada producto/línea de la factura
- IMPORTANTE: Leer la columna "Monto" o "Importe" (Cantidad x Precio), NO el precio unitario
- Si IVA = "E" (exento) o no hay IVA → precio = monto, iva = 0, precioFinal = monto
- Si hay IVA → precio = monto sin IVA, iva = monto IVA, precioFinal = precio + iva
- La suma de precioFinal de todos los items debe igualar el TOTAL A PAGAR

CATEGORÍAS: ${CATEGORIAS_GASTOS.join(", ")}

MAPEO:
- UTE/electricidad → "Electricidad"
- BPS/aportes → "Sueldos"
- DGI/impuestos/IMEBA → "Impuestos"
- Veterinaria/medicamentos/vacunas → "Sanidad y Manejo"
- Pinturas para marcar ganado (Celocheck, celo, marcador) → "Sanidad y Manejo"
- Semillas pasturas (raigras, lotus, trébol) → "Insumos Pasturas"
- Semillas agrícolas (maíz, soja, trigo) → "Insumos de Cultivos"
- Alambres/postes/varillas/tranqueras → "Estructuras"
- Pinturas construcción/galpones → "Estructuras"
- Balanceados/forrajes/raciones → "Alimentación"
- Gasoil/nafta → "Combustible"

MONEDA: "USD" si dice dólares/USD/U$S, sino "UYU"
PAGO: "Plazo" si dice crédito/CTA CTE/e-Factura Crédito, sino "Contado"

RESPONDE SOLO JSON (sin markdown):
{
  "tipo": "GASTO",
  "proveedor": "EMPRESA EMISORA",
  "fecha": "YYYY-MM-DD",
  "moneda": "UYU",
  "montoTotal": 0,
  "items": [{"descripcion": "", "categoria": "", "precio": 0, "iva": 0, "precioFinal": 0}],
  "metodoPago": "Contado",
  "diasPlazo": null,
  "pagado": true
}`,
            },
          ],
        },
      ],
    });

    // Extraer el contenido de la respuesta de Claude
    const textBlock = response.content.find(block => block.type === 'text');
    const content = textBlock && textBlock.type === 'text' ? textBlock.text : null;

    console.log('✅ [VISION-GASTO] Respuesta Claude recibida')
    console.log('📝 [VISION-GASTO] Content:', content?.substring(0, 300))
    console.log('📊 [VISION-GASTO] Metadata:', {
      model: response.model,
      stop_reason: response.stop_reason,
      usage: response.usage
    })

    if (!content) {
      console.log('❌ [VISION-GASTO] Content vacío')
      return null;
    }

    // Limpiar el JSON (quitar markdown si lo hay)
    const jsonStr = content
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    let data: ParsedInvoice;
    try {
      data = JSON.parse(jsonStr) as ParsedInvoice;
    } catch (parseError) {
      console.log('❌ [VISION-GASTO] Error parseando JSON:', jsonStr.substring(0, 200))
      return null;
    }

    // Validaciones mínimas
    if (!data.items?.length) {
      console.log('❌ [VISION-GASTO] No se encontraron ítems');
      return null;
    }

    if (!data.moneda) data.moneda = "UYU"; // fallback Uruguay

    if (!data.proveedor?.trim()) {
      data.proveedor = "Proveedor no identificado";
    }

    // Asegurar que todos los ítems tengan categoría válida
    data.items = data.items.map(item => ({
      ...item,
      categoria: CATEGORIAS_GASTOS.includes(item.categoria)
        ? item.categoria
        : "Otros"
    }));

    // Consistencia de pago
    if (data.metodoPago === "Plazo" && !data.diasPlazo) {
      data.diasPlazo = 30;
    }

    if (data.metodoPago === "Plazo") {
      data.pagado = false;
    }

    if (!data.montoTotal) {
      data.montoTotal = data.items.reduce(
        (sum, item) => sum + item.precioFinal,
        0
      );
    }

    console.log("✅ [VISION-GASTO] Factura procesada:", data);
    return data;
  } catch (error) {
    console.error("❌ Error en processInvoiceImage:", error);
    return null;
  }
}
