// backend/src/services/excelUniversalService.js
import * as XLSX from "xlsx";

// ==================== CONSTANTES ====================

export const CAMPOS_BASE = [
  { key: "refId", label: "Código producto", requerido: true, tipo: "texto" },
  { key: "nombre", label: "Nombre producto", requerido: true, tipo: "texto" },
  { key: "sku", label: "SKU / EAN", requerido: false, tipo: "texto" },
  { key: "marca", label: "Marca", requerido: false, tipo: "texto" },
  { key: "categoria", label: "Categoría", requerido: false, tipo: "texto" },
  {
    key: "subcategoria",
    label: "Subcategoría",
    requerido: false,
    tipo: "texto",
  },
  { key: "precio", label: "Precio / Costo", requerido: true, tipo: "numero" },
  { key: "stock", label: "Stock", requerido: false, tipo: "numero" },
  { key: "uxB", label: "Unidades por bulto", requerido: false, tipo: "numero" },
  { key: "imagen", label: "URL Imagen", requerido: false, tipo: "texto" },
];

const REGLAS_AUTOMAP = {
  refId: [/^cod(igo)?/, /^ref/, /articulo/, /^art\.?/, /^cod_/],
  nombre: [/descrip/, /^nombre/, /^producto/, /detalle/],
  sku: [/^sku/, /^ean/, /barras/, /^gtin/, /^upc/],
  marca: [/^marca/, /^brand/, /^fabricante/, /^proveedor$/],
  categoria: [/^categor(ia)?$/, /^rubro$/, /^familia$/],
  subcategoria: [/subcategor/, /subfamilia/, /subrubro/],
  precio: [/^precio/, /^pvp/, /^costo/, /lista/, /^prec\.?/],
  stock: [/^stock/, /^cantidad/, /^disp(onible)?/, /^qty/],
  imagen: [/^imagen/, /^foto/, /^url/, /^img/],
  uxB: [/uxb/, /unid.*bulto/, /unidades.*bulto/, /por.*bulto/, /bulto/],
};

/**
 * Palabras que suelen aparecer en filas de título/subtítulo (no son headers).
 */
const REGEX_BASURA =
  /fecha|p[aá]gina|total|lista de precios|distribuidora|s\.?a\.?|s\.?r\.?l\.?|cuit|tel[eé]fono|www\.|@|http/i;

// ==================== DETECCIÓN DE HEADER ====================

/**
 * Intenta detectar cuál fila del Excel es la de cabecera.
 *
 * Heurística:
 *  - Recorre las primeras 15 filas.
 *  - Se queda con la primera que tenga ≥3 celdas con texto.
 *  - Descarta filas numéricas puras (probablemente datos).
 *  - Descarta filas con 1-2 celdas que matcheen "basura" (título, fecha, total).
 *
 * @param {Buffer} buffer
 * @returns {number} índice 0-based de la fila de header
 */
export function detectarFilaHeader(buffer) {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
    blankrows: false,
  });

  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const row = rows[i] || [];
    const strings = row
      .filter((c) => typeof c === "string" && c.trim().length > 0)
      .map((s) => s.trim());

    if (strings.length < 3) continue;

    // Filtrar si todas son números (fila de datos)
    const numericas = strings.filter(
      (s) =>
        !isNaN(Number(s.replace(/[^\d.-]/g, ""))) &&
        s.replace(/[^\d.-]/g, "") !== "",
    );
    if (numericas.length === strings.length) continue;

    // Filtrar si matchea basura Y hay pocas columnas (título típico)
    const matchBasura = strings.filter((s) => REGEX_BASURA.test(s));
    if (matchBasura.length > 0 && strings.length < 5) continue;

    return i;
  }

  return 0; // fallback
}

// ==================== PREVIEW ====================

/**
 * Lee un buffer de Excel y devuelve:
 *  - headers: array de { nombre, indice } (índice 0-based)
 *  - headersRaw: array de strings originales (compatibilidad)
 *  - sample:  primeras N filas como objetos {nombre: valor}
 *  - totalFilas: cantidad de filas de datos (sin contar el header)
 *  - sheetName: nombre de la hoja
 *  - automap: mapeo sugerido por heurística { campo: indice }
 *  - filaHeader: índice 0-based de la fila de cabecera detectada/usada
 *  - headersDuplicados: array con info de duplicados (no bloqueante)
 *
 * @param {Buffer} buffer
 * @param {object} [opts]
 * @param {number} [opts.filasSample=10]
 * @param {number|null} [opts.headerRow=null]  Si es null, auto-detecta.
 */
