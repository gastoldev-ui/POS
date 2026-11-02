// backend/src/services/posService.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { reservarSiguienteTicket } from './contadorService.js';

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
 * Parsea "YYYY-MM-DD" a un Date en UTC a mediodía, para que no se
 * desplace por el timezone al hacer toISOString() de vuelta.
 */
function parsearFechaStr(fechaStr) {
  if (!fechaStr) return new Date();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fechaStr);
  if (!m) return new Date();
  const [, y, mo, d] = m;
  return new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d), 12, 0, 0));
}

/**
 * Guarda una venta en el archivo del día.
 * Asigna el ID secuencial atómicamente ANTES de escribir, si la venta
 * no viene con uno ya asignado.
 *
 * @param {Object} venta
 * @param {string} [fechaStr] - YYYY-MM-DD. Si no viene, usa la fecha
 *                              interna de la venta (o hoy).
 */
export function guardarVenta(venta, fechaStr = null) {
  const fecha = fechaStr ? parsearFechaStr(fechaStr) : new Date(venta.fecha || Date.now());
  const fechaArchivo = fecha.toISOString().slice(0, 10);
  const ruta = obtenerRutaArchivo(fecha);

  let ventasDelDia = [];
  if (fs.existsSync(ruta)) {
    try {
      ventasDelDia = JSON.parse(fs.readFileSync(ruta, 'utf-8'));
    } catch {
      /* archivo corrupto, empezamos de cero */
    }
  }

  // El backend SIEMPRE asigna el ID secuencial (ignora el que mande el
  // front). Así garantizamos unicidad y orden.
  const idAsignado = reservarSiguienteTicket(fechaArchivo);
  const ventaFinal = { ...venta, id: idAsignado };

  ventasDelDia.push(ventaFinal);
  fs.writeFileSync(ruta, JSON.stringify(ventasDelDia, null, 2), 'utf-8');
  return ventaFinal;
}

/**
 * Lee las ventas del día.
 * @param {Date|string} [fecha=new Date()] - Date o "YYYY-MM-DD".
 */
export function leerVentasDelDia(fecha = new Date()) {
  const fechaDate = typeof fecha === 'string' ? parsearFechaStr(fecha) : fecha;
  const ruta = obtenerRutaArchivo(fechaDate);
  if (!fs.existsSync(ruta)) return [];
  try {
    return JSON.parse(fs.readFileSync(ruta, 'utf-8'));
  } catch {
    return [];
  }
}