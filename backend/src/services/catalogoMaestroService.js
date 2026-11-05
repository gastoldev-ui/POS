// backend/src/services/catalogoMaestroService.js
//
// Servicio central del catálogo maestro del POS.
//
// Responsabilidades:
//   - Leer / escribir el JSON único del catálogo (con backup automático).
//   - Normalizar productos al shape canónico.
//   - Merge no-destructivo desde un import de Excel.
//   - CRUD individual (crear/editar/eliminar con soft-delete).
//
// Lo que NO hace:
//   - No sabe de Excel (eso lo hace importacionService.js).
//   - No sabe de HTTP (eso lo hacen las routes).
//   - No sabe de proveedores (el POS no tiene proveedores, tiene un
//     único catálogo propio).

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";
import {
  normalizarListaImagenes,
  urlDeImagen,
  borrarArchivoImagen,
  MAX_IMAGENES,
} from "./imagenesService.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ==================== RUTAS ====================

const DATA_DIR = path.resolve(__dirname, "../../data/pos");
const CATALOGO_PATH = path.join(DATA_DIR, "catalogo-maestro.json");
const BACKUP_DIR = path.join(DATA_DIR, "backups");
const IMG_DIR = path.join(DATA_DIR, "img", "productos");

// ==================== HELPERS DE FECHA/ID ====================

function ahoraISO() {
  return new Date().toISOString();
}

function timestampParaArchivo() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

// ==================== HELPERS DE FS ====================

function asegurarDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Crea un backup del catálogo actual ANTES de escribir.
 * Nombre: backups/catalogo-maestro.backup-<timestamp>.json
 * Si no existe el catálogo todavía, no hace nada (no hay qué respaldar).
 */
function hacerBackup() {
  if (!fs.existsSync(CATALOGO_PATH)) return null;
  asegurarDir(BACKUP_DIR);
  const backupPath = path.join(
    BACKUP_DIR,
    `catalogo-maestro.backup-${timestampParaArchivo()}.json`,
  );
  try {
    fs.copyFileSync(CATALOGO_PATH, backupPath);
    return backupPath;
  } catch (e) {
    console.error("⚠️ [catalogo-maestro] No se pudo hacer backup:", e.message);
    return null;
  }
}

// ==================== LECTURA / ESCRITURA ====================

/**
 * Lee el catálogo maestro. Devuelve [] si no existe.
 * Filtra entradas corruptas (sin sku) para que el POS no rompa.
 */
