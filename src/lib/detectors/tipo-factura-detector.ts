// lib/detectors/tipo-factura-detector.ts
// Detecta si una factura es de VENTA o GASTO

import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Detectar si una imagen es una factura de VENTA (no de gasto)
 */
export async function detectarTipoFactura(imageUrl: string, campoId?: string): Promise<"VENTA" | "GASTO" | null> {
  console.log("🔍 Detectando tipo factura:", imageUrl);

  // ESTRATEGIA 1: Extraer RUT rápido y verificar si es de una firma conocida
  if (campoId) {
    try {
      const quickOCR = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `Extrae de esta factura el VENDEDOR/PRODUCTOR.

⚠️ INSTRUCCIÓN CRÍTICA:
Esta es una factura de VENTA de animales o lana. El VENDEDOR es el productor que vende, NO la empresa que emite la factura.

⚠️ PISTAS VISUALES IMPORTANTES:
- Buscar texto que diga literalmente 'VENDEDOR:' seguido de un nombre
- Puede estar en fondo VERDE con letras BLANCAS
- Suele estar en la parte superior/media izquierda de la factura
- Puede estar en un recuadro o sección específica

⚠️ BUSCAR EN ESTE ORDEN:

1. Campo 'RUT VENDEDOR' o 'RUT EMISOR':
   → Extraer RUT + nombre asociado
   
2. Campo 'VENDEDOR:' o 'Vendedor:' (PRIORIDAD ALTA):
   → Extraer el nombre que aparece después
   → Ejemplo: 'VENDEDOR: LUCIA CASTRO' → extraer 'LUCIA CASTRO'
   
3. Sección 'NOMBRE:' asociada al vendedor

⚠️ NO CONFUNDIR CON:
- RUT del header (TOURON, MEGAAGRO, etc. son consignatarios)
- 'RUT COMPRADOR' o 'Comprador:'
- Empresa que emite la factura

📋 FORMATO RESPUESTA:
- Con RUT: RUT|NOMBRE
- Sin RUT: SIN_RUT|NOMBRE
- Si NO encuentras: NO_ENCONTRADO

⚠️ IMPORTANTE: Si ves 'VENDEDOR:' en la factura, SIEMPRE debes extraer lo que viene después, aunque esté en fondo verde o con letras blancas.`
          },
          {
            role: "user",
            content: [{ type: "image_url", image_url: { url: imageUrl, detail: "high" } }]
          }
        ],
        max_tokens: 50,
        temperature: 0
      });

      const respuesta = quickOCR.choices[0].message.content?.trim();
      console.log("📋 Datos extraídos:", respuesta);

      if (respuesta && respuesta !== "NO_ENCONTRADO") {
        const [rutExtraido, nombreExtraido] = respuesta.split("|");
        
        const { prisma } = await import("@/lib/prisma");
        
        // Construir condiciones de búsqueda
        const condiciones: any[] = [];
        
        // 1. Si hay RUT (y no es "SIN_RUT"), buscar por RUT
        if (rutExtraido && rutExtraido !== "SIN_RUT") {
          condiciones.push({ rut: rutExtraido.trim() });
        }
        
        // 2. Buscar por razón social completa
        if (nombreExtraido) {
          condiciones.push({ 
            razonSocial: { contains: nombreExtraido.trim(), mode: 'insensitive' } 
          });
          
          // 3. Buscar por palabras individuales del nombre
          const palabras = nombreExtraido.trim().split(/\s+/).filter(p => p.length > 2);
          palabras.forEach(palabra => {
            condiciones.push({
              razonSocial: { contains: palabra, mode: 'insensitive' }
            });
          });
        }
        
        // Buscar en BD
        const firmaEncontrada = condiciones.length > 0 
          ? await prisma.firma.findFirst({
              where: {
                campoId,
                OR: condiciones
              }
            })
          : null;

        if (firmaEncontrada) {
          console.log(`✅ Nombre "${nombreExtraido}" encontrado en firma: ${firmaEncontrada.razonSocial}`);
          console.log("🎯 AUTO-DETECTADO como VENTA (es tu firma)");
          return "VENTA";
        } else {
          console.log(`ℹ️ Nombre "${nombreExtraido}" NO está en tus firmas configuradas`);
        }
      }
    } catch (err) {
      console.warn("⚠️ Error en detección rápida de RUT, continuando con método normal:", err);
    }
  }

  // ESTRATEGIA 2: Preguntar a GPT directamente
  try {
    const response1 = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `Eres un detector de facturas de venta de hacienda o lana en Uruguay.

PREGUNTA: ¿Esta imagen es una factura de VENTA de animales o lana a un frigorífico/comprador?

CONTEXTO IMPORTANTE:
- VENTA = El productor/vendedor VENDE animales o lana al frigorífico/comprador
- El frigorífico/comprador es quien PAGA por los animales/lana
- Puede ser e-factura, factura física, liquidación, etc.

SEÑALES FUERTES DE VENTA (si tiene 2 o más → es VENTA):
1. Menciona animales con PESO y PRECIO: VACAS, OVEJAS, CORDEROS, NOVILLOS, TERNEROS, CAPONES
2. Menciona LANA con categorías: LANA VELLÓN, LANA BARRIGA, LANA BARRIGUERA
3. Tiene datos de PRODUCTOR o VENDEDOR (nombre, RUT, DICOSE)
4. Tiene datos de COMPRADOR identificado (frigorífico, empresa ganadera, otro campo)
5. Tiene columnas típicas de venta: Cantidad/Cant, Kilos/Peso, Precio, Rendimiento, Importe
6. Menciona: TROPA, DICOSE, GUIAS, Segunda Balanza, Primera Balanza
7. Tiene impuestos de venta ganadera/lanera: MEVIR, INIA, IMEBA, Comisión
8. Dice "Fact.Haciendas", "e-Factura", "Liquidación", "PRODUCTOR", "LANAS"

SEÑALES DE GASTO (factura común):
- Es un proveedor vendiendo insumos/servicios (veterinaria, alimento, combustible, etc.)
- No menciona kilos ni precio por kilo de animales o lana
- Es una factura de compra de productos/servicios

IMPORTANTE:
- Si menciona RUT COMPRADOR + categoría de animales/lana con kilos → es VENTA
- Si dice "e-Factura" y tiene animales/lana con precio/kg → es VENTA
- Confiá en las señales, aunque el formato sea diferente

RESPONDE SOLO:
- "SI" si es claramente una venta de animales o lana (2+ señales fuertes)
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
    console.log("📊 Respuesta GPT sobre VENTA:", respuesta1);

    if (respuesta1.includes("SI")) {
      console.log("✅ DETECTADO: VENTA (GPT confirmó)");
      return "VENTA";
    }

    if (respuesta1.includes("NO")) {
      console.log("✅ DETECTADO: GASTO (GPT descartó venta)");
      return "GASTO";
    }

    // ESTRATEGIA 3: Si GPT no está seguro, extraer texto y buscar palabras clave
    console.log("⚠️ GPT incierto, extrayendo texto...");
    
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
    console.log("📝 Texto extraído (primeros 200):", texto.substring(0, 200));

    // Buscar palabras clave VENTA
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
      "E-FACTURA",
      "RUT COMPRADOR",
      "VENDEDOR:",
      "LANA VELLÓN",
      "LANA VELLON",
      "LANA BARRIGA",
      "LANA BARRIGUERA",
      "LANAS",
    ];

    for (const palabra of palabrasVentaFuertes) {
      if (texto.includes(palabra)) {
        console.log(`✅ VENTA detectada por palabra clave: "${palabra}"`);
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
      console.log("✅ VENTA por: animales + peso/precio por kg");
      return "VENTA";
    }

    // Si no hay señales claras, retornar null
    console.log("⚠️ No hay señales claras → null (preguntar al usuario)");
    return null;
    
  } catch (error) {
    console.error("❌ Error en detectarTipoFactura:", error);
    return null;
  }
}