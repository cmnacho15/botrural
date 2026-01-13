//src/app/components/modales/ModalDividirBovinos.tsx
"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { Sriracha } from "next/font/google";

interface Potrero {
  loteId: string;
  nombre: string;
  cantidad: number;
  animalLoteId: string;
}

interface ModalDividirBovinosProps {
  isOpen: boolean;
  onClose: () => void;
  potreros: Potrero[];
  onSuccess: () => void;
}

export default function ModalDividirBovinos({
  isOpen,
  onClose,
  potreros,
  onSuccess,
}: ModalDividirBovinosProps) {
  const [divisiones, setDivisiones] = useState<Array<{
    animalLoteId: string;
    loteId: string;
    totalOriginal: number;
    machos: number;
    hembras: number;
  }>>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setDivisiones(
        potreros.map((p) => ({
          animalLoteId: p.animalLoteId,
          loteId: p.loteId,
          totalOriginal: p.cantidad,
          machos: 0,
          hembras: 0,
        }))
      );
    }
  }, [isOpen, potreros]);

  if (!isOpen) return null;

  const totalAnimales = potreros.reduce((sum, p) => sum + p.cantidad, 0);

  const actualizarMachos = (index: number, valor: string) => {
    const num = parseInt(valor) || 0;
    const nuevasDivisiones = [...divisiones];
    nuevasDivisiones[index].machos = num;
    setDivisiones(nuevasDivisiones);
  };

  const actualizarHembras = (index: number, valor: string) => {
    const num = parseInt(valor) || 0;
    const nuevasDivisiones = [...divisiones];
    nuevasDivisiones[index].hembras = num;
    setDivisiones(nuevasDivisiones);
  };

  const validarDivision = (div: (typeof divisiones)[0]) => {
    return div.machos + div.hembras === div.totalOriginal;
  };

  const todasValidas = divisiones.every(validarDivision);

  const handleConfirmar = async () => {
    if (!todasValidas) return;

    setLoading(true);
    try {
      const res = await fetch("/api/recategorizacion/dividir-bovinos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ divisiones }),
      });

      if (!res.ok) {
        const error = await res.json();
        alert(error.error || "Error al dividir");
        return;
      }

      onSuccess();
      onClose();
    } catch (error) {
      console.error("Error:", error);
      alert("Error al dividir");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">
            🐄 Dividir Terneros nacidos por sexo
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              Total a dividir: <strong>{totalAnimales} animales</strong> en{" "}
              {potreros.length} potrero{potreros.length > 1 ? "s" : ""}
            </p>
          </div>

          {/* Divisiones por potrero */}
          <div className="space-y-4">
            {divisiones.map((div, index) => {
              const potrero = potreros[index];
              const valida = validarDivision(div);
              const suma = div.machos + div.hembras;
              const diferencia = div.totalOriginal - suma;

              return (
                <div
                  key={potrero.loteId}
                  className="border rounded-lg p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium text-gray-900">
                      {potrero.nombre}
                    </h3>
                    <span className="text-sm text-gray-600">
                      Total: {potrero.cantidad} Terneros nacidos
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Machos (Terneros)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max={div.totalOriginal}
                        value={div.machos || ""}
                        onChange={(e) => actualizarMachos(index, e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="0"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Hembras (Terneras)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max={div.totalOriginal}
                        value={div.hembras || ""}
                        onChange={(e) => actualizarHembras(index, e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="0"
                      />
                    </div>
                  </div>

                  {/* Validación */}
                  <div
                    className={`text-sm font-medium ${
                      valida
                        ? "text-green-600"
                        : suma === 0
                        ? "text-gray-500"
                        : "text-red-600"
                    }`}
                  >
                    {valida ? (
                      <span>✅ {suma} = {div.totalOriginal}</span>
                    ) : suma === 0 ? (
                      <span>⚠️ Faltan {div.totalOriginal} animales</span>
                    ) : diferencia > 0 ? (
                      <span>❌ Faltan {diferencia} animales</span>
                    ) : (
                      <span>❌ Sobran {Math.abs(diferencia)} animales</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Info */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <p className="text-sm text-gray-700">
              ℹ️ Los "Terneros nacidos" se eliminarán y crearán nuevos registros
              de Terneros y Terneras
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 border-t px-6 py-4 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            disabled={loading}
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirmar}
            disabled={!todasValidas || loading}
            className={`px-6 py-2 rounded-lg font-medium transition-colors ${
              todasValidas && !loading
                ? "bg-blue-600 text-white hover:bg-blue-700"
                : "bg-gray-300 text-gray-500 cursor-not-allowed"
            }`}
          >
            {loading ? "Procesando..." : "Confirmar"}
          </button>
        </div>
      </div>
    </div>
  );
}