export function leerCatalogoMaestro() {
  if (!fs.existsSync(CATALOGO_PATH)) return [];
  try {
    const raw = fs.readFileSync(CATALOGO_PATH, "utf-8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((p) => p && typeof p.sku === "string" && p.sku.trim());
  } catch (e) {
    console.error("⚠️ [catalogo-maestro] JSON corrupto:", e.message);
    return [];
  }
}

/**
 * Escribe el catálogo completo. Hace backup automático antes.
 * Devuelve { path, backupPath, cantidad }.
 */
export function guardarCatalogoMaestro(productos) {
  if (!Array.isArray(productos)) {
    throw new Error("guardarCatalogoMaestro: se esperaba un array");
  }
  asegurarDir(DATA_DIR);
  const backupPath = hacerBackup();
  fs.writeFileSync(CATALOGO_PATH, JSON.stringify(productos, null, 2), "utf-8");
  return {
    path: CATALOGO_PATH,
    backupPath,
    cantidad: productos.length,
  };
}

// ==================== NORMALIZACIÓN ====================

/**
 * Genera un nombre corto a partir del nombre completo.
 *
 * Heurística:
 *   - Saca la marca del nombre si ya está (ej: "Aguila Alfajor... Aguila").
 *   - Toma las primeras 2-3 palabras significativas (>2 chars).
 *   - Si hay una medida (ej: "71.5g", "500ml"), la agrega al final.
 *
 * Ejemplos:
 *   "Alfajor Águila Minitorta Clásica 71.5g" → "Alfajor Águila 71.5g"
 *   "Chocolate Cofler Block 170g"            → "Chocolate Cofler 170g"
 *   "Galletitas Bagley Criollitas 300g"      → "Galletitas Bagley 300g"
 */
export function generarNombreCorto(nombreCompleto) {
  const nombre = String(nombreCompleto || "").trim();
  if (!nombre) return "";

  // 1. Extraer medida (ej: "71.5g", "1.5l", "500ml", "12u")
  const medidaMatch = nombre.match(
    /\b(\d+(?:[.,]\d+)?)\s*(g|gr|grs|kg|ml|cc|lt|lts|l|u|un|unidades?)\b/i,
  );
  const medida = medidaMatch
    ? `${medidaMatch[1].replace(",", ".")}${medidaMatch[2].toLowerCase()}`
    : "";

  // 2. Limpiar: sacar la medida y símbolos raros para tokenizar
  const sinMedida = medida
    ? nombre.replace(medidaMatch[0], "").trim()
    : nombre;

  const tokens = sinMedida
    .replace(/[^\wáéíóúñüÁÉÍÓÚÑÜ\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2);

  // 3. Quedarnos con las primeras 2-3 palabras
  const corto = tokens.slice(0, 3).join(" ");

  return medida ? `${corto} ${medida}`.trim() : corto;
}

/**
 * Calcula el precio de venta a partir del costo y un margen (multiplicador).
 * margen = 1.43 → precio = costo * 1.43
 */
export function calcularPrecioVenta(costo, margen = 1.43) {
  const c = Number(costo) || 0;
  const m = Number(margen) || 1.43;
  return Math.round(c * m * 100) / 100;
}

/**
 * Normaliza un producto al shape canónico del catálogo maestro.
 *
 * - Aplica defaults.
 * - Genera nombreCorto si falta.
 * - Calcula precioVenta si falta.
 * - Completa codigosBarras, editadoManualmente, origen.
 * - Incluye uxB (unidades por bulto) con default 6.
 * - Incluye precioBulto independiente (si no viene, lo calcula).
 * - NO toca campos existentes que ya estén definidos (respeta ediciones).
 *
 * @param {object} prod - Producto crudo (de Excel, migración, etc.)
 * @param {object} origen - { tipo, importacionId?, refId? }
 * @param {object} opts - { margenDefault? }
 */
export function normalizarProductoMaestro(prod, origen = {}, opts = {}) {
  if (!prod) throw new Error("normalizarProductoMaestro: prod vacío");

  const sku = String(prod.sku || prod.refId || "").trim();
  if (!sku) throw new Error("normalizarProductoMaestro: producto sin sku");

  const margenDefault = Number(opts.margenDefault) || 1.43;
  const ahora = ahoraISO();

  const costoUnitario =
    Number(prod.costoUnitario ?? prod.precio ?? 0) || 0;

  // precioVenta: si viene definido y > 0, lo respetamos.
  // Si no, lo calculamos con el margen default.
  const precioVentaDefinido = Number(prod.precioVenta);
  const precioVenta =
    Number.isFinite(precioVentaDefinido) && precioVentaDefinido > 0
      ? precioVentaDefinido
      : calcularPrecioVenta(costoUnitario, margenDefault);

  const uxB = Math.max(1, Math.floor(Number(prod.uxB) || 6));

  // precioBulto: si viene definido y > 0, lo respetamos.
  // Si no, lo calculamos (precioVenta * uxB).
  const precioBultoDefinido = Number(prod.precioBulto);
  const precioBulto =
    Number.isFinite(precioBultoDefinido) && precioBultoDefinido > 0
      ? precioBultoDefinido
      : precioVenta * uxB;

  const margenDisplay =
    Number(prod.margenDisplay) ||
    (costoUnitario > 0
      ? Math.round((precioVenta / costoUnitario) * 100) / 100
      : margenDefault);

  const codigosBarras = Array.isArray(prod.codigosBarras)
    ? prod.codigosBarras.filter(Boolean).map(String)
    : [sku].filter(Boolean);

  // Imágenes: hasta MAX_IMAGENES por producto. Aceptamos tanto el formato
  // nuevo (`imagenes`: array de {archivo, alt, orden}) como el viejo
  // (`imagen`: string suelto) y lo normalizamos.
  //
  // `imagen` se mantiene como CAMPO DERIVADO = la principal (imagenes[0]).
  // Eso preserva la compatibilidad con el POS, que ya lee `art.imagen`.
  const imagenes = normalizarListaImagenes(prod);

  return {
    sku,
    nombre: String(prod.nombre || prod.nombreCompleto || "Sin nombre").trim(),
    nombreCorto:
      String(prod.nombreCorto || "").trim() ||
      generarNombreCorto(prod.nombre || ""),
    marca: String(prod.marca || "").trim(),
    categoria: String(prod.categoria || "Sin categoría").trim(),
    subcategoria: String(prod.subcategoria || "").trim(),
    codigosBarras,
    precioVenta,
    // 👇 Campos nuevos/actualizados
    precioBulto: Math.round(precioBulto * 100) / 100,
    uxB,
    // 👆
    costoUnitario,
    margenDisplay,
    stock: Math.max(0, Math.floor(Number(prod.stock) || 0)),
    activo: prod.activo !== false,
    imagenes,
    imagen: urlDeImagen(imagenes[0]) || null,
    origen: {
      tipo: origen.tipo || prod.origen?.tipo || "manual",
      importacionId:
        origen.importacionId || prod.origen?.importacionId || null,
      refId: origen.refId || prod.origen?.refId || sku,
      ultimaImportacionSinEsteSku:
        prod.origen?.ultimaImportacionSinEsteSku || null,
    },
    editadoManualmente: {
      nombreCorto: Boolean(prod.editadoManualmente?.nombreCorto),
      precioVenta: Boolean(prod.editadoManualmente?.precioVenta),
      precioBulto: Boolean(prod.editadoManualmente?.precioBulto),
      ...(prod.editadoManualmente || {}),
    },
    creadoEn: prod.creadoEn || ahora,
    actualizadoEn: ahora,
  };
}

// ==================== MERGE NO-DESTRUCTIVO ====================

/**
 * Campos que el import SIEMPRE actualiza (aunque el dueño los haya editado).
 * `stock` va acá: el import refleja el stock real del proveedor.
 */
const CAMPOS_SIEMPRE_ACTUALIZA = [
  "stock",
  "costoUnitario",
  "codigosBarras",
  "actualizadoEn",
];

/**
 * Campos que respetan `editadoManualmente`. Si el dueño los tocó, NO se pisan.
 */
const CAMPOS_RESPETAN_EDICION = [
  "nombreCorto",
  "precioVenta",
  "precioBulto",
  "nombre",
  "marca",
  "categoria",
  "subcategoria",
];

/**
 * Campos que el import de Excel NUNCA toca.
 *
 * `imagenes` / `imagen` van acá a propósito: las fotos se suben a mano
 * desde el Admin. El Excel no trae archivos, así que si lo dejaramos
 * pasar, cada import borraría las fotos ya cargadas.
 * (El campo "URL Imagen" del Excel sigue funcionando para productos
 * NUEVOS, vía normalizarProductoMaestro; lo que protegemos es el merge.)
 */
const CAMPOS_SOLO_MANUAL = ["imagenes", "imagen"];

/**
 * Aplica el resultado de un import al catálogo maestro.
 *
 * Reglas:
 *   1. Productos del maestro con SKU en el import → actualizar.
 *   2. Productos del maestro con SKU que NO está en el import → marcar
 *      `origen.ultimaImportacionSinEsteSku` con el importId actual.
 *      NO se borran.
 *   3. Productos del import que NO están en el maestro → agregar (nuevos).
 *   4. Campos en `CAMPOS_RESPETAN_EDICION` con `editadoManualmente[campo] = true`
 *      no se pisan.
 *   5. `stock`, `costoUnitario` y `codigosBarras` se pisan SIEMPRE.
 *
 * @param {string} importacionId - ID del import (ej: "2026-11-03-ruta9")
 * @param {Array} productosImport - Productos ya normalizados (con SKU)
 * @param {object} opts - { margenDefault? }
 * @returns {{ catalogo, reporte, backupPath }}
 */
export function importarDesdeProveedor(importacionId, productosImport, opts = {}) {
  if (!importacionId) throw new Error("importarDesdeProveedor: falta importacionId");
  if (!Array.isArray(productosImport)) {
    throw new Error("importarDesdeProveedor: productosImport no es array");
  }

  const maestro = leerCatalogoMaestro();
  const porSku = new Map(maestro.map((p) => [p.sku, p]));

  const reporte = {
    importacionId,
    fecha: ahoraISO(),
    nuevos: 0,
    actualizados: 0,
    sinCambios: 0,
    noEnImport: 0,
    conflictos: [],
    totalMaestroAntes: maestro.length,
    totalMaestroDespues: 0,
  };

  const skusDelImport = new Set();

  for (const prodCrudo of productosImport) {
    const sku = String(prodCrudo.sku || prodCrudo.refId || "").trim();
    if (!sku) continue;
    skusDelImport.add(sku);

    const origen = {
      tipo: "excel",
      importacionId,
      refId: prodCrudo.origen?.refId || prodCrudo.refId || sku,
    };

    // Producto nuevo (no está en el maestro)
    if (!porSku.has(sku)) {
      try {
        const nuevo = normalizarProductoMaestro(prodCrudo, origen, {
          margenDefault: opts.margenDefault,
        });
        porSku.set(sku, nuevo);
        reporte.nuevos++;
      } catch (e) {
        reporte.conflictos.push({ sku, motivo: e.message, tipo: "normalizar-nuevo" });
      }
      continue;
    }

    // Producto existente → merge
    const existente = porSku.get(sku);
    const editado = existente.editadoManualmente || {};
    const actualizado = { ...existente };
    let huboCambio = false;

    // Las imágenes son SOLO manuales (se suben desde el Admin): el Excel
    // nunca las pisa. Si no las protegiéramos, un import borraría las
    // fotos ya cargadas (prodCrudo.imagen suele venir null).
    for (const campo of CAMPOS_SOLO_MANUAL) {
      if (campo in prodCrudo) delete prodCrudo[campo];
    }

    for (const campo of CAMPOS_RESPETAN_EDICION) {
      // Si el dueño editó ESTE campo a mano → no pisar.
      if (editado[campo]) continue;

      const valorNuevo =
        campo === "nombreCorto"
          ? String(prodCrudo.nombreCorto || "").trim() ||
            generarNombreCorto(prodCrudo.nombre || "")
          : prodCrudo[campo];

      if (valorNuevo === undefined || valorNuevo === null) continue;

      // Solo actualizamos si viene con valor no vacío.
      if (
        typeof valorNuevo === "string" &&
        valorNuevo.trim() === "" &&
        actualizado[campo]
      ) {
        continue;
      }

      if (actualizado[campo] !== valorNuevo) {
        actualizado[campo] = valorNuevo;
        huboCambio = true;
      }
    }

    // Campos que SIEMPRE se actualizan
    for (const campo of CAMPOS_SIEMPRE_ACTUALIZA) {
      if (campo === "actualizadoEn") continue; // lo seteamos al final
      const valorNuevo = prodCrudo[campo];
      if (valorNuevo === undefined || valorNuevo === null) continue;

      if (campo === "codigosBarras") {
        const codigos = Array.isArray(valorNuevo)
          ? valorNuevo.map(String)
          : [String(valorNuevo)];
        const actuales = Array.isArray(actualizado.codigosBarras)
          ? actualizado.codigosBarras
          : [];
        const union = Array.from(new Set([...actuales, ...codigos]));
        if (union.length !== actuales.length) {
          actualizado.codigosBarras = union;
          huboCambio = true;
        }
        continue;
      }

      if (campo === "stock") {
        const stockNuevo = Math.max(0, Math.floor(Number(valorNuevo) || 0));
        if (actualizado.stock !== stockNuevo) {
          actualizado.stock = stockNuevo;
          huboCambio = true;
        }
        continue;
      }

      if (actualizado[campo] !== valorNuevo) {
        actualizado[campo] = valorNuevo;
        huboCambio = true;
      }
    }

    // Recalcular margenDisplay si el costo o el precioVenta cambiaron
    if (
      actualizado.costoUnitario > 0 &&
      actualizado.precioVenta > 0 &&
      !editado.precioVenta
    ) {
      const margen =
        Math.round((actualizado.precioVenta / actualizado.costoUnitario) * 100) /
        100;
      if (actualizado.margenDisplay !== margen) {
        actualizado.margenDisplay = margen;
        huboCambio = true;
      }
    }

    // Metadata de origen
    actualizado.origen = {
      ...(actualizado.origen || {}),
      tipo: "excel",
      importacionId,
      refId: origen.refId,
      // Si estaba marcado como "sin este sku" en un import anterior,
      // al volver a aparecer limpiamos esa marca.
      ultimaImportacionSinEsteSku: null,
    };

    if (huboCambio) {
      actualizado.actualizadoEn = ahoraISO();
      porSku.set(sku, actualizado);
      reporte.actualizados++;
    } else {
      reporte.sinCambios++;
    }
  }

  // Productos del maestro que NO vinieron en el import → marcar, no borrar
  for (const [sku, prod] of porSku.entries()) {
    if (!skusDelImport.has(sku)) {
      const actualizado = {
        ...prod,
        origen: {
          ...(prod.origen || {}),
          ultimaImportacionSinEsteSku: importacionId,
        },
      };
      porSku.set(sku, actualizado);
      reporte.noEnImport++;
    }
  }

  const catalogoFinal = Array.from(porSku.values());
  reporte.totalMaestroDespues = catalogoFinal.length;

  const { backupPath } = guardarCatalogoMaestro(catalogoFinal);

  return { catalogo: catalogoFinal, reporte, backupPath };
}

// ==================== CRUD INDIVIDUAL ====================

export function crearProducto(prod) {
  const maestro = leerCatalogoMaestro();
  const sku = String(prod?.sku || prod?.refId || "").trim();
  if (!sku) throw new Error("crearProducto: falta sku");

  if (maestro.some((p) => p.sku === sku)) {
    const err = new Error(`Ya existe un producto con sku ${sku}`);
    err.status = 409;
    throw err;
  }

  const nuevo = normalizarProductoMaestro(prod, {
    tipo: "manual",
    refId: sku,
  });

  maestro.push(nuevo);
  guardarCatalogoMaestro(maestro);
  return nuevo;
}

/**
 * Edita un producto. Marca `editadoManualmente[campo] = true` para los
 * campos editables que cambien.
 */
export function editarProducto(sku, cambios) {
  const clave = String(sku || "").trim();
  if (!clave) throw new Error("editarProducto: falta sku");
  if (!cambios || typeof cambios !== "object") {
    throw new Error("editarProducto: cambios inválido");
  }

  const maestro = leerCatalogoMaestro();
  const idx = maestro.findIndex((p) => p.sku === clave);
  if (idx === -1) {
    const err = new Error(`Producto no encontrado: ${clave}`);
    err.status = 404;
    throw err;
  }

  const actual = maestro[idx];
  const editado = { ...(actual.editadoManualmente || {}) };

  const CAMPOS_EDITABLES = [
    "nombre",
    "nombreCorto",
    "marca",
    "categoria",
    "subcategoria",
    "precioVenta",
    "precioBulto", // 👈 NUEVO
    "costoUnitario",
    "uxB", // 👈 NUEVO
    "stock",
    "imagenes",
    "imagen",
    "activo",
    "codigosBarras",
  ];

  const actualizado = { ...actual };
  for (const campo of CAMPOS_EDITABLES) {
    if (!(campo in cambios)) continue;
    const nuevo = cambios[campo];

    if (campo === "codigosBarras") {
      actualizado.codigosBarras = Array.isArray(nuevo)
        ? nuevo.map(String).filter(Boolean)
        : actual.codigosBarras;
      continue;
    }

    // `imagenes` es la fuente de verdad; `imagen` (la principal) se deriva
    // al final, cuando ya está normalizada la lista.
    if (campo === "imagenes") {
      actualizado.imagenes = normalizarListaImagenes({ imagenes: nuevo });
      continue;
    }

    if (campo === "imagen") {
      // Compatibilidad: si alguien manda `imagen` suelta, la tratamos como
      // la principal de la lista.
      if (typeof nuevo === "string" && nuevo.trim()) {
        actualizado.imagenes = normalizarListaImagenes({ imagen: nuevo });
      }
      continue;
    }

    if (campo === "stock") {
      actualizado.stock = Math.max(0, Math.floor(Number(nuevo) || 0));
      // stock no es "editable a mano" en el sentido de merge: se actualiza siempre
      continue;
    }

    if (campo === "uxB") {
      actualizado.uxB = Math.max(1, Math.floor(Number(nuevo) || 6));
      continue;
    }

    if (campo === "activo") {
      actualizado.activo = Boolean(nuevo);
      continue;
    }

    if (campo === "precioVenta") {
      const p = Number(nuevo);
      if (!Number.isFinite(p) || p <= 0) {
        const err = new Error("precioVenta inválido");
        err.status = 400;
        throw err;
      }
      actualizado.precioVenta = Math.round(p * 100) / 100;
      editado.precioVenta = true;
      continue;
    }

    if (campo === "precioBulto") {
      const p = Number(nuevo);
      if (!Number.isFinite(p) || p <= 0) {
        const err = new Error("precioBulto inválido");
        err.status = 400;
        throw err;
      }
      actualizado.precioBulto = Math.round(p * 100) / 100;
      editado.precioBulto = true;
      continue;
    }

    if (campo === "costoUnitario") {
      const c = Number(nuevo);
      if (!Number.isFinite(c) || c < 0) {
        const err = new Error("costoUnitario inválido");
        err.status = 400;
        throw err;
      }
      actualizado.costoUnitario = Math.round(c * 100) / 100;
      continue;
    }

    actualizado[campo] = String(nuevo ?? "").trim();
    if (campo === "nombreCorto") editado.nombreCorto = true;
  }

  // Recalcular margen si corresponde
  if (
    actualizado.costoUnitario > 0 &&
    actualizado.precioVenta > 0
  ) {
    actualizado.margenDisplay =
      Math.round((actualizado.precioVenta / actualizado.costoUnitario) * 100) /
      100;
  }

  // `imagen` es derivado de `imagenes[0]`. Si no hay lista pero sí la
  // imagen vieja (compatibilidad), migrarla.
  if (!actualizado.imagenes || actualizado.imagenes.length === 0) {
    actualizado.imagenes = normalizarListaImagenes({ imagen: actualizado.imagen });
  }
  actualizado.imagen = urlDeImagen(actualizado.imagenes[0]) || null;

  actualizado.editadoManualmente = editado;
  actualizado.actualizadoEn = ahoraISO();

  maestro[idx] = actualizado;
  guardarCatalogoMaestro(maestro);
  return actualizado;
}

/**
 * Soft delete: marca `activo: false`.
 *
 * El POS filtra `activo: true` al vender. Si el producto tiene ventas
 * asociadas (por ahora no lo chequeamos: lo dejamos documentado para
 * Fase E), NO se puede borrar físicamente. En esta fase, siempre
 * hacemos soft delete. La opción de hard delete se puede agregar con
 * un flag `?hard=true` en la Fase B si el dueño lo pide.
 */
export function eliminarProducto(sku) {
  const clave = String(sku || "").trim();
  if (!clave) throw new Error("eliminarProducto: falta sku");

  const maestro = leerCatalogoMaestro();
  const idx = maestro.findIndex((p) => p.sku === clave);
  if (idx === -1) {
    const err = new Error(`Producto no encontrado: ${clave}`);
    err.status = 404;
    throw err;
  }

  maestro[idx] = {
    ...maestro[idx],
    activo: false,
    actualizadoEn: ahoraISO(),
  };

  guardarCatalogoMaestro(maestro);
  return maestro[idx];
}

/**
 * Elimina un producto de forma permanente (hard delete).
 * Borra la entrada del catálogo y también las imágenes asociadas del disco.
 *
 * @param {string} sku
 * @returns {object} { sku, imagenesBorradas: string[] }
 */
export function eliminarProductoPermanente(sku) {
  const clave = String(sku || "").trim();
  if (!clave) throw new Error("eliminarProductoPermanente: falta sku");

  const maestro = leerCatalogoMaestro();
  const idx = maestro.findIndex((p) => p.sku === clave);
  if (idx === -1) {
    const err = new Error(`Producto no encontrado: ${clave}`);
    err.status = 404;
    throw err;
  }

  const producto = maestro[idx];

  // Borrar imágenes asociadas del disco.
  const imagenesBorradas = [];
  const imagenes = Array.isArray(producto.imagenes) ? producto.imagenes : [];
  for (const img of imagenes) {
    const archivo = img.archivo || img;
    if (borrarArchivoImagen(archivo)) {
      imagenesBorradas.push(archivo);
    }
  }

  // Quitar también la imagen principal si quedó suelta.
  if (producto.imagen && borrarArchivoImagen(producto.imagen)) {
    if (!imagenesBorradas.includes(producto.imagen)) {
      imagenesBorradas.push(producto.imagen);
    }
  }

  const siguiente = maestro.filter((p) => p.sku !== clave);
  guardarCatalogoMaestro(siguiente);

  return { sku: clave, imagenesBorradas };
}

// ==================== UTILIDADES PARA IMÁGENES ====================

/**
 * Calcula el path local de una imagen a partir de su hash.
 * El hash se calcula sobre la URL original.
 */
export function pathImagenLocal(urlOriginal) {
  const hash = crypto
    .createHash("sha1")
    .update(String(urlOriginal))
    .digest("hex")
    .slice(0, 16);
  return `/img/productos/${hash}.jpg`;
}

export function dirImagenes() {
  asegurarDir(IMG_DIR);
  return IMG_DIR;
}