// frontend/src/components/panel/GrillaItems.jsx

/**
 * Grilla de ítems del POS.
 * Componente puramente visual: recibe datos y callbacks, no maneja
 * estado propio ni conoce el contexto.
 *
 * IMPORTANTE:
 *  - `grillaRef` va al div scrolleable (usePOSFoco lo usa para el
 *    auto-scroll al agregar/quitar filas).
 *  - `cantidad` se mantiene como string en el flujo de carga, pero
 *    acá el input de cantidad recibe el número ya persistido del
 *    item; los botones +/- delegan en `onEditarCantidad` con
 *    `item.cantidad ± 1` (el reducer clampea a >= 1).
 */
export default function GrillaItems({
  grillaRef,
  items,
  onEditarNombre,
  onEditarCantidad,
  onEditarPrecio,
  onQuitarItem,
  formatearPrecio,
}) {
  return (
    <div ref={grillaRef} className="flex-1 overflow-y-auto bg-slate-50 p-2">
      <table className="w-full text-sm text-left">
        <thead className="text-xs text-slate-500 uppercase bg-slate-100 sticky top-0 z-10">
          <tr>
            <th className="px-2 py-1 w-10">#</th>
            <th className="px-2 py-1">Producto</th>
            <th className="px-2 py-1 w-28 text-center">Cant.</th>
            <th className="px-2 py-1 w-36 text-right">P. Unit.</th>
            <th className="px-2 py-1 w-32 text-right">Subtotal</th>
            <th className="px-2 py-1 w-12"></th>
          </tr>
        </thead>
        <tbody>
          {items.map((it, idx) => {
            if (it.vacia) {
              return (
                <tr key={it.id} className="bg-slate-50/50">
                  <td className="px-2 py-2 text-slate-300 font-mono">
                    {idx + 1}
                  </td>
                  <td className="px-2 py-2 text-slate-400 italic" colSpan={4}>
                    Esperando próximo ítem…
                  </td>
                  <td></td>
                </tr>
              );
            }
            return (
              <tr
                key={it.id}
                className={`border-b border-slate-200 hover:bg-white transition-colors ${
                  it.esNuevo ? "bg-emerald-50/60" : "bg-white"
                }`}
              >
                <td className="px-2 py-1 text-slate-400 font-mono text-xs">
                  {idx + 1}
                </td>
                <td className="px-2 py-1">
                  <input
                    type="text"
                    value={it.nombre}
                    onChange={(e) => onEditarNombre(it.id, e.target.value)}
                    onFocus={(e) => e.target.select()}
                    className="w-full bg-transparent border-0 focus:outline-none focus:bg-indigo-50 rounded px-1 py-0.5 text-base text-slate-800 font-medium"
                  />
                  <div className="text-[10px] text-slate-400 font-mono px-1">
                    {it.sku ? `SKU ${it.sku}` : "Manual"}
                    {it.precioEditado && (
                      <span className="ml-1 text-amber-600">· editado</span>
                    )}
                  </div>
                </td>
                <td className="px-2 py-1">
                  <div className="flex items-center justify-center gap-1">
                    <button
                      onClick={() => onEditarCantidad(it.id, it.cantidad - 1)}
                      disabled={it.cantidad <= 1}
                      className="px-3 py-1 text-base font-bold text-slate-600 hover:bg-slate-100 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      value={it.cantidad}
                      min={1}
                      onChange={(e) => onEditarCantidad(it.id, e.target.value)}
                      onFocus={(e) => e.target.select()}
                      className="w-14 text-center bg-transparent border border-transparent hover:border-slate-300 focus:border-indigo-400 focus:bg-white rounded px-1 py-0.5 font-bold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <button
                      onClick={() => onEditarCantidad(it.id, it.cantidad + 1)}
                      className="px-3 py-1 text-base font-bold text-slate-600 hover:bg-slate-100 rounded"
                    >
                      +
                    </button>
                  </div>
                </td>
                <td className="px-2 py-1 text-right">
                  <input
                    type="number"
                    value={it.precioUnitario}
                    onChange={(e) => onEditarPrecio(it.id, e.target.value)}
                    onFocus={(e) => e.target.select()}
                    className="w-32 text-sm text-right bg-transparent border border-transparent hover:border-slate-300 focus:border-sky-400 focus:bg-sky-50 rounded px-1 py-0.5 font-semibold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </td>
                <td className="px-2 py-1 text-right font-bold text-base text-slate-800">
                  {formatearPrecio(it.subtotal)}
                </td>
                <td className="px-2 py-1 text-center">
                  <button
                    onClick={() => onQuitarItem(it.id)}
                    className="text-slate-300 hover:text-red-500 font-bold text-lg leading-none px-1"
                    title="Quitar ítem"
                  >
                    ×
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}