import { useState, useEffect, useCallback } from "react";
import { api } from "../../api/client";

const fmtFecha = new Intl.DateTimeFormat("es-AR", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

function formatearFecha(iso) {
  if (!iso) return "—";
  try {
    return fmtFecha.format(new Date(iso));
  } catch {
    return iso;
  }
}

function totalReporte(r) {
  if (!r) return 0;
  return (
    (r.nuevos ?? 0) +
    (r.actualizados ?? 0) +
    (r.sinCambios ?? 0) +
    (r.noEnImport ?? 0)
  );
}

export default function HistorialImportaciones({ productos }) {
  const [importaciones, setImportaciones] = useState([]);
  const [listaCatalogo, setListaCatalogo] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const [resImport, resCatalogo] = await Promise.all([
        api.importarImportaciones(),
        api.catalogoMaestroImportacionesLista(),
      ]);
      setImportaciones(
        Array.isArray(resImport?.importaciones) ? resImport.importaciones : [],
      );
      setListaCatalogo(
        Array.isArray(resCatalogo?.importaciones)
          ? resCatalogo.importaciones
          : [],
      );
    } catch (e) {
      setError(e?.message || "No se pudo cargar el historial");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  if (cargando) {
    return (
      <div className="bg-white rounded-lg border border-slate-200 p-8 text-center text-slate-500">
        Cargando historial…
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg border border-red-200 p-8 text-center">
        <p className="text-red-700 text-sm mb-3">⚠️ {error}</p>
        <button
          type="button"
          onClick={cargar}
          className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-sm font-medium rounded-lg"
        >
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-800">
              🕑 Importaciones realizadas
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {importaciones.length} registro
              {importaciones.length !== 1 ? "s" : ""} · endpoint{" "}
              <code className="text-[10px]">/api/importar/importaciones</code>
            </p>
          </div>
          <button
            type="button"
            onClick={cargar}
            className="px-3 py-1.5 text-xs rounded bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium"
          >
            ↻ Refrescar
          </button>
        </div>

        {importaciones.length === 0 ? (
          <div className="px-4 py-10 text-center text-slate-500 text-sm">
            Todavía no se hizo ninguna importación.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr className="text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">
                  <th className="px-3 py-2">Fecha</th>
                  <th className="px-3 py-2">Archivo</th>
                  <th className="px-3 py-2 text-right">Nuevos</th>
                  <th className="px-3 py-2 text-right">Actualizados</th>
                  <th className="px-3 py-2 text-right">Sin cambios</th>
                  <th className="px-3 py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {importaciones.map((r, i) => (
                  <tr
                    key={r.importacionId || i}
                    className="border-b border-slate-100 hover:bg-slate-50"
                  >
                    <td className="px-3 py-2 text-slate-700 whitespace-nowrap">
                      {formatearFecha(r.fecha)}
                    </td>
                    <td className="px-3 py-2 text-slate-700">
                      <span className="font-mono text-xs">
                        {r.nombreArchivo || "—"}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-emerald-700">
                      {r.nuevos ?? 0}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-blue-700">
                      {r.actualizados ?? 0}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-slate-600">
                      {r.sinCambios ?? 0}
                    </td>
                    <td className="px-3 py-2 text-right font-mono font-semibold text-slate-800">
                      {totalReporte(r)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
          <h3 className="text-sm font-semibold text-slate-800">
            📦 Importaciones que tocaron el catálogo maestro
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {listaCatalogo.length} registro
            {listaCatalogo.length !== 1 ? "s" : ""} · endpoint{" "}
            <code className="text-[10px]">
              /api/catalogo-maestro/importaciones/lista
            </code>
          </p>
        </div>

        {listaCatalogo.length === 0 ? (
          <div className="px-4 py-10 text-center text-slate-500 text-sm">
            Sin registros todavía.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr className="text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">
                  <th className="px-3 py-2">Fecha</th>
                  <th className="px-3 py-2">Importación ID</th>
                  <th className="px-3 py-2 text-right">Maestro antes</th>
                  <th className="px-3 py-2 text-right">Maestro después</th>
                  <th className="px-3 py-2 text-right">Conflictos</th>
                </tr>
              </thead>
              <tbody>
                {listaCatalogo.map((r, i) => (
                  <tr
                    key={r.importacionId || i}
                    className="border-b border-slate-100 hover:bg-slate-50"
                  >
                    <td className="px-3 py-2 text-slate-700 whitespace-nowrap">
                      {formatearFecha(r.fecha)}
                    </td>
                    <td className="px-3 py-2 text-slate-700">
                      <span className="font-mono text-xs">
                        {r.importacionId || "—"}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-slate-600">
                      {r.totalMaestroAntes ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-slate-800">
                      {r.totalMaestroDespues ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      {Array.isArray(r.conflictos) && r.conflictos.length > 0 ? (
                        <span className="text-orange-700">
                          {r.conflictos.length}
                        </span>
                      ) : (
                        <span className="text-slate-400">0</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}