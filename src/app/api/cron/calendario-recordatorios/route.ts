// src/app/api/cron/calendario-recordatorios/route.ts

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { sendWhatsAppMessage } from "@/lib/whatsapp/sendMessage"

export const maxDuration = 60 // WhatsApp puede ser lento

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
    const en5DiasFin = new Date(en5Dias.getTime() + 24 * 60 * 60 * 1000)

    // ✅ OPTIMIZACIÓN 1: Traer actividades con campo y usuarios en una sola query
    const actividades = await prisma.actividadCalendario.findMany({
      where: {
        realizada: false,
        fechaProgramada: {
          gte: en5Dias,
          lt: en5DiasFin
        }
      },
      include: {
        campo: {
          select: {
            id: true,
            usuarios: {
              select: {
                telefono: true,
              },
              where: {
                telefono: { not: null }
              }
            }
          }
        }
      }
    })

    console.log(`📅 Encontradas ${actividades.length} actividades para recordar`)

    // ✅ OPTIMIZACIÓN 2: Preparar mensajes en batch
    const mensajesAProcesar: Array<{
      telefono: string
      mensaje: string
      actividadId: string
      titulo: string
    }> = []

    for (const act of actividades) {
      const fechaStr = new Date(act.fechaProgramada).toLocaleDateString('es-UY', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        timeZone: 'America/Montevideo'
      })

      const mensaje = 
        `⏰ *Recordatorio*\n\n` +
        `📌 ${act.titulo}\n` +
        `📅 ${fechaStr}\n` +
        `⚠️ Faltan 5 días\n\n` +
        `_Escribí "calendario" para ver todas tus actividades._`

      for (const user of act.campo.usuarios) {
        if (user.telefono) {
          mensajesAProcesar.push({
            telefono: user.telefono,
            mensaje,
            actividadId: act.id,
            titulo: act.titulo,
          })
        }
      }
    }

    console.log(`📱 Enviando ${mensajesAProcesar.length} mensajes...`)

    // ✅ OPTIMIZACIÓN 3: Enviar con control de errores individuales
    let exitosos = 0
    let fallidos = 0
    const errores: string[] = []

    // ✅ OPTIMIZACIÓN 4: Procesar en lotes pequeños (WhatsApp tiene rate limits)
    const LOTE_WHATSAPP = 5
    
    for (let i = 0; i < mensajesAProcesar.length; i += LOTE_WHATSAPP) {
      const lote = mensajesAProcesar.slice(i, i + LOTE_WHATSAPP)
      
      // Enviar lote en paralelo
      const resultados = await Promise.allSettled(
        lote.map(async (m) => {
          try {
            await sendWhatsAppMessage(m.telefono, m.mensaje)
            return { success: true as const, telefono: m.telefono, titulo: m.titulo }
          } catch (err) {
            return { 
              success: false as const, 
              telefono: m.telefono, 
              titulo: m.titulo, 
              error: err instanceof Error ? err.message : 'Error desconocido'
            }
          }
        })
      )

      // Procesar resultados del lote
      for (const resultado of resultados) {
        if (resultado.status === 'fulfilled') {
          const data = resultado.value
          if (data.success) {
            exitosos++
            console.log(`✅ Enviado a ${data.telefono}: ${data.titulo}`)
          } else {
            fallidos++
            errores.push(`${data.telefono}: ${data.error}`)
            console.error(`❌ Error enviando a ${data.telefono}: ${data.error}`)
          }
        } else {
          fallidos++
          const error = resultado.reason instanceof Error ? resultado.reason.message : 'Error desconocido'
          errores.push(`Error inesperado: ${error}`)
        }
      }

      // ✅ Pequeña pausa entre lotes para no saturar WhatsApp
      if (i + LOTE_WHATSAPP < mensajesAProcesar.length) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }

    console.log(`✅ Recordatorios procesados: ${exitosos} exitosos, ${fallidos} fallidos`)

    return NextResponse.json({ 
      success: true,
      actividadesEncontradas: actividades.length,
      mensajesEnviados: exitosos,
      mensajesFallidos: fallidos,
      errores: errores.length > 0 ? errores : undefined,
    })

  } catch (error) {
    console.error("❌ Error en cron de recordatorios:", error)
    return NextResponse.json({ 
      error: "Error interno",
      details: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 })
  }
}

export async function POST(request: Request) {
  return GET(request)
}