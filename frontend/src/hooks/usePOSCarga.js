// frontend/src/hooks/usePOSCarga.js
import { useState, useCallback } from "react";

/**
 * Tope de precio. Si un EAN escaneado por error cae acá, se rechaza
 * (es el bug clásico de "pistola de códigos en el input de precio").
 */
export const TOPE_PRECIO = 999000;

/**
 * Tope de cantidad. Evita que un "9999999" tipeado por error rompa
 * los totales del ticket.
 */
export const TOPE_CANTIDAD = 9999;

/**
 * ============================================================
 * CARGA DE PRODUCTO EN LA BARRA SUPERIOR
 * ============================================================
 *
 * Maneja el estado de la barra superior:
 *   - artSeleccionado (producto del catálogo, o null → manual)
 *   - cantidad (STRING, para permitir borrar y tipear libre)
 *   - precio   (STRING, idem)
 *
 * `cantidad` es string a propósito: si fuera número, borrar el input
 * lo forzaría a 1 y no se podría tipear "2" (el clásico bug del
 * input numérico controlado). Se parsea recién en `confirmarCarga`.
 *
 * @param {object} opts
 * @param {Function} opts.onProducto  (art, cantidad, precio) → void
 * @param {Function} opts.onManual    (precio, descripcion) → void
 */
export function usePOSCarga({ onProducto, onManual }) {
  const [artSeleccionado, setArtSeleccionado] = useState(null);
  const [cantidad, setCantidad] = useState("1"); // string
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
    setCantidad("1");
    setError(null);
  }, []);

  /**
   * Deselecciona el producto del catálogo SIN tocar cantidad ni precio.
   * A diferencia de `seleccionar(null)` (que es no-op por el `if (!art) return`),
   * esto sí limpia `artSeleccionado` para que el próximo Enter en precio
   * agregue un ítem manual en vez del producto viejo.
   */
  const deseleccionar = useCallback(() => setArtSeleccionado(null), []);

  /**
   * Acepta el string tal cual, permitiendo "" (input vacío mientras
   * el usuario tipea) y dígitos. Ignora cualquier otra cosa.
   * NO clampa acá: el clamp a 1 se hace en `confirmarCarga`, para no
   * romper el tipeo intermedio.
   */
  const cambiarCantidad = useCallback((nueva) => {
    console.log("[cambiarCantidad] recibe:", JSON.stringify(nueva));
    const s = String(nueva);
    if (s === "" || /^\d+$/.test(s)) {
      setCantidad(s);
      console.log("[cambiarCantidad] setea a:", JSON.stringify(s));
    }
  }, []);

  /**
   * Suma/resta al valor actual. Si el string está vacío, parte de 1.
   * Se usa desde ↑ / ↓ en el input de cantidad.
   */
  const incrementarCantidad = useCallback((delta) => {
    setCantidad((prev) => {
      const base = prev === "" ? 1 : Number(prev) || 1;
      const n = Math.max(1, base + delta);
      return String(n);
    });
  }, []);

  const cambiarPrecio = useCallback((nuevo) => {
    setPrecio(nuevo);
    setError(null);
  }, []);

  const limpiar = useCallback(() => {
    console.log('[limpiar] llamado, resetea cantidad a "1"');
    setArtSeleccionado(null);
    setCantidad("1");
    setPrecio("");
    setError(null);
  }, []);

  /**
   * Confirma la carga en la grilla.
   *
   * Reglas:
   *  - precio > 0
   *  - precio <= TOPE_PRECIO
   *  - cantidad entre 1 y TOPE_CANTIDAD (clampea a 1 si vacío/0)
   *  - si hay art seleccionado → onProducto(art, cantidad, precio)
   *  - si no → onManual(precio, descripcionTipeada || "Art. Kiosco")
   *
   * Devuelve { ok: boolean, error?: string }.
   */
  const confirmarCarga = useCallback(
    (descripcionTipeada = "") => {
      const precioNum = Number(precio) || 0;
      const cantNum = Math.max(1, Math.floor(Number(cantidad) || 0));

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

      if (cantNum > TOPE_CANTIDAD) {
        setError(`La cantidad no puede superar ${TOPE_CANTIDAD}`);
        return { ok: false, error: "cantidad>tope" };
      }

      if (artSeleccionado) {
        onProducto?.(artSeleccionado, cantNum, precioNum);
      } else {
        const desc = String(descripcionTipeada || "").trim() || "Art. Kiosco";
        onManual?.(precioNum, desc);
      }

      limpiar();
      return { ok: true };
    },
    [precio, cantidad, artSeleccionado, onProducto, onManual, limpiar],
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
    incrementarCantidad,
    cambiarPrecio,
    limpiar,
    confirmarCarga,
    setError,
  };
}
