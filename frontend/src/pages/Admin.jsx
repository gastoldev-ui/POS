import { useState } from "react";
import { useCatalogoMaestro } from "../hooks/useCatalogoMaestro";
import CatalogoAdmin from "../components/admin/CatalogoAdmin";
import DropzoneImport from "../components/admin/DropzoneImport";
import HistorialImportaciones from "../components/admin/HistorialImportaciones";

const TABS = [
  { id: "catalogo", label: "📦 Catálogo" },
  { id: "importar", label: "📥 Importar Excel" },
  { id: "historial", label: "🕑 Historial" },
];

export default function Admin({ onVolverAlPOS }) {
  const [tab, setTab] = useState("catalogo");
  const catalogo = useCatalogoMaestro();

  const handleImportacionCompletada = () => {
    catalogo.recargar();
    setTab("catalogo");
  };

  const handleVerHistorial = () => setTab("historial");

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-2xl">⚙️</span>
            <h1 className="text-lg font-semibold text-slate-800">
              Administración
            </h1>
          </div>
          <div className="ml-auto">
            <button
              onClick={onVolverAlPOS}
              className="px-3 py-1.5 text-sm rounded-md bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium transition-colors"
            >
              ← Volver al POS
            </button>
          </div>
        </div>

        <nav className="max-w-6xl mx-auto px-4 flex gap-1 border-t border-slate-100">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={
                "px-4 py-2.5 text-sm font-medium border-b-2 transition-colors " +
                (tab === t.id
                  ? "border-blue-600 text-blue-700"
                  : "border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300")
              }
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {tab === "catalogo" && (
          <CatalogoAdmin
            productos={catalogo.productos}
            cargando={catalogo.cargando}
            error={catalogo.error}
            recargar={catalogo.recargar}
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
    </div>
  );
}