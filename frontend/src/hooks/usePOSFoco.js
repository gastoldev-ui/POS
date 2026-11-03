// frontend/src/hooks/usePOSFoco.js
import { useRef, useEffect, useCallback } from "react";

export function usePOSFoco({ items, totales, modalAbierto }) {
  const inputProductoRef = useRef(null);
  const inputCantidadRef = useRef(null);
  const inputPrecioRef = useRef(null);
  const grillaRef = useRef(null);

  // Guardamos el estado del modal en un ref para que los callbacks
  // (que pueden ser viejos) lean SIEMPRE el valor actual y no le
  // roben el foco al CobroModal.
  const modalAbiertoRef = useRef(modalAbierto);
  useEffect(() => {
    modalAbiertoRef.current = modalAbierto;
  }, [modalAbierto]);

  const enfocarProducto = useCallback(() => {
    inputProductoRef.current?.focus();
    inputProductoRef.current?.select();
  }, []);

  const enfocarCantidad = useCallback(() => {
    if (modalAbiertoRef.current) return;
    inputCantidadRef.current?.focus();
    inputCantidadRef.current?.select();
  }, []);

  const enfocarPrecio = useCallback(() => {
    if (modalAbiertoRef.current) return;
    inputPrecioRef.current?.focus();
    inputPrecioRef.current?.select();
  }, []);

  const navegarCampo = useCallback(
    (origen, direccion) => {
      const CAMPOS_ORDEN = ["producto", "cantidad", "precio"];
      const idx = CAMPOS_ORDEN.indexOf(origen);
      if (idx === -1) return;
      const destinoIdx = Math.min(
        CAMPOS_ORDEN.length - 1,
        Math.max(0, idx + direccion),
      );
      const destino = CAMPOS_ORDEN[destinoIdx];

      if (destino === "producto") enfocarProducto();
      else if (destino === "cantidad") enfocarCantidad();
      else if (destino === "precio") enfocarPrecio();
    },
    [enfocarProducto, enfocarCantidad, enfocarPrecio],
  );

  const handleFlechasCampo = useCallback(
    (origen, e) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        e.stopPropagation();
        navegarCampo(origen, -1);
        return true;
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        e.stopPropagation();
        navegarCampo(origen, +1);
        return true;
      }
      return false;
    },
    [navegarCampo],
  );

  useEffect(() => {
    const t = setTimeout(() => {
      if (modalAbiertoRef.current) return;
      inputPrecioRef.current?.focus();
      inputPrecioRef.current?.select();
    }, 100);
    return () => clearTimeout(t);
  }, []);

  const ultimaFilaId = items[items.length - 1]?.id;
  useEffect(() => {
    const el = grillaRef.current;
    if (!el) return;
    const raf = requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
    return () => cancelAnimationFrame(raf);
  }, [ultimaFilaId, totales.cantidadItems]);

  return {
    refs: {
      producto: inputProductoRef,
      cantidad: inputCantidadRef,
      precio: inputPrecioRef,
      grilla: grillaRef,
    },
    enfocarProducto,
    enfocarCantidad,
    enfocarPrecio,
    navegarCampo,
    handleFlechasCampo,
  };
}