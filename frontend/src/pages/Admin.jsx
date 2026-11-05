import { useState, useEffect, useMemo } from "react";
import { useCatalogoMaestro } from "../hooks/useCatalogoMaestro";
import CatalogoAdmin from "../components/admin/CatalogoAdmin";
import ProductoEditorModal from "../components/admin/ProductoEditorModal";
import DropzoneImport from "../components/admin/DropzoneImport";
import HistorialImportaciones from "../components/admin/HistorialImportaciones";

const TABS = [
  { id: "catalogo", label: "📦 Catálogo" },
  { id: "importar", label: "📥 Importar Excel" },
  { id: "historial", label: "🕑 Historial" },
];

export default function Admin({ onVolverAlPOS }) {
  const [tab, setTab] = useState("catalogo");
  const [busquedaGlobal, setBusquedaGlobal] = useState("");
  const [categoria, setCategoria] = useState("");
  const [activo, setActivo] = useState("");
  const [vista, setVista] = useState("tarjetas");

  const [modal, setModal] = useState(null);
  const [editando, setEditando] = useState(null);
  const [guardando, setGuardando] = useState(false);

  const catalogo = useCatalogoMaestro();

  const categorias = useMemo(() => {
    const set = new Set();
    (catalogo.productos || []).forEach((p) => {
      if (p.categoria) set.add(p.categoria);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "es"));
  }, [catalogo.productos]);

  useEffect(() => {
    if (busquedaGlobal.trim() && tab !== "catalogo") {
      setTab("catalogo");
    }
  }, [busquedaGlobal, tab]);

  const handleImportacionCompletada = () => {
    catalogo.recargar();
    setTab("catalogo");
  };

  const handleVerHistorial = () => setTab("historial");

  const handleNuevo = () => {
    setEditando(null);
    setModal({ modo: "crear" });
  };

  async function handleGuardado(productoGuardado) {
    setGuardando(false);
    setModal(null);
    setEditando(null);
    catalogo.recargar();
  }

  return (
    <div className="min-h-screen bg-slate-100">
      {/* HEADER COMPACTO */}
      <header className="sticky top-0 z-50 w-full bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-[1400px] mx-auto px-3 py-2">
          {/* Fila 1: título · buscador · tabs · volver */}
          <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-xl leading-none">⚙️</span>
              <h1 className="text-base font-semibold text-slate-800 leading-none">
                Administración
              </h1>
            </div>

            <div className="flex-1 min-w-[180px] max-w-md">
              <input
                type="text"
                value={busquedaGlobal}
                onChange={(e) => setBusquedaGlobal(e.target.value)}
                placeholder="Buscar productos…"
                className="w-full px-2.5 py-1 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>

            <nav className="flex items-center gap-0.5 shrink-0">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={
                    "px-3 py-1.5 text-[13px] font-medium rounded-md transition-colors whitespace-nowrap " +
                    (tab === t.id
                      ? "bg-blue-50 text-blue-700 border border-blue-200"
                      : "text-slate-600 hover:bg-slate-100 border border-transparent")
                  }
                >
                  {t.label}
                </button>
              ))}
            </nav>

            <button
              onClick={onVolverAlPOS}
              className="px-2.5 py-1.5 text-[13px] rounded-md bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium transition-colors shrink-0 ml-auto"
            >
              ← POS
            </button>
          </div>

          {/* Fila 2: SOLO filtros cuando está en Catálogo */}
          {tab === "catalogo" && (
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              <select
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
                className="px-2 py-1 border border-slate-300 rounded text-[13px] bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                title="Categoría"
              >
                <option value="">Todas las categorías</option>
                {categorias.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>

              <select
                value={activo}
                onChange={(e) => setActivo(e.target.value)}
                className="px-2 py-1 border border-slate-300 rounded text-[13px] bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                title="Estado"
              >
                <option value="">Todos los estados</option>
                <option value="true">Activos</option>
                <option value="false">Inactivos</option>
              </select>

              <div className="inline-flex rounded border border-slate-300 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setVista("tabla")}
                  className={`px-2.5 py-1 text-[13px] ${
                    vista === "tabla"
                      ? "bg-blue-600 text-white"
                      : "bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  Tabla
                </button>
                <button
                  type="button"
                  onClick={() => setVista("tarjetas")}
                  className={`px-2.5 py-1 text-[13px] border-l border-slate-300 ${
                    vista === "tarjetas"
                      ? "bg-blue-600 text-white"
                      : "bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  Tarjetas
                </button>
              </div>

              <button
                onClick={handleNuevo}
                className="ml-auto px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-[13px] font-medium rounded transition-colors"
              >
                + Nuevo producto
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-3 py-4">
        {tab === "catalogo" && (
          <CatalogoAdmin
            productos={catalogo.productos}
            cargando={catalogo.cargando}
            error={catalogo.error}
            recargar={catalogo.recargar}
            busquedaGlobal={busquedaGlobal}
            categoria={categoria}
            activo={activo}
            vista={vista}
            handleEditar={(p) => {
              setEditando(p);
              setModal({ modo: "editar", producto: p });
            }}
          />
        )}

        {tab === "importar" && (
          <DropzoneImport
            onImportacionCompletada={handleImportacionCompletada}
            onVerHistorial={handleVerHistorial}
          />
        )}

        {tab === "historial" && (
          <HistorialImportaciones productos={catalogo.productos} />
        )}
      </main>

      {modal && (
        <ProductoEditorModal
          modo={modal.modo}
          producto={editando}
          onCerrar={() => {
            setModal(null);
            setEditando(null);
          }}
          onGuardado={handleGuardado}
        />
      )}
    </div>
  );
}