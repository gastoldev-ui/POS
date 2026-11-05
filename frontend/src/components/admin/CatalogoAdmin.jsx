// frontend/src/components/admin/CatalogoAdmin.jsx
import { useState, useEffect, useMemo } from "react";
import { api } from "../../api/client";
import CarruselImagenes from "./CarruselImagenes";
import TarjetaProducto from "./TarjetaProducto";

function useDebounce(valor, ms = 250) {
  const [debounced, setDebounced] = useState(valor);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(valor), ms);
    return () => clearTimeout(t);
  }, [valor, ms]);
  return debounced;
}

const fmtPrecio = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 2,
});

export default function CatalogoAdmin({
  productos,
  cargando,
  error,
  recargar,
  busquedaGlobal,
  categoria,
  activo,
  vista,
  handleEditar,
}) {
  const busquedaGlobalDebounced = useDebounce(busquedaGlobal);

  const productosFiltrados = useMemo(() => {
    const base = Array.isArray(productos) ? productos : [];
    const texto = busquedaGlobalDebounced.trim().toLowerCase();
    return base.filter((p) => {
      if (texto) {
        const hay =
          (p.sku || "").toLowerCase().includes(texto) ||
          (p.nombre || "").toLowerCase().includes(texto) ||
          (p.nombreCorto || "").toLowerCase().includes(texto) ||
          (p.marca || "").toLowerCase().includes(texto);
        if (!hay) return false;
      }
      if (categoria && (p.categoria || "") !== categoria) return false;
      if (activo === "true" && p.activo !== true) return false;
      if (activo === "false" && p.activo !== false) return false;
      return true;
    });
  }, [productos, busquedaGlobalDebounced, categoria, activo]);

  async function handleEliminar(p) {
    const ok = window.confirm(
      `¿Desactivar "${p.nombreCorto || p.nombre}" (SKU ${p.sku})?\n\n` +
        `No se borra: queda inactivo y se puede reactivar editándolo.`,
    );
    if (!ok) return;
    try {
      await api.catalogoMaestroEliminar(p.sku);
      recargar();
    } catch (e) {
      window.alert("No se pudo eliminar: " + (e.message || e));
    }
  }

  return (
    <div>
      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
          Error al cargar catálogo: {String(error)}
        </div>
      )}

      {vista === "tarjetas" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {!cargando && productosFiltrados.length === 0 && (
            <div className="col-span-full px-4 py-8 text-center text-slate-500 text-sm">
              No hay productos que coincidan con los filtros.
            </div>
          )}
          {!cargando &&
            productosFiltrados.map((p) => (
              <TarjetaProducto
                key={p.sku}
                producto={p}
                onEditar={handleEditar}
                onEliminar={handleEliminar}
                onActualizado={recargar}
              />
            ))}
        </div>
      )}

      {vista === "tabla" && (
        <div className="overflow-x-auto border border-slate-200 rounded-lg bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr className="text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">
                <th className="px-3 py-2 w-24 text-center">Acciones</th>
                <th className="px-3 py-2 w-12 text-center">Imagen</th>
                <th className="px-3 py-2">SKU</th>
                <th className="px-3 py-2">Nombre</th>
                <th className="px-3 py-2">Marca</th>
                <th className="px-3 py-2">Categoría</th>
                <th className="px-3 py-2 text-right">Costo</th>
                <th className="px-3 py-2 text-right">Venta Unit.</th>
                <th className="px-3 py-2 text-right">Venta Bulto</th>
                <th className="px-3 py-2 text-right">Stock</th>
              </tr>
            </thead>
            <tbody>
              {cargando && (
                <tr>
                  <td colSpan={10} className="px-3 py-8 text-center text-slate-500">
                    Cargando…
                  </td>
                </tr>
              )}

              {!cargando && productosFiltrados.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-3 py-8 text-center text-slate-500">
                    No hay productos que coincidan con los filtros.
                  </td>
                </tr>
              )}

              {!cargando &&
                productosFiltrados.map((p) => {
                  const precioBulto =
                    typeof p.precioVenta === "number"
                      ? p.precioVenta * (p.uxB || 6)
                      : null;
                  return (
                    <tr
                      key={p.sku}
                      className={
                        "border-b border-slate-100 hover:bg-slate-50 " +
                        (p.activo === false ? "opacity-60" : "")
                      }
                    >
                      <td className="px-3 py-2 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleEditar(p)}
                            className="px-2 py-1 text-xs rounded bg-blue-100 hover:bg-blue-200 text-blue-700 font-medium transition-colors"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => handleEliminar(p)}
                            className="px-1.5 py-1 text-xs rounded bg-red-50 hover:bg-red-100 text-red-600 transition-colors"
                          >
                            ✕
                          </button>
                        </div>
                      </td>
                      <td className="px-3 py-2 w-12 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {p.imagenes && p.imagenes.length > 0 ? (
                            <CarruselImagenes
                              imagenes={p.imagenes}
                              ancho="w-8"
                              alto="h-8"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-md bg-slate-100 border border-slate-200 flex items-center justify-center">
                              <span className="text-[9px] text-slate-400">Sin</span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-slate-600 whitespace-nowrap">
                        {p.sku}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <div className="font-medium text-slate-800">{p.nombre}</div>
                        {p.nombreCorto && p.nombre !== p.nombreCorto && (
                          <div className="text-xs text-slate-400 truncate max-w-[240px]">
                            {p.nombreCorto}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-slate-700 whitespace-nowrap">
                        {p.marca || "—"}
                      </td>
                      <td className="px-3 py-2 text-slate-700 whitespace-nowrap">
                        {p.categoria || "—"}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-red-600 whitespace-nowrap">
                        {typeof p.costoUnitario === "number"
                          ? fmtPrecio.format(p.costoUnitario)
                          : "—"}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-emerald-600 whitespace-nowrap">
                        {typeof p.precioVenta === "number"
                          ? fmtPrecio.format(p.precioVenta)
                          : "—"}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-blue-600 whitespace-nowrap">
                        {precioBulto != null ? fmtPrecio.format(precioBulto) : "—"}
                      </td>
                      <td className="px-3 py-2 text-right text-slate-700 whitespace-nowrap">
                        {typeof p.stock === "number" ? p.stock : "—"}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}