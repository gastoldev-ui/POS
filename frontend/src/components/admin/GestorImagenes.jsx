// frontend/src/components/admin/GestorImagenes.jsx
//
// Gestor de imágenes de un producto (hasta 3).
// Componente puramente visual: recibe el producto y callbacks, no llama a la API.
// Uso: <GestorImagenes imagenes={producto.imagenes} onCambio={...} />

import { useState, useCallback } from "react";

const MAX_IMAGENES = 3;
const Acepto = ["image/jpeg", "image/png", "image/webp"];

/**
 * Lee un archivo con FileReader y devuelve una data URL.
 */
function leerArchivoComoDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("No se pudo leer el archivo"));
    reader.readAsDataURL(file);
  });
}

/**
 * Valida tipo y tamaño antes de aceptar.
 * Devuelve { ok, motivo }.
 */
function validarArchivo(file) {
  if (!Acepto.includes(file.type)) {
    return { ok: false, motivo: "Formato no soportado. Usá JPG, PNG o WEBP." };
  }
  const maxMb = 2;
  if (file.size > maxMb * 1024 * 1024) {
    return {
      ok: false,
      motivo: `La imagen supera los ${maxMb}MB. Reducila antes de subirla.`,
    };
  }
  return { ok: true };
}

export default function GestorImagenes({ imagenes = [], onCambio }) {
  const [arrastrando, setArrastrando] = useState(false);
  const [error, setError] = useState(null);

  const lista = Array.isArray(imagenes) ? [...imagenes] : [];

  // ==================== AGREGAR ====================

  const agregarArchivos = useCallback(
    async (files) => {
      setError(null);
      if (!files.length) return;

      const espacio = MAX_IMAGENES - lista.length;
      if (espacio <= 0) {
        setError(`Límite de ${MAX_IMAGENES} imágenes por producto.`);
        return;
      }

      const aAgregar = Array.from(files).slice(0, espacio);
      const invalidos = [];

      for (const f of aAgregar) {
        const v = validarArchivo(f);
        if (!v.ok) {
          invalidos.push(`${f.name}: ${v.motivo}`);
          continue;
        }
        try {
          const dataUrl = await leerArchivoComoDataUrl(f);
          lista.push({
            archivo: dataUrl, // placeholder: el servidor asigna el nombre real
            alt: "",
            orden: lista.length,
            __archivoLocal: f, // marca interna para saber que es nuevo
            __dataUrl: dataUrl,
          });
        } catch {
          invalidos.push(`${f.name}: no se pudo leer`);
        }
      }

      if (invalidos.length) {
        setError(invalidos.join(" · "));
      }

      onCambio(lista);
    },
    [lista, onCambio],
  );

  // ==================== QUITAR ====================

  const quitarImagen = useCallback(
    (idx) => {
      setError(null);
      const siguiente = lista.filter((_, i) => i !== idx);
      onCambio(siguiente);
    },
    [lista, onCambio],
  );

  // ==================== PRINCIPAL (mover al índice 0) ====================

  const hacerPrincipal = useCallback(
    (idx) => {
      if (idx <= 0 || !lista[idx]) return;
      setError(null);
      const [mover] = lista.splice(idx, 1);
      lista.unshift(mover);
      const reindexada = lista.map((img, i) => ({ ...img, orden: i }));
      onCambio(reindexada);
    },
    [lista, onCambio],
  );

  // ==================== REORDENAR (subir/bajar) ====================

  const mover = useCallback(
    (idx, direccion) => {
      const destino = idx + direccion;
      if (destino < 0 || destino >= lista.length) return;
      setError(null);
      const siguiente = [...lista];
      [siguiente[idx], siguiente[destino]] = [
        siguiente[destino],
        siguiente[idx],
      ];
      const reindexada = siguiente.map((img, i) => ({ ...img, orden: i }));
      onCambio(reindexada);
    },
    [lista, onCambio],
  );

  // ==================== DROPZONE ====================

  const onDrop = useCallback(
    (e) => {
      e.preventDefault();
      setArrastrando(false);
      agregarArchivos(Array.from(e.dataTransfer.files));
    },
    [agregarArchivos],
  );

  const onDragOver = useCallback((e) => {
    e.preventDefault();
    setArrastrando(true);
  }, []);

  const onDragLeave = useCallback((e) => {
    e.preventDefault();
    setArrastrando(false);
  }, []);

  const inputRef = useCallback(() => {}, []);

  const abrirSelector = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.accept = Acepto.join(",");
    input.onchange = (e) => agregarArchivos(Array.from(e.target.files || []));
    input.click();
  }, [agregarArchivos]);

  // ==================== RENDER ====================

  const puedeAgregar = lista.length < MAX_IMAGENES;

  return (
    <div className="space-y-3">
      {/* Dropzone / selector */}
      <div
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors ${
          arrastrando
            ? "bg-blue-50 border-blue-400"
            : puedeAgregar
            ? "bg-white border-slate-300 hover:border-blue-400"
            : "bg-slate-100 border-slate-200 opacity-60 cursor-not-allowed"
        }`}
        onClick={() => puedeAgregar && abrirSelector()}
      >
        {puedeAgregar ? (
          <>
            <p className="text-sm font-medium text-slate-700 mb-1">
              {arrastrando ? "Suelta las imágenes aquí" : "Subí imágenes"}
            </p>
            <p className="text-xs text-slate-500 mb-2">
              Arrastra un archivo o hacé clic para seleccionar
            </p>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                abrirSelector();
              }}
              className="px-3 py-1.5 text-sm rounded bg-blue-600 hover:bg-blue-700 text-white"
            >
              Seleccionar archivos
            </button>
            <p className="text-xs text-slate-400 mt-3">
              Máximo {MAX_IMAGENES} por producto · JPG, PNG o WEBP · hasta 2 MB cada una
            </p>
          </>
        ) : (
          <p className="text-sm text-slate-500">
            Límite de {MAX_IMAGENES} imágenes alcanzado.
          </p>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="px-3 py-2 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
          {error}
        </div>
      )}

      {/* Slots */}
      {lista.length > 0 ? (
        <div className="grid grid-cols-3 gap-2">
          {lista.map((img, i) => {
            const esPrincipal = i === 0;
            const esLocal = Boolean(img.__archivoLocal);
            const src = esLocal ? img.__dataUrl : `/img/productos/${img.archivo}`;
            return (
              <div
                key={img.archivo || i}
                className="relative group border rounded-md bg-white p-2"
              >
                <img
                  src={src}
                  alt={img.alt || `Imagen ${i + 1}`}
                  className="w-full h-24 object-cover rounded-md bg-slate-100"
                />
                {/* Badge principal */}
                <span
                  className={`absolute top-1 left-1 px-1.5 py-0.5 rounded text-xs font-bold ${
                    esPrincipal
                      ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
                      : "bg-slate-200 text-slate-600"
                  }`}
                >
                  {esPrincipal ? "Principal" : `Slot ${i + 1}`}
                </span>
                {/* Es nuevo (sin subir aún) */}
                {esLocal && (
                  <span
                    className="absolute top-1 right-1 px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 text-xs font-bold border border-blue-200"
                  >
                    Nuevo
                  </span>
                )}

                <div className="mt-2 flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => hacerPrincipal(i)}
                      disabled={esPrincipal}
                      className={`px-2 py-1 text-xs rounded ${
                        esPrincipal
                          ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                          : "bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200"
                      }`}
                    >
                      ↟ Principal
                    </button>
                    {i > 0 && (
                      <button
                        type="button"
                        onClick={() => mover(i, -1)}
                        className="px-2 py-1 text-xs rounded bg-slate-100 text-slate-700 hover:bg-slate-200"
                      >
                        ↥
                      </button>
                    )}
                    {i < lista.length - 1 && (
                      <button
                        type="button"
                        onClick={() => mover(i, 1)}
                        className="px-2 py-1 text-xs rounded bg-slate-100 text-slate-700 hover:bg-slate-200"
                      >
                        ↧
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => quitarImagen(i)}
                      className="px-2 py-1 text-xs rounded bg-red-50 text-red-700 hover:bg-red-100"
                    >
                      ×
                    </button>
                  </div>
                  <label className="block text-xs text-slate-500">
                    Texto alternativo (alt)
                  </label>
                  <input
                    type="text"
                    value={img.alt || ""}
                    onChange={(e) => {
                      const siguiente = lista.map((x, j) =>
                        j === i ? { ...x, alt: e.target.value } : x,
                      );
                      onCambio(siguiente);
                    }}
                    className="w-full text-xs border border-slate-300 rounded px-2 py-1 focus:ring-1 focus:ring-blue-500"
                    placeholder="Descripción breve"
                  />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="px-4 py-2 bg-slate-50 rounded-lg text-center text-xs text-slate-500">
          Sin imágenes todavía.
        </div>
      )}
    </div>
  );
}
