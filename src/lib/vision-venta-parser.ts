// lib/vision-venta-parser.ts
// Parser especializado para facturas de VENTA de hacienda (frigoríficos)

import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface VentaRenglonParsed {
  categoria: string;        // "OVEJAS", "CORDEROS DL", "NOVILLOS", etc.
  tipoAnimal: string;       // "OVINO" | "BOVINO" | "EQUINO"
  raza: string | null;      // "GEN S/Clasif", "HEREFORD", etc.
  cantidad: number;         // 130, 300
  pesoTotalKg: number;      // Peso en segunda balanza (2191.0, 4140.5)
  pesoPromedio: number;     // kg por animal
  rendimiento: number | null; // % de rendimiento (42.22%, 40.24%)
  precioKgUSD: number;      // precio por kg (4.7000, 5.5600)
  importeBrutoUSD: number;  // importe del renglón (10297.70, 23021.18)
}

export interface ImpuestosVenta {
  mevir?: number;           // 0.20%
  inia?: number;            // 0.40%
  imeba?: number;           // 2.00%
  decreto364_003?: number;
  decreto117_015?: number;
  mgap?: number;
  otros?: number;
}

export interface ParsedVenta {
  tipo: "VENTA";
  
  // Datos del comprador (frigorífico)
  comprador: string;        // "Frigo Salto"
  compradorDireccion?: string;
  
  // Datos del productor (vendedor)
  productor: string;        // "ERNESTO ESTEVEZ"
  productorDicose?: string; // "HH.07.19526"
  productorRut?: string;
  rutEmisor?: string;
  
  // Consignatario (intermediario)
  consignatario?: string;   // "CANEPA MARTINEZ FRANCISCO ANSELMO"
  consignatarioDicose?: string;
  consignatarioRut?: string;
  
  // Datos de la operación
  fecha: string;            // "2025-11-06"
  nroFactura: string;       // "6590"
  nroTropa: string | null;  // "28"
  guias?: string;           // "D 626465;d 626979"
  
  // Renglones de animales
  renglones: VentaRenglonParsed[];
  
  // Totales
  cantidadTotal: number;    // 430
  pesoTotalKg: number;      // 6331.5
  subtotalUSD: number;      // 33318.88
  
  // Impuestos (descuentos)
  impuestos: ImpuestosVenta;
  totalImpuestosUSD: number; // suma de todos los impuestos
  
  // Total final
  totalNetoUSD: number;     // 32469.21
  
  // Condiciones de pago
  metodoPago: "Contado" | "Plazo";
  diasPlazo?: number;
  fechaVencimiento?: string;
  tipoCambio?: number;      // T/C 39.8070
  
  // Otros
  flete?: string;           // "Por cuenta de Frigorífico"
}

/**
 * Detectar si una imagen es una factura de VENTA (no de gasto)
 */
