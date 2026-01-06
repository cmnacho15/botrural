// 📁 src/lib/whatsapp/handlers/daoHandler.ts

import { prisma } from "@/lib/prisma"
import { sendWhatsAppMessage, sendWhatsAppButtons } from "../sendMessage"

/**
 * 🔬 Solicitar confirmación para registrar DAO
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
    const porcentajeCiclando = Math.round((parsedData.ciclando / cantidadExaminada) * 100)
    const porcentajeAnestroSup = Math.round((parsedData.anestroSuperficial / cantidadExaminada) * 100)
    const porcentajeAnestroProf = Math.round((parsedData.anestroProfundo / cantidadExaminada) * 100)

    // Guardar en pending confirmation
    await prisma.pendingConfirmation.upsert({
      where: { telefono },
      create: {
        telefono,
        data: JSON.stringify({
          tipo: 'DAO',
          potrero: potrero.nombre,
          potreroId: potrero.id,
          categoria: parsedData.categoria,
          cantidadExaminada,
          prenado: parsedData.prenado,
          ciclando: parsedData.ciclando,
          anestroSuperficial: parsedData.anestroSuperficial,
          anestroProfundo: parsedData.anestroProfundo,
          campoId: user.campoId,
          usuarioId: user.id
        })
      },
      update: {
        data: JSON.stringify({
          tipo: 'DAO',
          potrero: potrero.nombre,
          potreroId: potrero.id,
          categoria: parsedData.categoria,
          cantidadExaminada,
          prenado: parsedData.prenado,
          ciclando: parsedData.ciclando,
          anestroSuperficial: parsedData.anestroSuperficial,
          anestroProfundo: parsedData.anestroProfundo,
          campoId: user.campoId,
          usuarioId: user.id
        })
      }
    })

    // Enviar mensaje con botones
    const mensaje = 
      `🔬 *DAO - Confirmá los datos*\n\n` +
      `📍 Potrero: ${potrero.nombre}\n` +
      `🐄 Categoría: ${parsedData.categoria}\n` +
      `🔬 Examinadas: ${cantidadExaminada}\n\n` +
      `📊 *Resultados:*\n` +
      `✅ Preñadas: ${parsedData.prenado} (${porcentajePrenado}%)\n` +
      `🔄 Ciclando: ${parsedData.ciclando} (${porcentajeCiclando}%)\n` +
      `⚠️ Anestro Sup.: ${parsedData.anestroSuperficial} (${porcentajeAnestroSup}%)\n` +
      `❌ Anestro Prof.: ${parsedData.anestroProfundo} (${porcentajeAnestroProf}%)\n\n` +
      `_Escribí "editar" para modificar o clickeá confirmar_`

    await sendWhatsAppButtons(
      telefono,
      mensaje,
      [
        { id: 'confirmar_dao', title: '✅ Confirmar' },
        { id: 'cancelar', title: '❌ Cancelar' }
      ]
    )

    console.log("✅ Solicitud de confirmación DAO enviada")

  } catch (error) {
    console.error("❌ Error solicitando confirmación DAO:", error)
    await sendWhatsAppMessage(
      telefono,
      "❌ Error al procesar el DAO. Intentá de nuevo."
    )
  }
}

/**
 * 🔬 Confirmar y registrar el DAO
 */
export async function confirmarDAO(telefono: string, data: any) {
  try {
    const { potreroId, categoria, cantidadExaminada, prenado, ciclando, 
            anestroSuperficial, anestroProfundo, campoId, usuarioId, potrero } = data

    // Construir descripción detallada
    const descripcion = `DAO en potrero ${potrero}: ${categoria}: ${cantidadExaminada} examinadas ` +
                       `(Preñadas: ${prenado}, Ciclando: ${ciclando}, ` +
                       `Anestro Superficial: ${anestroSuperficial}, Anestro Profundo: ${anestroProfundo})`

    // Crear evento
    await prisma.evento.create({
      data: {
        campoId,
        tipo: 'DAO' as any,
        fecha: new Date(),
        descripcion,
        loteId: potreroId,
        cantidad: cantidadExaminada,
        categoria,
        usuarioId
      }
    })

    // Calcular porcentajes
    const porcentajePrenado = Math.round((prenado / cantidadExaminada) * 100)

    // Mensaje de confirmación
    await sendWhatsAppMessage(
      telefono,
      `✅ *DAO registrado correctamente*\n\n` +
      `📍 Potrero: ${potrero}\n` +
      `🐄 Categoría: ${categoria}\n` +
      `🔬 Examinadas: ${cantidadExaminada}\n` +
      `📊 Preñez: ${porcentajePrenado}%`
    )

    console.log("✅ DAO registrado:", potrero, categoria, porcentajePrenado + "% preñez")

  } catch (error) {
    console.error("❌ Error confirmando DAO:", error)
    await sendWhatsAppMessage(
      telefono,
      "❌ Error al registrar el DAO. Intentá de nuevo."
    )
  }
}