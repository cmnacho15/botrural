// Vision API para procesar facturas src/lib/vision-parser.ts
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

====== MONEDA ======
REGLAS PARA DETECTAR:
- Si aparece: "USD", "US$", "U$S", "Dólares", "USD$", "U.S.D" → moneda = "USD"
- Si aparece: "$U", "UYU", "$ Uruguayo", "Pesos" → moneda = "UYU"
- Si aparecen ambos → usar "USD"
- Si no hay señal → usar "UYU" por defecto

====== CATEGORIZACIÓN DE ÍTEMS ======
Para cada ítem de la factura, DEBES asignar UNA categoría de esta lista:

${CATEGORIAS_GASTOS.map((cat, i) => `${i + 1}. ${cat}`).join('\n')}

REGLAS DE CATEGORIZACIÓN:
- Semillas: maíz, soja, trigo, pasturas, semillas forrajeras
- Fertilizantes: urea, fosfatos, NPK, cal, compost, fertilizantes líquidos
- Agroquímicos: herbicidas, insecticidas, fungicidas, productos fitosanitarios
- Combustible: gasoil, nafta, diesel, GNC
- Maquinaria: tractores, cosechadoras, implementos agrícolas, equipos
- Reparaciones: repuestos, mantenimiento, service, arreglos
- Mano de Obra: jornales, salarios, contratistas
- Transporte: fletes, logística, camiones
- Veterinaria: medicamentos, vacunas, suplementos para animales
- Alimentos Animales: balanceados, concentrados, forrajes, sales minerales
- Servicios: electricidad, agua, internet, telefonía
- Asesoramiento: consultoría, estudios, análisis de suelo
- Estructuras: alambrados, galpones, silos, construcciones
- Insumos Agrícolas: herramientas, bolsas, envases, materiales varios
- Otros: lo que no encaje en ninguna categoría anterior

SI NO ESTÁS SEGURO: usa "Insumos Agrícolas" para materiales generales u "Otros" como último recurso.

====== EXTRACCIÓN DE ÍTEMS ======
Para cada ítem extraer:
- descripcion: incluir cantidad si existe ("Fertilizante x6")
- categoria: UNA de las ${CATEGORIAS_GASTOS.length} categorías listadas arriba
- precio: SIEMPRE el TOTAL sin IVA
- iva: 0, 10 o 22
- precioFinal: TOTAL con IVA

REGLA DE ORO:
Si existe "Total ítem", "Importe", "Monto", "Subtotal" o "Total" → ese es el precio total.
Ignorar precio unitario siempre que exista total por ítem.

====== FECHA ======
Detectar DD/MM/YYYY o DD-MM-YYYY → devolver como YYYY-MM-DD.

====== FORMA DE PAGO ======
CRÍTICO: Buscar indicadores de pago a PLAZO en TODA la factura:

PAGO A PLAZO si encuentra:
- Texto: "Crédito", "Credito", "CTA CTE", "Cuenta Corriente", "PLAZO"
- Días comerciales: "30 días", "60 días", "90 días", "30 dias Comerciales"
- Plazos: "A 30 días", "A plazo", "Financiado"

PAGO CONTADO si encuentra:
- Texto: "CONTADO", "EFECTIVO", "AL CONTADO", "Cash"

REGLAS:
1. Si aparece "Crédito" o "CTA CTE" → metodoPago = "Plazo"
2. Si aparece un número seguido de "días" (30 días, 60 días) → metodoPago = "Plazo" y diasPlazo = ese número
3. Si dice "30 dias Comerciales" → metodoPago = "Plazo" y diasPlazo = 30
4. Si NO aparece ningún indicador → metodoPago = "Contado"
5. Si es a plazo → pagado = false (porque aún no se pagó)
6. Si es contado → pagado = true (porque se paga al momento)

EJEMPLOS:
- "30 días Comerciales - ARS" → metodoPago: "Plazo", diasPlazo: 30, pagado: false
- "Crédito" → metodoPago: "Plazo", diasPlazo: 30, pagado: false
- "CTA CTE" → metodoPago: "Plazo", diasPlazo: null, pagado: false
- "CONTADO" → metodoPago: "Contado", diasPlazo: null, pagado: true

====== EJEMPLOS DE CATEGORIZACIÓN ======
- "Pintura Celocheck" → "Estructuras"
- "Alambre CAUDILLO" → "Estructuras"
- "Alambrado" → "Estructuras"
- "Soja RR" → "Semillas"
- "Urea granulada" → "Fertilizantes"
- "Glifosato" → "Agroquímicos"
- "Gasoil" → "Combustible"
- "Ivermectina" → "Veterinaria"
- "Balanceado vacuno" → "Alimentos Animales"

====== SALIDA OBLIGATORIA (SIN MARKDOWN) ======
{
  "tipo": "GASTO",
  "moneda": "USD" | "UYU",
  "items": [
    {
      "descripcion": "...",
      "categoria": "una de las ${CATEGORIAS_GASTOS.length} categorías",
      "precio": 0,
      "iva": 0,
      "precioFinal": 0
    }
  ],
  "proveedor": "...",
  "fecha": "YYYY-MM-DD",
  "montoTotal": 0,
  "metodoPago": "Contado" | "Plazo",
  "diasPlazo": número | null,
  "pagado": true | false
}
          `,
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Extrae todos los datos de esta factura en formato JSON. IMPORTANTE: Detecta correctamente si es pago a plazo (crédito, CTA CTE, días comerciales) o contado.",
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

    // ✅ VALIDACIÓN: Asegurar que todos los ítems tengan categoría válida
    data.items = data.items.map(item => ({
      ...item,
      categoria: CATEGORIAS_GASTOS.includes(item.categoria) 
        ? item.categoria 
        : "Otros"
    }));

    // ✅ NUEVA VALIDACIÓN: Consistencia de pago
    // Si es a plazo pero no hay diasPlazo, usar 30 días por defecto
    if (data.metodoPago === "Plazo" && !data.diasPlazo) {
      data.diasPlazo = 30;
    }

    // Si es a plazo, debe estar como no pagado
    if (data.metodoPago === "Plazo") {
      data.pagado = false;
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