export async function detectarTipoFactura(imageUrl: string): Promise<"VENTA" | "GASTO" | null> {
  console.log("🔍 Detectando tipo factura:", imageUrl)
  
  try {
    // Estrategia: Hacer 2 preguntas directas a GPT
    
    // PREGUNTA 1: ¿Es una venta de animales?
    const response1 = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `Eres un detector de facturas de venta de hacienda (animales) en Uruguay.

PREGUNTA: ¿Esta imagen es una factura de VENTA de animales a un frigorífico o comprador de hacienda?

CONTEXTO IMPORTANTE:
- VENTA = El productor/vendedor VENDE animales al frigorífico/comprador
- El frigorífico/comprador es quien PAGA por los animales
- Puede ser e-factura, factura física, liquidación, etc.

SEÑALES FUERTES DE VENTA (si tiene 2 o más → es VENTA):
1. Menciona animales con PESO y PRECIO: VACAS, OVEJAS, CORDEROS, NOVILLOS, TERNEROS, CAPONES
2. Tiene datos de PRODUCTOR o VENDEDOR (nombre, RUT, DICOSE)
3. Tiene datos de COMPRADOR que es un frigorífico o empresa: Frigo Salto, Marfrig, CHIADEL, PUL, Pradera de Rosas
4. Tiene columnas típicas de venta ganadera: Cantidad/Cant, Kilos/Peso, Precio, Rendimiento, Importe
5. Menciona: TROPA, DICOSE, GUIAS, Segunda Balanza, Primera Balanza
6. Tiene impuestos de venta ganadera: MEVIR, INIA, IMEBA, Comisión, C.S.E, TCB, TCF
7. Dice "Fact.Haciendas", "e-Factura", "Liquidación", "PRODUCTOR"
8. Tipo de documento: "e-Factura" con categoría de animales

SEÑALES DE GASTO (factura común):
- Es un proveedor vendiendo insumos/servicios (veterinaria, alimento, combustible, etc.)
- No menciona kilos ni precio por kilo de animales
- Es una factura de compra de productos/servicios

IMPORTANTE:
- Si menciona RUT COMPRADOR + categoría de animales con kilos → es VENTA
- Si dice "e-Factura" y tiene animales con precio/kg → es VENTA
- Confiá en las señales, aunque el formato sea diferente

RESPONDE SOLO:
- "SI" si es claramente una venta de animales (2+ señales fuertes)
- "NO" si es una compra/gasto (factura común)
- "INCIERTO" si realmente no podés determinar`
        },
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: imageUrl, detail: "low" } }
          ]
        }
      ],
      max_tokens: 10,
      temperature: 0
    });

    const respuesta1 = response1.choices[0].message.content?.toUpperCase().trim() || "";
    console.log("📊 Respuesta GPT sobre VENTA:", respuesta1)

    if (respuesta1.includes("SI")) {
      console.log("✅ DETECTADO: VENTA (GPT confirmó)")
      return "VENTA";
    }

    if (respuesta1.includes("NO")) {
      console.log("✅ DETECTADO: GASTO (GPT descartó venta)")
      return "GASTO";
    }

    // Si GPT no está seguro, hacer extracción de texto como fallback
    console.log("⚠️ GPT incierto, extrayendo texto...")
    
    const response2 = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "Extrae TODO el texto visible. Responde SOLO el texto plano."
        },
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: imageUrl, detail: "low" } }
          ]
        }
      ],
      max_tokens: 800,
      temperature: 0
    });

    const texto = response2.choices[0].message.content?.toUpperCase() || "";
    console.log("📝 Texto extraído (primeros 200):", texto.substring(0, 200))

    // Buscar palabras clave VENTA (más específicas)
    const palabrasVentaFuertes = [
      "TROPA",
      "DICOSE",
      "FACT. HACIENDAS",
      "FACT.HACIENDAS",
      "FRIGORIFICO",
      "FRIGORÍFICO",
      "FRIGO ",
      "SEGUNDA BALANZA",
      "RENDIMIENTO",
      "MEVIR",
      "INIA",
      "IMEBA",
      "PRODUCTOR:",
      "LIQUIDACION",
      "LIQUIDACIÓN",
      "CHIADEL",
      "E-FACTURA",
      "RUT COMPRADOR",
      "COMISION",
      "COMISIÓN",
      "C.S.E",
      "TCB",
      "TCF",
      "COMPENSACION KILOS"
    ];

    for (const palabra of palabrasVentaFuertes) {
      if (texto.includes(palabra)) {
        console.log(`✅ VENTA detectada por palabra clave: "${palabra}"`)
        return "VENTA";
      }
    }

    // Buscar animales + peso + precio
    const animalesRegex = /OVEJAS|CORDEROS|NOVILLOS|VACAS|CAPONES|CARNEROS|TERNEROS|VAQUILLONAS/;
    const pesoRegex = /\d+[.,]\d+\s*(KG|KILOS)/;
    const precioKgRegex = /\$\s*\d+[.,]\d+\s*\/\s*KG/;
    
    const tieneAnimales = animalesRegex.test(texto);
    const tienePeso = pesoRegex.test(texto);
    const tienePrecioKg = precioKgRegex.test(texto);

    if (tieneAnimales && (tienePeso || tienePrecioKg)) {
      console.log("✅ VENTA por: animales + peso/precio por kg")
      return "VENTA";
    }

    // Si no hay señales claras, retornar null
    console.log("⚠️ No hay señales claras → null (preguntar)")
    return null;
    
  } catch (error) {
    console.error("❌ Error en detectarTipoFactura:", error);
    return null;
  }
}

