// src/lib/whatsapp/handlers/moduloSelectionHandler.ts

import { prisma } from "@/lib/prisma"
import { sendWhatsAppMessage } from "../services/messageService"
import { handleCambioPotrero } from "./potreroHandler"
import { buscarPotreroConModulos } from "@/lib/potrero-helpers"

/**
 * Manejar la selección de potrero cuando hay duplicados con módulos
 */
export async function handleSeleccionPotreroModulo(
  phoneNumber: string,
  numeroSeleccion: string,
  data: any
) {
  const numero = parseInt(numeroSeleccion.trim())

  if (isNaN(numero) || numero < 1 || numero > data.opciones.length) {
    await sendWhatsAppMessage(
      phoneNumber,
      `❌ Escribí un número del 1 al ${data.opciones.length}`
    )
    return
  }

  const potreroSeleccionado = data.opciones[numero - 1]

  // Caso 1: Estaba eligiendo ORIGEN
  if (data.tipo === "ELEGIR_POTRERO_ORIGEN") {
    console.log(`✅ Usuario eligió potrero ORIGEN: ${potreroSeleccionado.nombre} (${potreroSeleccionado.moduloNombre || 'Sin módulo'})`)

    // 🔥 FIX: Obtener campoId del usuario de forma segura
    const user = await prisma.user.findUnique({
      where: { telefono: phoneNumber },
      select: { campoId: true }
    })
    
    if (!user?.campoId) {
      await sendWhatsAppMessage(phoneNumber, "Error: usuario no encontrado")
      await prisma.pendingConfirmation.delete({ where: { telefono: phoneNumber } })
      return
    }

    // Ahora buscar el DESTINO
    const resultadoDestino = await buscarPotreroConModulos(data.loteDestino, user.campoId)

    if (!resultadoDestino.unico && resultadoDestino.opciones && resultadoDestino.opciones.length > 1) {
      // También hay duplicados en DESTINO
      const mensaje = `Encontré varios "${data.loteDestino}":\n\n` +
        resultadoDestino.opciones.map((opt, i) => 
          `${i + 1}️⃣ ${opt.nombre}${opt.moduloNombre ? ` (${opt.moduloNombre})` : ''}`
        ).join('\n') +
        `\n\n¿A cuál querés mover? Respondé con el número.`
      
      await sendWhatsAppMessage(phoneNumber, mensaje)
      
      await prisma.pendingConfirmation.update({
        where: { telefono: phoneNumber },
        data: {
          data: JSON.stringify({
            tipo: "ELEGIR_POTRERO_DESTINO",
            opciones: resultadoDestino.opciones,
            categoria: data.categoria,
            cantidad: data.cantidad,
            loteOrigenId: potreroSeleccionado.id,
            loteOrigenNombre: potreroSeleccionado.nombre
          })
        }
      })
      return
    }

    if (!resultadoDestino.unico || !resultadoDestino.lote) {
      await sendWhatsAppMessage(phoneNumber, `No encontré el potrero destino "${data.loteDestino}"`)
      await prisma.pendingConfirmation.delete({ where: { telefono: phoneNumber } })
      return
    }

    // Ya tenemos ORIGEN y DESTINO, proceder con el cambio
    await procesarCambioPotreroConModulos(
      phoneNumber,
      data.categoria,
      data.cantidad,
      potreroSeleccionado,
      resultadoDestino.lote
    )
  }

  // Caso 2: Estaba eligiendo DESTINO (ya tiene origen)
  else if (data.tipo === "ELEGIR_POTRERO_DESTINO") {
    console.log(`✅ Usuario eligió potrero DESTINO: ${potreroSeleccionado.nombre} (${potreroSeleccionado.moduloNombre || 'Sin módulo'})`)

    const potreroOrigen = {
      id: data.loteOrigenId,
      nombre: data.loteOrigenNombre
    }

    await procesarCambioPotreroConModulos(
      phoneNumber,
      data.categoria,
      data.cantidad,
      potreroOrigen,
      potreroSeleccionado
    )
  }
}

/**
 * Procesar cambio de potrero una vez que tenemos origen y destino claros
 */
async function procesarCambioPotreroConModulos(
  phoneNumber: string,
  categoria: string,
  cantidad: string | number,
  potreroOrigen: { id: string; nombre: string },
  potreroDestino: { id: string; nombre: string }
) {
  // 🔥 FIX: BORRAR LA CONFIRMACIÓN PENDIENTE PRIMERO para evitar loop infinito
  await prisma.pendingConfirmation.delete({ 
    where: { telefono: phoneNumber } 
  }).catch(() => {}) // Ignorar error si no existe

  // Llamar al handler normal con los datos completos
  await handleCambioPotrero(phoneNumber, {
    categoria,
    cantidad,
    loteOrigen: potreroOrigen.nombre,
    loteDestino: potreroDestino.nombre,
    _origenId: potreroOrigen.id,  // IDs explícitos
    _destinoId: potreroDestino.id
  })
}