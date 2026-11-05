// backend/src/services/imagenesService.js
//
// Servicio de imágenes de producto del catálogo maestro.
//
// Responsabilidades:
//   - Guardar hasta 3 imágenes por producto en data/pos/img/productos/.
//   - Nombrar los archivos por HASH DEL CONTENIDO (SHA1, 16 chars).
//     Si subís la misma foto dos veces, se guarda una sola vez.
//   - Validar tipo real por MAGIC BYTES (no por extensión: un .jpg que en
//     realidad es un .exe se rechaza).
//   - Borrar y reordenar imágenes ya guardadas.
//
// Lo que NO hace:
//   - No sabe de HTTP (eso lo hacen las routes).
//   - No lee ni escribe el catálogo (eso lo hace catalogoMaestroService).
//   - No convierte formatos: se guarda la EXTENSIÓN REAL del archivo.
//
// Convención de salida: cada imagen se representa como
//   { archivo: "<hash>.<ext>", alt: "", orden: 0 }
// y se sirve en /img/productos/<archivo> (ver index.js, estático /img).

import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, "../../data/pos");
const IMG_DIR = path.join(DATA_DIR, "img", "productos");

// ==================== LÍMITES ====================

/** Máximo de imágenes por producto. */
export const MAX_IMAGENES = 3;

/** Tamaño máximo por archivo (2MB). */
export const MAX_BYTES = 2 * 1024 * 1024;

/**
 * Tipos permitidos. La validación es por magic bytes, así que la
 * extensión declarada por el navegador NO se usa para decidir el tipo.
 */
export const TIPOS_PERMITIDOS = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

// ==================== HELPERS DE FS ====================

function asegurarDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function badRequest(msg) {
  const err = new Error(msg);
  err.status = 400;
  return err;
}

// ==================== VALIDACIÓN ====================

/**
 * Detecta el tipo real de una imagen leyendo sus magic bytes.
 * Devuelve "jpg" | "png" | "webp" | null si no es ninguna de las tres.
 *
 *   JPEG → FF D8 FF
 *   PNG  → 89 50 4E 47 0D 0A 1A 0A
 *   WEBP → "RIFF" .... "WEBP"
 */
export function detectarTipo(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return null;

  // JPEG
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "jpg";
  }

  // PNG
  const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (PNG_SIG.every((byte, i) => buffer[i] === byte)) {
    return "png";
  }

  // WEBP: "RIFF" en 0-3 y "WEBP" en 8-11
  if (
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "webp";
  }

  return null;
}

/**
 * Valida un buffer de imagen subida.
 * Devuelve { ext, hash, bytes } o tira error 400 con motivo legible.
 */
export function validarImagen(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw badRequest("El archivo llegó vacío.");
  }

  if (buffer.length > MAX_BYTES) {
    const mb = (buffer.length / 1024 / 1024).toFixed(2);
    throw badRequest(
      `La imagen pesa ${mb}MB y el máximo es ${MAX_BYTES / 1024 / 1024}MB. ` +
        `Reducila antes de subirla.`,
    );
  }

  const ext = detectarTipo(buffer);
  if (!ext) {
    throw badRequest(
      "Formato no soportado. Se aceptan JPG, PNG o WEBP " +
        "(se valida el contenido real, no la extensión del archivo).",
    );
  }

  const hash = crypto.createHash("sha1").update(buffer).digest("hex").slice(0, 16);
  return { ext, hash, bytes: buffer.length };
}

// ==================== NORMALIZACIÓN DE LA LISTA ====================

/**
 * Normaliza la lista de imágenes de un producto al shape canónico:
 *   [{ archivo, alt, orden }]
 *
 * - Acepta el formato viejo (`imagen` string suelto) y lo migra.
 * - Descarta entradas corruptas (sin archivo).
 * - Reasigna `orden` en base al índice del array: el array ES la fuente
 *   de verdad del orden, `orden` es un espejo para que el JSON sea legible.
 * - Corta a MAX_IMAGENES.
 *
 * @param {object} producto - producto del catálogo (puede tener `imagen` y/o `imagenes`)
 * @returns {Array<{archivo, alt, orden}>}
 */
