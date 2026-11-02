// frontend/src/services/posApi.js
import { api } from "../api/client.js";

/**
 * ============================================================
 * SERVICIO POS
 * ============================================================
 *
 * Wrappers sobre `api.*` con:
 *   - manejo de error uniforme (siempre tira Error con mensaje legible)
 *   - normalización del shape de respuesta
 *   - un solo punto de cambio si mañana el endpoint muta
 *
 * No tiene estado. No toca React. Es pura.
 *
 * La venta (POST /api/pos/venta) NO tiene wrapper acá a propósito:
 * CobroModal usa `api.posVenta` directo de `api/client.js` porque
 * necesita pasar `{ imprimir }` (header X-Skip-Print), que `client.js`
 * ya maneja. Si mañana necesitás un wrapper, agregalo ahí.
 */

// ==================== ARQUEO ====================

/**
 * Cierra la caja del día y devuelve el resumen.
 *
 * @param {object} opts
 * @param {number} opts.montoInicial
 * @param {number} opts.efectivoDeclarado
 * @returns {Promise<{
 *   fecha, cantidadVentas, cantidadVentasEfectivo,
 *   totalVentas, totalEfectivo,
 *   montoInicial, esperadoEnCaja,
 *   efectivoDeclarado, diferencia
 * }>}
 */
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

/**
 * Reimprime un ticket ya guardado.
 * No la usa el flujo normal (el POS imprime al cobrar), pero está
 * expuesta por si en el futuro agregamos "reimprimir última venta".
 */
export async function reimprimirTicket(ticket) {
  const data = await api.posImprimir(ticket);
  if (!data?.success) {
    throw new Error(data?.error || "No se pudo reimprimir");
  }
  return data;
}