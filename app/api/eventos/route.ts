import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '../auth/[...nextauth]/route'

// ==============================================
// POST: Crear un nuevo evento con lógica integrada
// ==============================================
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const usuario = await prisma.user.findUnique({
      where: { id: session.user.id }
    })

    if (!usuario?.campoId) {
      return NextResponse.json({ error: 'Usuario sin campo' }, { status: 400 })
    }

    const body = await request.json()
    const {
      tipo,
      fecha,
      descripcion,
      loteId,
      cantidad,
      categoria,
      monto,
      insumoId,
      tipoCultivo,
      hectareas,
      loteDestinoId,
      metodoPago,
      intensidad,
      notas
    } = body

    console.log('📥 Creando evento:', { tipo, descripcion })

    // 1️⃣ CREAR EL EVENTO PRINCIPAL
    const evento = await prisma.evento.create({
      data: {
        tipo,
        descripcion,
        fecha: fecha ? new Date(fecha) : new Date(),
        cantidad: cantidad ? parseInt(cantidad) : null,
        categoria: categoria || null,
        loteId: loteId || null,
        usuarioId: session.user.id,
        campoId: usuario.campoId
      }
    })

    console.log('✅ Evento creado:', evento.id)

    // 2️⃣ LÓGICA SEGÚN EL TIPO DE EVENTO

    switch (tipo) {
      // 🌧️ LLUVIA - Solo guardar evento
      case 'LLUVIA':
        break

      // ❄️ HELADA - Solo guardar evento
      case 'HELADA':
        break

      // 💸 COMPRA / CONSUMO → Crear GASTO
      case 'COMPRA':
      case 'CONSUMO':
        if (monto && parseFloat(monto) > 0) {
          await prisma.gasto.create({
            data: {
              tipo: 'GASTO',
              monto: parseFloat(monto),
              fecha: fecha ? new Date(fecha) : new Date(),
              descripcion: descripcion || '',
              categoria: categoria || 'Otros',
              metodoPago: metodoPago || null,
              campoId: usuario.campoId,
              loteId: loteId || null
            }
          })
          console.log('✅ Gasto registrado')
        }
        break

      // 💰 VENTA → Restar animales del lote
      case 'VENTA':
        if (loteId && cantidad && categoria) {
          const animalExistente = await prisma.animalLote.findFirst({
            where: { loteId, categoria }
          })

          if (animalExistente) {
            const nuevaCantidad = Math.max(0, animalExistente.cantidad - parseInt(cantidad))
            
            if (nuevaCantidad === 0) {
              await prisma.animalLote.delete({ where: { id: animalExistente.id } })
            } else {
              await prisma.animalLote.update({
                where: { id: animalExistente.id },
                data: { cantidad: nuevaCantidad }
              })
            }
          }
          console.log('✅ Animales restados del lote (venta)')
        }
        break

      // 📦 USO DE INSUMO → Crear movimiento + restar stock
      case 'USO_INSUMO':
        if (!insumoId || !cantidad) {
          return NextResponse.json({ error: 'insumoId y cantidad requeridos' }, { status: 400 })
        }

        const insumoUso = await prisma.insumo.findUnique({ where: { id: insumoId } })
        if (!insumoUso) {
          return NextResponse.json({ error: 'Insumo no encontrado' }, { status: 404 })
        }

        await prisma.movimientoInsumo.create({
          data: {
            tipo: 'USO',
            cantidad: parseFloat(cantidad),
            fecha: fecha ? new Date(fecha) : new Date(),
            notas: notas || descripcion || null,
            insumoId,
            loteId: loteId || null
          }
        })

        await prisma.insumo.update({
          where: { id: insumoId },
          data: { stock: Math.max(0, insumoUso.stock - parseFloat(cantidad)) }
        })

        console.log('✅ Uso de insumo registrado')
        break

      // 📥 INGRESO DE INSUMO → Crear movimiento + sumar stock (+ gasto si tiene monto)
      case 'INGRESO_INSUMO':
        if (!insumoId || !cantidad) {
          return NextResponse.json({ error: 'insumoId y cantidad requeridos' }, { status: 400 })
        }

        const insumoIngreso = await prisma.insumo.findUnique({ where: { id: insumoId } })
        if (!insumoIngreso) {
          return NextResponse.json({ error: 'Insumo no encontrado' }, { status: 404 })
        }

        await prisma.movimientoInsumo.create({
          data: {
            tipo: 'INGRESO',
            cantidad: parseFloat(cantidad),
            fecha: fecha ? new Date(fecha) : new Date(),
            notas: notas || descripcion || null,
            insumoId,
            loteId: loteId || null
          }
        })

        await prisma.insumo.update({
          where: { id: insumoId },
          data: { stock: insumoIngreso.stock + parseFloat(cantidad) }
        })

        // Si tiene monto, crear gasto
        if (monto && parseFloat(monto) > 0) {
          await prisma.gasto.create({
            data: {
              tipo: 'GASTO',
              monto: parseFloat(monto),
              fecha: fecha ? new Date(fecha) : new Date(),
              descripcion: `Compra de ${insumoIngreso.nombre}`,
              categoria: 'Insumos',
              metodoPago: metodoPago || null,
              campoId: usuario.campoId,
              loteId: loteId || null
            }
          })
        }

        console.log('✅ Ingreso de insumo registrado')
        break

      // 🚜 SIEMBRA → Crear cultivo en el lote
      case 'SIEMBRA':
        if (loteId && tipoCultivo && hectareas) {
          await prisma.cultivo.create({
            data: {
              tipoCultivo,
              fechaSiembra: fecha ? new Date(fecha) : new Date(),
              hectareas: parseFloat(hectareas),
              loteId
            }
          })
          console.log('✅ Cultivo creado en el lote')
        }
        break

      // 🌾 COSECHA → Eliminar cultivo del lote (opcional)
      case 'COSECHA':
        if (loteId && tipoCultivo) {
          await prisma.cultivo.deleteMany({
            where: { loteId, tipoCultivo }
          })
          console.log('✅ Cultivo eliminado tras cosecha')
        }
        break

      // 🐄 TRASLADO/MOVIMIENTO → Mover animales entre potreros
      case 'TRASLADO':
      case 'MOVIMIENTO':
        if (loteId && loteDestinoId && cantidad && categoria) {
          // Restar del lote origen
          const animalOrigen = await prisma.animalLote.findFirst({
            where: { loteId, categoria }
          })

          if (animalOrigen) {
            const nuevaCantOrigen = Math.max(0, animalOrigen.cantidad - parseInt(cantidad))
            
            if (nuevaCantOrigen === 0) {
              await prisma.animalLote.delete({ where: { id: animalOrigen.id } })
            } else {
              await prisma.animalLote.update({
                where: { id: animalOrigen.id },
                data: { cantidad: nuevaCantOrigen }
              })
            }
          }

          // Sumar al lote destino
          const animalDestino = await prisma.animalLote.findFirst({
            where: { loteId: loteDestinoId, categoria }
          })

          if (animalDestino) {
            await prisma.animalLote.update({
              where: { id: animalDestino.id },
              data: { cantidad: animalDestino.cantidad + parseInt(cantidad) }
            })
          } else {
            await prisma.animalLote.create({
              data: {
                categoria,
                cantidad: parseInt(cantidad),
                loteId: loteDestinoId
              }
            })
          }

          console.log('✅ Animales trasladados entre potreros')
        }
        break

      // 🐣 NACIMIENTO → Sumar animales al lote
      case 'NACIMIENTO':
        if (loteId && cantidad && categoria) {
          const animalExistente = await prisma.animalLote.findFirst({
            where: { loteId, categoria }
          })

          if (animalExistente) {
            await prisma.animalLote.update({
              where: { id: animalExistente.id },
              data: { cantidad: animalExistente.cantidad + parseInt(cantidad) }
            })
          } else {
            await prisma.animalLote.create({
              data: {
                categoria,
                cantidad: parseInt(cantidad),
                loteId
              }
            })
          }

          console.log('✅ Nacimientos registrados en el lote')
        }
        break

      // ☠️ MORTANDAD → Restar animales del lote
      case 'MORTANDAD':
        if (loteId && cantidad && categoria) {
          const animalExistente = await prisma.animalLote.findFirst({
            where: { loteId, categoria }
          })

          if (animalExistente) {
            const nuevaCantidad = Math.max(0, animalExistente.cantidad - parseInt(cantidad))
            
            if (nuevaCantidad === 0) {
              await prisma.animalLote.delete({ where: { id: animalExistente.id } })
            } else {
              await prisma.animalLote.update({
                where: { id: animalExistente.id },
                data: { cantidad: nuevaCantidad }
              })
            }
          }

          console.log('✅ Mortandad registrada, animales restados')
        }
        break

      // 🧪 PULVERIZACIÓN → Registrar uso de insumo si tiene insumoId
      case 'PULVERIZACION':
        if (insumoId && cantidad) {
          const insumo = await prisma.insumo.findUnique({ where: { id: insumoId } })
          
          if (insumo) {
            await prisma.movimientoInsumo.create({
              data: {
                tipo: 'USO',
                cantidad: parseFloat(cantidad),
                fecha: fecha ? new Date(fecha) : new Date(),
                notas: `Pulverización: ${descripcion}`,
                insumoId,
                loteId: loteId || null
              }
            })

            await prisma.insumo.update({
              where: { id: insumoId },
              data: { stock: Math.max(0, insumo.stock - parseFloat(cantidad)) }
            })
          }
        }
        break

      // Otros eventos solo se guardan
      default:
        break
    }

    return NextResponse.json({ success: true, evento }, { status: 201 })
  } catch (error) {
    console.error('❌ Error creando evento:', error)
    return NextResponse.json({
      error: 'Error al crear el evento',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// ==============================================
// GET: Listar eventos
// ==============================================
export async function GET() {
  try {
    const eventos = await prisma.evento.findMany({
      include: {
        usuario: { select: { name: true } },
        lote: { select: { nombre: true } }
      },
      orderBy: { fecha: 'desc' }
    })

    return NextResponse.json(eventos)
  } catch (error) {
    console.error('Error al obtener eventos:', error)
    return NextResponse.json({ error: 'Error al obtener eventos' }, { status: 500 })
  }
}