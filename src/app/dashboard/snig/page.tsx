"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SnigPage() {
  const router = useRouter();

  const [loadingUpload, setLoadingUpload] = useState(false);
  const [loadingConfirm, setLoadingConfirm] = useState(false);

  const [snigSessionId, setSnigSessionId] = useState<string | null>(null);
  const [caravanas, setCaravanas] = useState<string[]>([]);
  const [fechaSnig, setFechaSnig] = useState<string | null>(null);

  const [accion, setAccion] = useState<string>("");

  // Campos extra según acción
  const [categoria, setCategoria] = useState("");
  const [loteId, setLoteId] = useState("");
  const [loteDestinoId, setLoteDestinoId] = useState("");

  const [categorias, setCategorias] = useState<any[]>([]);
  const [lotes, setLotes] = useState<any[]>([]);

  const campoId = "CAMPO-ID"; // 🚨 reemplazar por el campo real del usuario logueado
  const usuarioId = "USUARIO-ID"; // 🚨 reemplazar por el usuario logueado

  // ===========================================
  // 1) SUBIR ARCHIVO SNIG
  // ===========================================
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;

    const file = e.target.files[0];
    setLoadingUpload(true);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("campoId", campoId);
    formData.append("usuarioId", usuarioId);

    const res = await fetch("/api/snig/upload", {
      method: "POST",
      body: formData,
    });

    setLoadingUpload(false);

    const data = await res.json();

    if (!res.ok) {
      alert(data.error || "Error procesando SNIG");
      return;
    }

    setSnigSessionId(data.snigSessionId);
    setCaravanas(data.caravanas);
    setFechaSnig(new Date(data.fechaSnig).toLocaleString());
  };

  // ===========================================
  // 2) CARGAR LOTES Y CATEGORÍAS CUANDO SE ELIJA ACCIÓN
  // ===========================================
  const loadDataIfNeeded = async (accion: string) => {
    setAccion(accion);

    // Solo acciones que tocan potreros
    if (["VENTA", "MORTANDAD", "TRASLADO"].includes(accion)) {
      // cargar lotes
      const resLotes = await fetch(`/api/lotes?campoId=${campoId}`);
      const lotesData = await resLotes.json();
      setLotes(lotesData);

      // cargar categorías
      const resCat = await fetch(`/api/categorias-animales?campoId=${campoId}`);
      const catData = await resCat.json();
      setCategorias(catData);
    }
  };

  // ===========================================
  // 3) CONFIRMAR ACCIÓN SNIG
  // ===========================================
  const confirmarAccion = async () => {
    if (!snigSessionId) {
      alert("No hay sesión SNIG cargada");
      return;
    }

    if (!accion) {
      alert("Seleccioná la acción");
      return;
    }

    setLoadingConfirm(true);

    const res = await fetch("/api/snig/confirm", {
      method: "POST",
      body: JSON.stringify({
        snigSessionId,
        accion,
        caravanas,
        categoria,
        loteId,
        loteDestinoId,
        campoId,
        usuarioId,
      }),
      headers: {
        "Content-Type": "application/json",
      },
    });

    setLoadingConfirm(false);

    const data = await res.json();

    if (!res.ok) {
      alert(data.error || "Error confirmando SNIG");
      return;
    }

    alert("SNIG procesado correctamente");
    router.refresh();
  };

  // ===========================================
  // RENDER
  // ===========================================

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">SNIG – Movimientos</h1>

      {/* UPLOAD FILE */}
      <div className="mb-6">
        <label className="block font-semibold mb-2">Subir archivo TXT del SNIG</label>
        <input
          type="file"
          accept=".txt"
          onChange={handleUpload}
          className="border p-2 w-full"
        />

        {loadingUpload && <p className="mt-2 text-blue-600">Procesando archivo...</p>}
      </div>

      {/* RESULTADO DEL UPLOAD */}
      {snigSessionId && (
        <div className="bg-gray-100 p-4 rounded-md mb-6">
          <h2 className="font-semibold">Archivo procesado</h2>
          <p><strong>Sesión SNIG:</strong> {snigSessionId}</p>
          <p><strong>Fecha SNIG:</strong> {fechaSnig}</p>
          <p><strong>Caravanas:</strong> {caravanas.length}</p>

          <div className="max-h-48 overflow-y-auto bg-white p-2 rounded-md mt-2 text-xs">
            {caravanas.map((c) => (
              <div key={c}>{c}</div>
            ))}
          </div>
        </div>
      )}

      {/* SELECCIONAR ACCIÓN */}
      {snigSessionId && (
        <div className="mb-6">
          <label className="block font-semibold mb-2">Acción</label>
          <select
            className="border p-2 w-full"
            value={accion}
            onChange={(e) => loadDataIfNeeded(e.target.value)}
          >
            <option value="">Elegir...</option>
            <option value="STOCK_INICIAL">Stock inicial</option>
            <option value="NACIMIENTO">Nacimiento / Caravaneo</option>
            <option value="COMPRA">Compra</option>
            <option value="VENTA">Venta</option>
            <option value="MORTANDAD">Mortandad</option>
            <option value="TRASLADO">Traslado</option>
          </select>
        </div>
      )}

      {/* CAMPOS EXTRA POR ACCIÓN */}
      {(accion === "VENTA" || accion === "MORTANDAD" || accion === "TRASLADO") && (
        <div className="mb-6 bg-gray-50 p-4 rounded-md">
          {/* Categoría */}
          <label className="block font-semibold">Categoría</label>
          <select
            className="border p-2 w-full mb-4"
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
          >
            <option value="">Seleccionar...</option>
            {categorias.map((c: any) => (
              <option key={c.id} value={c.nombreSingular}>{c.nombrePlural}</option>
            ))}
          </select>

          {/* Lote origen */}
          <label className="block font-semibold">Potrero origen</label>
          <select
            className="border p-2 w-full mb-4"
            value={loteId}
            onChange={(e) => setLoteId(e.target.value)}
          >
            <option value="">Seleccionar...</option>
            {lotes.map((l: any) => (
              <option key={l.id} value={l.id}>{l.nombre}</option>
            ))}
          </select>

          {/* Lote destino si TRASLADO */}
          {accion === "TRASLADO" && (
            <>
              <label className="block font-semibold">Potrero destino</label>
              <select
                className="border p-2 w-full"
                value={loteDestinoId}
                onChange={(e) => setLoteDestinoId(e.target.value)}
              >
                <option value="">Seleccionar...</option>
                {lotes.map((l: any) => (
                  <option key={l.id} value={l.id}>{l.nombre}</option>
                ))}
              </select>
            </>
          )}
        </div>
      )}

      {/* CONFIRMAR */}
      {snigSessionId && (
        <button
          onClick={confirmarAccion}
          disabled={loadingConfirm}
          className="bg-green-600 text-white px-6 py-2 rounded-md shadow-md"
        >
          {loadingConfirm ? "Procesando..." : "Confirmar acción SNIG"}
        </button>
      )}
    </div>
  );
}