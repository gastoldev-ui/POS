// frontend/src/components/ArqueoCajaModal.jsx
import { useState, useEffect, useRef } from "react";
import { cerrarCaja } from "../services/posApi.js";
import { formatearPrecio } from "../utils/formateo.js";

/**
 * ============================================================
 * MODAL DE ARQUEO (F4)
 * ============================================================
 *
 * Flujo keyboard-first:
 *   PASO 1 "input":  dos inputs (montoInicial, efectivoDeclarado).
 *                    Enter en el 1° → foco al 2°.
 *                    Enter en el 2° → calcular.
 *                    Esc → cerrar.
 *   PASO 2 "resumen": muestra el resumen del backend.
 *                    Enter → cerrar (modal entero).
 *                    Esc   → volver a "input" SIN resetear montos
 *                            (para corregir y recalcular).
 *                    Botón "← Volver" idem Esc.
 *
 * El backend hace TODAS las cuentas (totalVentas, totalEfectivo,
 * esperadoEnCaja, diferencia). El front solo muestra.
 *
 * Props:
 *   - onCerrar()
 */
export default function ArqueoCajaModal({ onCerrar }) {
  const [fase, setFase] = useState("input"); // "input" | "resumen"
  const [montoInicial, setMontoInicial] = useState("");
  const [efectivoDeclarado, setEfectivoDeclarado] = useState("");
  const [calculando, setCalculando] = useState(false);
  const [resumen, setResumen] = useState(null);
  const [error, setError] = useState(null);

  const inputInicialRef = useRef(null);
  const inputDeclaradoRef = useRef(null);

  // Foco inicial
  useEffect(() => {
    setTimeout(() => {
      inputInicialRef.current?.focus();
      inputInicialRef.current?.select();
    }, 50);
  }, []);

  // ==================== CALCULAR ====================

  const calcular = async () => {
    setCalculando(true);
    setError(null);
    try {
      const r = await cerrarCaja({
        montoInicial: Number(montoInicial) || 0,
        efectivoDeclarado: Number(efectivoDeclarado) || 0,
      });
      setResumen(r);
      setFase("resumen");
    } catch (err) {
      setError(err.message);
    } finally {
      setCalculando(false);
    }
  };

  // ==================== ATAJOS ====================

  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        if (fase === "input" && !calculando) {
          onCerrar?.();
        } else if (fase === "resumen") {
          setFase("input");
        }
        return;
      }

      if (fase === "resumen" && e.key === "Enter") {
        e.preventDefault();
        onCerrar?.();
      }
    };

    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [fase, calculando, onCerrar]);

  // ==================== HANDLERS INPUT ====================

  const onInicialKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      inputDeclaradoRef.current?.focus();
      inputDeclaradoRef.current?.select();
    }
  };

  const onDeclaradoKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      calcular();
    }
  };

  // ==================== RENDER ====================

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* HEADER */}
        <div className="bg-sky-600 p-4 text-center">
          <h3 className="text-2xl font-black text-white">Arqueo de Caja</h3>
          <p className="text-sky-100 text-xs mt-1">F4 · Cierre del día</p>
        </div>

        {fase === "input" && (
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                Monto inicial en caja
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xl font-bold">
                  $
                </span>
                <input
                  ref={inputInicialRef}
                  type="number"
                  inputMode="decimal"
                  value={montoInicial}
                  onChange={(e) => setMontoInicial(e.target.value)}
                  onKeyDown={onInicialKeyDown}
                  placeholder="0.00"
                  className="w-full border-2 border-slate-300 rounded-xl pl-10 pr-4 py-3 text-xl font-bold text-right focus:ring-2 focus:ring-sky-500 focus:border-sky-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                Efectivo declarado
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xl font-bold">
                  $
                </span>
                <input
                  ref={inputDeclaradoRef}
                  type="number"
                  inputMode="decimal"
                  value={efectivoDeclarado}
                  onChange={(e) => setEfectivoDeclarado(e.target.value)}
                  onKeyDown={onDeclaradoKeyDown}
                  placeholder="0.00"
                  className="w-full border-2 border-slate-300 rounded-xl pl-10 pr-4 py-3 text-xl font-bold text-right focus:ring-2 focus:ring-sky-500 focus:border-sky-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg p-2">
                ⚠️ {error}
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={onCerrar}
                disabled={calculando}
                className="flex-1 px-4 py-3 text-slate-600 font-bold bg-slate-100 hover:bg-slate-200 rounded-xl transition disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={calcular}
                disabled={calculando}
                className="flex-[2] bg-sky-600 hover:bg-sky-700 text-white font-black text-base py-3 rounded-xl transition disabled:opacity-50 shadow-lg"
              >
                {calculando ? "⏳ Calculando..." : "🧮 Calcular arqueo"}
              </button>
            </div>
          </div>
        )}

        {fase === "resumen" && resumen && (
          <div className="p-6 space-y-3">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="bg-slate-50 rounded-lg p-2">
                <p className="text-[10px] text-slate-500 uppercase">Ventas</p>
                <p className="font-bold text-slate-800">
                  {resumen.cantidadVentas}
                </p>
              </div>
              <div className="bg-slate-50 rounded-lg p-2">
                <p className="text-[10px] text-slate-500 uppercase">
                  Ventas efectivo
                </p>
                <p className="font-bold text-slate-800">
                  {resumen.cantidadVentasEfectivo}
                </p>
              </div>
              <div className="bg-slate-50 rounded-lg p-2 col-span-2">
                <p className="text-[10px] text-slate-500 uppercase">
                  Total ventas
                </p>
                <p className="font-bold text-slate-800 text-base">
                  {formatearPrecio(resumen.totalVentas)}
                </p>
              </div>
              <div className="bg-slate-50 rounded-lg p-2 col-span-2">
                <p className="text-[10px] text-slate-500 uppercase">
                  Total efectivo
                </p>
                <p className="font-bold text-slate-800 text-base">
                  {formatearPrecio(resumen.totalEfectivo)}
                </p>
              </div>
            </div>

            <div className="border-t border-slate-200 pt-3 space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-600">Monto inicial:</span>
                <span className="font-semibold">
                  {formatearPrecio(resumen.montoInicial)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Esperado en caja:</span>
                <span className="font-semibold">
                  {formatearPrecio(resumen.esperadoEnCaja)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Efectivo declarado:</span>
                <span className="font-semibold">
                  {formatearPrecio(resumen.efectivoDeclarado)}
                </span>
              </div>
            </div>

            <div
              className={`rounded-xl p-4 text-center border-2 ${
                Math.abs(resumen.diferencia) < 0.01
                  ? "bg-emerald-50 border-emerald-200"
                  : resumen.diferencia > 0
                    ? "bg-amber-50 border-amber-200"
                    : "bg-red-50 border-red-200"
              }`}
            >
              <p
                className={`text-xs font-bold uppercase ${
                  Math.abs(resumen.diferencia) < 0.01
                    ? "text-emerald-700"
                    : resumen.diferencia > 0
                      ? "text-amber-700"
                      : "text-red-700"
                }`}
              >
                {Math.abs(resumen.diferencia) < 0.01
                  ? "Caja cuadrada"
                  : resumen.diferencia > 0
                    ? "Sobra efectivo"
                    : "Falta efectivo"}
              </p>
              <p
                className={`text-3xl font-black ${
                  Math.abs(resumen.diferencia) < 0.01
                    ? "text-emerald-700"
                    : resumen.diferencia > 0
                      ? "text-amber-700"
                      : "text-red-700"
                }`}
              >
                {formatearPrecio(Math.abs(resumen.diferencia))}
              </p>
            </div>

            <div className="flex gap-2 mt-2">
              <button
                type="button"
                onClick={() => setFase("input")}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-xl transition"
              >
                ← Volver
                <span className="block text-[10px] font-mono opacity-70 mt-0.5">
                  (Esc)
                </span>
              </button>
              <button
                type="button"
                onClick={onCerrar}
                className="flex-[2] bg-sky-600 hover:bg-sky-700 text-white font-black text-base py-3 rounded-xl transition shadow-lg"
              >
                Cerrar (Enter)
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
