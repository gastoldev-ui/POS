import { useMemo } from "react";

const TARJETAS = [
  { key: "nuevos", label: "Nuevos", color: "emerald" },
  { key: "actualizados", label: "Actualizados", color: "blue" },
  { key: "sinCambios", label: "Sin cambios", color: "slate" },
  { key: "noEnImport", label: "No en import", color: "amber" },
  { key: "conflictos", label: "Conflictos", color: "orange" },
  { key: "erroresNormalizacion", label: "Errores norm.", color: "red" },
];

const COLORES = {
  emerald: "bg-emerald-50 border-emerald-200 text-emerald-700",
  blue: "bg-blue-50 border-blue-200 text-blue-700",
  slate: "bg-slate-50 border-slate-200 text-slate-700",
  amber: "bg-amber-50 border-amber-200 text-amber-700",
  orange: "bg-orange-50 border-orange-200 text-orange-700",
  red: "bg-red-50 border-red-200 text-red-700",
};

const MAX_DETALLE = 10;

export default function ReporteImportacion({ reporte, onCerrar, onVerHistorial }) {
  const conteos = useMemo(() => {
    return {
      nuevos: reporte?.nuevos ?? 0,
      actualizados: reporte?.actualizados ?? 0,
      sinCambios: reporte?.sinCambios ?? 0,
      noEnImport: reporte?.noEnImport ?? 0,
      conflictos: Array.isArray(reporte?.conflictos)
        ? reporte.conflictos.length
        : 0,
      erroresNormalizacion: Array.isArray(reporte?.erroresNormalizacion)
        ? reporte.erroresNormalizacion.length
        : 0,
    };
  }, [reporte]);

  const conflictos = Array.isArray(reporte?.conflictos)
    ? reporte.conflictos
    : [];
  const errores = Array.isArray(reporte?.erroresNormalizacion)
    ? reporte.erroresNormalizacion
    : [];

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold text-slate-800">
            ✅ Importación completada
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            {reporte?.nombreArchivo ? (
              <>
                Archivo: <span className="font-mono">{reporte.nombreArchivo}</span>
                {reporte?.importacionId && (
                  <>
                    {" · "}
                    ID: <span className="font-mono">{reporte.importacionId}</span>
                  </>
                )}
              </>
            ) : (
              <>ID: <span className="font-mono">{reporte?.importacionId || "—"}</span></>
            )}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
        {TARJETAS.map((t) => (
          <div
            key={t.key}
            className={`rounded-lg border p-3 ${COLORES[t.color]}`}
          >
            <p className="text-[10px] font-bold uppercase tracking-wide opacity-80">
              {t.label}
            </p>
            <p className="text-2xl font-black leading-tight mt-0.5">
              {conteos[t.key]}
            </p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 mb-5 text-xs">
        <div className="bg-slate-50 rounded-lg p-2">
          <p className="text-[10px] text-slate-500 uppercase">Catálogo antes</p>
          <p className="font-bold text-slate-800">
            {reporte?.totalMaestroAntes ?? "—"}
          </p>
        </div>
        <div className="bg-slate-50 rounded-lg p-2">
          <p className="text-[10px] text-slate-500 uppercase">Catálogo después</p>
          <p className="font-bold text-slate-800">
            {reporte?.totalMaestroDespues ?? "—"}
          </p>
        </div>
      </div>

      {conflictos.length > 0 && (
        <div className="mb-4">
          <h4 className="text-xs font-semibold text-orange-700 uppercase mb-2">
            ⚠️ Conflictos ({conflictos.length})
          </h4>
          <div className="border border-orange-200 bg-orange-50 rounded-lg p-3 max-h-48 overflow-y-auto">
            <ul className="space-y-1 text-xs">
              {conflictos.slice(0, MAX_DETALLE).map((c, i) => (
                <li key={i} className="text-orange-800">
                  <span className="font-mono font-semibold">
                    {c.sku || "?"}
                  </span>
                  {" — "}
                  {c.motivo || "sin motivo"}
                  {c.tipo && (
                    <span className="text-orange-600"> ({c.tipo})</span>
                  )}
                </li>
              ))}
            </ul>
            {conflictos.length > MAX_DETALLE && (
              <p className="text-[10px] text-orange-600 mt-2">
                … y {conflictos.length - MAX_DETALLE} más
              </p>
            )}
          </div>
        </div>
      )}

      {errores.length > 0 && (
        <div className="mb-4">
          <h4 className="text-xs font-semibold text-red-700 uppercase mb-2">
            ❌ Errores de normalización ({errores.length})
          </h4>
          <div className="border border-red-200 bg-red-50 rounded-lg p-3 max-h-48 overflow-y-auto">
            <ul className="space-y-1 text-xs">
              {errores.slice(0, MAX_DETALLE).map((e, i) => (
                <li key={i} className="text-red-800">
                  <span className="font-mono font-semibold">
                    {e.sku || "?"}
                  </span>
                  {" — "}
                  {e.motivo || "sin motivo"}
                </li>
              ))}
            </ul>
            {errores.length > MAX_DETALLE && (
              <p className="text-[10px] text-red-600 mt-2">
                … y {errores.length - MAX_DETALLE} más
              </p>
            )}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-200">
        <button
          type="button"
          onClick={onVerHistorial}
          className="text-xs text-slate-500 hover:text-slate-700 underline"
        >
          Ver historial
        </button>
        <button
          type="button"
          onClick={onCerrar}
          className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition"
        >
          Cerrar
        </button>
      </div>
    </div>
  );
}