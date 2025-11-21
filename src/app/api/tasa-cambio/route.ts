import { NextResponse } from "next/server";
import { getUSDToUYU } from "@/lib/currency";

export async function GET() {
  try {
    // obtiene la tasa desde tu lib/currency (server safe)
    const tasa = await getUSDToUYU();

    return NextResponse.json({
      tasa,
      origen: "server-lib-currency",
      success: true,
    });
  } catch (error) {
    console.error("❌ Error en /api/tasa-cambio:", error);
    return NextResponse.json(
      {
        success: false,
        tasa: 40, // fallback
      },
      { status: 500 }
    );
  }
}