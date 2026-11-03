import { useState, useRef } from "react";
import { api } from "../../api/client";
import MapeoColumnasModal from "./MapeoColumnasModal";
import ReporteImportacion from "./ReporteImportacion";

export default function DropzoneImport({
  onImportacionCompletada,
  onVerHistorial,
}) {
  const [fase, setFase] = useState("idle");
  const [archivo, setArchivo] = useState(null);
  const [preview, setPreview] = useState(null);
  const [reporte, setReporte] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [cargandoPreview, setCargandoPreview] = useState(false);
  const [error, setError] = useState(null);

  const inputRef = useRef(null);
  const submitEnCursoRef = useRef(false);

  const elegirArchivo = (file) => {
    if (!file) return;
    if (!/\.(xlsx?|csv)$/i.test(file.name)) {
      setError("Formato no soportado. Usá .xlsx, .xls o .csv");
      return;
    }
    setArchivo(file);
    setError(null);
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    elegirArchivo(e.dataTransfer.files?.[0]);
  };

  const onFileChange = (e) => elegirArchivo(e.target.files?.[0]);

  const handlePreview = async () => {
    if (!archivo) {
      setError("Primero elegí un archivo Excel");
      return;
    }
    setCargandoPreview(true);
    setError(null);
    try {
      const data = await api.importarPreview(archivo, null);
      setPreview(data);
      setFase("preview");
    } catch (err) {
      setError(err.message);
    } finally {
      setCargandoPreview(false);
    }
  };

  const handleConfirmar = async (mapeo, headerRow) => {
    if (submitEnCursoRef.current) return;
    submitEnCursoRef.current = true;
    setFase("confirmando");
    setError(null);
    try {
      const data = await api.importarConfirmar(archivo, mapeo, {
        headerRow: Number(headerRow) || 0,
      });
      setReporte(data.reporte ?? data);
      setFase("reporte");
      onImportacionCompletada?.(data);
    } catch (err) {
      setError(err.message);
      setFase("preview");
      submitEnCursoRef.current = false;
      throw err;
    }
  };

  const handleCancelarModal = () => {
    setPreview(null);
    setFase("idle");
  };

  const resetearTodo = () => {
    setArchivo(null);
    setPreview(null);
    setReporte(null);
    setError(null);
    setFase("idle");
    submitEnCursoRef.current = false;
    if (inputRef.current) inputRef.current.value = "";
  };

  // ==================== FASE: REPORTE ====================
  if (fase === "reporte" && reporte) {
    return (
      <ReporteImportacion
        reporte={reporte}
        onCerrar={resetearTodo}
        onVerHistorial={onVerHistorial}
      />
    );
  }

  // ==================== FASE: PREVIEW (modal mapeo) ====================
  if (fase === "preview" && preview) {
    return (
      <MapeoColumnasModal
        abierto
        archivo={archivo}
        headers={preview.headers || []}
        sample={preview.sample || []}
        totalFilas={preview.totalFilas || 0}
        camposBase={preview.camposBase || []}
        mapeoSugerido={preview.mapeoInicial || preview.automap || {}}
        headerRowInicial={preview.filaHeader || 0}
        headersDuplicados={preview.headersDuplicados || []}
        onCancelar={handleCancelarModal}
        onConfirmar={handleConfirmar}
      />
    );
  }

  // ==================== FASE: FORM PRINCIPAL ====================
  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 w-full">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold text-slate-800">
            📥 Importar Excel
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Arrastrá tu lista de precios (.xlsx, .xls o .csv) para mapear
            columnas y actualizar el catálogo maestro.
          </p>
        </div>
      </div>

      <div className="mb-4">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition ${
            dragOver
              ? "border-indigo-500 bg-indigo-50"
              : "border-slate-300 hover:border-indigo-400 hover:bg-slate-50"
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={onFileChange}
            className="hidden"
          />
          {archivo ? (
            <div className="text-sm">
              <p className="text-3xl mb-2">📄</p>
              <p className="font-medium text-slate-700 truncate">
                {archivo.name}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {(archivo.size / 1024).toFixed(1)} KB · Click para cambiar
              </p>
            </div>
          ) : (
            <div className="text-sm text-slate-500">
              <p className="text-4xl mb-3">📂</p>
              <p className="font-medium text-slate-700">
                Arrastrá el Excel acá
              </p>
              <p className="text-xs mt-1">
                o hacé click para elegirlo (.xlsx / .xls / .csv)
              </p>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg p-2">
          ❌ {error}
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onVerHistorial}
          className="text-xs text-slate-500 hover:text-slate-700 underline"
        >
          Ver historial de importaciones
        </button>
        <button
          type="button"
          onClick={handlePreview}
          disabled={cargandoPreview || !archivo}
          className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {cargandoPreview ? "⏳ Procesando…" : "Siguiente → Mapear columnas"}
        </button>
      </div>
    </div>
  );
}