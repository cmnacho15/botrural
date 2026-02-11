// src/lib/email-notifications.ts
// Servicio de notificaciones por email usando Resend

import { prisma } from "@/lib/prisma"

const RESEND_API_KEY = process.env.RESEND_API_KEY
const ADMIN_EMAIL = process.env.ADMIN_NOTIFICATION_EMAIL || "cmnacho15@gmail.com"

interface ErrorLogData {
  id: string
  source: string
  level: string
  message: string
  stack?: string | null
  context?: any
  userId?: string | null
  campoId?: string | null
  url?: string | null
  createdAt: Date
}

/**
 * Envía una notificación de error por email
 */
export async function sendErrorNotificationEmail(
  errorLog: ErrorLogData,
  totalRecentErrors?: number
): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.log("⚠️ RESEND_API_KEY no configurada, no se envió email")
    return false
  }

  try {
    // Obtener info del usuario si existe
    let userName = "Usuario no identificado"
    let campoName = "Sin campo"

    if (errorLog.userId) {
      const user = await prisma.user.findUnique({
        where: { id: errorLog.userId },
        select: { name: true, email: true, telefono: true, campo: { select: { nombre: true } } }
      })
      if (user) {
        userName = user.name || user.email || user.telefono || "Usuario"
        campoName = user.campo?.nombre || "Sin campo"
      }
    }

    const fecha = new Date(errorLog.createdAt).toLocaleString("es-UY", {
      timeZone: "America/Montevideo",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    })

    const subject = totalRecentErrors
      ? `🚨 ${totalRecentErrors} errores en BotRural (últimos 5 min)`
      : `🚨 Error ${errorLog.level} en BotRural`

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #dc2626;">🚨 Error en BotRural</h2>

        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd; background: #f9f9f9;"><strong>Fecha:</strong></td>
            <td style="padding: 8px; border: 1px solid #ddd;">${fecha}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd; background: #f9f9f9;"><strong>Nivel:</strong></td>
            <td style="padding: 8px; border: 1px solid #ddd;">
              <span style="background: ${errorLog.level === 'CRITICAL' ? '#dc2626' : errorLog.level === 'ERROR' ? '#f59e0b' : '#3b82f6'}; color: white; padding: 2px 8px; border-radius: 4px;">
                ${errorLog.level}
              </span>
            </td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd; background: #f9f9f9;"><strong>Origen:</strong></td>
            <td style="padding: 8px; border: 1px solid #ddd;">${errorLog.source}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd; background: #f9f9f9;"><strong>Usuario:</strong></td>
            <td style="padding: 8px; border: 1px solid #ddd;">${userName}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd; background: #f9f9f9;"><strong>Campo:</strong></td>
            <td style="padding: 8px; border: 1px solid #ddd;">${campoName}</td>
          </tr>
          ${errorLog.url ? `
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd; background: #f9f9f9;"><strong>URL:</strong></td>
            <td style="padding: 8px; border: 1px solid #ddd;">${errorLog.url}</td>
          </tr>
          ` : ''}
        </table>

        <h3 style="color: #374151;">Mensaje de error:</h3>
        <pre style="background: #1f2937; color: #f9fafb; padding: 15px; border-radius: 8px; overflow-x: auto; white-space: pre-wrap;">
${errorLog.message}
        </pre>

        ${errorLog.stack ? `
        <h3 style="color: #374151;">Stack trace:</h3>
        <pre style="background: #1f2937; color: #f9fafb; padding: 15px; border-radius: 8px; overflow-x: auto; font-size: 12px; white-space: pre-wrap;">
${errorLog.stack}
        </pre>
        ` : ''}

        ${errorLog.context ? `
        <h3 style="color: #374151;">Contexto adicional:</h3>
        <pre style="background: #f3f4f6; padding: 15px; border-radius: 8px; overflow-x: auto;">
${JSON.stringify(errorLog.context, null, 2)}
        </pre>
        ` : ''}

        <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">

        <p style="color: #6b7280; font-size: 14px;">
          <a href="https://botrural.vercel.app/admin/logs" style="color: #2563eb;">
            Ver todos los logs en el panel de admin →
          </a>
        </p>
      </div>
    `

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: "BotRural <onboarding@resend.dev>", // Dominio gratuito de Resend
        to: [ADMIN_EMAIL],
        subject,
        html: htmlContent
      })
    })

    if (response.ok) {
      // Marcar el error como notificado
      await prisma.errorLog.update({
        where: { id: errorLog.id },
        data: { emailSent: true }
      })
      console.log(`📧 Email de error enviado a ${ADMIN_EMAIL}`)
      return true
    } else {
      const error = await response.text()
      console.error("❌ Error enviando email:", error)
      return false
    }

  } catch (error) {
    console.error("❌ Error en sendErrorNotificationEmail:", error)
    return false
  }
}
