// frontend/src/hooks/usePOSBusqueda.js
import { useState, useMemo, useCallback } from "react";

/**
 * ============================================================
 * BÚSQUEDA / DROPDOWN DE PRODUCTOS DEL POS
 * ============================================================
 *
 * Maneja:
 *   - texto del input
 *   - apertura/cierre del dropdown
 *   - índice seleccionado (flechas ↑↓)
 *   - filtrado en memoria (nombre / marca / sku)
 *   - selección con Enter
 *
 * @param {Array} catalogo  Productos cargados del proveedor actual
 * @param {number} maxResultados
 */
export function usePOSBusqueda(catalogo, maxResultados = 8) {
  const [busqueda, setBusqueda] = useState("");
  const [dropAbierto, setDropAbierto] = useState(false);
  const [indiceDrop, setIndiceDrop] = useState(0);

  const resultados = useMemo(() => {
    const t = busqueda.trim().toLowerCase();
    if (!t) return [];
    return (catalogo || [])
      .filter((a) => {
        const blob = `${a.nombre || ""} ${a.marca || ""} ${a.sku || ""}`.toLowerCase();
        return blob.includes(t);
      })
      .slice(0, maxResultados);
  }, [busqueda, catalogo, maxResultados]);

  /**
   * Busca por coincidencia EXACTA de sku/refId (para escaneo).
   * Devuelve el producto o null.
   */
  const buscarPorCodigo = useCallback(
    (codigo) => {
      const t = String(codigo || "").trim().toLowerCase();
      if (!t) return null;
      return (
        (catalogo || []).find(
          (a) =>
            String(a.sku || "").toLowerCase() === t ||
            String(a.refId || "").toLowerCase() === t,
        ) || null
      );
    },
    [catalogo],
  );

  const handleChange = useCallback((valor) => {
    setBusqueda(valor);
    setDropAbierto(valor.length > 0);
    setIndiceDrop(0);
  }, []);

  const cerrar = useCallback(() => {
    setDropAbierto(false);
  }, []);

  const limpiar = useCallback(() => {
    setBusqueda("");
    setDropAbierto(false);
    setIndiceDrop(0);
  }, []);

  /**
   * Maneja teclas del input del dropdown.
   * Devuelve la acción a ejecutar (o null si no aplica).
   *
   * - ArrowDown / ArrowUp → mueve índice
   * - Enter con dropdown abierto → selecciona el del índice
   * - Escape → cierra
   * - Enter con dropdown cerrado → intenta buscar por código exacto
   *
   * El caller decide qué hacer con el producto devuelto.
   */
  const handleKeyDown = useCallback(
    (e) => {
      if (dropAbierto && resultados.length > 0) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setIndiceDrop((prev) => (prev + 1) % resultados.length);
          return { tipo: "navegar" };
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setIndiceDrop(
            (prev) => (prev - 1 + resultados.length) % resultados.length,
          );
          return { tipo: "navegar" };
        }
        if (e.key === "Enter") {
          e.preventDefault();
          const art = resultados[indiceDrop];
          return art ? { tipo: "seleccionar", art } : { tipo: "vacio" };
        }
        if (e.key === "Escape") {
          e.preventDefault();
          setDropAbierto(false);
          return { tipo: "cerrar" };
        }
      } else if (e.key === "Enter") {
        e.preventDefault();
        const art = buscarPorCodigo(busqueda);
        return art
          ? { tipo: "seleccionar", art }
          : { tipo: "pasar-a-precio" };
      }
      return null;
    },
    [dropAbierto, resultados, indiceDrop, buscarPorCodigo, busqueda],
  );

  return {
    // estado
    busqueda,
    dropAbierto,
    indiceDrop,
    resultados,
    // acciones
    setBusqueda,
    setIndiceDrop,
    handleChange,
    handleKeyDown,
    cerrar,
    limpiar,
    buscarPorCodigo,
  };
}