// Temporal: el modal real es el paso 2. Mientras tanto, stub que avisa.
// Cuando exista ProductoEditorModal.jsx, borrá este stub y poné el import real.
import { useState, useEffect, useMemo } from "react";
import * as api from "../../api/client";

function ProductoEditorModal({ modo, producto, onCerrar, onGuardado }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-md">
        <h3 className="font-semibold mb-2">
          {modo === "crear" ? "Nuevo producto" : "Editar producto"}
        </h3>
        <p className="text-sm text-slate-600 mb-4">
          Modal pendiente (paso 2). SKU:{" "}
          <code>{producto?.sku || "(nuevo)"}</code>
        </p>
        <div className="flex justify-end gap-2">
          <button
            onClick={onCerrar}
            className="px-3 py-1.5 text-sm rounded bg-slate-200 hover:bg-slate-300"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

// Debounce simple: ejecuta fn después de `ms` sin llamadas nuevas.
function useDebounce(valor, ms = 250) {
  const [debounced, setDebounced] = useState(valor);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(valor), ms);
    return () => clearTimeout(t);
  }, [valor, ms]);
  return debounced;
}

// Formateo de precio con Intl (pesos argentinos).
const fmtPrecio = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 2,
});

export default function CatalogoAdmin({ productos, cargando, error, recargar }) {
  // Filtros locales (se mandan al backend como query params).
  const [q, setQ] = useState("");
  const [categoria, setCategoria] = useState("");
  const [activo, setActivo] = useState(""); // "", "true", "false"

  // Modal de alta/edición: { modo: "crear" | "editar", producto? }
  const [modal, setModal] = useState(null);

  // Listado filtrado (viene del backend vía hook, pero el hook no acepta
  // filtros). Para Fase B, filtramos en cliente sobre `productos` porque
  // el hook ya trae todo. Si el catálogo crece a 1000+, migramos a
  // refetch con query params.
  //
  // NOTA: el backend ya soporta ?q= etc. Cuando el hook exponga filtros,
  // cambiamos esto. Mientras tanto, cliente-side es correcto y simple.
  const qDebounced = useDebounce(q);

  const productosFiltrados = useMemo(() => {
    const base = Array.isArray(productos) ? productos : [];
    const texto = qDebounced.trim().toLowerCase();
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
  }, [productos, qDebounced, categoria, activo]);

  // Lista de categorías únicas (para el select de filtro).
  const categorias = useMemo(() => {
    const set = new Set();
    (productos || []).forEach((p) => {
      if (p.categoria) set.add(p.categoria);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "es"));
  }, [productos]);

  // Eliminar (soft delete) con confirmación nativa.
  async function handleEliminar(p) {
    const ok = window.confirm(
      `¿Desactivar "${p.nombreCorto || p.nombre}" (SKU ${p.sku})?\n\n` +
        `No se borra: queda inactivo y se puede reactivar editándolo.`
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
      {/* Barra de filtros */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 mb-4">
        <div className="flex flex-wrap items-end gap-3">
          {/* Búsqueda */}
          <div className="flex-1 min-w-[220px]">
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Buscar
            </label>
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="SKU, nombre, marca…"
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Categoría */}
          <div className="min-w-[160px]">
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Categoría
            </label>
            <select
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todas</option>
              {categorias.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Activo */}
          <div className="min-w-[140px]">
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Estado
            </label>
            <select
              value={activo}
              onChange={(e) => setActivo(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todos</option>
              <option value="true">Activos</option>
              <option value="false">Inactivos</option>
            </select>
          </div>

          {/* Botón Nuevo */}
          <div className="ml-auto">
            <button
              onClick={() => setModal({ modo: "crear" })}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md transition-colors"
            >
              + Nuevo producto
            </button>
          </div>
        </div>

        {/* Contador */}
        <div className="mt-3 text-xs text-slate-500">
          {cargando
            ? "Cargando catálogo…"
            : `${productosFiltrados.length} de ${
                (productos || []).length
              } productos`}
        </div>
      </div>

      {/* Error del hook */}
      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
          Error al cargar catálogo: {String(error)}
        </div>
      )}

      {/* Tabla */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr className="text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">
                <th className="px-3 py-2">SKU</th>
                <th className="px-3 py-2">Nombre</th>
                <th className="px-3 py-2">Marca</th>
                <th className="px-3 py-2">Categoría</th>
                <th className="px-3 py-2 text-right">Precio</th>
                <th className="px-3 py-2 text-right">Costo</th>
                <th className="px-3 py-2 text-right">Stock</th>
                <th className="px-3 py-2 text-center">Estado</th>
                <th className="px-3 py-2 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {cargando && (
                <tr>
                  <td colSpan={9} className="px-3 py-8 text-center text-slate-500">
                    Cargando…
                  </td>
                </tr>
              )}

              {!cargando && productosFiltrados.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-3 py-8 text-center text-slate-500">
                    No hay productos que coincidan con los filtros.
                  </td>
                </tr>
              )}

              {!cargando &&
                productosFiltrados.map((p) => (
                  <tr
                    key={p.sku}
                    className={
                      "border-b border-slate-100 hover:bg-slate-50 " +
                      (p.activo === false ? "opacity-60" : "")
                    }
                  >
                    <td className="px-3 py-2 font-mono text-xs text-slate-600">
                      {p.sku}
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-medium text-slate-800">
                        {p.nombreCorto || p.nombre}
                      </div>
                      {p.nombreCorto && p.nombre !== p.nombreCorto && (
                        <div className="text-xs text-slate-400 truncate max-w-[280px]">
                          {p.nombre}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-slate-700">{p.marca || "—"}</td>
                    <td className="px-3 py-2 text-slate-700">
                      {p.categoria || "—"}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-slate-800">
                      {typeof p.precioVenta === "number"
                        ? fmtPrecio.format(p.precioVenta)
                        : "—"}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-slate-500">
                      {typeof p.costoUnitario === "number"
                        ? fmtPrecio.format(p.costoUnitario)
                        : "—"}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-700">
                      {typeof p.stock === "number" ? p.stock : "—"}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {p.activo === false ? (
                        <span className="inline-block px-2 py-0.5 rounded text-xs bg-slate-200 text-slate-600">
                          Inactivo
                        </span>
                      ) : (
                        <span className="inline-block px-2 py-0.5 rounded text-xs bg-green-100 text-green-700">
                          Activo
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <button
                        onClick={() =>
                          setModal({ modo: "editar", producto: p })
                        }
                        className="px-2 py-1 text-xs rounded bg-slate-100 hover:bg-slate-200 text-slate-700 mr-1 transition-colors"
                      >
                        Editar
                      </button>
                      {p.activo !== false && (
                        <button
                          onClick={() => handleEliminar(p)}
                          className="px-2 py-1 text-xs rounded bg-red-50 hover:bg-red-100 text-red-700 transition-colors"
                        >
                          Eliminar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de alta/edición */}
      {modal && (
        <ProductoEditorModal
          modo={modal.modo}
          producto={modal.producto}
          onCerrar={() => setModal(null)}
          onGuardado={() => {
            // Refetch: el backend devuelve el producto normalizado (con
            // editadoManualmente actualizado). Confiar en el refetch es
            // más robusto que replicar la normalización en el front.
            recargar();
            setModal(null);
          }}
        />
      )}
    </div>
  );
}