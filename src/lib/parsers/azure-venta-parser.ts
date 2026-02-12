// src/lib/parsers/azure-venta-parser.ts
import { DocumentAnalysisClient, AzureKeyCredential } from "@azure/ai-form-recognizer";
import OpenAI from "openai";
import { trackOpenAIChat } from "@/lib/ai-usage-tracker";

const client = new DocumentAnalysisClient(
  process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT!,
  new AzureKeyCredential(process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY!)
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface ParsedVentaGanadoAzure {
  tipo: "VENTA";
  tipoProducto: "GANADO" | "LANA" | "GRANOS";
  comprador: string;
  productor: string;
  rutEmisor?: string;
  consignatario?: string;
  fecha: string;
  nroFactura?: string;
  nroLiquidacion?: string;
  nroTropa?: string;
  renglones: Array<{
    categoria: string;
    tipoAnimal: "BOVINO" | "OVINO" | "EQUINO" | null;
    raza: string | null;
    cantidad: number;
    pesoTotalKg: number;
    pesoPromedio: number;
    rendimiento: number | null;
    precioKgUSD: number;
    importeBrutoUSD: number;
    esBonificacion?: boolean;
  }>;
  cantidadTotal: number;
  pesoTotalKg: number;
  subtotalUSD: number;
  impuestos: {
    iva: number;
    imeba: number;
    inia: number;
    mevir: number;
    comision: number;
    otros: number;
    otrosDetalle?: Array<{ concepto: string; monto: number }>;
  };
  totalImpuestosUSD: number;
  totalNetoUSD: number;
  metodoPago: "Contado" | "Plazo";
  diasPlazo?: number;
  fechaVencimiento?: string;
}

export async function parseVentaGanadoWithAzure(
  imageUrl: string,
  campoId?: string,
  userId?: string
): Promise<ParsedVentaGanadoAzure | null> {
  try {
    console.log("🔵 [AZURE] Iniciando análisis de factura con Azure Document Intelligence...");

    // Paso 1: Analizar documento con Azure
    const poller = await client.beginAnalyzeDocumentFromUrl(
      "prebuilt-invoice",
      imageUrl
    );

    const result = await poller.pollUntilDone();

    if (!result.documents || result.documents.length === 0) {
      console.error("❌ [AZURE] No se pudo analizar el documento");
      return null;
    }

    // Extraer texto completo y campos
    const document = result.documents[0];
    const fields = document.fields;

    console.log("✅ [AZURE] Documento analizado exitosamente");

    // Extraer texto de toda la página
    let fullText = "";
    if (result.pages && result.pages.length > 0) {
      for (const page of result.pages) {
        if (page.lines) {
          fullText += page.lines.map(line => line.content).join("\n") + "\n";
        }
      }
    }

    console.log("📄 [AZURE] Texto extraído:", fullText.substring(0, 500) + "...");

    // Paso 2: Interpretar con GPT-4o-mini
    console.log("🤖 [GPT-4o-mini] Interpretando documento...");

    const promptSystem = `Eres un experto en facturas ganaderas uruguayas.
Te voy a pasar el texto extraído por OCR de una factura de venta de ganado.
Tu trabajo es estructurar la información en formato JSON.

🚨 CRÍTICO - COSTOS COMERCIALES:
Buscar en el desglose entre Subtotal y Total. Extraer TODOS los costos:

1. IMEBA: "IMEBA", "Ley 16736", "Ley 18726", "A655", "Impuesto Enajenación"
2. INIA: "INIA", "Ley 16065", "Instituto"
3. MEVIR: "MEVIR", "Ley 15851", "Vivienda"
4. IVA: "IVA", "I.V.A."
5. Comisión: "Comisión", "Com.", "Gastos"
6. Otros: D364/432/003, Ley 19300, Ley 19355, Certificación, SCEPB, etc.

IMPORTANTE:
- Lee CADA línea del desglose entre Subtotal y Total
- Lee los números COMPLETOS (si dice 936.38, NO pongas 93.64)
- SUMA todos los costos para verificar que totalImpuestosUSD = Subtotal - Total
- NO omitas ningún costo, por pequeño que sea

🚨 BONIFICACIONES:
- Si hay bonificaciones, poner cantidad: 0, pesoTotalKg: 0
- Solo el importeBrutoUSD debe tener valor
- Marcar esBonificacion: true

NO inventes valores. Si no encuentras un campo, usa null o 0.`;

    const promptUser = `Texto de la factura extraído por OCR:

${fullText}

Extrae TODOS los datos y devuelve un JSON con esta estructura:
{
  "comprador": "nombre del comprador",
  "productor": "nombre del productor/remitente",
  "fecha": "YYYY-MM-DD",
  "nroFactura": "número de factura si existe",
  "nroTropa": "número de tropa si existe",
  "renglones": [
    {
      "categoria": "VACA GORDA",
      "tipoAnimal": "BOVINO",
      "cantidad": 40,
      "pesoTotalKg": 19130,
      "pesoPromedio": 478.25,
      "rendimiento": 48.95,
      "precioKgUSD": 2.50,
      "importeBrutoUSD": 47755.38,
      "esBonificacion": false
    }
  ],
  "subtotalUSD": 48052.29,
  "impuestos": {
    "iva": 0,
    "imeba": 936.38,
    "inia": 187.28,
    "mevir": 93.64,
    "comision": 0,
    "otros": 293.49
  },
  "totalImpuestosUSD": 1510.79,
  "totalNetoUSD": 46541.50,
  "metodoPago": "Plazo",
  "fechaVencimiento": "YYYY-MM-DD"
}

CRÍTICO: Lee los números EXACTOS como aparecen. Si dice 936.38, NO pongas 93.64.`;

    const startTime = Date.now();
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: promptSystem },
        { role: "user", content: promptUser }
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
    });

    const elapsed = Date.now() - startTime;

    // Track usage
    if (userId) {
      await trackOpenAIChat(
        userId,
        "FACTURA_PARSER",
        response,
        {
          parser: "azure+gpt4o-mini",
          campoId: campoId || ""
        }
      );
    }

    const content = response.choices[0].message.content;
    if (!content) {
      console.error("❌ [GPT-4o-mini] No se obtuvo respuesta");
      return null;
    }

    const parsedData = JSON.parse(content);
    console.log("✅ [GPT-4o-mini] Documento interpretado exitosamente");

    // Validar y estructurar datos
    // CRÍTICO: Limpiar bonificaciones (cantidad y peso deben ser 0)
    const renglonesLimpios = (parsedData.renglones || []).map((r: any) => {
      if (r.esBonificacion) {
        return {
          ...r,
          cantidad: 0,
          pesoTotalKg: 0,
          pesoPromedio: 0
        };
      }
      return r;
    });

    const ventaData: ParsedVentaGanadoAzure = {
      tipo: "VENTA",
      tipoProducto: "GANADO",
      comprador: parsedData.comprador || "",
      productor: parsedData.productor || "",
      rutEmisor: parsedData.rutEmisor || undefined,
      consignatario: parsedData.consignatario || undefined,
      fecha: parsedData.fecha || new Date().toISOString().split('T')[0],
      nroFactura: parsedData.nroFactura || undefined,
      nroLiquidacion: parsedData.nroLiquidacion || undefined,
      nroTropa: parsedData.nroTropa || undefined,
      renglones: renglonesLimpios,
      cantidadTotal: renglonesLimpios.reduce((sum: number, r: any) => sum + (r.esBonificacion ? 0 : (r.cantidad || 0)), 0),
      pesoTotalKg: renglonesLimpios.reduce((sum: number, r: any) => sum + (r.esBonificacion ? 0 : (r.pesoTotalKg || 0)), 0),
      subtotalUSD: parsedData.subtotalUSD || 0,
      impuestos: {
        iva: parsedData.impuestos?.iva || 0,
        imeba: parsedData.impuestos?.imeba || 0,
        inia: parsedData.impuestos?.inia || 0,
        mevir: parsedData.impuestos?.mevir || 0,
        comision: parsedData.impuestos?.comision || 0,
        otros: parsedData.impuestos?.otros || 0,
        otrosDetalle: parsedData.impuestos?.otrosDetalle || []
      },
      totalImpuestosUSD: parsedData.totalImpuestosUSD || 0,
      totalNetoUSD: parsedData.totalNetoUSD || 0,
      metodoPago: parsedData.metodoPago || "Contado",
      diasPlazo: parsedData.diasPlazo || undefined,
      fechaVencimiento: parsedData.fechaVencimiento || undefined
    };

    console.log("💰 [AZURE+GPT] Costos comerciales extraídos:");
    console.log(`  IMEBA: $${ventaData.impuestos.imeba}`);
    console.log(`  INIA: $${ventaData.impuestos.inia}`);
    console.log(`  MEVIR: $${ventaData.impuestos.mevir}`);
    console.log(`  Total: $${ventaData.totalImpuestosUSD}`);

    return ventaData;

  } catch (error) {
    console.error("❌ [AZURE] Error procesando factura:", error);
    return null;
  }
}
