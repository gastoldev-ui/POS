// backend/src/routes/importarRoutes.js
//
// Adaptado del comparador. Recortes respecto al original:
//   - Fuera /imagenes/* (matcher de scrapers, no aplica al POS).
//   - Fuera nombreProveedor / slug / sobrescribir (el POS tiene UN
//     catálogo, no N proveedores).
//   - Fuera ZIP de imágenes.
//   - Fuera mapeos guardados por proveedor (el POS guarda un solo
//     mapeo "default" en data/pos/mapeo-default.json, ver importacionService).
//
// Lo que SÍ se mantiene:
//   - POST /preview   → lee Excel + detecta header + automap + sample.
//   - POST /confirmar → procesa + merge no-destructivo + historial.
//   - GET  /campos    → campos base para el MapeoColumnasModal.
//   - GET  /modelo    → Excel de ejemplo.
//   - GET  /mapeos    → último mapeo guardado (para pre-cargar).
//   - GET  /importaciones → historial de imports.

import { Router } from "express";
import multer from "multer";
import * as XLSX from "xlsx";
import {
  previewExcel,
  CAMPOS_BASE,
} from "../services/excelUniversalService.js";
import {
  aplicarImportacion,
  leerUltimoMapeo,
  guardarUltimoMapeo,
  listarImportaciones,
} from "../services/importacionService.js";

const router = Router();

// ==================== MULTER ====================

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.fieldname === "archivo") {
      if (!/\.(xlsx?|csv)$/i.test(file.originalname)) {
        const err = new Error("El archivo debe ser .xlsx, .xls o .csv");
        err.status = 400;
        return cb(err);
      }
      return cb(null, true);
    }
    return cb(null, false);
  },
});

function uploadSingle(req, res, next) {
  upload.single("archivo")(req, res, (err) => {
    if (err) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res
          .status(400)
          .json({ success: false, error: "El archivo supera los 50MB" });
      }
      return res
        .status(err.status || 400)
        .json({ success: false, error: err.message });
    }
    next();
  });
}

// ==================== POST /api/importar/preview ====================

router.post("/preview", uploadSingle, (req, res) => {
  try {
    if (!req.file) {
      return res
        .status(400)
        .json({ success: false, error: 'Falta el archivo (campo "archivo")' });
    }

    const headerRowRaw = req.body.headerRow;
    const headerRow =
      headerRowRaw !== undefined && headerRowRaw !== ""
        ? Number(headerRowRaw)
        : null;

    const preview = previewExcel(req.file.buffer, { headerRow });

    // Mapeo sugerido: el último mapeo guardado, o el automap.
    const mapeoGuardado = leerUltimoMapeo();
    const mapeoInicial = mapeoGuardado || preview.automap;

    res.json({
      success: true,
      headers: preview.headers,
      sample: preview.sample,
      totalFilas: preview.totalFilas,
      sheetName: preview.sheetName,
      automap: preview.automap,
      mapeoGuardado,
      mapeoInicial,
      camposBase: preview.camposBase,
      filaHeader: preview.filaHeader,
      nombreArchivo: req.file.originalname,
    });
  } catch (e) {
    console.error("❌ [IMPORTAR/preview]", e.message);
    res.status(e.status || 500).json({ success: false, error: e.message });
  }
});

// ==================== POST /api/importar/confirmar ====================

router.post("/confirmar", uploadSingle, (req, res) => {
  try {
    const archivoExcel = req.file;
    if (!archivoExcel) {
      return res
        .status(400)
        .json({ success: false, error: 'Falta el archivo (campo "archivo")' });
    }

    let mapeo;
    try {
      mapeo = JSON.parse(req.body.mapeo || "{}");
    } catch {
      return res
        .status(400)
        .json({ success: false, error: 'El campo "mapeo" no es JSON válido' });
    }

    const headerRow = Number(req.body.headerRow) || 0;
    const importacionId =
      String(req.body.importacionId || "").trim() ||
      `import-${new Date().toISOString().replace(/[:.]/g, "-")}`;

    const resultado = aplicarImportacion({
      buffer: archivoExcel.buffer,
      nombreArchivo: archivoExcel.originalname,
      mapeo,
      headerRow,
      importacionId,
    });

    // Guardamos el mapeo para la próxima (auto-precarga en el modal).
    guardarUltimoMapeo(mapeo);

    res.json({
      success: true,
      importacionId,
      ...resultado,
    });
  } catch (e) {
    console.error("❌ [IMPORTAR/confirmar]", e.message);
    res.status(e.status || 500).json({ success: false, error: e.message });
  }
});

