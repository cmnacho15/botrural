import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN!;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN!;
const PHONE_ID = process.env.WHATSAPP_PHONE_ID!;

// ✅ Verificación inicial del webhook
// 📩 Procesamiento de mensajes entrantes
export async function POST(req: Request) {
  try {
    const data = await req.json();
    console.log("📥 Webhook data:", JSON.stringify(data, null, 2));

    const message = data?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if (!message) return NextResponse.json({ received: true });

    const from = message.from;
    const type = message.type;

    console.log("📩 Mensaje recibido de:", from, "tipo:", type);

    let text = "";
    if (type === "text") {
      text = message.text?.body || "";
      console.log(`📝 Texto recibido: ${text}`);
    } else if (type === "audio") {
      console.log("🎤 Audio recibido:", message.audio?.id);
      text = "(audio)";
    } else if (type === "image") {
      console.log("🖼️ Imagen recibida:", message.image?.id);
      text = "(imagen)";
    }

    // 🔍 Buscar usuario en base de datos
    let user = await prisma.user.findUnique({
      where: { telefono: from },
    });

    console.log("👤 Usuario encontrado:", user ? user.name : "No existe");

    if (!user) {
      console.log("🚀 Creando nuevo usuario...");
      
      await sendWhatsAppMessage(
        from,
        "👋 Hola, soy el asistente de tu campo.\nPor favor, decime tu *nombre y apellido* para registrarte como invitado."
      );

      user = await prisma.user.create({
        data: {
          telefono: from,
          role: "USUARIO",
          name: "Pendiente",
        },
      });

      console.log("✅ Usuario invitado creado:", from);
    } else {
      console.log("💬 Enviando respuesta a usuario existente...");
      await sendWhatsAppMessage(from, `Hola ${user.name || "👤"} 👋, tu mensaje fue recibido: ${text}`);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("❌ ERROR en webhook:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// 🧩 Función para enviar mensajes por la API de WhatsApp
async function sendWhatsAppMessage(to: string, body: string) {
  try {
    console.log("📤 Intentando enviar mensaje a:", to);
    console.log("📝 Contenido:", body);
    console.log("🔑 PHONE_ID:", PHONE_ID ? "✅ Configurado" : "❌ Falta");
    console.log("🔑 TOKEN:", WHATSAPP_TOKEN ? "✅ Configurado" : "❌ Falta");

    const res = await fetch(`https://graph.facebook.com/v20.0/${PHONE_ID}/messages`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${WHATSAPP_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body },
      }),
    });

    const data = await res.json();
    console.log("📤 Respuesta de WhatsApp API:", JSON.stringify(data, null, 2));
    
    if (!res.ok) {
      console.error("❌ Error al enviar mensaje:", data);
    }

    return data;
  } catch (error) {
    console.error("❌ ERROR en sendWhatsAppMessage:", error);
    throw error;
  }
}