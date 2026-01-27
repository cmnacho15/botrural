// Vision API para procesar facturas src/lib/vision-parser.ts
// Usa Claude (Anthropic) para OCR de facturas - más permisivo con documentos comerciales

import Anthropic from "@anthropic-ai/sdk";
import { trackClaudeUsage } from "@/lib/ai-usage-tracker";

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
  imageUrl: string,
  userId?: string
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
      model: "claude-sonnet-4-20250514",
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

⚠️ REGLA CRÍTICA DE VALIDACIÓN MATEMÁTICA:
La suma de precioFinal de TODOS los items DEBE ser EXACTAMENTE igual al TOTAL de la factura.
PROCESO OBLIGATORIO:
1. Primero identificar el TOTAL FINAL de la factura (buscar "TOTAL", "TOTAL A PAGAR", "IMPORTE TOTAL")
2. Luego extraer cada item con sus montos
3. Verificar: Σ(precioFinal) = TOTAL. Si no coincide, reinterpretar las columnas.

📊 CÓMO LEER TABLAS DE FACTURAS:
Las facturas uruguayas típicamente tienen estas columnas:
- Cantidad | Precio Unitario | Total/Monto/Importe | IVA

REGLAS PARA EXTRAER MONTOS:
- "precio" = valor de columna "Total", "Monto", "Importe" o "Total (doc.)" → ya es Cantidad × Precio Unitario
- "iva" = valor de columna "IVA" (si existe y no es "E" o "EXE")
- "precioFinal" = precio + iva
- Si IVA = "E", "EXE", "IVA_EXE" o vacío → iva = 0, precioFinal = precio
- NUNCA usar el precio unitario como precioFinal (error común)

EJEMPLO DE LECTURA CORRECTA:
| Descripción | Cant | P.Unit | Total | IVA |
| Producto A  |   8  | $89.87 | $718.96 | $158.17 |
→ precio: 718.96, iva: 158.17, precioFinal: 877.13 ✓
→ INCORRECTO sería: precio: 89.87 (eso es unitario!)

PROVEEDOR:
- Es la EMPRESA que EMITE la factura (logo/membrete arriba), NO el cliente
- UTE, BPS, DGI → usar ese nombre
- Otros → nombre del comercio emisor

ITEMS PARA SERVICIOS PÚBLICOS (UTE, BPS, DGI, OSE):
- Crear UN SOLO item con el total del servicio
- Ejemplo: "Consumo eléctrico mes XX/XXXX"

CATEGORÍAS: ${CATEGORIAS_GASTOS.join(", ")}

MAPEO:
- UTE/electricidad → "Electricidad"
- BPS/aportes → "Sueldos"
- DGI/impuestos/IMEBA → "Impuestos"
- Veterinaria/medicamentos/vacunas → "Sanidad y Manejo"
- Pinturas para marcar ganado (Celocheck) → "Sanidad y Manejo"
- Semillas pasturas → "Insumos Pasturas"
- Semillas agrícolas → "Insumos de Cultivos"
- Alambres/postes/varillas/bebederos/tanques/tubos/caños → "Estructuras"
- Balanceados/forrajes → "Alimentación"
- Gasoil/nafta → "Combustible"

MONEDA: "USD" si dice dólares/USD/U$S/US$, sino "UYU"
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

    // Trackear uso de Claude
    if (userId) {
      trackClaudeUsage(userId, 'FACTURA_PARSER', response, { imageType: imageData.mediaType })
    }

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

    // 🔢 VALIDACIÓN MATEMÁTICA: Suma de items vs Total
    const sumaItems = data.items.reduce((sum, item) => sum + (item.precioFinal || 0), 0);
    const diferencia = Math.abs(sumaItems - data.montoTotal);

    if (diferencia > 0.50) {
      console.log('⚠️ [VISION-GASTO] DISCREPANCIA MATEMÁTICA DETECTADA:');
      console.log(`   📊 Suma de items: ${sumaItems.toFixed(2)}`);
      console.log(`   💰 Total factura: ${data.montoTotal.toFixed(2)}`);
      console.log(`   ❌ Diferencia: ${diferencia.toFixed(2)}`);
      console.log('   📋 Items detectados:');
      data.items.forEach((item, i) => {
        console.log(`      ${i + 1}. ${item.descripcion}: precio=${item.precio}, iva=${item.iva}, final=${item.precioFinal}`);
      });

      // Si la diferencia es muy grande, puede que haya leído precios unitarios
      if (diferencia > data.montoTotal * 0.1) {
        console.log('   ⚠️ Posible error: Claude puede haber leído precios unitarios en vez de totales');
      }
    } else {
      console.log(`✅ [VISION-GASTO] Validación OK: Suma items (${sumaItems.toFixed(2)}) ≈ Total (${data.montoTotal.toFixed(2)})`);
    }

    if (!data.montoTotal) {
      data.montoTotal = sumaItems;
    }

    console.log("✅ [VISION-GASTO] Factura procesada:", data);
    return data;
  } catch (error) {
    console.error("❌ Error en processInvoiceImage:", error);
    return null;
  }
}
