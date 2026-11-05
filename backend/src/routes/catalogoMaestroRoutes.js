// backend/src/routes/catalogoMaestroRoutes.js
//
// Endpoints del catálogo maestro del POS.
//
// Filtros:
//   GET /api/catalogo-maestro?q=aguila&categoria=Alfajores&activo=true
//
// CRUD:
//   GET    /api/catalogo-maestro/:sku
//   POST   /api/catalogo-maestro
//   PUT    /api/catalogo-maestro/:sku
//   DELETE /api/catalogo-maestro/:sku      (soft delete → activo: false)
//
// Import (delega al importarRoutes, pero dejamos los alias acá también
// por comodidad del frontend):
//   POST /api/catalogo-maestro/importar/preview
//   POST /api/catalogo-maestro/importar/confirmar
//   GET  /api/catalogo-maestro/importaciones

import { Router } from "express";
import multer from "multer";
import {
  leerCatalogoMaestro,
  guardarCatalogoMaestro,
  crearProducto,
  editarProducto,
  eliminarProducto,
  eliminarProductoPermanente,
} from "../services/catalogoMaestroService.js";
import { listarImportaciones } from "../services/importacionService.js";
import {
  guardarImagen,
  borrarArchivoImagen,
  existeArchivoImagen,
  normalizarListaImagenes,
  MAX_IMAGENES,
} from "../services/imagenesService.js";

const router = Router();

// Multer para imágenes: memory storage (no guardamos el original,
// solo el archivo hasheado en data/pos/img/productos).
const uploadImagen = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.fieldname === "archivo") return cb(null, true);
    return cb(null, false);
  },
});

// ==================== HELPERS ====================

/**
 * Filtra el catálogo por q (texto libre), categoria y activo.
 * - q se busca en nombre, nombreCorto, marca, sku, codigosBarras.
 * - categoria es match exacto (case-insensitive).
 * - activo: "true" | "false" | undefined (sin filtro).
 */
function filtrarCatalogo(productos, { q, categoria, activo }) {
  let out = productos;

  if (activo === "true") out = out.filter((p) => p.activo === true);
  else if (activo === "false") out = out.filter((p) => p.activo === false);

  if (categoria) {
    const cat = String(categoria).toLowerCase();
    out = out.filter(
      (p) => String(p.categoria || "").toLowerCase() === cat,
    );
  }

  if (q) {
    const t = String(q).toLowerCase().trim();
    out = out.filter((p) => {
      const blob = [
        p.nombre,
        p.nombreCorto,
        p.marca,
        p.sku,
        ...(Array.isArray(p.codigosBarras) ? p.codigosBarras : []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return blob.includes(t);
    });
  }

  return out;
}

// ==================== GET /api/catalogo-maestro ====================

router.get("/", (req, res) => {
  try {
    const productos = leerCatalogoMaestro();
    const filtrados = filtrarCatalogo(productos, req.query);

    // Lista de categorías únicas (para el <select> del front, si lo
    // necesita). Solo de los activos, para no ofrecer categorías vacías.
    const categorias = Array.from(
      new Set(
        productos
          .filter((p) => p.activo !== false && p.categoria)
          .map((p) => p.categoria),
      ),
    ).sort((a, b) => a.localeCompare(b, "es"));

    res.json({
      success: true,
      total: filtrados.length,
      totalCatalogo: productos.length,
      categorias,
      productos: filtrados,
    });
  } catch (e) {
    console.error("❌ [CATALOGO-MAESTRO/GET]", e.message);
    res.status(500).json({ success: false, error: e.message });
  }
});

// ==================== POST /api/catalogo-maestro/:sku/imagenes ====================

router.post(
  "/:sku/imagenes",
  uploadImagen.single("archivo"),
  (req, res) => {
    try {
      const { sku } = req.params;
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'Falta el archivo (campo "archivo")',
        });
      }

      const maestro = leerCatalogoMaestro();
      const idx = maestro.findIndex((p) => p.sku === sku);
      if (idx === -1) {
        return res.status(404).json({
          success: false,
          error: `Producto no encontrado: ${sku}`,
        });
      }

      const existente = maestro[idx];
      const imagenes = normalizarListaImagenes(existente);
      if (imagenes.length >= MAX_IMAGENES) {
        return res.status(400).json({
          success: false,
          error: `Límite de ${MAX_IMAGENES} imágenes por producto alcanzado.`,
        });
      }

      const { archivo, bytes } = guardarImagen(req.file.buffer);

      const nuevas = [
        ...imagenes,
        { archivo, alt: "", orden: imagenes.length },
      ];

      const actualizado = editarProducto(sku, { imagenes: nuevas });

      return res.json({
        success: true,
        producto: actualizado,
        imagen: { archivo, bytes },
        mensaje: "Imagen subida correctamente.",
      });
    } catch (e) {
      console.error(`❌ [CATALOGO-MAESTRO/${req.params.sku}/imagenes POST]`, e.message);
      res.status(e.status || 500).json({ success: false, error: e.message });
    }
  },
);

// ==================== DELETE /api/catalogo-maestro/:sku/imagenes/:archivo ====================

