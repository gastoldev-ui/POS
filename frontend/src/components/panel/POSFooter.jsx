// frontend/src/components/panel/POSFooter.jsx
import { formatearPrecio } from "../../utils/formateo";

/**
 * Footer del POS: totales a la izquierda, COBRAR + Total a la derecha.
 * Componente puramente visual, sin estado ni lógica de negocio.
 *
 * Props:
 *   - cantidadItems     {number}  pos.totales.cantidadItems
 *   - totalUnidades     {number}  pos.totales.totalUnidades
 *   - total             {number}  pos.totales.total
 *   - onCobrar          {Function}
 */
export default function POSFooter({
  cantidadItems,
  totalUnidades,
  total,
  onCobrar,
}) {
  const cobrarDeshabilitado = cantidadItems === 0;

  return (
    <footer className="bg-white border-t-2 border-slate-300 px-4 py-3 flex items-center justify-between flex-shrink-0 shadow-[0_-4px_6px_-4px_rgba(0,0,0,0.1)]">
      <div className="flex gap-6 text-slate-600">
        <div>
          <p className="text-[10px] font-bold uppercase text-slate-400">
            Ítems
          </p>
          <p className="text-2xl font-black text-slate-700">{cantidadItems}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase text-slate-400">
            Unidades
          </p>
          <p className="text-2xl font-black text-slate-700">{totalUnidades}</p>
        </div>
      </div>

      <div className="flex items-center gap-6">
        <button
          onClick={onCobrar}
          disabled={cobrarDeshabilitado}
          className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-black text-xl px-8 py-3 rounded-xl shadow-lg transition-colors flex items-center gap-3"
        >
          💵 COBRAR
          <span className="text-xs font-mono opacity-80 border border-white/30 rounded px-1.5 py-0.5">
            F10
          </span>
        </button>
        <div className="text-right">
          <p className="text-[10px] font-bold uppercase text-slate-400">
            Total
          </p>
          <p className="text-5xl font-black text-slate-900 leading-none">
            {formatearPrecio(total)}
          </p>
        </div>
      </div>
    </footer>
  );
}