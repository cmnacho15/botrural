// app/api/whatsapp/renew-token/route.ts

import { NextResponse } from "next/server";
import { renewWhatsAppToken } from "@/lib/renew-whatsapp-token";

export async function POST(request: Request) {
  try {
    console.log("🚀 Endpoint de renovación llamado");

    // Verificar autorización básica
    const authHeader = request.headers.get("authorization");
    const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;

    console.log("🔐 Verificando autorización...");
    
    if (authHeader !== expectedAuth) {
      console.error("❌ Autorización inválida");
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 401 }
      );
    }

    console.log("✅ Autorización correcta");
    console.log("🔄 Iniciando renovación de token...");

    const result = await renewWhatsAppToken();

    if (!result.success) {
      console.error("❌ Renovación fallida:", result.error);
      return NextResponse.json(
        {
          success: false,
          error: result.error,
        },
        { status: 500 }
      );
    }

    console.log("✅ Renovación exitosa");

    const expiresInDays = Math.floor((result.expiresIn || 0) / 86400);

    return NextResponse.json({
      success: true,
      message: "Token renovado exitosamente",
      expiresInDays: expiresInDays,
      instruction: "Copia el nuevo token de los logs del servidor y actualiza tu .env",
      newTokenPreview: result.newToken?.substring(0, 30) + "...",
    });

  } catch (error) {
    console.error("❌ Error en endpoint:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : "Error desconocido" 
      },
      { status: 500 }
    );
  }
}

// También permitir GET para testing más fácil
export async function GET(request: Request) {
  return POST(request);
}