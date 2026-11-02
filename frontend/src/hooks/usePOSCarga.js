// frontend/src/hooks/usePOSCarga.js
import { useState, useCallback } from "react";

/**
 * Tope de precio. Si un EAN escaneado por error cae acá, se rechaza
 * (es el bug clásico de "pistola de códigos en el input de precio").
 */
export const TOPE_PRECIO = 999000;

/**
 * ============================================================
 * CARGA DE PRODUCTO EN LA BARRA SUPERIOR
 * ============================================================
 *
 * Maneja el estado de la barra superior:
 *   - artSeleccionado (producto del catálogo, o null → manual)
 *   - cantidad
 *   - precio (string, para permitir tipeo libre)
 *
 * Y expone `confirmarCarga()` con todas las validaciones.
 *
 * No sabe nada de POSContext ni del backend. El caller le pasa
 * los callbacks `onProducto` y `onManual` que se encargan de la
 * mutación real.
 *
 * @param {object} opts
 * @param {Function} opts.onProducto  (art, cantidad, precio) → void
 * @param {Function} opts.onManual    (precio, descripcion) → void
 */
export function usePOSCarga({ onProducto, onManual }) {
  const [artSeleccionado, setArtSeleccionado] = useState(null);
  const [cantidad, setCantidad] = useState(1);
  const [precio, setPrecio] = useState("");
  const [error, setError] = useState(null);

  /**
   * Selecciona un producto del catálogo.
   * Precarga su costo como precio por defecto y resetea cantidad a 1.
   */
  const seleccionar = useCallback((art) => {
    if (!art) return;
    setArtSeleccionado(art);

    const costo = Number(
      art.costoConDescuento ?? art.costoUnitario ?? art.precio ?? 0,
    );
    setPrecio(costo > 0 ? costo.toFixed(2) : "");
    setCantidad(1);
    setError(null);
  }, []);

  /**
   * Deselecciona el producto del catálogo SIN tocar cantidad ni precio.
   * A diferencia de `seleccionar(null)` (que es no-op por el `if (!art) return`),
   * esto sí limpia `artSeleccionado` para que el próximo Enter en precio
   * agregue un ítem manual en vez del producto viejo.
   */
  const deseleccionar = useCallback(() => setArtSeleccionado(null), []);

  const cambiarCantidad = useCallback((nueva) => {
    const n = Number(nueva);
    if (!Number.isFinite(n)) return;
    setCantidad(Math.max(1, Math.floor(n)));
  }, []);

  const cambiarPrecio = useCallback((nuevo) => {
    setPrecio(nuevo);
    setError(null);
  }, []);

  const limpiar = useCallback(() => {
    setArtSeleccionado(null);
    setCantidad(1);
    setPrecio("");
    setError(null);
  }, []);

  /**
   * Confirma la carga en la grilla.
   *
   * Reglas:
   *  - precio > 0
   *  - precio <= TOPE_PRECIO
   *  - si hay art seleccionado → onProducto(art, cantidad, precio)
   *  - si no → onManual(precio, descripcionTipeada || "Art. Kiosco")
   *
   * Devuelve { ok: boolean, error?: string }.
   */
  const confirmarCarga = useCallback(
    (descripcionTipeada = "") => {
      const precioNum = Number(precio) || 0;

      if (precioNum <= 0) {
        setError("El precio debe ser mayor a 0");
        return { ok: false, error: "precio<=0" };
      }

      if (precioNum > TOPE_PRECIO) {
        setError(
          `El precio no puede superar los $${TOPE_PRECIO.toLocaleString(
            "es-AR",
          )} (¿Escaneaste un código por error?)`,
        );
        return { ok: false, error: "precio>tope" };
      }

      if (artSeleccionado) {
        onProducto?.(artSeleccionado, cantidad, precioNum);
      } else {
        const desc = String(descripcionTipeada || "").trim() || "Art. Kiosco";
        onManual?.(precioNum, desc);
      }

      limpiar();
      return { ok: true };
    },
    [precio, artSeleccionado, cantidad, onProducto, onManual, limpiar],
  );

  return {
    // estado
    artSeleccionado,
    cantidad,
    precio,
    error,
    // acciones
    seleccionar,
    deseleccionar,
    cambiarCantidad,
    cambiarPrecio,
    limpiar,
    confirmarCarga,
    setError,
  };
}
