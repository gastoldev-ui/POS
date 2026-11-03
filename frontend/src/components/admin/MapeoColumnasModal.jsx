// src/components/admin/MapeoColumnasModal.jsx
import { useState, useMemo } from "react";
import { api } from "../../api/client";

export default function MapeoColumnasModal({
  // Control de apertura — el padre decide cuándo montarlo. El modal
  // igual chequea y devuelve null si no está abierto, por las dudas.
  abierto = true,

  // File object del Excel. Se usa SOLO para re-disparar /preview
  // cuando el usuario cambia la fila de header.
  archivo,

  // Datos de la preview inicial (vienen de DropzoneImport).
  headers = [], // [{ nombre, indice }]
  sample = [], // [{ [nombreHeader]: valor }]
  totalFilas = 0,
  camposBase = [], // [{ key, label, requerido, tipo }]
  mapeoSugerido = {}, // { campo: indice }
  headerRowInicial = 0,
  headersDuplicados = [], // [{ nombre, indices, cantidad }]

  // Callbacks.
  onCancelar,
  onConfirmar, // (mapeo, headerRow) => Promise<void>
}) {
  // ---- Estado interno ----
  const [mapeo, setMapeo] = useState(() => ({ ...(mapeoSugerido || {}) }));
  const [headerRow, setHeaderRow] = useState(headerRowInicial);
  const [confirmando, setConfirmando] = useState(false);
  const [recargando, setRecargando] = useState(false);
  const [error, setError] = useState(null);

  // Toggle: mostrar TODAS las columnas del Excel (no solo las mapeadas)
  const [verTodasLasColumnas, setVerTodasLasColumnas] = useState(false);

  // ---- Derivados ----
  const requeridosFaltantes = useMemo(
    () => camposBase.filter((c) => c.requerido && mapeo[c.key] === undefined),
    [camposBase, mapeo],
  );

  // Set de índices usados (para el badge "×N compartida").
  const indicesUsados = useMemo(() => {
    const usados = new Set();
    for (const k of Object.keys(mapeo)) {
      const v = mapeo[k];
      if (typeof v === "number") usados.add(v);
    }
    return usados;
  }, [mapeo]);

  // ---- Acciones ----

  // setCampo guarda ÍNDICE (número) en el mapeo — el backend espera
  // { campo: indice }, no { campo: "nombre" }. Vaciar borra la clave.
  const setCampo = (key, valor) => {
    setMapeo((prev) => {
      const next = { ...prev };
      if (valor === "" || valor === null || valor === undefined) {
        delete next[key];
      } else {
        next[key] = Number(valor);
      }
      return next;
    });
  };

  // Al cambiar fila de header → re-postear /importar/preview con
  // `headerRow` nuevo. El backend devuelve headers/sample/automap
  // recalculados; reseteamos el mapeo al automap nuevo (el usuario
  // puede re-mapear si no le gusta).
  //
  // Por qué re-fetch y no recalcular cliente-side: la detección de
  // header vive en el backend (detectarFilaHeader en
  // excelUniversalService.js). Reimplementarla en el front sería
  // duplicar heurística y divergir con el tiempo.
  const handleCambiarHeaderRow = async (nuevaFila) => {
    if (!archivo) {
      setError("No hay archivo para recalcular el header");
      return;
    }
    setHeaderRow(nuevaFila);
    setRecargando(true);
    setError(null);
    try {
      // OJO: firma del POS = (file, headerRow). Sin nombreProveedor.
      const data = await api.importarPreview(archivo, nuevaFila);
      setMapeo({ ...(data.mapeoInicial || data.automap || {}) });
    } catch (err) {
      setError(`Error recargando preview: ${err.message}`);
    } finally {
      setRecargando(false);
    }
  };

  // Confirmar: si faltan requeridos, no deja. Si no, delega al padre
  // (que es el que hace POST /confirmar y maneja el reporte).
  //
  // Doble submit: el `confirmando` + `disabled` del botón cubren el
  // doble click normal. El padre (DropzoneImport) además tiene su
  // propio guard de ref por si el usuario hace doble click en <16ms.
  const handleConfirmar = async () => {
    if (requeridosFaltantes.length > 0) {
      setError(
        `Faltan mapear: ${requeridosFaltantes.map((c) => c.label).join(", ")}`,
      );
      return;
    }
    setConfirmando(true);
    setError(null);
    try {
      await onConfirmar?.(mapeo, headerRow);
    } catch (err) {
      setError(err.message);
    } finally {
      setConfirmando(false);
    }
  };

  // ¿El header de ese índice está duplicado en el Excel?
  const esHeaderDuplicado = (indice) => {
    return headersDuplicados.some(
      (d) => Array.isArray(d.indices) && d.indices.includes(indice),
    );
  };

  // Label corto para un índice de columna (para thead del preview).
  const labelColumna = (indice) => {
    const h = headers.find((x) => x.indice === indice);
    if (!h) return `col ${indice + 1}`;
    if (esHeaderDuplicado(indice)) return `${h.nombre} [col ${indice + 1}]`;
    return h.nombre;
  };

  // Lee un valor del sample por índice de columna, con fallback a
  // claves con sufijo `__indice` (el backend las agrega cuando hay
  // duplicados de header para que no se pisen en el objeto sample).
  const leerValorSample = (fila, indice) => {
    const h = headers.find((x) => x.indice === indice);
    if (!h) return "";
    const dup = esHeaderDuplicado(indice);
    const clavesPosibles = dup
      ? [`${h.nombre}__${indice}`]
      : [h.nombre, h.nombre.trim(), `${h.nombre}__${indice}`];
    for (const clave of clavesPosibles) {
      if (clave in fila) return fila[clave];
    }
    return "";
  };

  // Columnas a renderizar en el preview.
  //  - Modo normal: solo las mapeadas, en el orden de `camposBase`.
  //  - Modo "ver todas": todas las columnas del Excel; las no
  //    mapeadas quedan en gris.
  const columnasPreview = useMemo(() => {
    if (verTodasLasColumnas) {
      return headers.map(({ indice, nombre }) => {
        const campoMapeado = Object.entries(mapeo).find(
          ([, v]) => v === indice,
        );
        const key = campoMapeado ? campoMapeado[0] : null;
        return {
          indice,
          nombreExcel: nombre,
          key,
          esMapeada: Boolean(key),
        };
      });
    }

    // Orden: camposBase primero; después los campos que no estén en
    // camposBase (por si el back agrega alguno en el futuro).
    const ordenadas = [];
    const keysVistas = new Set();

    for (const campo of camposBase) {
      if (typeof mapeo[campo.key] === "number") {
        ordenadas.push({
          indice: mapeo[campo.key],
          key: campo.key,
          labelCampo: campo.label,
        });
        keysVistas.add(campo.key);
      }
    }
    for (const [key, indice] of Object.entries(mapeo)) {
      if (!keysVistas.has(key) && typeof indice === "number") {
        ordenadas.push({ indice, key, labelCampo: key });
      }
    }
    return ordenadas;
  }, [verTodasLasColumnas, headers, mapeo, camposBase]);

  // ---- Guard de montaje ----
  // El padre decide cuándo renderizarnos con `abierto`. Si no está
  // abierto, no pintamos nada (ni siquiera un overlay transparente).
  if (!abierto) return null;

  // ---- Render ----

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-3">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-6xl max-h-[92vh] flex flex-col">
        {/* HEADER DEL MODAL */}
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between flex-shrink-0">
          <div className="min-w-0">
            <h2 className="font-bold text-slate-800">Mapear columnas</h2>
            <p className="text-xs text-slate-500 mt-0.5 truncate">
              {archivo?.name} · {totalFilas} filas detectadas
            </p>
          </div>
          <button
            type="button"
            onClick={onCancelar}
            className="text-slate-400 hover:text-slate-600 text-xl leading-none flex-shrink-0 ml-3"
            title="Cerrar"
          >
            ×
          </button>
        </div>

        {/* BARRA: FILA DE HEADER */}
        <div className="px-4 py-2 border-b border-slate-200 bg-slate-50 flex items-center gap-2 flex-wrap flex-shrink-0">
          <label className="text-xs font-medium text-slate-700">
            Fila de cabecera:
          </label>
          <select
            value={headerRow}
            onChange={(e) => handleCambiarHeaderRow(Number(e.target.value))}
            disabled={recargando || confirmando}
            className="text-xs border border-slate-300 rounded px-1.5 py-1 bg-white !text-slate-900 max-w-[180px] disabled:opacity-50"
          >
            {Array.from({ length: 15 }, (_, i) => (
              <option key={i} value={i}>
                Fila {i + 1} {i === headerRowInicial ? "(auto-detectada)" : ""}
              </option>
            ))}
          </select>
          {recargando && (
            <span className="text-xs text-indigo-600">⏳ Recalculando...</span>
          )}
          <span className="text-[10px] text-slate-500 ml-2">
            Si la primera fila es un título/logo, subí el número hasta ver las
            columnas reales.
          </span>
        </div>

        {/* AVISO: HEADERS DUPLICADOS */}
        {headersDuplicados.length > 0 && (
          <div className="px-4 pt-3 flex-shrink-0">
            <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded p-2">
              ⚠️ <strong>Columnas con nombre repetido:</strong>{" "}
              {headersDuplicados
                .map(
                  (d) =>
                    `"${d.nombre}" (${d.cantidad} veces, cols ${d.indices
                      .map((i) => i + 1)
                      .join(", ")})`,
                )
                .join(" · ")}
              <p className="mt-1 text-[10px] text-amber-700">
                Cada columna se puede mapear por separado. Solo se rechaza si
                asignás <strong>la misma columna</strong> a dos campos base.
              </p>
            </div>
          </div>
        )}

        {/* CONTENIDO SCROLLEABLE */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
          {/* SECCIÓN 1: MAPEO */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-slate-600 uppercase">
                Campos Dulce Reino
              </h3>
              <span className="text-[10px] text-slate-400">
                {Object.keys(mapeo).length} campos mapeados ·{" "}
                {indicesUsados.size} columna
                {indicesUsados.size !== 1 ? "s" : ""} usada
                {indicesUsados.size !== 1 ? "s" : ""}
                {Object.keys(mapeo).length > indicesUsados.size && (
                  <span className="text-emerald-600 ml-1">
                    (✓ reutilización activa)
                  </span>
                )}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {camposBase.map((campo) => {
                const indiceActual = mapeo[campo.key];
                const colActual =
                  typeof indiceActual === "number" ? String(indiceActual) : "";
                const fueAutomatico =
                  mapeoSugerido[campo.key] === indiceActual &&
                  typeof indiceActual === "number";
                return (
                  <div
                    key={campo.key}
                    className="flex items-center gap-2 bg-slate-50 rounded px-2 py-1.5"
                  >
                    <label className="flex-1 text-xs min-w-0">
                      <span className="font-medium text-slate-700 block truncate">
                        {campo.label}
                        {campo.requerido && (
                          <span className="text-red-500 ml-0.5">*</span>
                        )}
                        {fueAutomatico && (
                          <span className="ml-1 text-[10px] text-emerald-600">
                            ✨
                          </span>
                        )}
                      </span>
                    </label>
                    <select
                      value={colActual}
                      onChange={(e) => setCampo(campo.key, e.target.value)}
                      disabled={confirmando}
                      className={`text-xs border rounded px-1.5 py-1 bg-white !text-slate-900 w-[150px] flex-shrink-0 ${
                        colActual !== "" &&
                        indicesUsados.has(Number(colActual)) &&
                        Object.values(mapeo).filter(
                          (v) => v === Number(colActual),
                        ).length > 1
                          ? "border-emerald-400 ring-1 ring-emerald-200"
                          : "border-slate-300"
                      }`}
                    >
                      <option value="">— sin mapear —</option>
                      {headers.map(({ nombre, indice }) => {
                        const dup = esHeaderDuplicado(indice);
                        const cantUsos = Object.values(mapeo).filter(
                          (v) => v === indice,
                        ).length;
                        const compartida = cantUsos > 1;
                        return (
                          <option key={indice} value={indice}>
                            {dup ? `${nombre} [col ${indice + 1}]` : nombre}
                            {compartida
                              ? ` (✓ compartida con ${cantUsos - 1})`
                              : ""}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                );
              })}
            </div>

            {error && (
              <div className="mt-3 bg-red-50 text-red-700 text-xs rounded p-2">
                ❌ {error}
              </div>
            )}
          </section>

          {/* SECCIÓN 2: PREVIEW */}
          <section>
            <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
              <h3 className="text-xs font-semibold text-slate-600 uppercase">
                Preview (primeras filas)
              </h3>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 text-[11px] text-slate-600 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={verTodasLasColumnas}
                    onChange={(e) => setVerTodasLasColumnas(e.target.checked)}
                    className="rounded"
                  />
                  Ver todas las columnas del Excel
                </label>
                <span className="text-[10px] text-slate-400">
                  {columnasPreview.length} columna
                  {columnasPreview.length !== 1 ? "s" : ""}
                </span>
              </div>
            </div>

            <div className="border border-slate-200 rounded overflow-auto max-h-[45vh]">
              <table className="text-[11px] w-full border-collapse">
                <thead className="bg-slate-100 sticky top-0 z-10">
                  {/* Fila 1: nombre del campo Dulce Reino */}
                  <tr>
                    {columnasPreview.length === 0 ? (
                      <th className="px-2 py-1.5 text-slate-400 italic font-normal text-left">
                        Mapeá campos para ver el preview
                      </th>
                    ) : (
                      columnasPreview.map((col) => {
                        const cantUsos = Object.values(mapeo).filter(
                          (v) => v === col.indice,
                        ).length;
                        const compartida = cantUsos > 1;
                        return (
                          <th
                            key={`campo-${col.indice}`}
                            className={`px-2 py-1.5 text-left font-semibold whitespace-nowrap border-b border-slate-200 min-w-[120px] ${
                              col.esMapeada === false
                                ? "text-slate-400"
                                : "text-slate-700"
                            }`}
                          >
                            <span className="flex items-center gap-1">
                              {col.labelCampo ??
                                (col.key
                                  ? camposBase.find((c) => c.key === col.key)
                                      ?.label || col.key
                                  : `col ${col.indice + 1}`)}
                              {compartida && (
                                <span
                                  className="text-[9px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded-full"
                                  title={`Esta columna del Excel se usa en ${cantUsos} campos`}
                                >
                                  ×{cantUsos}
                                </span>
                              )}
                            </span>
                          </th>
                        );
                      })
                    )}
                  </tr>
                  {/* Fila 2: nombre original del Excel + número de columna */}
                  {columnasPreview.length > 0 && (
                    <tr>
                      {columnasPreview.map((col) => (
                        <th
                          key={`excel-${col.indice}`}
                          className={`px-2 py-1 text-left font-normal text-[10px] whitespace-nowrap border-b border-slate-200 bg-slate-50 ${
                            col.esMapeada === false
                              ? "text-slate-300"
                              : "text-slate-500"
                          }`}
                        >
                          {col.nombreExcel ?? labelColumna(col.indice)}
                          <span className="text-slate-400 ml-1">
                            [col {col.indice + 1}]
                          </span>
                        </th>
                      ))}
                    </tr>
                  )}
                </thead>
                <tbody>
                  {sample.slice(0, 10).map((fila, i) => (
                    <tr key={i} className="border-b last:border-0">
                      {columnasPreview.map((col) => {
                        const valor = leerValorSample(fila, col.indice);
                        return (
                          <td
                            key={`${i}-${col.indice}`}
                            className={`px-2 py-1 max-w-[200px] truncate ${
                              col.esMapeada === false
                                ? "text-slate-300"
                                : "text-slate-700"
                            }`}
                            title={String(valor ?? "")}
                          >
                            {String(valor ?? "")}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                  {sample.length === 0 && columnasPreview.length > 0 && (
                    <tr>
                      <td
                        colSpan={columnasPreview.length}
                        className="px-2 py-4 text-center text-slate-400 italic"
                      >
                        No hay filas de datos en este Excel.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <p className="text-[10px] text-slate-400 mt-2">
              {sample.length} filas mostradas de {totalFilas} · Arrastrá
              horizontal si hay muchas columnas
            </p>
          </section>
        </div>

        {/* FOOTER */}
        <div className="px-4 py-3 border-t border-slate-200 flex justify-between items-center flex-shrink-0 bg-white">
          <p className="text-xs text-slate-500">
            {requeridosFaltantes.length > 0
              ? `Faltan ${requeridosFaltantes.length} campos requeridos`
              : "✅ Listo para importar"}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onCancelar}
              disabled={confirmando}
              className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirmar}
              disabled={confirmando || requeridosFaltantes.length > 0}
              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium rounded-lg disabled:opacity-50"
            >
              {confirmando ? "⏳ Importando..." : "✅ Confirmar importación"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}