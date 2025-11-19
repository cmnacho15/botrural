"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { obtenerFechaLocal } from '@/lib/fechas'

interface Lote {
  id: string;
  nombre: string;
  animalesLote: Array<{
    id: string;
    categoria: string;
    cantidad: number;
  }>;
}

interface ModalRecategorizacionProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
  lotes: Lote[];
  onSuccess: () => void;
}

// ✅ CATEGORÍAS COMPLETAS POR ESPECIE
const CATEGORIAS_VACUNOS = [
  "Vacas",
  "Vaquillonas +2 años",
  "Vaquillonas 1–2 años",
  "Vaquillonas",
  "Novillos +3 años",
  "Novillos 2–3 años",
  "Novillos 1–2 años",
  "Novillos",
  "Novillitos",
  "Terneros/as Mamones",
  "Terneros/as",
  "Terneros",
  "Terneras",
  "Toros",
  "Toritos",
];

const CATEGORIAS_OVINOS = [
  "Ovejas",
  "Borregas 2–4 dientes",
  "Borregas",
  "Borregos",
  "Corderos/as Mamones",
  "Corderos DL",
  "Corderas DL",
  "Corderos",
  "Corderas",
  "Capones",
  "Carneros",
];

const CATEGORIAS_EQUINOS = [
  "Yeguas",
  "Padrillos",
  "Caballos",
  "Potrillos",
];

// ✅ Función para detectar la especie de una categoría
function obtenerEspecie(categoria: string): 'vacunos' | 'ovinos' | 'equinos' | null {
  if (CATEGORIAS_VACUNOS.includes(categoria)) return 'vacunos';
  if (CATEGORIAS_OVINOS.includes(categoria)) return 'ovinos';
  if (CATEGORIAS_EQUINOS.includes(categoria)) return 'equinos';
  return null;
}

