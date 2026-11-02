// backend/src/services/posService.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const VENTAS_DIR = path.resolve(__dirname, '../../data/pos/ventas');

function obtenerRutaArchivo(fecha = new Date()) {
  if (!fs.existsSync(VENTAS_DIR)) {
    fs.mkdirSync(VENTAS_DIR, { recursive: true });
  }
  const fechaStr = fecha.toISOString().slice(0, 10); // YYYY-MM-DD
  return path.join(VENTAS_DIR, `${fechaStr}.json`);
}

/**
 * Guarda una venta en el archivo del día.
 */
export function guardarVenta(venta) {
  const ruta = obtenerRutaArchivo();
  let ventasDelDia = [];
  if (fs.existsSync(ruta)) {
    try {
      ventasDelDia = JSON.parse(fs.readFileSync(ruta, 'utf-8'));
    } catch { /* archivo corrupto, empezamos de cero */ }
  }
  ventasDelDia.push(venta);
  fs.writeFileSync(ruta, JSON.stringify(ventasDelDia, null, 2), 'utf-8');
  return venta;
}

/**
 * Lee las ventas del día.
 */
export function leerVentasDelDia(fecha = new Date()) {
  const ruta = obtenerRutaArchivo(fecha);
  if (!fs.existsSync(ruta)) return [];
  try {
    return JSON.parse(fs.readFileSync(ruta, 'utf-8'));
  } catch {
    return [];
  }
}