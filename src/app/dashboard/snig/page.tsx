"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

export default function SnigPage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  const [loadingUpload, setLoadingUpload] = useState(false);
  const [loadingConfirm, setLoadingConfirm] = useState(false);

  const [snigSessionId, setSnigSessionId] = useState<string | null>(null);
  const [caravanas, setCaravanas] = useState<string[]>([]);
  const [fechaSnig, setFechaSnig] = useState<string | null>(null);
  const [warningFecha, setWarningFecha] = useState<string | null>(null);

  const [accion, setAccion] = useState<string>("");

  // Campos extra según acción
  const [categoria, setCategoria] = useState("");
  const [loteId, setLoteId] = useState("");
  const [loteDestinoId, setLoteDestinoId] = useState("");

  const [categorias, setCategorias] = useState<any[]>([]);
  const [lotes, setLotes] = useState<any[]>([]);

  // Obtener datos del usuario desde NextAuth
  const campoId = (session?.user as any)?.campoId || "";
  const usuarioId = session?.user?.id || "";

  // ===========================================
  // CARGAR LOTES Y CATEGORÍAS AL MONTAR
  // ===========================================
  useEffect(() => {
    if (status === "authenticated") {
      loadLotesYCategorias();
    }
  }, [status]);

  const loadLotesYCategorias = async () => {
    try {
      // Cargar lotes (tu API ya maneja la autenticación internamente)
      const resLotes = await fetch("/api/lotes");
      if (resLotes.ok) {
        const lotesData = await resLotes.json();
        setLotes(lotesData);
      }

      // Cargar categorías (tu API ya maneja la autenticación internamente)
      const resCat = await fetch("/api/categorias-animales");
      if (resCat.ok) {
        const catData = await resCat.json();
        setCategorias(catData);
      }
    } catch (error) {
      console.error("Error cargando lotes y categorías:", error);
    }
  };

  // ===========================================
  // 1) SUBIR ARCHIVO SNIG
  // ===========================================
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;

    const file = e.target.files[0];

    if (!campoId) {
      alert("No se pudo obtener el campo del usuario. Por favor recargá la página.");
      return;
    }

    setLoadingUpload(true);
    setSnigSessionId(null);
    setCaravanas([]);
    setFechaSnig(null);
    setWarningFecha(null);
    setAccion("");

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("campoId", campoId);
      if (usuarioId) {
        formData.append("usuarioId", usuarioId);
      }

      const res = await fetch("/api/snig/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Error procesando SNIG");
        return;
      }

      // ✅ Guardar datos de la sesión
      setSnigSessionId(data.snigSessionId);
      setCaravanas(data.caravanas);
      setFechaSnig(new Date(data.fechaSnig).toLocaleString());
      setWarningFecha(data.warningFecha);

      console.log("✅ Sesión SNIG creada:", data.snigSessionId);
    } catch (error) {
      console.error("Error subiendo archivo:", error);
      alert("Error procesando el archivo");
    } finally {
      setLoadingUpload(false);
    }
  };

  // ===========================================
  // 2) CONFIRMAR ACCIÓN SNIG
  // ===========================================
  const confirmarAccion = async () => {
    if (!snigSessionId) {
      alert("No hay sesión SNIG cargada");
      return;
    }

    if (!accion) {
      alert("Seleccioná una acción");
      return;
    }

    // Validaciones según acción
    if (["STOCK_INICIAL", "NACIMIENTO", "COMPRA", "VENTA", "MORTANDAD", "TRASLADO"].includes(accion)) {
      if (!categoria) {
        alert("Seleccioná una categoría");
        return;
      }
      if (!loteId) {
        alert("Seleccioná un potrero");
        return;
      }
    }

    if (accion === "TRASLADO" && !loteDestinoId) {
      alert("Seleccioná un potrero destino");
      return;
    }

    setLoadingConfirm(true);

    try {
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

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Error confirmando SNIG");
        return;
      }

      alert(`✅ ${data.mensaje}\n${data.cantidad} animales procesados`);
      
      // Resetear estado
      setSnigSessionId(null);
      setCaravanas([]);
      setFechaSnig(null);
      setWarningFecha(null);
      setAccion("");
      setCategoria("");
      setLoteId("");
      setLoteDestinoId("");

      // Recargar lotes para reflejar cambios
      await loadLotesYCategorias();
      router.refresh();
    } catch (error) {
      console.error("Error confirmando:", error);
      alert("Error procesando la confirmación");
    } finally {
      setLoadingConfirm(false);
    }
  };

  // ===========================================
  // DETERMINAR SI MOSTRAR CAMPOS EXTRA
  // ===========================================
  const necesitaLoteYCategoria = ["STOCK_INICIAL", "NACIMIENTO", "COMPRA", "VENTA", "MORTANDAD", "TRASLADO"].includes(accion);
  const necesitaLoteDestino = accion === "TRASLADO";

  // ===========================================
  // LOADING Y NO AUTENTICADO
  // ===========================================
  if (status === "loading") {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <p className="text-gray-600">Cargando...</p>
      </div>
    );
  }

  if (status === "unauthenticated") {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <p className="text-red-600">Necesitás iniciar sesión para acceder a esta página.</p>
      </div>
    );
  }

  // ===========================================
  // RENDER
  // ===========================================
  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">SNIG – Movimientos</h1>

      {/* UPLOAD FILE */}
      <div className="mb-6">
        <label className="block font-semibold mb-2">
          📄 Subir archivo TXT del SNIG
        </label>
        <input
          type="file"
          accept=".txt"
          onChange={handleUpload}
          disabled={loadingUpload}
          className="border p-2 w-full rounded-md"
        />

        {loadingUpload && (
          <p className="mt-2 text-blue-600 flex items-center gap-2">
            <span className="animate-spin">⏳</span>
            Procesando archivo...
          </p>
        )}
      </div>

      {/* RESULTADO DEL UPLOAD */}
      {snigSessionId && (
        <div className="bg-green-50 border border-green-200 p-4 rounded-md mb-6">
          <h2 className="font-semibold text-green-800 mb-2">✅ Archivo procesado</h2>
          <div className="space-y-1 text-sm">
            <p><strong>Sesión SNIG:</strong> {snigSessionId}</p>
            <p><strong>Fecha SNIG:</strong> {fechaSnig}</p>
            <p><strong>Caravanas encontradas:</strong> {caravanas.length}</p>
            {warningFecha && (
              <p className="text-amber-600">⚠️ {warningFecha}</p>
            )}
          </div>

          <details className="mt-3">
            <summary className="cursor-pointer text-sm text-gray-600 hover:text-gray-800">
              Ver todas las caravanas
            </summary>
            <div className="max-h-48 overflow-y-auto bg-white p-2 rounded-md mt-2 text-xs border">
              {caravanas.map((c, idx) => (
                <div key={idx} className="py-1 border-b last:border-b-0">
                  {c}
                </div>
              ))}
            </div>
          </details>
        </div>
      )}

      {/* SELECCIONAR ACCIÓN */}
      {snigSessionId && (
        <div className="mb-6">
          <label className="block font-semibold mb-2">🔧 Acción a realizar</label>
          <select
            className="border p-2 w-full rounded-md"
            value={accion}
            onChange={(e) => setAccion(e.target.value)}
          >
            <option value="">Elegir acción...</option>
            <option value="STOCK_INICIAL">📦 Stock inicial</option>
            <option value="NACIMIENTO">🐄 Nacimiento / Caravaneo</option>
            <option value="COMPRA">💰 Compra</option>
            <option value="VENTA">💵 Venta</option>
            <option value="MORTANDAD">💀 Mortandad</option>
            <option value="TRASLADO">🚜 Traslado entre potreros</option>
          </select>
        </div>
      )}

      {/* CAMPOS EXTRA POR ACCIÓN */}
      {necesitaLoteYCategoria && (
        <div className="mb-6 bg-gray-50 border border-gray-200 p-4 rounded-md space-y-4">
          <h3 className="font-semibold text-gray-800">Detalles de la operación</h3>

          {/* Categoría */}
          <div>
            <label className="block font-semibold mb-1 text-sm">Categoría</label>
            <select
              className="border p-2 w-full rounded-md"
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
            >
              <option value="">Seleccionar categoría...</option>
              {categorias.map((c: any) => (
                <option key={c.id} value={c.nombreSingular}>
                  {c.nombrePlural}
                </option>
              ))}
            </select>
          </div>

          {/* Lote origen */}
          <div>
            <label className="block font-semibold mb-1 text-sm">
              Potrero {necesitaLoteDestino ? "origen" : ""}
            </label>
            <select
              className="border p-2 w-full rounded-md"
              value={loteId}
              onChange={(e) => setLoteId(e.target.value)}
            >
              <option value="">Seleccionar potrero...</option>
              {lotes.map((l: any) => (
                <option key={l.id} value={l.id}>
                  {l.nombre}
                </option>
              ))}
            </select>
          </div>

          {/* Lote destino si TRASLADO */}
          {necesitaLoteDestino && (
            <div>
              <label className="block font-semibold mb-1 text-sm">Potrero destino</label>
              <select
                className="border p-2 w-full rounded-md"
                value={loteDestinoId}
                onChange={(e) => setLoteDestinoId(e.target.value)}
              >
                <option value="">Seleccionar potrero destino...</option>
                {lotes.filter(l => l.id !== loteId).map((l: any) => (
                  <option key={l.id} value={l.id}>
                    {l.nombre}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      {/* CONFIRMAR */}
      {snigSessionId && accion && (
        <button
          onClick={confirmarAccion}
          disabled={loadingConfirm}
          className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-md shadow-md font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loadingConfirm ? (
            <span className="flex items-center gap-2">
              <span className="animate-spin">⏳</span>
              Procesando...
            </span>
          ) : (
            "✅ Confirmar acción SNIG"
          )}
        </button>
      )}

      {/* AYUDA */}
      <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-md text-sm">
        <h3 className="font-semibold text-blue-800 mb-2">ℹ️ Cómo usar este módulo:</h3>
        <ol className="list-decimal list-inside space-y-1 text-gray-700">
          <li>Subí el archivo TXT exportado desde el SNIG</li>
          <li>Elegí la acción que representa este movimiento</li>
          <li>Completá los datos requeridos (categoría, potrero, etc.)</li>
          <li>Confirmá la operación</li>
        </ol>
      </div>
    </div>
  );
}