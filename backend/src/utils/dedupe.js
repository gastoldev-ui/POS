// backend/src/utils/dedupe.js

/**
 * Normaliza un texto para usarlo como clave de deduplicación.
 * - Pasa a minúsculas.
 * - Elimina tildes/diacríticos.
 * - Quita puntos y comas.
 * - Colapsa espacios múltiples.
 *
 * @param {string} str El texto a normalizar.
 * @returns {string} El texto normalizado.
 */
export function normalizarClave(str) {
  return String(str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Saca acentos
    .replace(/[.,]/g, '')           // Saca puntos y comas
    .replace(/\s+/g, ' ')            // Colapsa espacios
    .trim();
}

/**
 * Deduplica un array de productos de forma inteligente.
 *
 * ¿Por qué no usar solo el SKU?
 * Porque proveedores como Golomax usan el mismo `Codigo` para distintas
 * variantes de un producto (ej: Ferrero Rocher x3u y x8u pueden llegar a
 * compartir código en algunas respuestas de la API).
 *
 * ¿Por qué no usar solo `sku + nombre`?
 * Porque el mismo producto puede llegar con "Nombre" y "Nombre." (con punto).
 * La normalización del nombre resuelve eso.
 *
 * Lógica:
 *   1. La clave de unicidad es `SKU + Nombre Normalizado`.
 *   2. Si dos productos tienen la misma clave, se considera un duplicado real.
 *   3. En caso de duplicado, se prioriza el que tenga `stock > 0`.
 *
 * @param {Array<object>} productos El array de productos a deduplicar.
 * @param {string} [skuField='sku'] El nombre del campo que contiene el SKU.
 * @param {string} [nombreField='nombre'] El nombre del campo del nombre.
 * @returns {Array<object>} El array deduplicado.
 */
export function deduplicarProductos(productos, skuField = 'sku', nombreField = 'nombre') {
  if (!Array.isArray(productos)) return [];

  const productosPorClave = new Map();

  for (const p of productos) {
    const sku = p[skuField];
    const nombre = p[nombreField];

    // Si no hay SKU ni nombre, no podemos deduplicar. Lo dejamos pasar.
    if (!sku && !nombre) {
      // Usamos un id único para que no colisione con otros productos sin id.
      const claveFailsafe = `__FAILSAFE__${Math.random()}`;
      productosPorClave.set(claveFailsafe, p);
      continue;
    }

    // La clave de deduplicación es el SKU + nombre normalizado.
    const clave = `${sku || ''}__${normalizarClave(nombre)}`;

    const existente = productosPorClave.get(clave);

    if (!existente) {
      productosPorClave.set(clave, p);
      continue;
    }

    // Si ya existe, nos quedamos con el que tenga stock.
    const stockExistente = Number(existente.stock) || 0;
    const stockNuevo = Number(p.stock) || 0;

    // Si el existente no tiene stock y el nuevo sí, lo reemplazamos.
    if (stockExistente <= 0 && stockNuevo > 0) {
      productosPorClave.set(clave, p);
    }
    // Si ambos tienen stock o ambos no, el primero gana.
  }

  return Array.from(productosPorClave.values());
}