export function previewExcel(
  buffer,
  { filasSample = 10, headerRow = null } = {},
) {
  const wb = XLSX.read(buffer, { type: "buffer" });
  if (!wb.SheetNames.length) throw badRequest("El Excel no tiene hojas");

  const sheetName = wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
    blankrows: false,
  });

  if (!rows.length) throw badRequest("El Excel está vacío");

  const filaHeader =
    headerRow !== null && headerRow !== undefined
      ? Number(headerRow)
      : detectarFilaHeader(buffer);

  if (
    !Number.isInteger(filaHeader) ||
    filaHeader < 0 ||
    filaHeader >= rows.length
  ) {
    throw badRequest(
      `Fila de header inválida: ${filaHeader}. El Excel tiene ${rows.length} filas.`,
    );
  }

  const headersRaw = rows[filaHeader] || [];
  const headersRawStrings = headersRaw.map((h, i) => {
    const s = String(h ?? "").trim();
    return s || `columna_${i + 1}`;
  });

  // Estructura de headers: { nombre, indice }
  // El índice es la posición física en el Excel (0-based).
  // Es lo que va a usar el mapeo para resolver sin ambigüedad.
  const headers = headersRawStrings.map((nombre, indice) => ({
    nombre,
    indice,
  }));

  // Chequeo de headers duplicados: NO bloqueante.
  // Solo informamos al front para que muestre un banner.
  const vistos = new Map(); // nombre normalizado → [índices]
  for (let i = 0; i < headersRawStrings.length; i++) {
    const norm = String(headersRawStrings[i]).trim().toLowerCase();
    if (!norm) continue;
    if (!vistos.has(norm)) vistos.set(norm, []);
    vistos.get(norm).push(i);
  }

  const headersDuplicados = [];
  for (const [, idxs] of vistos.entries()) {
    if (idxs.length > 1) {
      headersDuplicados.push({
        nombre: headersRawStrings[idxs[0]],
        indices: idxs,
        cantidad: idxs.length,
      });
    }
  }

  // Sample: usamos el nombre de header como clave.
  // Con duplicados, Object.fromEntries colapsa a la última aparición —
  // pero el modal muestra por ÍNDICE, no por nombre, así que no hay problema.
  const dataRows = rows.slice(filaHeader + 1);
  const sample = dataRows.slice(0, filasSample).map((row) => {
    const obj = {};
    headers.forEach(({ nombre, indice }) => {
      // Si el nombre está duplicado, agregamos sufijo para que no se pise
      const claveFinal =
        vistos.get(nombre.trim().toLowerCase())?.length > 1
          ? `${nombre}__${indice}`
          : nombre;
      obj[claveFinal] = row[indice] ?? "";
    });
    return obj;
  });

  const automap = detectarMapeoAutomatico(headersRawStrings);

  return {
    headers, // [{ nombre, indice }]
    headersRaw: headersRawStrings, // ["Proveedor", "Codigo", ...]
    sample,
    totalFilas: dataRows.length,
    sheetName,
    automap, // { campo: indice }
    camposBase: CAMPOS_BASE,
    filaHeader,
    headersDuplicados,
  };
}

// ==================== PROCESAR ====================

/**
 * Procesa el buffer completo aplicando el mapeo del usuario.
 *
 * Fase 6: se agregó `imagenes` (mapa de imageService). Si viene, cada
 * producto cuyo campo `imagen` (o `refId`/`sku` como fallback) matchee
 * una clave del mapa, recibe la URL de la imagen.
 *
 * @param {Buffer} buffer
 * @param {object} mapeo   { refId: 1, nombre: 2, ... }
 * @param {object} opts
 * @param {string} opts.slug
 * @param {string} opts.nombreProveedor
 * @param {number} [opts.headerRow=0]  índice 0-based de la fila de header
 * @param {Map<string, {url, hash, nombreOriginal, ext}>} [opts.imagenes]
 *        Mapa de imágenes ya procesadas (de imageService.procesarZipDeImagenes).
 *        Las claves ya vienen normalizadas (lowercase, sin espacios/símbolos).
 * @returns {{productos: Array, estadisticas: object}}
 */
