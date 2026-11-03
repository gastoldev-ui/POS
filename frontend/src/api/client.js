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

  const esFormData =
    typeof FormData !== "undefined" && body instanceof FormData;
  const headersFinal = esFormData ? undefined : headers;

  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: headersFinal,
    body: esFormData ? body : JSON.stringify(body ?? {}),
  });
  return manejarRespuesta(res);
}

async function get(path) {
  const res = await fetch(`${BASE}${path}`);
  return manejarRespuesta(res);
}

async function put(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  return manejarRespuesta(res);
}

async function del(path) {
  const res = await fetch(`${BASE}${path}`, { method: "DELETE" });
  return manejarRespuesta(res);
}

function conFecha(path, fecha) {
  if (!fecha) return path;
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}fecha=${encodeURIComponent(fecha)}`;
}

export const api = {
  // ==================== POS (ventas, arqueo, tickets) ====================
  posVenta: (ticket, opts) => post("/pos/venta", ticket, opts),
  posCerrarCaja: (montoInicial, efectivoDeclarado) =>
    post("/pos/cerrar-caja", { montoInicial, efectivoDeclarado }),
  posVentasHoy: (fecha) => get(conFecha("/pos/ventas-hoy", fecha)),
  posResumenDia: (fecha) => get(conFecha("/pos/resumen-dia", fecha)),
  posSiguienteTicket: (fecha) => get(conFecha("/pos/siguiente-ticket", fecha)),
  posImprimir: (ticket) => post("/pos/imprimir", ticket),

  // ==================== CATÁLOGO MAESTRO ====================
  catalogoMaestroListar: (filtros = {}) => {
    const params = new URLSearchParams();
    if (filtros.q) params.set("q", filtros.q);
    if (filtros.categoria) params.set("categoria", filtros.categoria);
    if (filtros.activo !== undefined)
      params.set("activo", String(filtros.activo));
    const qs = params.toString();
    return get(`/catalogo-maestro${qs ? `?${qs}` : ""}`);
  },
  catalogoMaestroGet: (sku) =>
    get(`/catalogo-maestro/${encodeURIComponent(sku)}`),
  catalogoMaestroCrear: (producto) => post("/catalogo-maestro", producto),
  catalogoMaestroEditar: (sku, cambios) =>
    put(`/catalogo-maestro/${encodeURIComponent(sku)}`, cambios),
  catalogoMaestroEliminar: (sku) =>
    del(`/catalogo-maestro/${encodeURIComponent(sku)}`),
  
  // Historial de importaciones del catálogo maestro
  catalogoMaestroImportacionesLista: () =>
    get("/catalogo-maestro/importaciones/lista"),

  // ==================== IMPORTAR EXCEL ====================
  importarPreview: (file, headerRow = null) => {
    const fd = new FormData();
    fd.append("archivo", file);
    if (headerRow !== null && headerRow !== undefined) {
      fd.append("headerRow", String(headerRow));
    }
    return post("/importar/preview", fd);
  },
  importarConfirmar: (
    file,
    mapeo,
    { headerRow = 0, importacionId = null } = {},
  ) => {
    const fd = new FormData();
    fd.append("archivo", file);
    fd.append("mapeo", JSON.stringify(mapeo));
    fd.append("headerRow", String(headerRow));
    if (importacionId) fd.append("importacionId", importacionId);
    return post("/importar/confirmar", fd);
  },
  importarCampos: () => get("/importar/campos"),
  importarMapeos: () => get("/importar/mapeos"),
  importarImportaciones: () => get("/importar/importaciones"),
  importarModelo: () => {
    window.open(`${BASE}/importar/modelo`, "_blank");
  },
};