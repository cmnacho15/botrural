// src/app/api/logs/error/route.ts
// API para recibir y almacenar logs de errores de clientes

import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "../../auth/[...nextauth]/route"
import { prisma } from "@/lib/prisma"
import { sendErrorNotificationEmail } from "@/lib/email-notifications"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { source, level, message, stack, context, url } = body

    // Obtener info del usuario
    // Prioridad: context.userId > session
    let userId: string | null = null
    let campoId: string | null = null

    // Si el context incluye userId/campoId (ej: desde WhatsApp processor), usarlo directamente
    if (context?.userId) {
      userId = context.userId
      campoId = context.campoId || null
    } else {
      // Intentar obtener de la sesión (para errores de web)
      try {
        const session = await getServerSession(authOptions)
        if (session?.user?.id) {
          userId = session.user.id
          const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { campoId: true }
          })
          campoId = user?.campoId || null
        }
      } catch {
        // No hay sesión, continuar sin usuario
      }
    }

    // Obtener headers
    const userAgent = request.headers.get("user-agent") || undefined

    // Crear el log de error
    const errorLog = await prisma.errorLog.create({
      data: {
        userId,
        campoId,
        source: source || "WEB",
        level: level || "ERROR",
        message: message || "Error desconocido",
        stack,
        context: context || null,
        userAgent,
        url,
      }
    })

    // Enviar email:
    // - Siempre para CRITICAL
    // - Siempre para errores de WHATSAPP (cualquier nivel)
    // - Si hay 5+ errores en 5 minutos
    if (level === "CRITICAL" || source === "WHATSAPP") {
      await sendErrorNotificationEmail(errorLog)
    } else {
      // Verificar si hay más de 5 errores en los últimos 5 minutos
      const hace5Min = new Date()
      hace5Min.setMinutes(hace5Min.getMinutes() - 5)

      const erroresRecientes = await prisma.errorLog.count({
        where: {
          createdAt: { gte: hace5Min },
          emailSent: false
        }
      })

      if (erroresRecientes >= 5) {
        await sendErrorNotificationEmail(errorLog, erroresRecientes)
      }
    }

    return NextResponse.json({ success: true, id: errorLog.id })

  } catch (error) {
    console.error("Error guardando log:", error)
    // No fallar si hay error guardando el log
    return NextResponse.json({ success: false }, { status: 200 })
  }
}

// GET para probar que la API funciona
export async function GET() {
  return NextResponse.json({ status: "ok", service: "error-logs" })
}