/**
 * Procesar imagen de factura de VENTA de hacienda
 */
export async function processVentaImage(imageUrl: string): Promise<ParsedVenta | null> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `Eres un experto en procesar facturas de venta de hacienda de Uruguay.

CONTEXTO:
- Estas facturas son de frigoríficos (Frigo Salto, Marfrig, etc.) que COMPRAN animales a productores
- El PRODUCTOR es quien VENDE sus animales
- El frigorífico es el COMPRADOR
- Puede haber un CONSIGNATARIO (intermediario)

ESTRUCTURA TÍPICA:
- Header: Logo del frigorífico, datos de contacto
- Fact.Haciendas: número de factura
- TROPA: número de tropa
- Fecha
- PRODUCTOR: nombre del que vende, DICOSE, RUT
- Consignatario: intermediario (opcional)
- Tabla de animales: CATEGORÍA, Raza, Cantidad, Kilos, Precio/kg, Importe
- Totales: Subtotal, Impuestos (MEVIR, INIA, IMEBA, etc.), Total Neto
- Condiciones de pago: Contado/Plazo, Vencimiento, T/C

CATEGORÍAS COMUNES (mapear a tipoAnimal):
- OVEJAS, CORDEROS, CAPONES, CARNEROS, BORREGOS → OVINO
- NOVILLOS, VACAS, VAQUILLONAS, TERNEROS, TOROS → BOVINO
- YEGUAS, POTROS, CABALLOS → EQUINO

IMPUESTOS TÍPICOS (son DESCUENTOS del subtotal):
- MEVIR: 0.20%
- INIA: 0.40%
- IMEBA: 2.00%
- Decreto 364/003
- Decreto 117/015
- MGAP

IMPORTANTE:
- Los precios están en USD (U$S o US$)
- El peso puede estar en "Segunda Balanza" o "Primera Balanza"
- Calcular pesoPromedio = pesoTotalKg / cantidad

RESPONDE EN JSON (sin markdown):
{
  "tipo": "VENTA",
  "comprador": "nombre del frigorífico",
  "productor": "nombre del productor",
  "productorDicose": "XX.XX.XXXXX",
  "rutEmisor": "RUT del emisor de la factura",
  "consignatario": "nombre o null",
  "fecha": "YYYY-MM-DD",
  "nroFactura": "número",
  "nroTropa": "número o null",
  "renglones": [
    {
      "categoria": "OVEJAS",
      "tipoAnimal": "OVINO",
      "raza": "GEN S/Clasif",
      "cantidad": 130,
      "pesoTotalKg": 2191.0,
      "pesoPromedio": 16.85,
      "rendimiento": 42.22,
      "precioKgUSD": 4.70,
      "importeBrutoUSD": 10297.70
    }
  ],
  "cantidadTotal": 430,
  "pesoTotalKg": 6331.5,
  "subtotalUSD": 33318.88,
  "impuestos": {
    "mevir": 64.95,
    "inia": 129.90,
    "imeba": 649.49,
    "mgap": 5.33
  },
  "totalImpuestosUSD": 849.67,
  "totalNetoUSD": 32469.21,
  "metodoPago": "Contado",
  "diasPlazo": null,
  "fechaVencimiento": null,
  "tipoCambio": 39.8070,
  "flete": "Por cuenta de Frigorífico"
}`
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Extrae todos los datos de esta factura de venta de hacienda:"
            },
            {
              type: "image_url",
              image_url: { url: imageUrl, detail: "high" }
            }
          ]
        }
      ],
      max_tokens: 2500,
      temperature: 0.05
    });

    const content = response.choices[0].message.content;
    if (!content) return null;

    // Limpiar markdown si viene
    const jsonStr = content
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    const data = JSON.parse(jsonStr) as ParsedVenta;

    // Validaciones
    if (!data.renglones?.length) {
      throw new Error("No se encontraron renglones de animales");
    }

    if (!data.comprador?.trim()) {
      data.comprador = "Frigorífico no identificado";
    }

    if (!data.productor?.trim()) {
      data.productor = "Productor no identificado";
    }

    // Calcular totales si faltan
    if (!data.cantidadTotal) {
      data.cantidadTotal = data.renglones.reduce((sum, r) => sum + r.cantidad, 0);
    }

    if (!data.pesoTotalKg) {
      data.pesoTotalKg = data.renglones.reduce((sum, r) => sum + r.pesoTotalKg, 0);
    }

    if (!data.subtotalUSD) {
      data.subtotalUSD = data.renglones.reduce((sum, r) => sum + r.importeBrutoUSD, 0);
    }

    // Calcular total de impuestos
    if (!data.totalImpuestosUSD && data.impuestos) {
      data.totalImpuestosUSD = Object.values(data.impuestos).reduce((sum, val) => sum + (val || 0), 0);
    }

    if (!data.totalNetoUSD) {
      data.totalNetoUSD = data.subtotalUSD - (data.totalImpuestosUSD || 0);
    }

    // Asegurar que metodoPago tenga valor
    if (!data.metodoPago) {
      data.metodoPago = "Contado";
    }

    console.log("✅ Factura de VENTA procesada:", {
      comprador: data.comprador,
      productor: data.productor,
      renglones: data.renglones.length,
      totalNetoUSD: data.totalNetoUSD
    });

    return data;

  } catch (error) {
    console.error("❌ Error procesando factura de venta:", error);
    return null;
  }
}