// ==================== GET /api/importar/campos ====================

router.get("/campos", (req, res) => {
  res.json({ success: true, camposBase: CAMPOS_BASE });
});

// ==================== GET /api/importar/modelo ====================

router.get("/modelo", (req, res) => {
  try {
    const headers = CAMPOS_BASE.map((c) => c.label);
    const labelOf = (key) =>
      CAMPOS_BASE.find((c) => c.key === key)?.label || key;

    const filas = [
      {
        [labelOf("refId")]: "AR-0001",
        [labelOf("nombre")]: "Alfajor Águila Minitorta Triple 69g",
        [labelOf("sku")]: "7790040000001",
        [labelOf("marca")]: "Águila",
        [labelOf("categoria")]: "Alfajores",
        [labelOf("subcategoria")]: "Triples",
        [labelOf("precio")]: 850.5,
        [labelOf("stock")]: 120,
        [labelOf("uxB")]: 12,
        [labelOf("imagen")]: "",
      },
      {
        [labelOf("refId")]: "AR-0002",
        [labelOf("nombre")]: "Chocolate Cofler Block 170g",
        [labelOf("sku")]: "7790040000002",
        [labelOf("marca")]: "Cofler",
        [labelOf("categoria")]: "Chocolates",
        [labelOf("subcategoria")]: "Bloques",
        [labelOf("precio")]: 1450,
        [labelOf("stock")]: 48,
        [labelOf("uxB")]: 6,
        [labelOf("imagen")]: "",
      },
      {
        [labelOf("refId")]: "AR-0003",
        [labelOf("nombre")]: "Galletitas Bagley Criollitas 300g",
        [labelOf("sku")]: "7790040000003",
        [labelOf("marca")]: "Bagley",
        [labelOf("categoria")]: "Galletitas",
        [labelOf("subcategoria")]: "Clásicas",
        [labelOf("precio")]: 620,
        [labelOf("stock")]: 0,
        [labelOf("uxB")]: 1,
        [labelOf("imagen")]: "",
      },
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(filas, { header: headers });
    ws["!cols"] = headers.map((h) => ({ wch: Math.max(h.length + 2, 14) }));
    XLSX.utils.book_append_sheet(wb, ws, "Lista de precios");

    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="modelo-catalogo-pos.xlsx"',
    );
    res.setHeader("Access-Control-Expose-Headers", "Content-Disposition");
    res.send(buffer);
  } catch (e) {
    console.error("❌ [IMPORTAR/modelo]", e.message);
    res.status(500).json({ success: false, error: e.message });
  }
});

// ==================== GET /api/importar/mapeos ====================
// En el POS hay UN solo mapeo (el último usado). Este endpoint lo
// devuelve para que el front pueda pre-cargarlo.

router.get("/mapeos", (req, res) => {
  try {
    const mapeo = leerUltimoMapeo();
    res.json({ success: true, tieneMapeo: Boolean(mapeo), mapeo });
  } catch (e) {
    console.error("❌ [IMPORTAR/mapeos]", e.message);
    res.status(500).json({ success: false, error: e.message });
  }
});

// ==================== GET /api/importar/importaciones ====================

router.get("/importaciones", (req, res) => {
  try {
    const importaciones = listarImportaciones();
    res.json({
      success: true,
      total: importaciones.length,
      importaciones,
    });
  } catch (e) {
    console.error("❌ [IMPORTAR/importaciones]", e.message);
    res.status(500).json({ success: false, error: e.message });
  }
});

export default router;