export function procesarExcel(
  buffer,
  mapeo,
  { slug, nombreProveedor, headerRow = 0, imagenes = null },
) {
  if (!mapeo || typeof mapeo !== "object") {
    throw badRequest("Falta el mapeo de columnas");
  }

  // Normalizar valores del mapeo a índices numéricos.
  const mapeoIndices = {};
  for (const [campo, valor] of Object.entries(mapeo)) {
    if (valor === null || valor === undefined || valor === "") continue;
    const n = Number(valor);
    if (!Number.isInteger(n) || n < 0) {
      throw badRequest(
        `Mapeo inválido para "${campo}": se esperaba un índice de columna (número ≥ 0), ` +
          `recibido ${JSON.stringify(valor)}.`,
      );
    }
    mapeoIndices[campo] = n;
  }

  const faltantes = CAMPOS_BASE.filter(
    (c) => c.requerido && mapeoIndices[c.key] === undefined,
  );
  if (faltantes.length > 0) {
    throw badRequest(
      `Faltan mapear campos requeridos: ${faltantes.map((c) => c.label).join(", ")}`,
    );
  }

  const wb = XLSX.read(buffer, { type: "buffer" });
  const sheetName = wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];

  const rows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
    blankrows: false,
    range: Number(headerRow) + 1,
  });

  if (!rows.length) throw badRequest("El Excel no tiene filas de datos");

  const productos = [];
  const descartadas = [];
  let idx = 0;

  // Contadores de imágenes (solo si se procesaron imágenes)
  let imagenesAsociadas = 0;
  let imagenesNoEncontradas = 0;

  // Helper interno para buscar la imagen de un producto.
  // Orden de búsqueda:
  //   1. valor crudo del campo `imagen` (si está mapeado) normalizado
  //   2. refId normalizado
  //   3. sku normalizado
  // Si nada matchea, el producto queda sin imagen.
  const buscarImagen = (rawImagen, refId, sku) => {
    if (!imagenes || imagenes.size === 0) return null;

    // Si el campo imagen trae una URL completa, la respetamos
    // (el usuario ya la subió a algún lado).
    if (rawImagen && /^https?:\/\//i.test(rawImagen)) {
      return { url: rawImagen, externa: true };
    }

    const candidatos = [rawImagen, refId, sku]
      .filter(Boolean)
      .map((v) => normalizarClaveImagen(v));

    for (const clave of candidatos) {
      if (!clave) continue;
      const hit = imagenes.get(clave);
      if (hit) return { url: hit.url, hash: hit.hash, externa: false };
    }
    return null;
  };

  for (const row of rows) {
    idx++;
    const get = (campo) => {
      const indice = mapeoIndices[campo];
      if (indice === undefined) return "";
      return String(row[indice] ?? "").trim();
    };

    const nombre = get("nombre");
    if (!nombre) {
      descartadas.push({ fila: idx, motivo: "sin nombre" });
      continue;
    }

    const refId = get("refId");
    if (!refId) {
      descartadas.push({ fila: idx, motivo: "sin refId", nombre });
      continue;
    }

    const precio = parsePrecio(get("precio"));
    if (precio <= 0) {
      descartadas.push({
        fila: idx,
        motivo: "precio inválido",
        nombre,
        raw: get("precio"),
      });
      continue;
    }

    const stockRaw = get("stock");
    const stock = stockRaw === "" ? 0 : parseInt(stockRaw, 10) || 0;

    const skuFinal = get("sku") || refId;
    const rawImagen = get("imagen");

    // 🔥 Fase 6: resolver imagen
    const img = buscarImagen(rawImagen, refId, skuFinal);
    let imagenFinal = null;
    if (img) {
      imagenFinal = img.url;
      if (img.externa) {
        // URL externa declarada en el Excel: cuenta como asociada
        imagenesAsociadas++;
      } else {
        imagenesAsociadas++;
      }
    } else if (imagenes && imagenes.size > 0) {
      // Había imágenes en el ZIP pero no matcheó ninguna clave
      imagenesNoEncontradas++;
    }

    productos.push({
      id: `${slug}_${refId}`,
      refId,
      sku: skuFinal,
      nombre,
      marca: get("marca") || "",
      subcategoria: get("subcategoria") || "",
      imagen: imagenFinal,
      proveedor: slug,
      categoria: get("categoria") || "Sin categoría",
      precio,
      costoUnitario: precio,
      stock,
      uxB: Math.max(1, parseInt(get("uxB"), 10) || 1),
      conversiones: {},
    });
  }

  if (productos.length === 0) {
    const ejemplo = descartadas
      .slice(0, 3)
      .map((d) => `fila ${d.fila} (${d.motivo})`)
      .join(", ");
    throw badRequest(
      `No se pudo importar ningún producto. Ejemplos descartados: ${ejemplo}. ` +
        `Revisá el mapeo o la calidad del Excel.`,
    );
  }

  const refIdsVistos = new Set();
  const duplicados = [];
  for (const p of productos) {
    if (refIdsVistos.has(p.refId)) duplicados.push(p.refId);
    refIdsVistos.add(p.refId);
  }

  console.log(
    `📦 [${slug}] Procesados ${productos.length} productos` +
      (descartadas.length ? ` (${descartadas.length} descartados)` : "") +
      (duplicados.length ? ` ⚠️ ${duplicados.length} refId duplicados` : "") +
      ` · header en fila ${Number(headerRow) + 1}` +
      (imagenes
        ? ` · imágenes: ${imagenesAsociadas} asociadas` +
          (imagenesNoEncontradas > 0
            ? ` / ${imagenesNoEncontradas} sin match`
            : "")
        : ""),
  );

  return {
    productos,
    estadisticas: {
      totalFilas: rows.length,
      importados: productos.length,
      descartados: descartadas.length,
      duplicadosRefId: duplicados.length,
      ejemplosDescartados: descartadas.slice(0, 5),
      imagenes: imagenes
        ? {
            totalEnZip: imagenes.size,
            asociadas: imagenesAsociadas,
            noEncontradas: imagenesNoEncontradas,
          }
        : null,
    },
  };
}