export function normalizarListaImagenes(producto) {
  const crudas = [];

  // 1. Formato nuevo.
  if (Array.isArray(producto?.imagenes)) {
    crudas.push(...producto.imagenes);
  }

  // 2. Formato viejo: `imagen` string → migrar solo si no vino en el array.
  const imagenVieja = producto?.imagen;
  if (typeof imagenVieja === "string" && imagenVieja.trim()) {
    const archivoViejo = archivoDesdeUrl(imagenVieja);
    if (archivoViejo) {
      const ya = crudas.some((c) => archivoDe(c) === archivoViejo);
      if (!ya) crudas.push({ archivo: archivoViejo, alt: "" });
    }
  }

  const vistas = new Set();
  const out = [];

  for (const c of crudas) {
    const archivo = archivoDe(c);
    if (!archivo) continue;
    if (vistas.has(archivo)) continue; // dedupe
    vistas.add(archivo);
    out.push({
      archivo,
      alt: String((typeof c === "object" && c?.alt) || "").trim(),
    });
    if (out.length >= MAX_IMAGENES) break;
  }

  return out.map((img, i) => ({ ...img, orden: i }));
}

/** Extrae el nombre de archivo de una entrada (string u objeto). */
function archivoDe(entrada) {
  if (typeof entrada === "string") return archivoDesdeUrl(entrada);
  if (entrada && typeof entrada === "object") {
    if (typeof entrada.archivo === "string") return archivoDesdeUrl(entrada.archivo);
  }
  return null;
}

/**
 * De "/img/productos/a1b2.jpg" (o "a1b2.jpg") saca "a1b2.jpg".
 * Valida que sea un nombre de archivo seguro (sin barras ni "..").
 */
export function archivoDesdeUrl(valor) {
  const s = String(valor || "").trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return null; // las URLs externas no son archivos locales

  const base = s.split("/").pop();
  if (!base) return null;
  if (base === "." || base === "..") return null;
  if (!/^[A-Za-z0-9._-]+$/.test(base)) return null;
  if (!/\.(jpe?g|png|webp)$/i.test(base)) return null;

  return base;
}

/** Devuelve la URL pública de una entrada de imagen. */
export function urlDeImagen(entrada) {
  const archivo = archivoDe(entrada);
  return archivo ? `/img/productos/${archivo}` : null;
}

// ==================== ESCRITURA ====================

/**
 * Guarda un buffer de imagen en disco y devuelve la entrada lista para
 * meter en el array del producto.
 *
 * Si el mismo contenido ya existe (mismo hash), NO reescribe el archivo:
 * devuelve la entrada igual, para que se pueda asociar a otro producto.
 *
 * @param {Buffer} buffer
 * @returns {{ archivo: string, ext: string, bytes: number, nueva: boolean }}
 */
export function guardarImagen(buffer) {
  const { ext, hash, bytes } = validarImagen(buffer);

  asegurarDir(IMG_DIR);
  const archivo = `${hash}.${ext}`;
  const destino = path.join(IMG_DIR, archivo);

  // Verificamos que el path resuelto siga dentro de IMG_DIR (defensa en profundidad).
  const resuelto = path.resolve(destino);
  if (!resuelto.startsWith(path.resolve(IMG_DIR) + path.sep)) {
    throw badRequest("Nombre de archivo inválido.");
  }

  const yaExistia = fs.existsSync(resuelto);
  if (!yaExistia) {
    fs.writeFileSync(resuelto, buffer);
  }

  return { archivo, ext, bytes, nueva: !yaExistia };
}

/**
 * Borra un archivo de imagen del disco.
 * Es tolerante: si no existe, no falla (la entrada igual se saca del array).
 *
 * @param {string} archivo - "a1b2c3.jpg"
 * @returns {boolean} true si borró algo
 */
export function borrarArchivoImagen(archivo) {
  const base = archivoDesdeUrl(archivo);
  if (!base) return false;

  const ruta = path.join(IMG_DIR, base);
  const resuelto = path.resolve(ruta);
  if (!resuelto.startsWith(path.resolve(IMG_DIR) + path.sep)) return false;

  try {
    if (fs.existsSync(resuelto)) {
      fs.unlinkSync(resuelto);
      return true;
    }
  } catch (e) {
    console.error("⚠️ [imagenes] No se pudo borrar", base, e.message);
  }
  return false;
}

/** true si el archivo existe en disco. */
export function existeArchivoImagen(archivo) {
  const base = archivoDesdeUrl(archivo);
  if (!base) return false;
  return fs.existsSync(path.join(IMG_DIR, base));
}

export { IMG_DIR };
