// src/api/client.js
const BASE = "/api"; // Vite lo redirige a http://localhost:4000 vía proxy

export class ApiError extends Error {
  constructor(message, status, body) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

async function manejarRespuesta(res) {
  const contentType = res.headers.get("content-type") || "";
  const esJson = contentType.includes("application/json");
  const body = esJson
    ? await res.json().catch(() => null)
    : await res.text().catch(() => null);

  if (!res.ok) {
    const msg =
      (body && body.error) || (body && body.message) || `HTTP ${res.status}`;
    throw new ApiError(msg, res.status, body);
  }
  return body;
}

async function post(path, body, opts = {}) {
  const headers = { "Content-Type": "application/json" };
  if (opts.imprimir === false) {
    headers["X-Skip-Print"] = "1";
  }
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body ?? {}),
  });
  return manejarRespuesta(res);
}

async function get(path) {
  const res = await fetch(`${BASE}${path}`);
  return manejarRespuesta(res);
}

export const api = {
  posVenta: (ticket, opts) => post("/pos/venta", ticket, opts),
  posCerrarCaja: (montoInicial, efectivoDeclarado) =>
    post("/pos/cerrar-caja", { montoInicial, efectivoDeclarado }),
  posVentasHoy: () => get("/pos/ventas-hoy"),
  posImprimir: (ticket) => post("/pos/imprimir", ticket), // <-- Para reimprimir
};
