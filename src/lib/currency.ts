// src/lib/currency.ts

/**
 * Obtiene la cotización de USD → UYU desde una API pública gratuita:
 * https://open.er-api.com/v6/latest/USD
 *
 * Se cachea por 1 hora para no saturar la API.
 */

export async function getUSDToUYU(): Promise<number> {
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD", {
      next: { revalidate: 3600 }, // cache 1 hora
    });

    const data = await res.json();

    if (!data || !data.rates || !data.rates.UYU) {
      console.error("⚠️ Cotización UYU no encontrada:", data);
      return 40; // fallback seguro si falla la API
    }

    return data.rates.UYU; // Ej: 39.81
  } catch (error) {
    console.error("❌ Error obteniendo USD→UYU:", error);
    return 40; // fallback razonable
  }
}

// ---------------------------------------------------------------------------
// 🔥 Conversión según moneda ingresada (USD o UYU)
// ---------------------------------------------------------------------------

/**
 * Convierte un monto a UYU dependiendo de la moneda.
 * Si es USD → convierte usando la cotización actual.
 * Si es UYU → retorna el mismo monto.
 */
export async function convertirAUYU(monto: number, moneda: string): Promise<number> {
  if (moneda === "USD") {
    const tasa = await getUSDToUYU();
    return monto * tasa;
  }
  return monto;
}

/**
 * Retorna la tasa de cambio usada para el registro.
 * Si es USD → retorna la cotización.
 * Si es UYU → retorna null.
 */
export async function obtenerTasaCambio(moneda: string): Promise<number | null> {
  if (moneda === "USD") {
    return await getUSDToUYU();
  }
  return null;
}