/**
 * Mapear categoría de factura a categoría del sistema
 */
export function mapearCategoriaVenta(categoriaFactura: string): { categoria: string; tipoAnimal: string } {
  const cat = categoriaFactura.toUpperCase().trim();
  
  // OVINOS
  if (cat.includes("OVEJA")) return { categoria: "Oveja", tipoAnimal: "OVINO" };
  if (cat.includes("CORDERO")) return { categoria: "Cordero", tipoAnimal: "OVINO" };
  if (cat.includes("CAPON") || cat.includes("CAPÓN")) return { categoria: "Capón", tipoAnimal: "OVINO" };
  if (cat.includes("CARNERO")) return { categoria: "Carnero", tipoAnimal: "OVINO" };
  if (cat.includes("BORREGO")) return { categoria: "Borrego", tipoAnimal: "OVINO" };
  
  // BOVINOS
  if (cat.includes("NOVILLO")) return { categoria: "Novillo", tipoAnimal: "BOVINO" };
  if (cat.includes("VACA") && !cat.includes("VAQUILLONA")) return { categoria: "Vaca", tipoAnimal: "BOVINO" };
  if (cat.includes("VAQUILLONA")) return { categoria: "Vaquillona", tipoAnimal: "BOVINO" };
  if (cat.includes("TERNERO")) return { categoria: "Ternero", tipoAnimal: "BOVINO" };
  if (cat.includes("TERNERA")) return { categoria: "Ternera", tipoAnimal: "BOVINO" };
  if (cat.includes("TORO")) return { categoria: "Toro", tipoAnimal: "BOVINO" };
  
  // EQUINOS
  if (cat.includes("YEGUA")) return { categoria: "Yegua", tipoAnimal: "EQUINO" };
  if (cat.includes("POTRO")) return { categoria: "Potro", tipoAnimal: "EQUINO" };
  if (cat.includes("CABALLO")) return { categoria: "Caballo", tipoAnimal: "EQUINO" };
  
  // Por defecto, intentar capitalizar
  const palabras = categoriaFactura.toLowerCase().split(/\s+/);
  const categoriaCapitalizada = palabras
    .map(p => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
  
  return { categoria: categoriaCapitalizada, tipoAnimal: "OTRO" };
}