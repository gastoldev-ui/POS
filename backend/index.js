// POS/backend/index.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import posRoutes from "./src/routes/posRoutes.js";

dotenv.config();
const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/pos", posRoutes);

const PORT = 4000; // O el que quieras
app.listen(PORT, () => {
  console.log(`🚀 Backend POS en http://localhost:${PORT}`);
});