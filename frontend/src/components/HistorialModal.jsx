// src/components/HistorialModal.jsx
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  getVentasPorFecha,
  getResumenDia,
  reimprimirTicket,
} from "../services/posApi";
import { formatearPrecio } from "../utils/formateo";

const FECHA_HOY = () => new Date().toISOString().slice(0, 10);

// Métodos de pago que ofrece el filtro. "Mixto" se resuelve en el
// cliente mirando v.metodoPago === "Mixto".
const FILTROS = [
  { key: "todos", label: "Todos" },
  { key: "Efectivo", label: "Efectivo" },
  { key: "Débito", label: "Débito" },
  { key: "Cta. DNI", label: "Cta. DNI" },
  { key: "Transferencia", label: "Transferencia" },
  { key: "Mixto", label: "Mixto" },
];

// Normaliza los pagos de una venta (contrato nuevo o viejo).
function normalizarPagos(v) {
  if (Array.isArray(v.pagos) && v.pagos.length > 0) {
    return v.pagos.map((p) => ({
      metodo: String(p.metodo || "Efectivo"),
      monto: Number(p.monto) || 0,
    }));
  }
  return [
    { metodo: v.metodoPago || "Efectivo", monto: Number(v.total) || 0 },
  ];
}

// Matchea una venta contra el filtro de método seleccionado.
function matcheaFiltro(venta, filtro) {
  if (filtro === "todos") return true;
  if (filtro === "Mixto") {
    // "Mixto" = tiene más de un pago distinto, o metodoPago === "Mixto".
    const pagos = normalizarPagos(venta);
    const metodos = new Set(pagos.map((p) => p.metodo));
    return metodos.size > 1 || venta.metodoPago === "Mixto";
  }
  return normalizarPagos(venta).some((p) => p.metodo === filtro);
}

