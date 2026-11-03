// POS/backend/index.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

import posRoutes from "./src/routes/posRoutes.js";
import catalogoMaestroRoutes from "./src/routes/catalogoMaestroRoutes.js";
import importarRoutes from "./src/routes/importarRoutes.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();
const app = express();

app.use(cors());

// Límite alto porque el import de Excel manda el archivo en multipart,
// y un Excel con miles de filas puede pesar varios MB.
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// ==================== ESTÁTICOS ====================
// Imágenes locales del catálogo maestro.
// backend/data/pos/img/productos/<hash>.jpg → /img/productos/<hash>.jpg
const imgPath = path.resolve(__dirname, "data/pos/img");
app.use(
  "/img",
  express.static(imgPath, {
    maxAge: "7d",
    fallthrough: true, // si no existe, deja seguir (devuelve 404 real, no HTML)
  }),
);

// ==================== API ====================

app.use("/api/pos", posRoutes);
app.use("/api/catalogo-maestro", catalogoMaestroRoutes);
app.use("/api/importar", importarRoutes);

// ==================== HEALTH ====================

app.get("/api/health", (req, res) => {
  res.json({ success: true, mensaje: "POS Dulce Reino backend OK" });
});

// ==================== 404 JSON PARA /api ====================
// Si pegan a una ruta /api/* que no existe, que devuelva JSON en vez
// del HTML feo de Express. Eso hace que el frontend muestre un error
// legible en lugar de "Cannot GET /api/...".
app.use("/api", (req, res) => {
  res.status(404).json({
    success: false,
    error: `Endpoint no encontrado: ${req.method} ${req.originalUrl}`,
  });
});

// ==================== LISTEN ====================

const PORT = Number(process.env.PORT) || 4000;
app.listen(PORT, () => {
  console.log(`🚀 Backend POS en http://localhost:${PORT}`);
  console.log(`   · /api/pos               → ventas + arqueo + tickets`);
  console.log(`   · /api/catalogo-maestro  → CRUD del catálogo`);
  console.log(`   · /api/importar          → preview + confirmar Excel`);
  console.log(`   · /img/productos         → imágenes locales`);
});