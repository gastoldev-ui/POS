// frontend/src/components/panel/BarraCarga.jsx
import { formatearPrecio } from "../../utils/formateo";

/**
 * Barra superior de carga: Producto (con dropdown) + Cantidad + Precio.
 * Componente puramente visual: recibe refs, valores y handlers, no
 * maneja estado propio ni conoce el contexto.
 *
 * IMPORTANTE:
 *  - Los 3 refs vienen de `usePOSFoco` (producto / cantidad / precio).
 *  - Los onKeyDown ya vienen resueltos desde PanelPOS (flechas,
 *    Enter, ↑↓, etc). Acá solo se enchufan al input.
 *  - El dropdown de búsqueda se renderiza acá, pero su estado
 *    (dropAbierto / resultados / indiceDrop) y sus handlers
 *    (seleccionarProducto) vienen por props.
 *  - `cantidad` llega como string a propósito (permite borrar y
 *    tipear); el parseo se hace en usePOSCarga.confirmarCarga.
 */
export default function BarraCarga({
  // refs
  productoRef,
  cantidadRef,
  precioRef,
  // valores
  busqueda,
  dropAbierto,
  resultados,
  indiceDrop,
  cantidad,
  precio,
  error,
  // handlers
  onProductoChange,
  onProductoKeyDown,
  onCantidadChange,
  onCantidadKeyDown,
  onPrecioChange,
  onPrecioKeyDown,
  onSeleccionarProducto,
}) {
  return (
    <div className="p-3 bg-white border-b border-slate-200 shadow-sm z-20 relative flex-shrink-0">
      <div className="flex gap-2 items-start">
        <div className="relative flex-1 z-20">
          <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
            Producto (F1)
          </label>
          <input
            ref={productoRef}
            type="text"
            value={busqueda}
            onChange={(e) => onProductoChange(e.target.value)}
            onKeyDown={onProductoKeyDown}
            placeholder="Escanear o buscar..."
            className="w-full text-base border-2 border-indigo-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 h-[50px]"
          />
          {dropAbierto && resultados.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl z-50 max-h-64 overflow-y-auto">
              {resultados.map((a, i) => (
                <div
                  key={a.sku}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => onSeleccionarProducto(a)}
                  className={`px-3 py-2 cursor-pointer flex justify-between items-center text-sm ${
                    i === indiceDrop ? "bg-indigo-50" : "hover:bg-slate-50"
                  }`}
                >
                  <div className="truncate flex-1">
                    <span className="font-semibold text-slate-800">
                      {a.nombre}
                    </span>
                    <span className="text-[10px] text-slate-500 ml-2">
                      {a.sku}
                    </span>
                  </div>
                  <span className="font-bold text-slate-700 ml-2">
                    {formatearPrecio(a.costoUnitario)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="w-28 flex-shrink-0">
          <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
            Cant.
          </label>
          <input
            ref={cantidadRef}
            type="number"
            min={1}
            value={cantidad}
            onChange={(e) => onCantidadChange(e.target.value)}
            onFocus={(e) => e.target.select()}
            onKeyDown={onCantidadKeyDown}
            className="w-full text-center text-lg font-bold border-2 border-slate-300 rounded-lg bg-white h-[50px] px-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
        </div>

        <div className="w-52 flex-shrink-0">
          <label className="text-[10px] font-bold text-sky-600 uppercase block mb-1">
            Precio (Enter)
          </label>
          <div className="flex items-center border-2 border-sky-400 rounded-lg overflow-hidden bg-sky-50 h-[50px] focus-within:ring-2 focus-within:ring-sky-500">
            <span className="pl-3 text-sky-500 text-xl font-bold">$</span>
            <input
              ref={precioRef}
              type="number"
              value={precio}
              onChange={(e) => onPrecioChange(e.target.value)}
              onKeyDown={onPrecioKeyDown}
              placeholder="0.00"
              className="w-full px-2 py-2 text-right text-xl font-bold bg-transparent border-0 text-sky-900 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none placeholder-sky-300"
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="mt-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1">
          ⚠️ {error}
        </div>
      )}
    </div>
  );
}