export default function HistorialModal({ onCerrar }) {
  // -------------------- Estado de datos --------------------
  const [ventas, setVentas] = useState([]);
  const [resumen, setResumen] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  // -------------------- Estado de UI --------------------
  const [fecha, setFecha] = useState(FECHA_HOY);
  const [busqueda, setBusqueda] = useState("");
  const [filtroMetodo, setFiltroMetodo] = useState("todos");
  const [indiceSel, setIndiceSel] = useState(0);

  // Fase: "lista" | "preview"
  const [fase, setFase] = useState("lista");
  const [ventaPreview, setVentaPreview] = useState(null);

  const [imprimiendo, setImprimiendo] = useState(false);
  const [msjExito, setMsjExito] = useState(null);

  const inputBusquedaRef = useRef(null);
  const inputFechaRef = useRef(null);

  // -------------------- Fetch --------------------

  const cargar = useCallback(async (fechaConsulta) => {
    setCargando(true);
    setError(null);
    try {
      const [ventasData, resumenData] = await Promise.all([
        getVentasPorFecha(fechaConsulta),
        getResumenDia(fechaConsulta).catch(() => null), // resumen es best-effort
      ]);
      setVentas(ventasData);
      setResumen(resumenData);
      setIndiceSel(0);
    } catch (err) {
      // Distinguimos "sin datos" de error real. Si el backend devuelve
      // [], getVentasPorFecha no tira; un throw acá es error de red/servidor.
      setVentas([]);
      setResumen(null);
      setError(err.message || "No se pudieron cargar las ventas");
    } finally {
      setCargando(false);
    }
  }, []);

  // Carga inicial + cada vez que cambia la fecha
  useEffect(() => {
    cargar(fecha);
  }, [fecha, cargar]);

  // Foco inicial en el buscador (solo en fase lista)
  useEffect(() => {
    if (!cargando && fase === "lista") inputBusquedaRef.current?.focus();
  }, [cargando, fase]);

  // -------------------- Filtrado --------------------

  const ventasFiltradas = useMemo(() => {
    const t = busqueda.trim().toLowerCase();
    return ventas.filter((v) => {
      if (!matcheaFiltro(v, filtroMetodo)) return false;
      if (!t) return true;
      const matchId = String(v.id).toLowerCase().includes(t);
      const matchProd = v.items?.some((it) =>
        it.nombre?.toLowerCase().includes(t),
      );
      return matchId || matchProd;
    });
  }, [ventas, busqueda, filtroMetodo]);

  // Resetear índice si cambia el filtro o la búsqueda
  useEffect(() => {
    setIndiceSel(0);
  }, [busqueda, filtroMetodo, fecha]);

  // -------------------- Acciones --------------------

  const abrirPreview = useCallback((venta) => {
    if (!venta) return;
    setVentaPreview(venta);
    setFase("preview");
    setError(null);
    setMsjExito(null);
  }, []);

  const volverALista = useCallback(() => {
    setFase("lista");
    setVentaPreview(null);
    setMsjExito(null);
    setError(null);
  }, []);

  const imprimirPreview = useCallback(async () => {
    if (!ventaPreview || imprimiendo) return;
    setImprimiendo(true);
    setError(null);
    setMsjExito(null);
    try {
      await reimprimirTicket(ventaPreview);
      setMsjExito("✅ Ticket enviado a la impresora");
      setTimeout(() => setMsjExito(null), 2000);
    } catch (err) {
      setError("Error al imprimir: " + err.message);
    } finally {
      setImprimiendo(false);
    }
  }, [ventaPreview, imprimiendo]);

  // -------------------- Teclado (UN SOLO listener) --------------------
  // Fase capture + stopPropagation, igual que antes, pero ahora ramifica
  // según `fase`. No creamos listeners paralelos.

  useEffect(() => {
    const handler = (e) => {
      // ===== FASE PREVIEW =====
      if (fase === "preview") {
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          volverALista();
          return;
        }
        if (e.key === "Enter") {
          e.preventDefault();
          e.stopPropagation();
          imprimirPreview();
          return;
        }
        return;
      }

      // ===== FASE LISTA =====
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onCerrar();
        return;
      }

      // Si el foco está en el input de fecha, dejamos que el navegador
      // maneje flechas/Enter/espacio nativos (date picker). Solo Esc
      // cierra el modal (ya manejado arriba).
      if (document.activeElement === inputFechaRef.current) return;

      if (ventasFiltradas.length === 0) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        e.stopPropagation();
        setIndiceSel((prev) => (prev + 1) % ventasFiltradas.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        e.stopPropagation();
        setIndiceSel(
          (prev) =>
            (prev - 1 + ventasFiltradas.length) % ventasFiltradas.length,
        );
      } else if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        abrirPreview(ventasFiltradas[indiceSel]);
      }
    };

    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [fase, ventasFiltradas, indiceSel, onCerrar, abrirPreview, volverALista, imprimirPreview]);

  // -------------------- Helpers de render --------------------

  const horaDe = (v) =>
    new Date(v.fecha).toLocaleTimeString("es-AR", {
      hour: "2-digit",
      minute: "2-digit",
    });

  // -------------------- RENDER: PREVIEW --------------------

  if (fase === "preview" && ventaPreview) {
    const pagos = normalizarPagos(ventaPreview);
    const totalPagado = pagos.reduce((s, p) => s + p.monto, 0);
    const vuelto = Math.max(
      0,
      Math.round((totalPagado - Number(ventaPreview.total || 0)) * 100) / 100,
    );

    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
          {/* HEADER */}
          <div className="bg-indigo-600 p-4 flex items-center justify-between flex-shrink-0">
            <div>
              <h3 className="text-xl font-black text-white">Vista previa</h3>
              <p className="text-indigo-100 text-xs font-mono">
                Ticket #{ventaPreview.id}
              </p>
            </div>
            <button
              onClick={volverALista}
              className="text-white hover:text-red-200 font-bold text-xl px-2"
              title="Volver (Esc)"
            >
              ✕
            </button>
          </div>

          {/* CUERPO tipo ticket */}
          <div className="flex-1 overflow-y-auto p-5 font-mono text-sm bg-slate-50">
            <div className="text-center mb-2">
              <p className="font-black text-base tracking-wide">DULCE REINO</p>
              <p className="text-xs text-slate-500">Ticket de Venta</p>
            </div>
            <div className="border-t border-dashed border-slate-300 my-2" />
            <div className="flex justify-between text-xs text-slate-600">
              <span>Fecha:</span>
              <span>
                {new Date(ventaPreview.fecha).toLocaleString("es-AR")}
              </span>
            </div>
            <div className="flex justify-between text-xs text-slate-600">
              <span>Ticket #:</span>
              <span>{ventaPreview.id}</span>
            </div>
            <div className="border-t border-dashed border-slate-300 my-2" />

            {/* Items */}
            <ul className="space-y-1">
              {(ventaPreview.items || []).map((it, i) => (
                <li key={i}>
                  <p className="text-slate-800">{it.nombre}</p>
                  <div className="flex justify-between text-xs text-slate-600">
                    <span>
                      {it.cantidad} x {formatearPrecio(it.precioUnitario)}
                    </span>
                    <span>{formatearPrecio(it.subtotal)}</span>
                  </div>
                </li>
              ))}
            </ul>

            <div className="border-t border-dashed border-slate-300 my-2" />
            <div className="flex justify-between font-black text-base text-slate-800">
              <span>TOTAL</span>
              <span>{formatearPrecio(ventaPreview.total)}</span>
            </div>

            <div className="border-t border-dashed border-slate-300 my-2" />
            <p className="text-xs text-slate-500 mb-1">PAGOS:</p>
            <ul className="space-y-0.5">
              {pagos.map((p, i) => (
                <li key={i} className="flex justify-between text-xs">
                  <span>{p.metodo}</span>
                  <span>{formatearPrecio(p.monto)}</span>
                </li>
              ))}
            </ul>
            {vuelto > 0.001 && (
              <div className="flex justify-between text-xs mt-1 font-semibold text-sky-700">
                <span>Vuelto:</span>
                <span>{formatearPrecio(vuelto)}</span>
              </div>
            )}

            <div className="border-t border-dashed border-slate-300 my-3" />
            <p className="text-center text-xs text-slate-500">
              ¡Gracias por su compra!
            </p>
          </div>

          {/* MENSAJES */}
          {msjExito && (
            <div className="px-4 py-2 bg-emerald-50 border-t border-emerald-200 text-emerald-700 text-sm font-bold text-center">
              {msjExito}
            </div>
          )}
          {error && (
            <div className="px-4 py-2 bg-red-50 border-t border-red-200 text-red-700 text-sm text-center">
              ⚠️ {error}
            </div>
          )}

          {/* FOOTER */}
          <div className="p-4 bg-white border-t border-slate-200 flex gap-2 flex-shrink-0">
            <button
              onClick={volverALista}
              className="flex-1 px-4 py-3 text-slate-600 font-bold bg-slate-100 hover:bg-slate-200 rounded-xl transition"
            >
              ← Volver
              <span className="block text-[10px] font-mono opacity-70 mt-0.5">
                (Esc)
              </span>
            </button>
            <button
              onClick={imprimirPreview}
              disabled={imprimiendo}
              className="flex-[2] bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-black text-base py-3 rounded-xl transition shadow-lg flex items-center justify-center gap-2"
            >
              🖨️ {imprimiendo ? "Imprimiendo..." : "Imprimir"}
              <span className="text-[10px] font-mono opacity-80">(Enter)</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // -------------------- RENDER: LISTA --------------------

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* HEADER */}
        <div className="bg-indigo-600 p-4 flex items-center justify-between">
          <div>
            <h3 className="text-2xl font-black text-white">Historial</h3>
            <p className="text-indigo-100 text-xs">
              Fecha: {fecha} · Enter abre vista previa
            </p>
          </div>
          <button
            onClick={onCerrar}
            className="text-white hover:text-red-200 font-bold text-xl px-2"
            title="Cerrar (Esc)"
          >
            ✕
          </button>
        </div>

        {/* CONTROLES: fecha + búsqueda + filtro */}
        <div className="p-4 border-b border-slate-200 bg-slate-50 space-y-2">
          <div className="flex gap-2 items-center">
            <label className="text-xs font-bold text-slate-600 uppercase whitespace-nowrap">
              Fecha
            </label>
            <input
              ref={inputFechaRef}
              type="date"
              value={fecha}
              max={FECHA_HOY()}
              onChange={(e) => setFecha(e.target.value || FECHA_HOY())}
              className="border-2 border-indigo-300 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
            />
            <button
              onClick={() => setFecha(FECHA_HOY())}
              className="text-xs font-bold text-indigo-600 hover:text-indigo-800 px-2 py-1 rounded hover:bg-indigo-50 transition"
            >
              Hoy
            </button>
          </div>

          <input
            ref={inputBusquedaRef}
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por Ticket # o producto... (↑↓ navegar · Enter ver detalle)"
            className="w-full text-base border-2 border-indigo-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />

          <div className="flex flex-wrap gap-1.5">
            {FILTROS.map((f) => {
              const activo = filtroMetodo === f.key;
              return (
                <button
                  key={f.key}
                  onClick={() => setFiltroMetodo(f.key)}
                  className={`px-2.5 py-1 text-xs font-bold rounded-lg border-2 transition ${
                    activo
                      ? "bg-indigo-600 text-white border-indigo-600"
                      : "bg-white text-slate-600 border-slate-200 hover:border-indigo-300"
                  }`}
                >
                  {f.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* LISTADO */}
        <div className="flex-1 overflow-y-auto p-2">
          {cargando ? (
            <p className="text-center text-slate-500 py-10">Cargando ventas...</p>
          ) : error ? (
            <p className="text-center text-red-500 py-10">⚠️ {error}</p>
          ) : ventasFiltradas.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-slate-500">
                {ventas.length === 0
                  ? `No hay ventas registradas para ${fecha}.`
                  : "No se encontraron ventas con ese filtro/búsqueda."}
              </p>
              {ventas.length === 0 && (
                <button
                  onClick={() => setFecha(FECHA_HOY())}
                  className="mt-3 text-sm font-bold text-indigo-600 hover:text-indigo-800"
                >
                  ← Volver a hoy
                </button>
              )}
            </div>
          ) : (
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-500 uppercase bg-slate-100 sticky top-0 z-10">
                <tr>
                  <th className="px-3 py-2">Hora</th>
                  <th className="px-3 py-2">Ticket #</th>
                  <th className="px-3 py-2">Pago</th>
                  <th className="px-3 py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {ventasFiltradas.map((v, i) => {
                  const activo = i === indiceSel;
                  return (
                    <tr
                      key={v.id}
                      onClick={() => setIndiceSel(i)}
                      onDoubleClick={() => abrirPreview(v)}
                      className={`cursor-pointer transition-colors border-b border-slate-100 ${
                        activo ? "bg-indigo-50" : "hover:bg-slate-50"
                      }`}
                    >
                      <td className="px-3 py-2 text-slate-600">{horaDe(v)}</td>
                      <td className="px-3 py-2 font-mono text-xs">{v.id}</td>
                      <td className="px-3 py-2 text-slate-600">
                        {v.metodoPago || "Efectivo"}
                      </td>
                      <td className="px-3 py-2 text-right font-bold text-slate-800">
                        {formatearPrecio(v.total)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* RESUMEN DEL DÍA (fijo en el footer) */}
        {resumen && (
          <div className="px-4 py-3 bg-indigo-50 border-t border-indigo-200">
            <div className="flex justify-between items-start gap-4 text-sm">
              <div className="flex-shrink-0">
                <p className="text-[10px] font-bold uppercase text-indigo-500">
                  Total facturado
                </p>
                <p className="text-xl font-black text-indigo-800">
                  {formatearPrecio(resumen.totalFacturado)}
                </p>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  {resumen.cantidadVentas} venta(s)
                </p>
              </div>
              <div className="flex-1 text-right">
                <p className="text-[10px] font-bold uppercase text-indigo-500 mb-0.5">
                  Por método
                </p>
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 justify-end text-xs">
                  {Object.entries(resumen.porMetodo)
                    .filter(([, monto]) => monto > 0)
                    .sort((a, b) => b[1] - a[1])
                    .map(([metodo, monto]) => (
                      <span key={metodo} className="text-slate-700">
                        <span className="font-semibold">{metodo}:</span>{" "}
                        {formatearPrecio(monto)}
                      </span>
                    ))}
                  {Object.keys(resumen.porMetodo).length === 0 && (
                    <span className="text-slate-400">—</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MENSAJES */}
        {msjExito && (
          <div className="px-4 py-2 bg-emerald-50 border-t border-emerald-200 text-emerald-700 text-sm font-bold text-center">
            {msjExito}
          </div>
        )}

        {/* FOOTER */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center">
          <p className="text-xs text-slate-500">
            {ventasFiltradas.length} de {ventas.length} venta(s)
          </p>
          <div className="flex gap-2">
            <button
              onClick={onCerrar}
              className="px-4 py-2 text-slate-600 font-bold bg-slate-200 hover:bg-slate-300 rounded-lg transition"
            >
              Cerrar (Esc)
            </button>
            <button
              onClick={() => abrirPreview(ventasFiltradas[indiceSel])}
              disabled={ventasFiltradas.length === 0}
              className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-bold rounded-lg transition flex items-center gap-2"
            >
              👁️ Ver detalle (Enter)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}