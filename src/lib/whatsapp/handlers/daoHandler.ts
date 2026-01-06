// 📁 src/lib/whatsapp/handlers/daoHandler.ts

import { prisma } from "@/lib/prisma"
import { sendWhatsAppMessage } from "../sendMessage"

/**
 * 🔬 Registrar DAO (Diagnóstico de Actividad Ovárica)
 */
export async function handleDAO(
  telefono: string,
  parsedData: {
    potrero?: string
    categoria: string
    prenado: number
    ciclando: number
    anestroSuperficial: number
    anestroProfundo: number
  }
) {
  try {
    const user = await prisma.user.findUnique({
      where: { telefono },
      select: { id: true, campoId: true }
    })

    if (!user || !user.campoId) {
      await sendWhatsAppMessage(
        telefono,
        "❌ No estás registrado en ningún campo. Contactá al administrador."
      )
      return
    }

    // Validar que se haya especificado el potrero
    if (!parsedData.potrero) {
      const potrerosDisponibles = await prisma.lote.findMany({
        where: { campoId: user.campoId },
        select: { nombre: true },
        orderBy: { nombre: 'asc' }
      })
      const nombres = potrerosDisponibles.map(p => p.nombre).join(', ')
      
      await sendWhatsAppMessage(
        telefono,
        `❌ Tenés que especificar el potrero.\n\n` +
        `📍 Tus potreros son: ${nombres}\n\n` +
        `Ejemplo: "dao en potrero norte a 98 vacas: 20 preñadas, 30 ciclando"`
      )
      return
    }

    // Buscar el potrero
    const potrero = await prisma.lote.findFirst({
      where: {
        campoId: user.campoId,
        nombre: {
          equals: parsedData.potrero,
          mode: 'insensitive'
        }
      },
      include: {
        animalesLote: true
      }
    })

    if (!potrero) {
      const potrerosDisponibles = await prisma.lote.findMany({
        where: { campoId: user.campoId },
        select: { nombre: true }
      })
      const nombres = potrerosDisponibles.map(p => p.nombre).join(', ')
      
      await sendWhatsAppMessage(
        telefono,
        `❌ Potrero "${parsedData.potrero}" no encontrado.\n\n` +
        `📍 Tus potreros son: ${nombres}`
      )
      return
    }

    // Buscar la categoría en el potrero
    const animalEnPotrero = potrero.animalesLote.find(
      a => a.categoria.toLowerCase() === parsedData.categoria.toLowerCase()
    )

    if (!animalEnPotrero || animalEnPotrero.cantidad === 0) {
      await sendWhatsAppMessage(
        telefono,
        `❌ No hay ${parsedData.categoria} en el potrero ${potrero.nombre}`
      )
      return
    }

    // Validar que haya al menos un resultado
    const cantidadExaminada = parsedData.prenado + parsedData.ciclando + 
                              parsedData.anestroSuperficial + parsedData.anestroProfundo

    if (cantidadExaminada === 0) {
      await sendWhatsAppMessage(
        telefono,
        `❌ Tenés que ingresar al menos un resultado (preñadas, ciclando, anestro superficial o anestro profundo)`
      )
      return
    }

    // Validar que no supere la cantidad disponible
    if (cantidadExaminada > animalEnPotrero.cantidad) {
      await sendWhatsAppMessage(
        telefono,
        `❌ Solo hay ${animalEnPotrero.cantidad} ${parsedData.categoria} en el potrero ${potrero.nombre}.\n` +
        `No podés examinar ${cantidadExaminada}.`
      )
      return
    }

    // Calcular porcentajes
    const porcentajePrenado = Math.round((parsedData.prenado / cantidadExaminada) * 100)

    // Construir descripción detallada
    const descripcion = `DAO en potrero ${potrero.nombre}: ${parsedData.categoria}: ${cantidadExaminada} examinadas ` +
                       `(Preñadas: ${parsedData.prenado}, Ciclando: ${parsedData.ciclando}, ` +
                       `Anestro Superficial: ${parsedData.anestroSuperficial}, Anestro Profundo: ${parsedData.anestroProfundo})`

    // Crear evento
    await prisma.evento.create({
      data: {
        campoId: user.campoId,
        tipo: 'DAO' as any,
        fecha: new Date(),
        descripcion: descripcion,
        loteId: potrero.id,
        cantidad: cantidadExaminada,
        categoria: parsedData.categoria,
        usuarioId: user.id
      }
    })

    // Mensaje de confirmación
    await sendWhatsAppMessage(
      telefono,
      `✅ *DAO registrado*\n\n` +
      `📍 Potrero: ${potrero.nombre}\n` +
      `🐄 Categoría: ${parsedData.categoria}\n` +
      `🔬 Examinadas: ${cantidadExaminada}\n\n` +
      `📊 *Resultados:*\n` +
      `✅ Preñadas: ${parsedData.prenado} (${porcentajePrenado}%)\n` +
      `🔄 Ciclando: ${parsedData.ciclando}\n` +
      `⚠️ Anestro Sup.: ${parsedData.anestroSuperficial}\n` +
      `❌ Anestro Prof.: ${parsedData.anestroProfundo}`
    )

    console.log("✅ DAO registrado:", potrero.nombre, parsedData.categoria, porcentajePrenado + "% preñez")

  } catch (error) {
    console.error("❌ Error registrando DAO:", error)
    await sendWhatsAppMessage(
      telefono,
      "❌ Error al registrar el DAO. Intentá de nuevo."
    )
  }
}