// backend/src/services/importacionService.js
//
// Orquestador del flujo de importación:
//   1. procesarExcel() → productos crudos.
//   2. normalizarProductoMaestro() → shape canónico.
//   3. importarDesdeProveedor() → merge no-destructivo + backup.
//   4. Guardar historial en data/pos/importaciones/.
//
// También gestiona el "último mapeo" (data/pos/mapeo-default.json)
// para pre-cargar el MapeoColumnasModal.

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { procesarExcel } from "./excelUniversalService.js";
import {
  importarDesdeProveedor,
  normalizarProductoMaestro,
} from "./catalogoMaestroService.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, "../../data/pos");
const IMPORTACIONES_DIR = path.join(DATA_DIR, "importaciones");
const MAPEO_PATH = path.join(DATA_DIR, "mapeo-default.json");

function asegurarDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// ==================== ÚLTIMO MAPEO ====================

export function leerUltimoMapeo() {
  if (!fs.existsSync(MAPEO_PATH)) return null;
  try {
    const raw = fs.readFileSync(MAPEO_PATH, "utf-8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

export function guardarUltimoMapeo(mapeo) {
  if (!mapeo || typeof mapeo !== "object") return null;
  asegurarDir(DATA_DIR);
  fs.writeFileSync(MAPEO_PATH, JSON.stringify(mapeo, null, 2), "utf-8");
  return MAPEO_PATH;
}

// ==================== HISTORIAL ====================

export function guardarHistorialImportacion(reporte) {
  if (!reporte || !reporte.importacionId) {
    throw new Error("guardarHistorialImportacion: falta importacionId");
  }
  asegurarDir(IMPORTACIONES_DIR);
  const safeId = String(reporte.importacionId).replace(/[^\w.-]/g, "_");
  const ruta = path.join(IMPORTACIONES_DIR, `${safeId}.json`);
  fs.writeFileSync(ruta, JSON.stringify(reporte, null, 2), "utf-8");
  return ruta;
}

export function listarImportaciones() {
  asegurarDir(IMPORTACIONES_DIR);
  const archivos = fs
    .readdirSync(IMPORTACIONES_DIR)
    .filter((f) => f.endsWith(".json"));

  const lista = [];
  for (const archivo of archivos) {
    try {
      const raw = fs.readFileSync(
        path.join(IMPORTACIONES_DIR, archivo),
        "utf-8",
      );
      lista.push(JSON.parse(raw));
    } catch {
      /* archivo corrupto → ignorar */
    }
  }

  lista.sort((a, b) =>
    String(b.fecha || "").localeCompare(String(a.fecha || "")),
  );

  return lista;
}

// ==================== FLUJO PRINCIPAL ====================

export function aplicarImportacion({
  buffer,
  nombreArchivo,
  mapeo,
  headerRow,
  importacionId,
}) {
  if (!buffer) throw new Error("aplicarImportacion: falta buffer");
  if (!mapeo) throw new Error("aplicarImportacion: falta mapeo");
  if (!importacionId) throw new Error("aplicarImportacion: falta importacionId");

  // 1. Procesar el Excel.
  const { productos: productosCrudos, estadisticas } = procesarExcel(
    buffer,
    mapeo,
    {
      slug: "pos-catalogo-maestro",
      nombreProveedor: nombreArchivo || "Import manual",
      headerRow,
      imagenes: null,
    },
  );

  // 2. Normalizar cada producto al shape canónico.
  const productosNormalizados = [];
  const erroresNormalizacion = [];

  for (const crudo of productosCrudos) {
    try {
      const normalizado = normalizarProductoMaestro(
        crudo,
        {
          tipo: "excel",
          importacionId,
          refId: crudo.refId || crudo.sku,
        },
        { margenDefault: 1.43 },
      );
      productosNormalizados.push(normalizado);
    } catch (e) {
      erroresNormalizacion.push({
        sku: crudo.sku || crudo.refId || "?",
        motivo: e.message,
      });
    }
  }

  if (productosNormalizados.length === 0) {
    const err = new Error(
      `Ningún producto pudo normalizarse. Ejemplos: ${JSON.stringify(
        erroresNormalizacion.slice(0, 3),
      )}`,
    );
    err.status = 400;
    throw err;
  }

  // 3. Merge no-destructivo contra el catálogo maestro.
  const { reporte, backupPath } = importarDesdeProveedor(
    importacionId,
    productosNormalizados,
  );

  // 4. Guardar historial con metadata útil.
  const reporteConMetadata = {
    ...reporte,
    nombreArchivo: nombreArchivo || null,
    estadisticasExcel: estadisticas,
    erroresNormalizacion,
    backupPath: backupPath || null,
  };

  const archivoHistorial = guardarHistorialImportacion(reporteConMetadata);

  return {
    reporte: reporteConMetadata,
    cantidad: productosNormalizados.length,
    estadisticas: {
      ...estadisticas,
      normalizados: productosNormalizados.length,
      erroresNormalizacion: erroresNormalizacion.length,
    },
    archivoHistorial,
  };
}
