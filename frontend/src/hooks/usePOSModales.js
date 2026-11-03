// frontend/src/hooks/usePOSModales.js
import { useState, useRef, useCallback } from "react";

/**
 * ============================================================
 * MODALES DEL POS
 * ============================================================
 *
 * Agrupa el estado de apertura/cierre de los 3 modales del POS
 * (Cobro, Arqueo, Historial) y el mecanismo anti-fuga del Enter
 * residual que vive en `enterBloqueadoRef`.
 *
 * El Enter residual es el que dispara el modal al confirmar y que,
 * si no se frena, se filtra al POS de atrás y dispara una carga de
 * producto no deseada. Lo bloqueamos por 150ms tras cada cierre.
 *
 * `cerrarCobro` recibe un callback `onFocoPrecio` opcional porque
 * el hook NO debe saber de refs. PanelPOS le pasa la función que
 * devuelve el foco al input de Precio 200ms después del cierre
 * (mismo timing que tenía el código original).
 */
export function usePOSModales() {
  const [cobroAbierto, setCobroAbierto] = useState(false);
  const [arqueoAbierto, setArqueoAbierto] = useState(false);
  const [historialAbierto, setHistorialAbierto] = useState(false);

  // Flag para ignorar el Enter residual que viene del modal de cobro/arqueo
  const enterBloqueadoRef = useRef(false);

  const bloquearEnterResidual = useCallback(() => {
    enterBloqueadoRef.current = true;
    setTimeout(() => {
      enterBloqueadoRef.current = false;
    }, 150);
  }, []);

  const abrirCobro = useCallback(() => setCobroAbierto(true), []);
  const abrirArqueo = useCallback(() => setArqueoAbierto(true), []);
  const abrirHistorial = useCallback(() => setHistorialAbierto(true), []);

  const cerrarCobro = useCallback(
    (onFocoPrecio) => {
      setCobroAbierto(false);
      bloquearEnterResidual();
      // 200ms da tiempo a React a limpiar el modal y a CobroModal a
      // soltar el foco antes de devolvérselo a Precio.
      setTimeout(() => {
        onFocoPrecio?.();
      }, 200);
    },
    [bloquearEnterResidual],
  );

  const cerrarArqueo = useCallback(() => {
    setArqueoAbierto(false);
    bloquearEnterResidual();
  }, [bloquearEnterResidual]);

  const cerrarHistorial = useCallback(() => {
    setHistorialAbierto(false);
    bloquearEnterResidual();
  }, [bloquearEnterResidual]);

  return {
    // estado
    cobroAbierto,
    arqueoAbierto,
    historialAbierto,
    // aperturas
    abrirCobro,
    abrirArqueo,
    abrirHistorial,
    // cierres
    cerrarCobro,
    cerrarArqueo,
    cerrarHistorial,
    // anti-fuga
    enterBloqueadoRef,
  };
}