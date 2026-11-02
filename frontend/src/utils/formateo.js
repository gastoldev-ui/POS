// src/utils/formateo.js
export function formatearPrecio(n) {
  const num = Number(n) || 0;
  return num.toLocaleString('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}