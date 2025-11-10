// app/api/whatsapp/renew-token/route.ts

import { NextResponse } from "next/server";
import { renewWhatsAppToken } from "@/lib/renew-whatsapp-token";

export async function POST(request: Request) {
  try {
    console.log("🚀 Endpoint de renovación llamado");

    // Obtener el secret del header o de la URL
    const authHeader = request.headers.get("authorization");
    const url = new URL(request.url);
    const secretFromUrl = url.searchParams.get("secret");

    const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;
    const expectedSecret = process.env.CRON_SECRET;

    console.log("🔐 Verificando autorización...");

    // Verificar si viene del header (Postman) o de la URL (Vercel Cron)
    const isAuthorizedByHeader = authHeader === expectedAuth;
    const isAuthorizedByUrl = secretFromUrl === expectedSecret;

    if (!isAuthorizedByHeader && !isAuthorizedByUrl) {
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

    // Aquí podrías enviar un email/notificación con el nuevo token
    console.log("🔑 NUEVO TOKEN (GUÁRDALO EN TU .ENV):");
    console.log(result.newToken);

    return NextResponse.json({
      success: true,
      message: "Token renovado exitosamente",
      expiresInDays: expiresInDays,
      instruction: "Copia el nuevo token de los logs y actualiza las variables de entorno en Vercel",
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

export async function GET(request: Request) {
  return POST(request);
}