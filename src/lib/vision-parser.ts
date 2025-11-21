// Vision API para procesar facturas
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Categorías disponibles
const CATEGORIAS_GASTOS = [
  "Semillas",
  "Fertilizantes",
  "Agroquímicos",
  "Combustible",
  "Maquinaria",
  "Reparaciones",
  "Mano de Obra",
  "Transporte",
  "Veterinaria",
  "Alimentos Animales",
  "Servicios",
  "Asesoramiento",
  "Estructuras",
  "Insumos Agrícolas",
  "Otros",
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

  // NUEVO
  moneda: "USD" | "UYU";
}

export async function processInvoiceImage(
  imageUrl: string
): Promise<ParsedInvoice | null> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `
Eres un asistente experto en procesar facturas agrícolas de Uruguay y Argentina.

OBJETIVO NUEVO ➜ Detectar si la factura está en USD o UYU.

REGLAS PARA DETECTAR MONEDA:
- Si aparece texto como: "USD", "US$", "U$S", "Dólares", "USD$", "USD =", "U.S.D" → moneda = "USD"
- Si aparece: "$U", "UYU", "$ Uruguayo", "Pesos" → moneda = "UYU"
- Si aparecen ambos → usar "USD"
- Si no hay señal → usar "UYU" por defecto.

====== INSTRUCCIONES PARA ÍTEMS ======

EXTRAER TODOS LOS ÍTEMS. Para cada ítem:
- descripcion: incluir cantidad si existe (“Fertilizante x6”)
- precio: SIEMPRE el TOTAL sin IVA
- iva: 0, 10 o 22
- precioFinal: TOTAL con IVA

REGLA DE ORO:
Si existe “Total ítem”, “Importe”, “Monto”, “Subtotal” o “Total” → ese es el precio total.
Ignorar precio unitario siempre que exista total por ítem.

====== FECHA ======
Detectar DD/MM/YYYY o DD-MM-YYYY → devolver como YYYY-MM-DD.

====== FORMA DE PAGO ======
"CONTADO", "EFECTIVO" → Contado
"CTA CTE", "CUENTA CORRIENTE", "PLAZO", "30 días" → Plazo

====== SALIDA OBLIGATORIA (SIN MARKDOWN) ======
{
  "tipo": "GASTO",
  "moneda": "USD" | "UYU",
  "items": [...],
  "proveedor": "...",
  "fecha": "YYYY-MM-DD",
  "montoTotal": 0,
  "metodoPago": "...",
  "diasPlazo": 0 | null,
  "pagado": true
}
          `,
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Extrae todos los datos de esta factura en formato JSON:",
            },
            {
              type: "image_url",
              image_url: {
                url: imageUrl,
                detail: "high",
              },
            },
          ],
        },
      ],
      max_tokens: 2000,
      temperature: 0.05,
    });

    const content = response.choices[0].message.content;
    if (!content) return null;

    const jsonStr = content
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    const data = JSON.parse(jsonStr) as ParsedInvoice;

    // Validaciones mínimas
    if (!data.items?.length) throw new Error("No se encontraron ítems");

    if (!data.moneda) data.moneda = "UYU"; // fallback Uruguay

    if (!data.proveedor?.trim()) {
      data.proveedor = "Proveedor no identificado";
    }

    if (!data.montoTotal) {
      data.montoTotal = data.items.reduce(
        (sum, item) => sum + item.precioFinal,
        0
      );
    }

    console.log("✅ Factura procesada:", data);
    return data;
  } catch (error) {
    console.error("❌ Error en processInvoiceImage:", error);
    return null;
  }
}