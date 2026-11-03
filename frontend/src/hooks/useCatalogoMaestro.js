// frontend/src/hooks/useCatalogoMaestro.js
//
// Hook que trae el catálogo maestro del backend y lo cachea en memoria.
//
// Contrato:
//   const { productos, cargando, error, recargar } = useCatalogoMaestro();
//
// - `productos`: array de productos ya normalizados al shape que espera
//   el POS (con costoUnitario, nombre, sku, etc.). [] mientras carga.
// - `cargando`: true en el primer fetch o cuando se llama a recargar().
// - `error`: string | null.
// - `recargar()`: fuerza un re-fetch (útil después de importar o editar).
//
// Se monta UNA sola vez (en PanelPOS) y comparte el cache vía módulo.
// Si el backend devuelve 0 productos, `productos` es [] pero NO es error.

import { useState, useEffect, useCallback } from "react";
import { api } from "../api/client.js";

// Cache a nivel módulo. Si dos componentes usan el hook, no duplican fetch.
let _cache = null; // { productos, ts }
const CACHE_TTL_MS = 30 * 1000; // 30s. Si pasa, refetchea al montar.

export function useCatalogoMaestro() {
  const [productos, setProductos] = useState(() => _cache?.productos || []);
  const [cargando, setCargando] = useState(!_cache);
  const [error, setError] = useState(null);

  const fetchCatalogo = useCallback(async ({ force = false } = {}) => {
    // Si hay cache fresco y no se fuerza, no hacemos nada.
    if (
      !force &&
      _cache &&
      Date.now() - _cache.ts < CACHE_TTL_MS
    ) {
      setProductos(_cache.productos);
      setCargando(false);
      setError(null);
      return _cache.productos;
    }

    setCargando(true);
    setError(null);
    try {
      const data = await api.catalogoMaestroListar();
      const lista = Array.isArray(data?.productos) ? data.productos : [];
      _cache = { productos: lista, ts: Date.now() };
      setProductos(lista);
      return lista;
    } catch (e) {
      console.error("[useCatalogoMaestro] error:", e);
      setError(e.message);
      // En caso de error, dejamos los productos que ya teníamos (si había).
      return productos;
    } finally {
      setCargando(false);
    }
  }, [productos]);

  // Fetch inicial.
  useEffect(() => {
    fetchCatalogo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // `recargar` fuerza re-fetch (ignora cache).
  const recargar = useCallback(() => fetchCatalogo({ force: true }), [fetchCatalogo]);

  // `invalidar` limpia el cache (útil si otro componente sabe que cambió).
  const invalidar = useCallback(() => {
    _cache = null;
  }, []);

  return {
    productos,
    cargando,
    error,
    recargar,
    invalidar,
  };
}