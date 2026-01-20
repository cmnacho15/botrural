// lib/vision-venta-parser.ts
// ORQUESTADOR MINIMALISTA - Mantiene compatibilidad hacia atrás

import { detectarTipoFactura } from "./detectors/tipo-factura-detector";
import { detectarTipoVentaEspecifico } from "./detectors/venta-especifico-detector";
import { processVentaGanadoImage, ParsedVentaGanado } from "./parsers/venta-ganado-parser";
import { processVentaLanaImage, ParsedVentaLana } from "./parsers/venta-lana-parser";

// ==========================================
// TYPES PÚBLICOS (mantener compatibilidad)
// ==========================================

export type ParsedVenta = ParsedVentaGanado | ParsedVentaLana;

// Re-exportar types de los parsers especializados
export type { ParsedVentaGanado, ParsedVentaLana };
export type { VentaGanadoRenglonParsed, ImpuestosVenta } from "./parsers/venta-ganado-parser";
export type { VentaLanaRenglonParsed, ImpuestosVentaLana } from "./parsers/venta-lana-parser";

// Re-exportar función de detección (compatibilidad)
export { detectarTipoFactura };

// ==========================================
// FUNCIÓN PRINCIPAL - ORQUESTADOR
// ==========================================

/**
 * Procesar imagen de factura de VENTA
 * Detecta automáticamente si es GANADO o LANA y delega al parser correcto
 */
export async function processVentaImage(imageUrl: string, campoId?: string): Promise<ParsedVenta | null> {
  try {
    console.log("🔍 Iniciando procesamiento de factura de venta...");
    
    // 1. Verificar que es una venta (no un gasto)
    const tipo = await detectarTipoFactura(imageUrl, campoId);
    
    if (tipo !== "VENTA") {
      console.log("⚠️ No es una factura de venta");
      return null;
    }
    
    // 2. Detectar tipo específico (GANADO vs LANA)
    const tipoEspecifico = await detectarTipoVentaEspecifico(imageUrl);
    
    console.log(`📊 Tipo de venta detectado: ${tipoEspecifico}`);
    
    // 3. Delegar al parser correcto
    switch (tipoEspecifico) {
      case "LANA":
        console.log("🧶 Procesando con parser de LANA...");
        return await processVentaLanaImage(imageUrl, campoId);
      
      case "GANADO":
      default:
        console.log("🐄 Procesando con parser de GANADO...");
        return await processVentaGanadoImage(imageUrl, campoId);
    }
    
  } catch (error) {
    console.error("❌ Error en processVentaImage:", error);
    return null;
  }
}

// ==========================================
// UTILIDADES (mantener compatibilidad)
// ==========================================

/**
 * Mapear categoría de factura a categoría del sistema
 * MANTIENE COMPATIBILIDAD - Útil para ambos tipos de venta
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
  
  // Por defecto
  const palabras = categoriaFactura.toLowerCase().split(/\s+/);
  const categoriaCapitalizada = palabras.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(" ");
  
  return { categoria: categoriaCapitalizada, tipoAnimal: "OTRO" };
}