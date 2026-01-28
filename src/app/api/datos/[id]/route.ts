//src/app/api/datos/id/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.campoId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const campoId = session.user.campoId
    const { id } = params

    // 🔍 Detectar qué tipo de dato es
    const evento = await prisma.evento.findFirst({
      where: { id, campoId },
      include: { lote: true }
    })

    const gasto = await prisma.gasto.findFirst({
      where: { id, campoId },
    })

    const movimientoInsumo = await prisma.movimientoInsumo.findFirst({
      where: { 
        id,
        insumo: { campoId }
      },
      include: { insumo: true }
    })

    // 🎯 Procesar según el tipo
    if (evento) {
      await eliminarEvento(evento, campoId)
      return NextResponse.json({ 
        success: true, 
        message: `Evento ${evento.tipo} eliminado correctamente` 
      })
    }

    if (gasto) {
      await eliminarGasto(gasto)
      return NextResponse.json({ 
        success: true, 
        message: `${gasto.tipo === 'INGRESO' ? 'Ingreso' : 'Gasto'} eliminado correctamente` 
      })
    }

    if (movimientoInsumo) {
      await eliminarMovimientoInsumo(movimientoInsumo)
      return NextResponse.json({ 
        success: true, 
        message: 'Movimiento de insumo eliminado correctamente' 
      })
    }

    return NextResponse.json(
      { error: 'Dato no encontrado' },
      { status: 404 }
    )

  } catch (error) {
    console.error('Error al eliminar dato:', error)
    return NextResponse.json(
      { error: 'Error al eliminar dato', details: (error as Error).message },
      { status: 500 }
    )
  }
}

// ==================== FUNCIONES DE ELIMINACIÓN ====================

async function eliminarEvento(evento: any, campoId: string) {
  const tipo = evento.tipo

  switch (tipo) {
    case 'NACIMIENTO':
      await revertirNacimiento(evento)
      break

    case 'MORTANDAD':
      await revertirMortandad(evento)
      break

    case 'VENTA':
      await revertirVenta(evento)
      break

    case 'COMPRA':
      await revertirCompra(evento)
      break

    case 'CAMBIO_POTRERO':
      await revertirCambioPotrero(evento)
      break

    case 'TRASLADO':
      await revertirTraslado(evento)
      break

    case 'CONSUMO':
      await revertirConsumo(evento)
      break

    case 'RECATEGORIZACION':
      await revertirRecategorizacion(evento)
      break

    // Para eventos sin impacto en datos (clima, tratamientos, etc.)
    default:
      await prisma.evento.delete({ where: { id: evento.id } })
      break
  }
}

async function eliminarGasto(gasto: any) {
  await prisma.gasto.delete({ where: { id: gasto.id } })
}

async function eliminarMovimientoInsumo(movimiento: any) {
  // Revertir stock del insumo
  if (movimiento.tipo === 'INGRESO') {
    // Si fue ingreso, restar del stock actual
    await prisma.insumo.update({
      where: { id: movimiento.insumoId },
      data: {
        stock: {  // 👈 Corregido: "stock" no "stockActual"
          decrement: movimiento.cantidad
        }
      }
    })
  } else {
    // Si fue uso, sumar al stock actual
    await prisma.insumo.update({
      where: { id: movimiento.insumoId },
      data: {
        stock: {  // 👈 Corregido: "stock" no "stockActual"
          increment: movimiento.cantidad
        }
      }
    })
  }

  await prisma.movimientoInsumo.delete({ where: { id: movimiento.id } })
}

// ==================== REVERTIR EVENTOS ESPECÍFICOS ====================

async function revertirNacimiento(evento: any) {
  const cantidad = evento.cantidad || 0
  const categoria = evento.categoria

  if (!categoria || cantidad === 0) {
    await prisma.evento.delete({ where: { id: evento.id } })
    return
  }

  // Restar animales del lote
  const animalesLote = await prisma.animalLote.findFirst({
    where: {
      loteId: evento.loteId!,
      categoria,
    }
  })

  if (animalesLote) {
    const nuevaCantidad = Math.max(0, animalesLote.cantidad - cantidad)
    
    if (nuevaCantidad === 0) {
      await prisma.animalLote.delete({ where: { id: animalesLote.id } })
    } else {
      await prisma.animalLote.update({
        where: { id: animalesLote.id },
        data: { cantidad: nuevaCantidad }
      })
    }
  }

  await prisma.evento.delete({ where: { id: evento.id } })
}

async function revertirMortandad(evento: any) {
  const cantidad = evento.cantidad || 0
  const categoria = evento.categoria

  if (!categoria || cantidad === 0) {
    await prisma.evento.delete({ where: { id: evento.id } })
    return
  }

  // Sumar animales al lote (revertir la baja)
  const animalesLote = await prisma.animalLote.findFirst({
    where: {
      loteId: evento.loteId!,
      categoria,
    }
  })

  if (animalesLote) {
    await prisma.animalLote.update({
      where: { id: animalesLote.id },
      data: {
        cantidad: {
          increment: cantidad
        }
      }
    })
  } else {
    await prisma.animalLote.create({
      data: {
        loteId: evento.loteId!,
        categoria,
        cantidad,
      }
    })
  }

  await prisma.evento.delete({ where: { id: evento.id } })
}