router.delete("/:sku/imagenes/:archivo", (req, res) => {
  try {
    const { sku, archivo } = req.params;
    const archivoSeguro = decodeURIComponent(archivo);

    const maestro = leerCatalogoMaestro();
    const idx = maestro.findIndex((p) => p.sku === sku);
    if (idx === -1) {
      return res.status(404).json({
        success: false,
        error: `Producto no encontrado: ${sku}`,
      });
    }

    const existente = maestro[idx];
    const imagenes = normalizarListaImagenes(existente);

    if (!imagenes.some((i) => i.archivo === archivoSeguro)) {
      return res.status(404).json({
        success: false,
        error: `Imagen no encontrada: ${archivoSeguro}`,
      });
    }

    borrarArchivoImagen(archivoSeguro);

    const restantes = imagenes.filter((i) => i.archivo !== archivoSeguro);
    const actualizado = editarProducto(sku, { imagenes: restantes });

    return res.json({
      success: true,
      producto: actualizado,
      mensaje: "Imagen eliminada.",
    });
  } catch (e) {
    console.error(
      `❌ [CATALOGO-MAESTRO/${req.params.sku}/imagenes DELETE]`,
      e.message,
    );
    res.status(e.status || 500).json({ success: false, error: e.message });
  }
});

// ==================== PUT /api/catalogo-maestro/:sku/imagenes/orden ====================

router.put("/:sku/imagenes/orden", (req, res) => {
  try {
    const { sku } = req.params;
    const { orden } = req.body;

    if (!Array.isArray(orden) || orden.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Falta el campo "orden" (array de archivos)',
      });
    }

    const maestro = leerCatalogoMaestro();
    const idx = maestro.findIndex((p) => p.sku === sku);
    if (idx === -1) {
      return res.status(404).json({
        success: false,
        error: `Producto no encontrado: ${sku}`,
      });
    }

    const existente = maestro[idx];
    const imagenes = normalizarListaImagenes(existente);

    const archivosExistentes = new Set(imagenes.map((i) => i.archivo));
    for (const archivo of orden) {
      if (!archivosExistentes.has(archivo)) {
        return res.status(404).json({
          success: false,
          error: `Archivo no válido en orden: ${archivo}`,
        });
      }
    }

    const reordenadas = imagenes
      .filter((i) => orden.includes(i.archivo))
      .sort((a, b) => orden.indexOf(a.archivo) - orden.indexOf(b.archivo));

    const actualizado = editarProducto(sku, { imagenes: reordenadas });

    return res.json({
      success: true,
      producto: actualizado,
      mensaje: "Orden de imágenes actualizado.",
    });
  } catch (e) {
    console.error(`❌ [CATALOGO-MAESTRO/${req.params.sku}/imagenes/orden PUT]`, e.message);
    res.status(e.status || 500).json({ success: false, error: e.message });
  }
});

// ==================== GET /api/catalogo-maestro/:sku ====================

router.get("/:sku", (req, res) => {
  try {
    const { sku } = req.params;
    const productos = leerCatalogoMaestro();
    const producto = productos.find((p) => p.sku === sku);

    if (!producto) {
      return res.status(404).json({
        success: false,
        error: `Producto no encontrado: ${sku}`,
      });
    }

    res.json({ success: true, producto });
  } catch (e) {
    console.error(`❌ [CATALOGO-MAESTRO/${req.params.sku}]`, e.message);
    res.status(500).json({ success: false, error: e.message });
  }
});

// ==================== POST /api/catalogo-maestro ====================

router.post("/", (req, res) => {
  try {
    const nuevo = crearProducto(req.body);
    res.status(201).json({ success: true, producto: nuevo });
  } catch (e) {
    console.error("❌ [CATALOGO-MAESTRO/POST]", e.message);
    res.status(e.status || 400).json({ success: false, error: e.message });
  }
});

// ==================== PUT /api/catalogo-maestro/:sku ====================

router.put("/:sku", (req, res) => {
  try {
    const actualizado = editarProducto(req.params.sku, req.body);
    res.json({ success: true, producto: actualizado });
  } catch (e) {
    console.error(`❌ [CATALOGO-MAESTRO/PUT ${req.params.sku}]`, e.message);
    res.status(e.status || 400).json({ success: false, error: e.message });
  }
});

// ==================== DELETE /api/catalogo-maestro/:sku ====================
// Soft delete: marca activo=false. El producto sigue en el JSON.

router.delete("/:sku", (req, res) => {
  try {
    const eliminado = eliminarProducto(req.params.sku);
    res.json({
      success: true,
      producto: eliminado,
      mensaje: "Producto desactivado (soft delete). Sigue en el catálogo con activo=false.",
    });
  } catch (e) {
    console.error(`❌ [CATALOGO-MAESTRO/DELETE ${req.params.sku}]`, e.message);
    res.status(e.status || 400).json({ success: false, error: e.message });
  }
});

// ==================== DELETE /api/catalogo-maestro/:sku/permanente ====================
// Hard delete: borra físicamente el producto del JSON y sus imágenes del disco.

router.delete("/:sku/permanente", (req, res) => {
  try {
    const resultado = eliminarProductoPermanente(req.params.sku);
    res.json({
      success: true,
      sku: resultado.sku,
      imagenesBorradas: resultado.imagenesBorradas,
      mensaje: "Producto eliminado de forma permanente.",
    });
  } catch (e) {
    console.error(`❌ [CATALOGO-MAESTRO/${req.params.sku}/permanente]`, e.message);
    res.status(e.status || 400).json({ success: false, error: e.message });
  }
});

// ==================== GET /api/catalogo-maestro/importaciones ====================
// Historial de importaciones. Alias del endpoint de /api/importar,
// pero lo dejamos acá también para que el frontend de admin tenga un
// solo prefijo. IMPORTANTE: esta ruta va ANTES de /:sku, si no Express
// la interpreta como un sku llamado "importaciones".

router.get("/importaciones/lista", (req, res) => {
  try {
    const importaciones = listarImportaciones();
    res.json({
      success: true,
      total: importaciones.length,
      importaciones,
    });
  } catch (e) {
    console.error("❌ [CATALOGO-MAESTRO/importaciones]", e.message);
    res.status(500).json({ success: false, error: e.message });
  }
});

export default router;