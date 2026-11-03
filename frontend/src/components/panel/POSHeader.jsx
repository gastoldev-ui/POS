// frontend/src/components/panel/POSHeader.jsx
import AtajoBoton from "./AtajoBoton";

/**
 * Header del POS: logo, fecha y botones de atajo (F1-F10).
 * Componente puramente visual.
 *
 * Props:
 *   - onEscanear        {Function}  F1
 *   - onPrecio          {Function}  F2
 *   - onHistorial       {Function}  F3
 *   - onArqueo          {Function}  F4
 *   - onBorrarUltima    {Function}  F9
 *   - onCobrar          {Function}  F10
 */
export default function POSHeader({
  onEscanear,
  onPrecio,
  onHistorial,
  onArqueo,
  onBorrarUltima,
  onCobrar,
}) {
  return (
    <header className="bg-slate-100 border-b border-slate-300 px-4 py-2 flex items-center justify-between flex-shrink-0">
      <div className="flex items-center gap-3">
        <span className="text-3xl">🧾</span>
        <div>
          <h1 className="font-bold text-slate-800 text-lg leading-tight">
            POS Rápido
          </h1>
          <p className="text-xs text-slate-500 capitalize">
            {new Date().toLocaleDateString("es-AR", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap justify-end">
        <AtajoBoton onClick={onEscanear} tecla="F1" label="Escanear" />
        <AtajoBoton onClick={onPrecio} tecla="F2" label="Precio" />
        <AtajoBoton onClick={onHistorial} tecla="F3" label="Historial" />
        <AtajoBoton onClick={onArqueo} tecla="F4" label="Caja" />
        <AtajoBoton onClick={onBorrarUltima} tecla="F9" label="Borrar" />
        <AtajoBoton onClick={onCobrar} tecla="F10" label="Cobrar" />
      </div>
    </header>
  );
}