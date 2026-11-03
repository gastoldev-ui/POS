// frontend/src/components/panel/AtajoBoton.jsx

/**
 * Botón de atajo de teclado (F1-F10) para la barra superior.
 * Puramente visual.
 */
export default function AtajoBoton({ onClick, tecla, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ backgroundColor: "#51A2FF" }}
      className="flex items-center gap-1.5 px-2.5 py-1.5 text-sm font-semibold text-white border border-[#3a8be6] rounded-lg transition-colors hover:brightness-110 active:brightness-95 shadow-sm"
    >
      <kbd className="text-[10px] font-mono bg-white/25 border border-white/40 rounded px-1 py-0.5 text-white">
        {tecla}
      </kbd>
      {label}
    </button>
  );
}