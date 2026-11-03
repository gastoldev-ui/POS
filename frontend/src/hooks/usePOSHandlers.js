// frontend/src/hooks/usePOSHandlers.js
import { useCallback } from "react";

/**
 * ============================================================
 * HANDLERS DE LA BARRA DE CARGA Y DE LA GRILLA
 * ============================================================
 *
 * Extrae de PanelPOS los handlers que conectan:
 *   - usePOSFoco     (flechas entre campos, foco a Precio)
 *   - usePOSBusqueda (cambio de texto, Enter en Producto)
 *   - usePOSCarga    (cambiar cantidad/precio, confirmar carga)
 *   - usePOSModales  (enterBloqueadoRef para el Enter residual)
 *   - POSContext     (editarPrecio / editarCantidad de la grilla)
 *
 * NO tiene estado propio. NO toca refs directamente (los recibe via
 * `foco`). Devuelve un objeto con handlers estables (useCallback)
 * listos para enchufar en <BarraCarga> y <GrillaItems>.
 *
 * @param {object} opts
 * @param {object} opts.foco         usePOSFoco()
 * @param {object} opts.busqueda     usePOSBusqueda()
 * @param {object} opts.carga        usePOSCarga()
 * @param {object} opts.modales      usePOSModales()
 * @param {object} opts.pos          usePOS()
 */
export function usePOSHandlers({ foco, busqueda, carga, modales, pos }) {
  // ==================== SELECCIÓN DE PRODUCTO ====================
  // Se dispara desde: Enter en Producto, clic en el dropdown.
  // Setea la búsqueda con el nombre, cierra el dropdown, selecciona
  // el art en carga (precarga costo), y manda el foco a Precio.
  const seleccionarProducto = useCallback(
    (art) => {
      busqueda.setBusqueda(art.nombre);
      busqueda.cerrar();
      carga.seleccionar(art);
      setTimeout(foco.enfocarPrecio, 50);
    },
    [busqueda, carga, foco],
  );

  // ==================== PRODUCTO ====================

  const handleProductoChange = useCallback(
    (valor) => {
      busqueda.handleChange(valor);
      carga.setError(null);
      if (carga.artSeleccionado) carga.deseleccionar();
    },
    [busqueda, carga],
  );

  const handleProductoKeyDown = useCallback(
    (e) => {
      if (foco.handleFlechasCampo("producto", e)) return;
      const res = busqueda.handleKeyDown(e);
      if (!res) return;
      if (res.tipo === "seleccionar") {
        seleccionarProducto(res.art);
      } else if (res.tipo === "pasar-a-precio") {
        foco.enfocarPrecio();
      }
    },
    [foco, busqueda, seleccionarProducto],
  );

  // ==================== CANTIDAD ====================

  const handleCantidadChange = useCallback(
    (valor) => {
      carga.cambiarCantidad(valor);
    },
    [carga],
  );

  const handleCantidadKeyDown = useCallback(
    (e) => {
      if (foco.handleFlechasCampo("cantidad", e)) return;
      if (e.key === "ArrowUp") {
        e.preventDefault();
        e.stopPropagation();
        carga.incrementarCantidad(1);
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        e.stopPropagation();
        carga.incrementarCantidad(-1);
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        foco.enfocarPrecio();
      }
    },
    [foco, carga],
  );

  // ==================== PRECIO / CONFIRMAR ====================
  // El Enter en Precio es el punto de entrada a la grilla. Tiene el
  // guard `enterBloqueadoRef` para no procesar el Enter residual que
  // viene del cierre de un modal.

  const confirmarCargaYLimpiar = useCallback(() => {
    console.log(
      "[confirmarCargaYLimpiar] cantidad actual:",
      JSON.stringify(carga.cantidad),
      "precio:",
      JSON.stringify(carga.precio),
    );
    const descripcionTipeada = busqueda.busqueda;
    const r = carga.confirmarCarga(descripcionTipeada);
    if (r.ok) {
      busqueda.limpiar();
    }
    setTimeout(foco.enfocarPrecio, 50);
  }, [busqueda, carga, foco]);

  const handlePrecioChange = useCallback(
    (valor) => {
      carga.cambiarPrecio(valor);
    },
    [carga],
  );

  const handlePrecioKeyDown = useCallback(
    (e) => {
      if (foco.handleFlechasCampo("precio", e)) return;
      if (e.key === "Enter") {
        e.preventDefault();
        if (modales.enterBloqueadoRef.current) return;
        confirmarCargaYLimpiar();
      }
    },
    [foco, modales, confirmarCargaYLimpiar],
  );

  // ==================== GRILLA (edición inline) ====================
  // Los guards de validación viven acá (no en GrillaItems, que es
  // puramente visual). Mismos límites que antes del refactor.

  const handleEditarPrecio = useCallback(
    (id, valor) => {
      const n = Number(valor);
      if (Number.isFinite(n) && n >= 0 && n <= 999000) {
        pos.editarPrecio(id, n);
      }
    },
    [pos],
  );

  const handleEditarCantidad = useCallback(
    (id, valor) => {
      const n = parseInt(valor, 10);
      if (Number.isFinite(n) && n >= 1) {
        pos.editarCantidad(id, n);
      }
    },
    [pos],
  );

  return {
    // selección
    seleccionarProducto,
    // producto
    handleProductoChange,
    handleProductoKeyDown,
    // cantidad
    handleCantidadChange,
    handleCantidadKeyDown,
    // precio / confirmar
    handlePrecioChange,
    handlePrecioKeyDown,
    confirmarCargaYLimpiar,
    // grilla
    handleEditarPrecio,
    handleEditarCantidad,
  };
}