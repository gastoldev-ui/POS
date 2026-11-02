// src/components/HistorialModal.jsx
import { useState, useEffect, useRef, useMemo } from "react";
import { api } from "../api/client";
import { reimprimirTicket } from "../services/posApi";
import { formatearPrecio } from "../utils/formateo";

export default function HistorialModal({ onCerrar }) {
  const [ventas, setVentas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [busqueda, setBusqueda] = useState("");
  const [indiceSel, setIndiceSel] = useState(0);
  const [imprimiendo, setImprimiendo] = useState(false);
  const [msjExito, setMsjExito] = useState(null);

  const inputBusquedaRef = useRef(null);

  // Cargar ventas al abrir
  useEffect(() => {
    const cargar = async () => {
      try {
        const data = await api.posVentasHoy();
        // Las ordenamos de más nueva a más vieja
        setVentas([...data.ventas].reverse());
      } catch (err) {
        setError(err.message);
      } finally {
        setCargando(false);
      }
    };
    cargar();
  }, []);

  // Foco inicial en el buscador
  useEffect(() => {
    if (!cargando) inputBusquedaRef.current?.focus();
  }, [cargando]);

  // Filtrado de ventas
  const ventasFiltradas = useMemo(() => {
    const t = busqueda.trim().toLowerCase();
    if (!t) return ventas;
    return ventas.filter((v) => {
      const matchId = String(v.id).toLowerCase().includes(t);
      const matchProd = v.items?.some((it) =>
        it.nombre?.toLowerCase().includes(t)
      );
      return matchId || matchProd;
    });
  }, [busqueda, ventas]);

  // Resetear índice si cambia el filtro
  useEffect(() => {
    setIndiceSel(0);
  }, [busqueda]);

  // Acción de reimprimir
  const handleReimprimir = async (venta) => {
    if (imprimiendo) return;
    setImprimiendo(true);
    setError(null);
    setMsjExito(null);
    try {
      await reimprimirTicket(venta);
      setMsjExito("✅ Ticket enviado a la impresora");
      // Limpiamos el mensaje después de 2 seg
      setTimeout(() => setMsjExito(null), 2000);
    } catch (err) {
      setError("Error al imprimir: " + err.message);
    } finally {
      setImprimiendo(false);
    }
  };

  // Atajos de teclado
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCerrar();
        return;
      }

      if (ventasFiltradas.length === 0) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setIndiceSel((prev) => (prev + 1) % ventasFiltradas.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setIndiceSel((prev) => (prev - 1 + ventasFiltradas.length) % ventasFiltradas.length);
      } else if (e.key === "Enter") {
        e.preventDefault();
        const ventaSeleccionada = ventasFiltradas[indiceSel];
        if (ventaSeleccionada) handleReimprimir(ventaSeleccionada);
      }
    };

    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [ventasFiltradas, indiceSel, imprimiendo, onCerrar]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* HEADER */}
        <div className="bg-indigo-600 p-4 flex items-center justify-between">
          <h3 className="text-2xl font-black text-white">Historial de Hoy</h3>
          <button
            onClick={onCerrar}
            className="text-white hover:text-red-200 font-bold text-xl px-2"
          >
            ✕
          </button>
        </div>

        {/* BUSCADOR */}
        <div className="p-4 border-b border-slate-200 bg-slate-50">
          <input
            ref={inputBusquedaRef}
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por Ticket # o producto... (↑↓ para navegar, Enter reimprime)"
            className="w-full text-base border-2 border-indigo-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>

        {/* LISTADO */}
        <div className="flex-1 overflow-y-auto p-2">
          {cargando ? (
            <p className="text-center text-slate-500 py-10">Cargando ventas...</p>
          ) : error ? (
            <p className="text-center text-red-500 py-10">⚠️ {error}</p>
          ) : ventasFiltradas.length === 0 ? (
            <p className="text-center text-slate-500 py-10">
              {ventas.length === 0
                ? "No hay ventas registradas hoy."
                : "No se encontraron ventas con esa búsqueda."}
            </p>
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
                  const hora = new Date(v.fecha).toLocaleTimeString("es-AR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  });
                  return (
                    <tr
                      key={v.id}
                      onClick={() => setIndiceSel(i)}
                      onDoubleClick={() => handleReimprimir(v)}
                      className={`cursor-pointer transition-colors border-b border-slate-100 ${
                        activo ? "bg-indigo-50" : "hover:bg-slate-50"
                      }`}
                    >
                      <td className="px-3 py-2 text-slate-600">{hora}</td>
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

        {/* MENSAJE EXITO/ERROR */}
        {msjExito && (
          <div className="px-4 py-2 bg-emerald-50 border-t border-emerald-200 text-emerald-700 text-sm font-bold text-center">
            {msjExito}
          </div>
        )}
        {error && !cargando && ventasFiltradas.length > 0 && (
          <div className="px-4 py-2 bg-red-50 border-t border-red-200 text-red-700 text-sm text-center">
            ⚠️ {error}
          </div>
        )}

        {/* FOOTER */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center">
          <p className="text-xs text-slate-500">
            {ventasFiltradas.length} venta(s) encontrada(s)
          </p>
          <div className="flex gap-2">
            <button
              onClick={onCerrar}
              className="px-4 py-2 text-slate-600 font-bold bg-slate-200 hover:bg-slate-300 rounded-lg transition"
            >
              Cerrar (Esc)
            </button>
            <button
              onClick={() => {
                const v = ventasFiltradas[indiceSel];
                if (v) handleReimprimir(v);
              }}
              disabled={ventasFiltradas.length === 0 || imprimiendo}
              className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-bold rounded-lg transition flex items-center gap-2"
            >
              🖨️ {imprimiendo ? "Imprimiendo..." : "Reimprimir (Enter)"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}