export default function ModalRecategorizacion({
  isOpen,
  onClose,
  onSubmit,
  lotes,
  onSuccess,
}: ModalRecategorizacionProps) {
  const [loteId, setLoteId] = useState("");
  const [categoria, setCategoria] = useState("");
  const [categoriaNueva, setCategoriaNueva] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [fecha, setFecha] = useState(obtenerFechaLocal());
  const [notas, setNotas] = useState("");

  const [categoriasDisponibles, setCategoriasDisponibles] = useState<string[]>([]);
  const [categoriasNuevasDisponibles, setCategoriasNuevasDisponibles] = useState<string[]>([]);
  const [cantidadMaxima, setCantidadMaxima] = useState(0);

  // Resetear formulario cuando se abre/cierra
  useEffect(() => {
    if (isOpen) {
      setLoteId("");
      setCategoria("");
      setCategoriaNueva("");
      setCantidad("");
      setFecha(obtenerFechaLocal());
      setNotas("");
      setCategoriasDisponibles([]);
      setCategoriasNuevasDisponibles([]);
      setCantidadMaxima(0);
    }
  }, [isOpen]);

  // Actualizar categorías disponibles cuando se selecciona un lote
  useEffect(() => {
    if (loteId) {
      const loteSeleccionado = lotes.find((l) => l.id === loteId);
      if (loteSeleccionado) {
        const cats = loteSeleccionado.animalesLote.map((a) => a.categoria);
        setCategoriasDisponibles(cats);
        setCategoria("");
        setCategoriaNueva("");
        setCantidad("");
      }
    } else {
      setCategoriasDisponibles([]);
      setCategoria("");
      setCategoriaNueva("");
      setCantidad("");
    }
  }, [loteId, lotes]);

  // ✅ Actualizar categorías nuevas disponibles según la especie seleccionada
  useEffect(() => {
    if (categoria) {
      const especie = obtenerEspecie(categoria);
      
      let categoriasPermitidas: string[] = [];
      if (especie === 'vacunos') {
        categoriasPermitidas = CATEGORIAS_VACUNOS;
      } else if (especie === 'ovinos') {
        categoriasPermitidas = CATEGORIAS_OVINOS;
      } else if (especie === 'equinos') {
        categoriasPermitidas = CATEGORIAS_EQUINOS;
      }

      // Filtrar para no incluir la categoría actual
      setCategoriasNuevasDisponibles(
        categoriasPermitidas.filter(cat => cat !== categoria)
      );
      setCategoriaNueva("");
    } else {
      setCategoriasNuevasDisponibles([]);
      setCategoriaNueva("");
    }
  }, [categoria]);

  // Actualizar cantidad máxima cuando se selecciona una categoría
  useEffect(() => {
    if (loteId && categoria) {
      const loteSeleccionado = lotes.find((l) => l.id === loteId);
      const animal = loteSeleccionado?.animalesLote.find(
        (a) => a.categoria === categoria
      );
      setCantidadMaxima(animal?.cantidad || 0);
      setCantidad("");
    } else {
      setCantidadMaxima(0);
      setCantidad("");
    }
  }, [loteId, categoria, lotes]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!loteId || !categoria || !categoriaNueva || !cantidad) {
      alert("Por favor complete todos los campos obligatorios");
      return;
    }

    if (categoria === categoriaNueva) {
      alert("La categoría nueva debe ser diferente a la actual");
      return;
    }

    const cantidadNum = parseInt(cantidad);
    if (cantidadNum <= 0 || cantidadNum > cantidadMaxima) {
      alert(`La cantidad debe ser entre 1 y ${cantidadMaxima}`);
      return;
    }

    const loteSeleccionado = lotes.find((l) => l.id === loteId);
    const nombrePotrero = loteSeleccionado?.nombre || "desconocido";

    const catActualLabel = cantidadNum === 1 ? categoria.replace(/s$/, "") : categoria;
    const catNuevaLabel = cantidadNum === 1 ? categoriaNueva.replace(/s$/, "") : categoriaNueva;
    const descripcion = `Recategorización de ${cantidadNum} ${catActualLabel} a ${catNuevaLabel} en potrero "${nombrePotrero}"`;

    onSubmit({
      tipo: "RECATEGORIZACION",
      loteId,
      categoria,
      categoriaNueva,
      cantidad: cantidadNum,
      fecha: fecha,
      descripcion,
      notas: notas.trim() || null,
    });

    onSuccess();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-800">
            🏷️ Recategorización de Animales
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Fecha */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fecha *
            </label>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              required
            />
          </div>

          {/* Potrero */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Potrero *
            </label>
            <select
              value={loteId}
              onChange={(e) => setLoteId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              required
            >
              <option value="">Seleccione un potrero</option>
              {lotes
                .filter((l) => l.animalesLote.length > 0)
                .map((lote) => (
                  <option key={lote.id} value={lote.id}>
                    {lote.nombre}
                  </option>
                ))}
            </select>
          </div>

          {/* Categoría Actual */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Categoría Actual *
            </label>
            <select
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              disabled={!loteId}
              required
            >
              <option value="">Seleccione categoría actual</option>
              {categoriasDisponibles.map((cat) => {
                const animal = lotes
                  .find((l) => l.id === loteId)
                  ?.animalesLote.find((a) => a.categoria === cat);
                return (
                  <option key={cat} value={cat}>
                    {cat} ({animal?.cantidad || 0})
                  </option>
                );
              })}
            </select>
          </div>

          {/* Categoría Nueva */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Categoría Nueva *
            </label>
            <select
              value={categoriaNueva}
              onChange={(e) => setCategoriaNueva(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              disabled={!categoria}
              required
            >
              <option value="">Seleccione categoría nueva</option>
              {categoriasNuevasDisponibles.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Cantidad */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Cantidad a Recategorizar *
            </label>
            <input
              type="number"
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
              min="1"
              max={cantidadMaxima}
              placeholder={cantidadMaxima > 0 ? `Máximo: ${cantidadMaxima}` : "Seleccione categoría"}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              disabled={!categoria}
              required
            />
            {cantidadMaxima > 0 && (
              <p className="text-xs text-gray-500 mt-1">
                Disponibles: {cantidadMaxima} {categoria}
              </p>
            )}
          </div>

          {/* Notas */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notas (opcional)
            </label>
            <textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              rows={3}
              placeholder="Ej: Peso promedio 280kg, destete tardío..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
            />
          </div>

          {/* Vista previa */}
          {loteId && categoria && categoriaNueva && cantidad && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm text-blue-800">
                <strong>Vista previa:</strong> Se recategorizarán {cantidad}{" "}
                {parseInt(cantidad) === 1 ? categoria.replace(/s$/, "") : categoria} a{" "}
                {parseInt(cantidad) === 1 ? categoriaNueva.replace(/s$/, "") : categoriaNueva} en{" "}
                {lotes.find((l) => l.id === loteId)?.nombre}
              </p>
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
              disabled={!loteId || !categoria || !categoriaNueva || !cantidad}
            >
              Recategorizar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}