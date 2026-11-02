// frontend/src/services/posApi.js
import { api } from "../api/client.js";

/**
 * Wrappers sobre `api.*` con manejo de error uniforme y normalización.
 * No tiene estado. No toca React.
 */

// ==================== ARQUEO ====================

export async function cerrarCaja({ montoInicial, efectivoDeclarado }) {
  const inicial = Number(montoInicial);
  const declarado = Number(efectivoDeclarado);

  if (!Number.isFinite(inicial) || inicial < 0) {
    throw new Error("Monto inicial inválido");
  }
  if (!Number.isFinite(declarado) || declarado < 0) {
    throw new Error("Efectivo declarado inválido");
  }

  const data = await api.posCerrarCaja(inicial, declarado);

  if (!data?.success || !data.resumen) {
    throw new Error(data?.error || "El backend no devolvió un resumen válido");
  }

  return data.resumen;
}

// ==================== REIMPRESIÓN ====================

export async function reimprimirTicket(ticket) {
  const data = await api.posImprimir(ticket);
  if (!data?.success) {
    throw new Error(data?.error || "No se pudo reimprimir");
  }
  return data;
}

// ==================== VENTAS POR FECHA ====================

/**
 * Trae las ventas de una fecha (YYYY-MM-DD). Si `fecha` es falsy, hoy.
 * Devuelve un array de ventas ordenado de más nueva a más vieja.
 * Si el archivo no existe, el backend devuelve [] (no error).
 */
export async function getVentasPorFecha(fecha) {
  const data = await api.posVentasHoy(fecha);
  if (!data?.success || !Array.isArray(data.ventas)) {
    throw new Error(data?.error || "Respuesta inválida del backend");
  }
  return [...data.ventas].reverse();
}

// ==================== RESUMEN DEL DÍA ====================

/**
 * Resumen agregado del día (server-side). Devuelve:
 * { fecha, cantidadVentas, totalFacturado, porMetodo: { Efectivo: N, ... } }
 */
export async function getResumenDia(fecha) {
  const data = await api.posResumenDia(fecha);
  if (!data?.success) {
    throw new Error(data?.error || "No se pudo obtener el resumen del día");
  }
  return {
    fecha: data.fecha,
    cantidadVentas: data.cantidadVentas ?? 0,
    totalFacturado: data.totalFacturado ?? 0,
    porMetodo: data.porMetodo ?? {},
  };
}

// ==================== SIGUIENTE TICKET ====================

/**
 * Devuelve el próximo ID de ticket (formateado, p.ej. "T-00042") SIN
 * reservarlo. Es informativo para la UI: la reserva real ocurre al
 * guardar la venta en POST /api/pos/venta.
 */
export async function getSiguienteTicket() {
  const data = await api.posSiguienteTicket();
  if (!data?.success || !data.id) {
    throw new Error(data?.error || "No se pudo obtener el próximo ticket");
  }
  return data.id;
}