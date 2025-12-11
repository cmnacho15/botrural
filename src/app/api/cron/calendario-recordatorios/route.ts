// src/app/api/cron/calendario-recordatorios/route.ts

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { sendWhatsAppMessage } from "@/lib/whatsapp/sendMessage"

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  try {
    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)

    const en5Dias = new Date(hoy)
    en5Dias.setDate(en5Dias.getDate() + 5)

    // Buscar actividades que vencen en exactamente 5 días
    const actividades = await prisma.actividadCalendario.findMany({
      where: {
        realizada: false,
        fechaProgramada: {
          gte: en5Dias,
          lt: new Date(en5Dias.getTime() + 24 * 60 * 60 * 1000)
        }
      }
    })

    console.log(`📅 Encontradas ${actividades.length} actividades para recordar`)

    for (const act of actividades) {
      // Buscar usuarios del campo
      const usuarios = await prisma.user.findMany({
        where: { campoId: act.campoId },
        select: { telefono: true }
      })

      const fechaStr = new Date(act.fechaProgramada).toLocaleDateString('es-UY', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        timeZone: 'America/Montevideo'
      })

      for (const user of usuarios) {
        if (user.telefono) {
          await sendWhatsAppMessage(
            user.telefono,
            `⏰ *Recordatorio*\n\n` +
            `📌 ${act.titulo}\n` +
            `📅 ${fechaStr}\n` +
            `⚠️ Faltan 5 días\n\n` +
            `_Escribí "calendario" para ver todas tus actividades._`
          )
          console.log(`✅ Recordatorio enviado a ${user.telefono}`)
        }
      }
    }

    return NextResponse.json({ 
      success: true, 
      recordatoriosEnviados: actividades.length 
    })

  } catch (error) {
    console.error("❌ Error en cron de recordatorios:", error)
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}