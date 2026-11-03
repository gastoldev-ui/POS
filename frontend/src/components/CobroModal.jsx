// src/components/CobroModal.jsx
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { usePOS } from "../context/POSContext";
import { api } from "../api/client";
import { formatearPrecio } from "../utils/formateo";

const METODOS = [
  { key: "F5", nombre: "Efectivo", pideMonto: true, color: "emerald" },
  { key: "F6", nombre: "Cta. DNI", pideMonto: true, color: "indigo" },
  { key: "F7", nombre: "Débito", pideMonto: true, color: "sky" },
  { key: "F8", nombre: "Transferencia", pideMonto: true, color: "violet" },
];

const METODO_POR_TECLA = Object.fromEntries(METODOS.map((m) => [m.key, m]));
const METODO_DEFAULT = METODOS[0];

function redondear2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function bloquearKeyupResidual() {
  const stop = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };
  window.addEventListener("keyup", stop, true);
  window.addEventListener("keypress", stop, true);
  setTimeout(() => {
    window.removeEventListener("keyup", stop, true);
    window.removeEventListener("keypress", stop, true);
  }, 100);
}

export default function CobroModal({ onCerrar }) {
  const pos = usePOS();

  const [pagos, setPagos] = useState([]);
  const [metodoActivo, setMetodoActivo] = useState(null);
  const [montoTipeado, setMontoTipeado] = useState("");
  const [fase, setFase] = useState("cobro");
  const [error, setError] = useState(null);
  const [opcionImpresion, setOpcionImpresion] = useState(0);
  const [resultadoExito, setResultadoExito] = useState(null);

  const inputMontoRef = useRef(null);

  const total = pos.totales.total;
  const totalPagado = useMemo(
    () => redondear2(pagos.reduce((s, p) => s + p.monto, 0)),
    [pagos],
  );
  const restante = useMemo(
    () => redondear2(total - totalPagado),
    [total, totalPagado],
  );
  const estaCubierto = restante <= 0.001;

  useEffect(() => {
    if (!metodoActivo) return;
    const enfocar = () => {
      inputMontoRef.current?.focus();
      inputMontoRef.current?.select();
    };
    const raf = requestAnimationFrame(enfocar);
    const t = setTimeout(enfocar, 80);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t);
    };
  }, [metodoActivo]);

  useEffect(() => {
    if (fase !== "exito") return;
    const t = setTimeout(() => onCerrar(), 1800);
    return () => clearTimeout(t);
  }, [fase, onCerrar]);

  const seleccionarMetodo = useCallback(
    (metodo) => {
      if (fase !== "cobro") return;
      setError(null);
      if (restante <= 0) return;

      setMetodoActivo(metodo);
      setMontoTipeado(restante.toFixed(2));
    },
    [fase, restante],
  );

  const confirmarMonto = useCallback(() => {
    if (!metodoActivo) return;

    const n = Number(montoTipeado);

    if (!Number.isFinite(n) || n <= 0) {
      setError("Ingresá un monto válido");
      return;
    }
    if (metodoActivo.nombre !== "Efectivo" && n > restante + 0.001) {
      setError(`El monto supera el restante (${formatearPrecio(restante)})`);
      return;
    }

    const nuevoPago = { metodo: metodoActivo.nombre, monto: redondear2(n) };
    const nuevosPagos = [...pagos, nuevoPago];
    const totalPagadoNuevo = redondear2(
      nuevosPagos.reduce((s, p) => s + p.monto, 0),
    );
    const cubierto = totalPagadoNuevo >= total - 0.001;

    setPagos(nuevosPagos);
    setMetodoActivo(null);
    setMontoTipeado("");
    setError(null);

    if (cubierto) {
      setFase("confirmarPago");
    }
  }, [metodoActivo, montoTipeado, restante, pagos, total]);

  const quitarPago = useCallback(
    (idx) => {
      if (fase !== "cobro") return;
      setPagos((prev) => prev.filter((_, i) => i !== idx));
      setError(null);
    },
    [fase],
  );

  const volverACobro = useCallback(() => {
    setFase("cobro");
    setError(null);
  }, []);

  const irAConfirmarPago = useCallback(() => {
    if (!estaCubierto) {
      setError(`Falta cubrir ${formatearPrecio(restante)}`);
      return;
    }
    setFase("confirmarPago");
  }, [estaCubierto, restante]);

  const irAElegirImpresion = useCallback(() => {
    setOpcionImpresion(0);
    setFase("elegirImpresion");
    setError(null);
  }, []);

  const confirmarCobro = useCallback(
    async (debeImprimir) => {
      setFase("procesando");
      setError(null);
      try {
        const ticket = pos.construirTicket(pagos);
        const data = await api.posVenta(ticket, { imprimir: debeImprimir });
        setResultadoExito({
          debeImprimir,
          impresion: data.impresion || null,
          total: ticket.total,
        });
        setFase("exito");
        pos.vaciar();
        bloquearKeyupResidual();
      } catch (err) {
        setError(err.message);
        setFase("cobro");
      }
    },
    [pagos, pos],
  );

  useEffect(() => {
    const handler = (e) => {
      if (["F5", "F6", "F7", "F8"].includes(e.key)) {
        e.preventDefault();
        e.stopPropagation();
      }

      if (fase === "exito") {
        if (e.key === "Enter" || e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          bloquearKeyupResidual();
          onCerrar();
        }
        return;
      }

      if (fase === "procesando") return;

      if (fase === "elegirImpresion") {
        if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
          e.preventDefault();
          e.stopPropagation();
          setOpcionImpresion((v) => (v === 0 ? 1 : 0));
          return;
        }
        if (e.key === "Enter") {
          e.preventDefault();
          e.stopPropagation();
          confirmarCobro(opcionImpresion === 0);
          return;
        }
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          setFase("confirmarPago");
          return;
        }
        return;
      }

      if (fase === "confirmarPago") {
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          volverACobro();
          return;
        }
        if (e.key === "Enter") {
          e.preventDefault();
          e.stopPropagation();
          irAElegirImpresion();
          return;
        }
        return;
      }

      if (fase !== "cobro") return;

      if (METODO_POR_TECLA[e.key]) {
        e.preventDefault();
        e.stopPropagation();
        seleccionarMetodo(METODO_POR_TECLA[e.key]);
        return;
      }

      if (metodoActivo) {
        if (e.key === "Escape") {
          e.preventDefault();
          setMetodoActivo(null);
          setMontoTipeado("");
          setError(null);
          return;
        }
        // FIX: Si el foco está en el input de monto, dejamos que el Enter
        // lo maneje el propio input (onKeyDown) para que lea el estado actualizado.
        if (e.key === "Enter") {
          if (document.activeElement === inputMontoRef.current) {
            return;
          }
          e.preventDefault();
          e.stopPropagation();
          confirmarMonto();
          return;
        }
        const enInput = document.activeElement === inputMontoRef.current;
        if (!enInput && /^[0-9]$/.test(e.key)) {
          e.preventDefault();
          e.stopPropagation();
          inputMontoRef.current?.focus();
          setMontoTipeado((prev) => prev + e.key);
          return;
        }
        return;
      }

      if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        if (pagos.length === 0) {
          seleccionarMetodo(METODO_DEFAULT);
          return;
        }
        if (estaCubierto) {
          irAConfirmarPago();
        } else {
          setError(`Falta cubrir ${formatearPrecio(restante)}`);
        }
        return;
      }

      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        if (pagos.length > 0) {
          setPagos([]);
          setError(null);
        } else {
          bloquearKeyupResidual();
          onCerrar();
        }
        return;
      }

      if (e.key === "Backspace" || e.key === "Delete") {
        if (pagos.length > 0) {
          e.preventDefault();
          e.stopPropagation();
          quitarPago(pagos.length - 1);
        }
        return;
      }
    };

    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [
    fase,
    metodoActivo,
    pagos,
    estaCubierto,
    restante,
    opcionImpresion,
    seleccionarMetodo,
    irAConfirmarPago,
    irAElegirImpresion,
    confirmarCobro,
    quitarPago,
    volverACobro,
    onCerrar,
  ]);

  if (fase === "exito") {
    return (
      <Overlay>
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
          <div className="bg-emerald-600 p-6 text-center">
            <p className="text-6xl mb-2">✅</p>
            <h3 className="text-2xl font-black text-white">Venta registrada</h3>
          </div>
          <div className="p-6 text-center">
            <p className="text-4xl font-black text-slate-800 mb-4">
              {formatearPrecio(resultadoExito?.total ?? total)}
            </p>
            <p className="text-sm text-slate-600 mb-4">
              {resultadoExito?.debeImprimir
                ? resultadoExito?.impresion?.success
                  ? "🖨️ Ticket enviado a impresora"
                  : `⚠️ Impresora: ${resultadoExito?.impresion?.error || "error desconocido"}`
                : "🚫 Ticket no impreso"}
            </p>
            <p className="text-[11px] text-slate-400 font-mono">
              Volviendo al POS… (Enter para cerrar ya)
            </p>
          </div>
        </div>
      </Overlay>
    );
  }

  if (fase === "confirmarPago") {
    return (
      <Overlay>
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
          <div className="bg-emerald-600 p-4 text-center">
            <h3 className="text-2xl font-black text-white">Confirmar Pago</h3>
          </div>
          <div className="p-6">
            <div className="text-center mb-6">
              <p className="text-sm font-semibold text-slate-500 uppercase tracking-widest mb-1">
                Total a Cobrar
              </p>
              <p className="text-5xl font-black text-slate-800">
                {formatearPrecio(total)}
              </p>
            </div>

            <ResumenPagos pagos={pagos} total={total} />

            {(() => {
              const vuelto = redondear2(Math.max(0, totalPagado - total));
              if (vuelto <= 0.001) return null;
              return (
                <div className="mt-4 p-3 rounded-xl text-center border-2 bg-sky-50 border-sky-200">
                  <p className="text-xs font-bold uppercase text-sky-600">
                    Vuelto
                  </p>
                  <p className="text-3xl font-black text-sky-700">
                    {formatearPrecio(vuelto)}
                  </p>
                </div>
              );
            })()}

            {error && (
              <div className="mt-3 text-xs text-red-600 bg-red-50 p-2 rounded">
                {error}
              </div>
            )}

            <div className="flex gap-3 mt-6">
              <button
                onClick={volverACobro}
                className="flex-1 px-4 py-3 text-slate-600 font-bold bg-slate-100 hover:bg-slate-200 rounded-xl transition"
              >
                ← Volver
                <span className="block text-[10px] font-mono opacity-70 mt-0.5">
                  (Esc)
                </span>
              </button>
              <button
                onClick={irAElegirImpresion}
                className="flex-[2] bg-emerald-600 hover:bg-emerald-700 text-white font-black text-lg py-3 rounded-xl transition shadow-lg"
              >
                ✅ CONFIRMAR PAGO
                <span className="block text-[10px] font-mono opacity-80 mt-0.5">
                  (Enter)
                </span>
              </button>
            </div>
          </div>
        </div>
      </Overlay>
    );
  }

  if (fase === "elegirImpresion" || fase === "procesando") {
    const cargando = fase === "procesando";
    return (
      <Overlay>
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
          <div className="bg-slate-700 p-4 text-center">
            <h3 className="text-2xl font-black text-white">
              ¿Imprimir Ticket?
            </h3>
          </div>
          <div className="p-6">
            <div className="text-center mb-6">
              <p className="text-sm font-semibold text-slate-500 uppercase tracking-widest mb-1">
                Pago confirmado
              </p>
              <p className="text-4xl font-black text-emerald-600">
                {formatearPrecio(total)}
              </p>
            </div>

            <ResumenPagos pagos={pagos} total={total} />

            <div className="mt-6">
              <div className="flex gap-3">
                <button
                  onClick={() => !cargando && confirmarCobro(true)}
                  disabled={cargando}
                  className={`flex-1 py-5 rounded-xl font-black text-lg transition border-2 flex items-center justify-center gap-1 disabled:opacity-60 ${
                    opcionImpresion === 0
                      ? "bg-emerald-600 text-white border-emerald-600 shadow-lg ring-2 ring-offset-2 ring-emerald-400"
                      : "bg-white text-slate-500 border-slate-300 hover:border-emerald-400"
                  }`}
                >
                  <span className="text-xl">◀</span>
                  🖨️ IMPRIMIR
                </button>
                <button
                  onClick={() => !cargando && confirmarCobro(false)}
                  disabled={cargando}
                  className={`flex-1 py-5 rounded-xl font-black text-lg transition border-2 flex items-center justify-center gap-1 disabled:opacity-60 ${
                    opcionImpresion === 1
                      ? "bg-slate-700 text-white border-slate-700 shadow-lg ring-2 ring-offset-2 ring-slate-400"
                      : "bg-white text-slate-500 border-slate-300 hover:border-slate-500"
                  }`}
                >
                  🚫 NO IMPRIMIR
                  <span className="text-xl">▶</span>
                </button>
              </div>
              <p className="text-[11px] text-slate-500 text-center mt-3 font-mono">
                {cargando
                  ? "⏳ Procesando…"
                  : "← → para elegir · Enter para confirmar · Esc para volver"}
              </p>
            </div>

            {error && (
              <div className="mt-3 text-xs text-red-600 bg-red-50 p-2 rounded">
                {error}
              </div>
            )}
          </div>
        </div>
      </Overlay>
    );
  }

  return (
    <Overlay>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="bg-emerald-600 p-4 text-center">
          <h3 className="text-2xl font-black text-white">Cobrar Venta</h3>
        </div>

        <div className="p-6">
          <div className="text-center mb-4">
            <p className="text-sm font-semibold text-slate-500 uppercase tracking-widest mb-1">
              Total a Pagar
            </p>
            <p className="text-5xl font-black text-slate-800">
              {formatearPrecio(total)}
            </p>
          </div>

          {pagos.length > 0 && (
            <div className="mb-4">
              <ResumenPagos pagos={pagos} total={total} onQuitar={quitarPago} />
            </div>
          )}

          <p className="text-xs font-bold text-slate-500 uppercase mb-2 text-center">
            Elegí medio de pago
          </p>
          <div className="grid grid-cols-2 gap-2 mb-3">
            {METODOS.map((m) => {
              const activo = metodoActivo?.key === m.key;
              const deshabilitado = restante <= 0;
              return (
                <button
                  key={m.key}
                  onClick={() => seleccionarMetodo(m)}
                  disabled={deshabilitado}
                  className={`px-3 py-4 rounded-xl font-bold text-base border-2 transition flex items-center justify-between gap-2 disabled:opacity-40 disabled:cursor-not-allowed ${
                    m.color === "emerald"
                      ? "bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100"
                      : m.color === "indigo"
                        ? "bg-indigo-50 text-indigo-800 border-indigo-300 hover:bg-indigo-100"
                        : m.color === "sky"
                          ? "bg-sky-50 text-sky-800 border-sky-300 hover:bg-sky-100"
                          : "bg-violet-50 text-violet-800 border-violet-300 hover:bg-violet-100"
                  } ${activo ? "ring-2 ring-offset-1 ring-emerald-500" : ""}`}
                >
                  <span>{m.nombre}</span>
                  <span className="text-[10px] font-mono bg-white/70 px-1.5 py-0.5 rounded">
                    {m.key}
                  </span>
                </button>
              );
            })}
          </div>

          {metodoActivo && (
            <div className="mb-3">
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                {metodoActivo.nombre} — Monto
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-2xl font-bold">
                  $
                </span>
                <input
                  ref={inputMontoRef}
                  type="number"
                  value={montoTipeado}
                  onChange={(e) => setMontoTipeado(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      e.stopPropagation();
                      confirmarMonto();
                    }
                  }}
                  placeholder={restante.toFixed(2)}
                  className="w-full border-2 border-emerald-400 rounded-xl pl-10 pr-4 py-3 text-2xl font-bold text-right bg-emerald-50 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>
              <p className="text-[10px] text-slate-500 mt-1 text-right">
                Restante a cubrir: <b>{formatearPrecio(restante)}</b> · Enter
                confirma · Esc cancela
              </p>
            </div>
          )}

          {error && (
            <div className="mt-3 text-xs text-red-600 bg-red-50 border border-red-200 p-2 rounded">
              ⚠️ {error}
            </div>
          )}

          <div className="flex gap-3 mt-6">
            <button
              onClick={onCerrar}
              className="flex-1 px-4 py-3 text-slate-600 font-bold bg-slate-100 hover:bg-slate-200 rounded-xl transition"
            >
              Cancelar
              <span className="block text-[10px] font-mono opacity-70 mt-0.5">
                (Esc)
              </span>
            </button>
            <button
              onClick={irAConfirmarPago}
              disabled={!estaCubierto}
              className="flex-[2] bg-emerald-600 hover:bg-emerald-700 text-white font-black text-lg py-3 rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
            >
              ✅ CONFIRMAR COBRO
              <span className="block text-[10px] font-mono opacity-80 mt-0.5">
                (Enter)
              </span>
            </button>
          </div>
        </div>
      </div>
    </Overlay>
  );
}