async function revertirVenta(evento: any) {
  const cantidad = evento.cantidad || 0
  const categoria = evento.categoria

  if (!categoria || cantidad === 0) {
    await prisma.evento.delete({ where: { id: evento.id } })
    return
  }

  // Devolver animales al lote
  const animalesLote = await prisma.animalLote.findFirst({
    where: {
      loteId: evento.loteId!,
      categoria,
    }
  })

  if (animalesLote) {
    await prisma.animalLote.update({
      where: { id: animalesLote.id },
      data: {
        cantidad: {
          increment: cantidad
        }
      }
    })
  } else {
    await prisma.animalLote.create({
      data: {
        loteId: evento.loteId!,
        categoria,
        cantidad,
      }
    })
  }

  await prisma.evento.delete({ where: { id: evento.id } })
}

async function revertirCompra(evento: any) {
  const cantidad = evento.cantidad || 0
  const categoria = evento.categoria

  if (!categoria || cantidad === 0) {
    await prisma.evento.delete({ where: { id: evento.id } })
    return
  }

  // Restar animales del lote
  const animalesLote = await prisma.animalLote.findFirst({
    where: {
      loteId: evento.loteId!,
      categoria,
    }
  })

  if (animalesLote) {
    const nuevaCantidad = Math.max(0, animalesLote.cantidad - cantidad)
    
    if (nuevaCantidad === 0) {
      await prisma.animalLote.delete({ where: { id: animalesLote.id } })
    } else {
      await prisma.animalLote.update({
        where: { id: animalesLote.id },
        data: { cantidad: nuevaCantidad }
      })
    }
  }

  await prisma.evento.delete({ where: { id: evento.id } })
}

async function revertirCambioPotrero(evento: any) {
  const cantidad = evento.cantidad || 0
  const categoria = evento.categoria
  const potreroDestinoId = evento.loteDestinoId

  if (!categoria || !potreroDestinoId || cantidad === 0) {
    await prisma.evento.delete({ where: { id: evento.id } })
    return
  }

  // Devolver animales al potrero origen
  const animalesOrigen = await prisma.animalLote.findFirst({
    where: {
      loteId: evento.loteId!,
      categoria,
    }
  })

  if (animalesOrigen) {
    await prisma.animalLote.update({
      where: { id: animalesOrigen.id },
      data: {
        cantidad: {
          increment: cantidad
        }
      }
    })
  } else {
    await prisma.animalLote.create({
      data: {
        loteId: evento.loteId!,
        categoria,
        cantidad,
      }
    })
  }

  // Restar del potrero destino
  const animalesDestino = await prisma.animalLote.findFirst({
    where: {
      loteId: potreroDestinoId,
      categoria,
    }
  })

  if (animalesDestino) {
    const nuevaCantidad = Math.max(0, animalesDestino.cantidad - cantidad)
    
    if (nuevaCantidad === 0) {
      await prisma.animalLote.delete({ where: { id: animalesDestino.id } })
    } else {
      await prisma.animalLote.update({
        where: { id: animalesDestino.id },
        data: { cantidad: nuevaCantidad }
      })
    }
  }

  await prisma.evento.delete({ where: { id: evento.id } })
}

async function revertirTraslado(evento: any) {
  // Similar a cambio de potrero
  await revertirCambioPotrero(evento)
}

async function revertirConsumo(evento: any) {
  // Similar a mortandad - devolver animales al stock
  await revertirMortandad(evento)
}

async function revertirRecategorizacion(evento: any) {
  const cantidad = evento.cantidad || 0
  const categoriaOrigen = evento.categoria
  const categoriaDestino = evento.categoriaNueva

  if (!categoriaOrigen || !categoriaDestino || cantidad === 0) {
    await prisma.evento.delete({ where: { id: evento.id } })
    return
  }

  // Devolver a categoría origen
  const animalesOrigen = await prisma.animalLote.findFirst({
    where: {
      loteId: evento.loteId!,
      categoria: categoriaOrigen,
    }
  })

  if (animalesOrigen) {
    await prisma.animalLote.update({
      where: { id: animalesOrigen.id },
      data: {
        cantidad: {
          increment: cantidad
        }
      }
    })
  } else {
    await prisma.animalLote.create({
      data: {
        loteId: evento.loteId!,
        categoria: categoriaOrigen,
        cantidad,
      }
    })
  }

  // Restar de categoría destino
  const animalesDestino = await prisma.animalLote.findFirst({
    where: {
      loteId: evento.loteId!,
      categoria: categoriaDestino,
    }
  })

  if (animalesDestino) {
    const nuevaCantidad = Math.max(0, animalesDestino.cantidad - cantidad)
    
    if (nuevaCantidad === 0) {
      await prisma.animalLote.delete({ where: { id: animalesDestino.id } })
    } else {
      await prisma.animalLote.update({
        where: { id: animalesDestino.id },
        data: { cantidad: nuevaCantidad }
      })
    }
  }

  await prisma.evento.delete({ where: { id: evento.id } })
}