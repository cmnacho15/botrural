"use client"

import { useState } from "react"
import { X, Users, Bot, Calculator, Copy, Check } from "lucide-react"

interface ModalInvitarUsuarioProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

type TipoInvitacion = "COLABORADOR" | "EMPLEADO" | "CONTADOR"

export default function ModalInvitarUsuario({
  isOpen,
  onClose,
  onSuccess,
}: ModalInvitarUsuarioProps) {
  const [step, setStep] = useState<"seleccionar" | "mostrar-link">("seleccionar")
  const [tipoSeleccionado, setTipoSeleccionado] = useState<TipoInvitacion | null>(null)
  const [loading, setLoading] = useState(false)
  const [linkGenerado, setLinkGenerado] = useState("")
  const [linkType, setLinkType] = useState<"whatsapp" | "web">("whatsapp")
  const [copiado, setCopiado] = useState(false)

  if (!isOpen) return null

  const handleSeleccionarTipo = async (tipo: TipoInvitacion) => {
    setTipoSeleccionado(tipo)
    setLoading(true)

    try {
      const response = await fetch("/api/invitaciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: tipo }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Error creando invitación")
      }

      setLinkGenerado(data.link)
      setLinkType(data.linkType)
      setStep("mostrar-link")
    } catch (error: any) {
      alert(error.message || "Error al crear invitación")
      setTipoSeleccionado(null)
    } finally {
      setLoading(false)
    }
  }

  const handleCopiar = async () => {
    try {
      await navigator.clipboard.writeText(linkGenerado)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch (error) {
      alert("Error al copiar el link")
    }
  }

  const handleCerrar = () => {
    setStep("seleccionar")
    setTipoSeleccionado(null)
    setLinkGenerado("")
    setCopiado(false)
    onClose()
    onSuccess()
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">
            {step === "seleccionar" ? "Invitar nuevo usuario" : "Link de invitación generado"}
          </h2>
          <button
            onClick={handleCerrar}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {step === "seleccionar" && (
            <>
              <p className="text-gray-600 mb-6">
                Selecciona el tipo de usuario que deseas invitar:
              </p>

              <div className="grid md:grid-cols-3 gap-4">
                {/* Tarjeta COLABORADOR */}
                <button
                  onClick={() => handleSeleccionarTipo("COLABORADOR")}
                  disabled={loading}
                  className="group relative bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-200 rounded-xl p-6 text-left hover:shadow-lg hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-3 bg-blue-500 rounded-lg">
                      <Users className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="text-xl font-bold text-blue-900">Colaborador</h3>
                  </div>

                  <ul className="space-y-2 text-sm text-blue-800">
                    <li className="flex items-start gap-2">
                      <span className="text-blue-500 font-bold">✓</span>
                      <span>Acceso a plataforma web</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-500 font-bold">✓</span>
                      <span>Acceso al bot de WhatsApp</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-500 font-bold">✓</span>
                      <span>Puede gestionar lotes y datos</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-orange-500 font-bold">○</span>
                      <span className="text-gray-600">Sin finanzas (puedes habilitarlo después)</span>
                    </li>
                  </ul>

                  <div className="mt-4 pt-4 border-t border-blue-300">
                    <p className="text-xs text-blue-700 font-medium">
                      📱 Se registra vía WhatsApp → Completa datos en web
                    </p>
                  </div>
                </button>

                {/* Tarjeta EMPLEADO */}
                <button
                  onClick={() => handleSeleccionarTipo("EMPLEADO")}
                  disabled={loading}
                  className="group relative bg-gradient-to-br from-green-50 to-green-100 border-2 border-green-200 rounded-xl p-6 text-left hover:shadow-lg hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-3 bg-green-500 rounded-lg">
                      <Bot className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="text-xl font-bold text-green-900">Empleado</h3>
                  </div>

                  <ul className="space-y-2 text-sm text-green-800">
                    <li className="flex items-start gap-2">
                      <span className="text-green-500 font-bold">✓</span>
                      <span>Solo bot de WhatsApp</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-green-500 font-bold">✓</span>
                      <span>Registro rápido (sin email)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-green-500 font-bold">✓</span>
                      <span>Carga datos y recibe info</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-red-500 font-bold">✗</span>
                      <span className="text-gray-600">Sin acceso a plataforma web</span>
                    </li>
                  </ul>

                  <div className="mt-4 pt-4 border-t border-green-300">
                    <p className="text-xs text-green-700 font-medium">
                      📱 Registro 100% por WhatsApp
                    </p>
                  </div>
                </button>

                {/* Tarjeta CONTADOR */}
                <button
                  onClick={() => handleSeleccionarTipo("CONTADOR")}
                  disabled={loading}
                  className="group relative bg-gradient-to-br from-purple-50 to-purple-100 border-2 border-purple-200 rounded-xl p-6 text-left hover:shadow-lg hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-3 bg-purple-500 rounded-lg">
                      <Calculator className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="text-xl font-bold text-purple-900">Contador</h3>
                  </div>

                  <ul className="space-y-2 text-sm text-purple-800">
                    <li className="flex items-start gap-2">
                      <span className="text-purple-500 font-bold">✓</span>
                      <span>Acceso solo a plataforma web</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-purple-500 font-bold">✓</span>
                      <span>Ve Gastos y Mano de Obra</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-orange-500 font-bold">○</span>
                      <span className="text-gray-600">Solo lectura (por ahora)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-red-500 font-bold">✗</span>
                      <span className="text-gray-600">Sin acceso al bot</span>
                    </li>
                  </ul>

                  <div className="mt-4 pt-4 border-t border-purple-300">
                    <p className="text-xs text-purple-700 font-medium">
                      🌐 Registro directo en plataforma web
                    </p>
                  </div>
                </button>
              </div>

              {loading && (
                <div className="mt-6 text-center">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-gray-300 border-t-blue-600"></div>
                  <p className="mt-2 text-gray-600">Generando invitación...</p>
                </div>
              )}
            </>
          )}

          {step === "mostrar-link" && (
            <div className="space-y-6">
              {/* Tipo de invitación */}
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-1">Tipo de invitación:</p>
                <p className="text-lg font-bold text-gray-900">
                  {tipoSeleccionado === "COLABORADOR" && "👤 Colaborador"}
                  {tipoSeleccionado === "EMPLEADO" && "🤖 Empleado (solo bot)"}
                  {tipoSeleccionado === "CONTADOR" && "🧮 Contador"}
                </p>
              </div>

              {/* Instrucciones según tipo */}
              <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
                <h4 className="font-semibold text-blue-900 mb-2">
                  📋 Instrucciones de uso:
                </h4>
                
                {linkType === "whatsapp" && (
                  <div className="text-sm text-blue-800 space-y-2">
                    <p>1. Copia el link de WhatsApp</p>
                    <p>2. Envíaselo al usuario que deseas invitar</p>
                    <p>3. Al hacer clic, se abrirá WhatsApp con el bot</p>
                    {tipoSeleccionado === "COLABORADOR" && (
                      <p>4. El bot le enviará un link web para completar su registro</p>
                    )}
                    {tipoSeleccionado === "EMPLEADO" && (
                      <p>4. El bot le pedirá su nombre y apellido para registrarlo</p>
                    )}
                  </div>
                )}

                {linkType === "web" && (
                  <div className="text-sm text-blue-800 space-y-2">
                    <p>1. Copia el link de registro</p>
                    <p>2. Envíaselo al contador por email o WhatsApp</p>
                    <p>3. Debe ingresar desde su navegador</p>
                    <p>4. Completará el formulario con email y contraseña</p>
                  </div>
                )}
              </div>

              {/* Link generado */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {linkType === "whatsapp" ? "🔗 Link de WhatsApp:" : "🔗 Link de registro web:"}
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={linkGenerado}
                    readOnly
                    className="flex-1 px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-sm font-mono"
                  />
                  <button
                    onClick={handleCopiar}
                    className={`px-4 py-3 rounded-lg font-medium transition-all ${
                      copiado
                        ? "bg-green-500 text-white"
                        : "bg-blue-600 text-white hover:bg-blue-700"
                    }`}
                  >
                    {copiado ? (
                      <>
                        <Check className="w-5 h-5" />
                      </>
                    ) : (
                      <>
                        <Copy className="w-5 h-5" />
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Advertencia de expiración */}
              <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 rounded">
                <p className="text-sm text-yellow-800">
                  ⏰ <strong>Esta invitación expira en 7 días.</strong> Asegúrate de que el usuario
                  la use antes de ese plazo.
                </p>
              </div>

              {/* Botones */}
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setStep("seleccionar")
                    setTipoSeleccionado(null)
                    setLinkGenerado("")
                  }}
                  className="flex-1 px-4 py-3 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition-colors"
                >
                  ← Crear otra invitación
                </button>
                <button
                  onClick={handleCerrar}
                  className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                >
                  Finalizar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}