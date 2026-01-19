// 📁 src/lib/whatsapp/handlers/daoHandler.ts

import { prisma } from "@/lib/prisma"
import { sendWhatsAppMessage, sendWhatsAppButtons } from "../sendMessage"
import { buscarPotreroConModulos } from "@/lib/potrero-helpers"

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
    _potreroId?: string
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

    let potrero

// 🔥 Si viene ID explícito (desde selección de módulos), usarlo directamente
if (parsedData._potreroId) {
  console.log("🎯 Usando ID explícito de potrero para DAO:", parsedData._potreroId)
  potrero = await prisma.lote.findUnique({
    where: { id: parsedData._potreroId },
    select: { id: true, nombre: true }
  })
  
  if (!potrero) {
    await sendWhatsAppMessage(telefono, "❌ Error: potrero no encontrado")
    return
  }
} else {
  // 🔍 Buscar potrero considerando módulos
  const resultadoPotrero = await buscarPotreroConModulos(parsedData.potrero, user.campoId)

  if (!resultadoPotrero.unico) {
    if (resultadoPotrero.opciones && resultadoPotrero.opciones.length > 1) {
      // HAY DUPLICADOS CON MÓDULOS
      const mensaje = `Encontré varios "${parsedData.potrero}":\n\n` +
        resultadoPotrero.opciones.map((opt, i) => 
          `${i + 1}️⃣ ${opt.nombre}${opt.moduloNombre ? ` (${opt.moduloNombre})` : ''}`
        ).join('\n') +
        `\n\n¿En cuál hiciste el DAO? Respondé con el número.`
      
      await sendWhatsAppMessage(telefono, mensaje)
      
      // Guardar estado pendiente
      await prisma.pendingConfirmation.upsert({
        where: { telefono },
        create: {
          telefono,
          data: JSON.stringify({
            tipo: "ELEGIR_POTRERO_DAO",
            opciones: resultadoPotrero.opciones,
            categoria: parsedData.categoria,
            prenado: parsedData.prenado,
            ciclando: parsedData.ciclando,
            anestroSuperficial: parsedData.anestroSuperficial,
            anestroProfundo: parsedData.anestroProfundo
          }),
        },
        update: {
          data: JSON.stringify({
            tipo: "ELEGIR_POTRERO_DAO",
            opciones: resultadoPotrero.opciones,
            categoria: parsedData.categoria,
            prenado: parsedData.prenado,
            ciclando: parsedData.ciclando,
            anestroSuperficial: parsedData.anestroSuperficial,
            anestroProfundo: parsedData.anestroProfundo
          }),
        },
      })
      return
    }

    // No encontrado
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

  potrero = resultadoPotrero.lote!
}

    // 🔥 YA NO VALIDAMOS SI HAY ANIMALES - solo registramos el dato

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

    // 🔥 YA NO VALIDAMOS cantidad - solo registramos lo que el usuario dice

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

console.log("✅ DAO registrado:", potrero, categoria, porcentajePrenado + "% preñez")

// 🔥 Enviar mensaje de éxito
await sendWhatsAppMessage(
  telefono,
  `✅ *DAO registrado correctamente*\n\n` +
  `📍 Potrero: ${potrero}\n` +
  `🐄 ${categoria}: ${porcentajePrenado}% de preñez`
)

  } catch (error) {
    console.error("❌ Error confirmando DAO:", error)
    await sendWhatsAppMessage(
      telefono,
      "❌ Error al registrar el DAO. Intentá de nuevo."
    )
  }
}