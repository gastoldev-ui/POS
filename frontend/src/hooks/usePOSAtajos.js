// frontend/src/hooks/usePOSAtajos.js
import { useEffect } from "react";

/**
 * ATAJOS DE TECLADO DEL POS
 * Registra los atajos globales en fase CAPTURE (para que el navegador
 * no se robe F5/F10/etc).
 *
 * @param {object} opts
 * @param {Function} opts.onBuscar       F1
 * @param {Function} opts.onPrecio       F2
 * @param {Function} opts.onHistorial    F3
 * @param {Function} opts.onArqueo       F4
 * @param {Function} opts.onBorrarUltima F9
 * @param {Function} opts.onCobrar       F10
 * @param {boolean}  opts.activo         false → no registra nada
 */
export function usePOSAtajos({
  onBuscar,
  onPrecio,
  onHistorial,
  onArqueo,
  onBorrarUltima,
  onCobrar,
  activo = true,
}) {
  useEffect(() => {
    if (!activo) return;

    const handler = (e) => {
      switch (e.key) {
        case "F1":
          e.preventDefault();
          onBuscar?.();
          break;
        case "F2":
          e.preventDefault();
          onPrecio?.();
          break;
        case "F3":
          e.preventDefault();
          onHistorial?.();
          break;
        case "F4":
          e.preventDefault();
          onArqueo?.();
          break;
        case "F9":
          e.preventDefault();
          onBorrarUltima?.();
          break;
        case "F10":
          e.preventDefault();
          onCobrar?.();
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [
    onBuscar,
    onPrecio,
    onHistorial,
    onArqueo,
    onBorrarUltima,
    onCobrar,
    activo,
  ]);

  return {
    buscar: () => onBuscar?.(),
    precio: () => onPrecio?.(),
    historial: () => onHistorial?.(),
    arqueo: () => onArqueo?.(),
    borrarUltima: () => onBorrarUltima?.(),
    cobrar: () => onCobrar?.(),
  };
}