// Vision API para procesar facturas
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Categorías disponibles (mismo enum que tu app)
const CATEGORIAS_GASTOS = [
  'Semillas',
  'Fertilizantes',
  'Agroquímicos',
  'Combustible',
  'Maquinaria',
  'Reparaciones',
  'Mano de Obra',
  'Transporte',
  'Veterinaria',
  'Alimentos Animales',
  'Servicios',
  'Asesoramiento',
  'Estructuras',
  'Insumos Agrícolas',
  'Otros'
];

interface InvoiceItem {
  descripcion: string;
  categoria: string;
  precio: number;
  iva: number;
  precioFinal: number;
}

export interface ParsedInvoice {
  tipo: 'GASTO' | 'INGRESO';
  items: InvoiceItem[];
  proveedor: string;
  fecha: string;
  montoTotal: number;
  metodoPago: 'Contado' | 'Plazo';
  diasPlazo?: number;
  pagado: boolean;
  notas?: string;
}

export async function processInvoiceImage(
  imageUrl: string
): Promise<ParsedInvoice | null> {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `
Eres un asistente experto en procesar facturas agrícolas de Uruguay y Argentina.

INSTRUCCIONES CRÍTICAS:

1. Extrae TODOS los ítems individuales de la factura (no solo el total).
2. Para cada ítem determina:
   - descripcion: nombre del producto/servicio (incluye cantidad si aparece, ej: "Fertilizante x6 unidades")
   - categoria: una de ${CATEGORIAS_GASTOS.join(', ')}
   - precio: SIEMPRE el precio TOTAL del ítem SIN IVA (NO el precio unitario)
   - iva: 0, 10 o 22
   - precioFinal: precio total con IVA incluido

REGLA ORO (muy importante):
- SIEMPRE que exista un valor etiquetado como "Monto", "Importe", "Subtotal", "Total ítem", "Total", úsalo como precio total del ítem.
- Ignora completamente el precio unitario cuando haya total del ítem.
- Ejemplo: Cantidad 6 × Unitario 7 = Total 42 → precio = 42 (no 7)

Si solo existe precio unitario sin cantidad → usa ese valor.

COLUMNAS TÍPICAS:
| Descripción | Cantidad | P.Unit | Subtotal | IVA | Total |
→ precio = SUBTOTAL o TOTAL sin IVA  
→ precioFinal = TOTAL con IVA (si no existe, calcula: precio + (precio × iva/100))

3. Reconoce números con formato Uruguay/Argentina: 1.234,56 o 1234.56
4. Busca RUT/RUC/CUIT para identificar el proveedor.
5. Fecha: formato DD/MM/YYYY o DD-MM-YYYY → devolver como YYYY-MM-DD.
6. Si dice "CONTADO" o "EFECTIVO" → metodoPago: "Contado".
7. Si dice "CTA CTE", "CUENTA CORRIENTE", "30 días" → metodoPago: "Plazo".
8. tipo: siempre "GASTO" salvo que explícitamente sea "INGRESO", "RECIBO DE COBRO", etc.

CATEGORIZACIÓN AUTOMÁTICA:
- Semillas, plantas, plantines → Semillas
- Fertilizantes, abonos, NPK → Fertilizantes
- Herbicidas, insecticidas, fungicidas, glifosato → Agroquímicos
- Gasoil, nafta, GNC → Combustible
- Tractores, herramientas, maquinaria → Maquinaria
- Reparación, taller, repuestos → Reparaciones
- Jornales, sueldos, mano de obra → Mano de Obra
- Flete, transporte → Transporte
- Vacunas, medicamentos animales → Veterinaria
- Ración, forraje, alimento → Alimentos Animales
- Electricidad, agua, internet → Servicios
- Asesoramiento técnico, agrónomo → Asesoramiento
- Alambres, postes, construcción → Estructuras
- Todo lo demás → Otros

Responde SOLO con JSON válido (sin markdown).
`
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Extrae todos los datos de esta factura en formato JSON:'
            },
            {
              type: 'image_url',
              image_url: {
                url: imageUrl,
                detail: 'high'
              }
            }
          ]
        }
      ],
      max_tokens: 2000,
      temperature: 0.05,
    });

    const content = response.choices[0].message.content;
    if (!content) return null;

    const jsonStr = content
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    const data = JSON.parse(jsonStr) as ParsedInvoice;

    if (!data.items || data.items.length === 0) {
      throw new Error('No se encontraron ítems en la factura');
    }

    if (!data.proveedor || data.proveedor.trim() === '') {
      data.proveedor = 'Proveedor no identificado';
    }

    if (!data.montoTotal) {
      data.montoTotal = data.items.reduce((sum, item) => sum + item.precioFinal, 0);
    }

    console.log('✅ Factura procesada:', data);
    return data;
  } catch (error) {
    console.error('❌ Error en processInvoiceImage:', error);
    return null;
  }
}