// ==================== HELPERS ====================

/**
 * Normaliza una clave de imagen (misma lógica que imageService).
 * La duplicamos acá a propósito para no acoplar el importador universal
 * al servicio de imágenes. Si un día se cambia la normalización, hay que
 * cambiarla en LOS DOS lados.
 */
function normalizarClaveImagen(valor) {
  return String(valor || "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9_-]/g, "");
}

/**
 * Parsea precios en formatos argentinos:
 *   "1500" / "$1.500" / "$1.500,50" / "1500,50" / "1,500.50" / 1500.5
 */
export function parsePrecio(raw) {
  if (raw === null || raw === undefined || raw === "") return 0;
  if (typeof raw === "number") return raw;

  let s = String(raw).trim();
  s = s.replace(/[^\d.,-]/g, "");
  if (!s) return 0;

  const tieneComa = s.includes(",");
  const tienePunto = s.includes(".");
  const ultimaComa = s.lastIndexOf(",");
  const ultimoPunto = s.lastIndexOf(".");

  if (tieneComa && tienePunto) {
    if (ultimaComa > ultimoPunto) {
      s = s.replace(/\./g, "").replace(",", ".");
    } else {
      s = s.replace(/,/g, "");
    }
  } else if (tieneComa) {
    const digitosDespues = s.length - ultimaComa - 1;
    if (digitosDespues === 3) {
      s = s.replace(/,/g, "");
    } else {
      s = s.replace(",", ".");
    }
  } else if (tienePunto) {
    const digitosDespues = s.length - ultimoPunto - 1;
    if (digitosDespues === 3 && s.split(".").length > 2) {
      s = s.replace(/\./g, "");
    } else if (digitosDespues === 3) {
      s = s.replace(/\./g, "");
    }
  }

  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Heurística de auto-mapeo: para cada campo base, busca una columna del Excel
 * que matchee alguna regex. Nunca asigna el mismo índice a dos campos.
 *
 * Ahora devuelve { campo: indice } (número), no { campo: nombre } (string).
 */
export function detectarMapeoAutomatico(headersRawStrings) {
  const normalizados = headersRawStrings.map((h, indice) => ({
    indice,
    nombre: h,
    norm: String(h)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim(),
  }));

  const usados = new Set(); // índices ya usados
  const mapeo = {}; // { campo: indice }

  for (const campo of CAMPOS_BASE) {
    const reglas = REGLAS_AUTOMAP[campo.key];
    if (!reglas) continue;

    for (const { indice, norm } of normalizados) {
      if (usados.has(indice)) continue;
      if (reglas.some((r) => r.test(norm))) {
        mapeo[campo.key] = indice;
        usados.add(indice);
        break;
      }
    }
  }

  return mapeo;
}

// ==================== ERRORES ====================

function badRequest(msg) {
  const err = new Error(msg);
  err.status = 400;
  return err;
}
