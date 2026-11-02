// backend/src/services/contadorService.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, '../../data/pos');
const CONTADOR_PATH = path.join(DATA_DIR, 'contador.json');

const PREFIJO = 'T-';
const DIGITOS = 5;

function fechaHoy() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

function asegurarDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function leerContadores() {
  asegurarDir();
  if (!fs.existsSync(CONTADOR_PATH)) return {};
  try {
    return JSON.parse(fs.readFileSync(CONTADOR_PATH, 'utf-8'));
  } catch {
    // archivo corrupto → arrancamos de cero
    return {};
  }
}

function escribirContadores(obj) {
  asegurarDir();
  fs.writeFileSync(CONTADOR_PATH, JSON.stringify(obj, null, 2), 'utf-8');
}

/**
 * Formatea un número entero a "T-00001".
 */
function formatear(n) {
  return `${PREFIJO}${String(n).padStart(DIGITOS, '0')}`;
}

/**
 * Devuelve el PRÓXIMO número (formateado) sin reservarlo.
 * Útil para mostrar en la UI antes de cobrar.
 */
export function verSiguienteTicket(fecha = fechaHoy()) {
  const contadores = leerContadores();
  const actual = Number(contadores[fecha]) || 0;
  return formatear(actual + 1);
}

/**
 * Incrementa y RESERVA el siguiente número para la fecha dada.
 * Devuelve el ID formateado. Es atómico a nivel de proceso (Node
 * single-thread, pero igual escribimos antes de devolver para que
 * un crash no deje el contador desfasado del archivo de ventas).
 *
 * IMPORTANTE: una vez reservado, el número NO se reutiliza aunque
 * la impresión falle. La venta ya se persistió con ese ID.
 */
export function reservarSiguienteTicket(fecha = fechaHoy()) {
  const contadores = leerContadores();
  const actual = Number(contadores[fecha]) || 0;
  const nuevo = actual + 1;
  contadores[fecha] = nuevo;
  escribirContadores(contadores);
  return formatear(nuevo);
}