function Overlay({ children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      {children}
    </div>
  );
}

function ResumenPagos({ pagos, total, onQuitar }) {
  if (pagos.length === 0) return null;
  const totalPagado = pagos.reduce((s, p) => s + p.monto, 0);
  const restante = Math.round((total - totalPagado) * 100) / 100;
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
      <p className="text-[10px] font-bold text-slate-500 uppercase mb-2">
        Pagos cargados
      </p>
      <ul className="space-y-1">
        {pagos.map((p, i) => (
          <li
            key={i}
            className="flex items-center justify-between text-sm bg-white rounded-lg px-3 py-1.5 border border-slate-200"
          >
            <span className="font-semibold text-slate-700">{p.metodo}</span>
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-800">
                {formatearPrecio(p.monto)}
              </span>
              {onQuitar && (
                <button
                  onClick={() => onQuitar(i)}
                  className="text-slate-300 hover:text-red-500 font-bold text-lg leading-none px-1"
                  title="Quitar pago (Backspace)"
                >
                  ×
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-2 pt-2 border-t border-slate-200 flex justify-between text-sm">
        <span className="text-slate-500">Restante:</span>
        <span
          className={`font-black ${restante <= 0.001 ? "text-emerald-600" : "text-red-600"}`}
        >
          {restante <= 0.001 ? "Cubierto ✓" : formatearPrecio(restante)}
        </span>
      </div>
    </div>
  );
}