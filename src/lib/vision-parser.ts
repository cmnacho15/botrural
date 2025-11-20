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
  iva: number; // 0, 10 o 22
  precioFinal: number;
}

export interface ParsedInvoice {
  tipo: 'GASTO' | 'INGRESO';
  items: InvoiceItem[];
  proveedor: string;
  fecha: string; // formato ISO: YYYY-MM-DD
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
          content: `Eres un asistente experto en procesar facturas agrícolas de Uruguay y Argentina.

INSTRUCCIONES CRÍTICAS:
1. Extrae TODOS los ítems individuales de la factura (no solo el total)
2. Para cada ítem determina:
   - descripcion: nombre del producto/servicio
   - categoria: una de ${CATEGORIAS_GASTOS.join(', ')}
   - precio: precio unitario SIN IVA
   - iva: porcentaje (0, 10 o 22)
   - precioFinal: precio con IVA incluido

3. Reconoce formatos de números uruguayos/argentinos: 1.234,56 o 1234.56
4. Busca RUT/RUC/CUIT para identificar el proveedor
5. Fecha en formato DD/MM/YYYY o DD-MM-YYYY
6. Si dice "CONTADO" o "EFECTIVO" → metodoPago: "Contado"
7. Si dice "CTA CTE", "CUENTA CORRIENTE", "30 días" → metodoPago: "Plazo"
8. tipo: siempre "GASTO" (a menos que diga explícitamente "INGRESO" o "RECIBO DE COBRO")

CATEGORIZACIÓN AUTOMÁTICA:
- Semillas, plantas, plantines → Semillas
- Fertilizantes, abonos, NPK → Fertilizantes
- Herbicidas, insecticidas, fungicidas, glifosato → Agroquímicos
- Gasoil, nafta, GNC → Combustible
- Tractores, cosechadoras, herramientas → Maquinaria
- Reparación, taller, repuestos → Reparaciones
- Jornales, sueldos, personal → Mano de Obra
- Flete, transporte, envío → Transporte
- Vacunas, medicamentos animales → Veterinaria
- Alimento balanceado, ración, forraje → Alimentos Animales
- Electricidad, agua, internet → Servicios
- Asesoramiento técnico, agronomía → Asesoramiento
- Alambres, postes, construcción → Estructuras
- Todo lo demás → Otros

Responde SOLO con JSON válido (sin \`\`\`json):
{
  "tipo": "GASTO",
  "items": [
    {
      "descripcion": "string",
      "categoria": "string",
      "precio": number,
      "iva": number,
      "precioFinal": number
    }
  ],
  "proveedor": "string",
  "fecha": "YYYY-MM-DD",
  "montoTotal": number,
  "metodoPago": "Contado" | "Plazo",
  "diasPlazo": number | null,
  "pagado": boolean,
  "notas": "string opcional"
}`
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
      temperature: 0.1,
    });

    const content = response.choices[0].message.content;
    if (!content) return null;

    // Limpiar markdown si existe
    const jsonStr = content
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();
    
    const data = JSON.parse(jsonStr) as ParsedInvoice;

    // Validaciones
    if (!data.items || data.items.length === 0) {
      throw new Error('No se encontraron ítems en la factura');
    }

    if (!data.proveedor || data.proveedor.trim() === '') {
      data.proveedor = 'Proveedor no identificado';
    }

    // Calcular montoTotal si no está
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