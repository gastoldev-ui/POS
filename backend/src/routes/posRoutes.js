// backend/src/routes/posRoutes.js
import { Router } from "express";
import { imprimirTicket } from "../services/printerService.js";
import { guardarVenta, leerVentasDelDia } from "../services/posService.js";
import { verSiguienteTicket } from "../services/contadorService.js";

const router = Router();

// Helper: normaliza los pagos de una venta a un array [{metodo, monto}]
// Soporta el contrato nuevo (pagos[]) y el viejo (metodoPago + total).
function normalizarPagos(venta) {
  if (Array.isArray(venta.pagos) && venta.pagos.length > 0) {
    return venta.pagos.map((p) => ({
      metodo: String(p.metodo || "Efectivo"),
      monto: Number(p.monto) || 0,
    }));
  }
  return [
    {
      metodo: venta.metodoPago || "Efectivo",
      monto: Number(venta.total) || 0,
    },
  ];
}

// Valida un "YYYY-MM-DD" y devuelve el string o null.
function parsearFechaQuery(q) {
  if (typeof q !== "string") return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(q) ? q : null;
}

// ==================== GET /api/pos/siguiente-ticket ====================
// Devuelve el próximo número (formateado) SIN reservarlo.
// Query opcional: ?fecha=YYYY-MM-DD (default: hoy).
router.get("/siguiente-ticket", (req, res) => {
  try {
    const fecha = parsearFechaQuery(req.query.fecha) || undefined;
    const id = verSiguienteTicket(fecha);
    res.json({ success: true, id });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ==================== POST /api/pos/venta ====================
// Guarda la venta en el JSON del día y dispara la impresión.
// El ID secuencial lo asigna el backend atómicamente al guardar.
router.post("/venta", async (req, res) => {
  try {
    const venta = req.body;

    if (!venta || !Array.isArray(venta.items) || venta.items.length === 0) {
      return res
        .status(400)
        .json({ success: false, error: "La venta no tiene ítems" });
    }
    if (!Number.isFinite(Number(venta.total)) || Number(venta.total) <= 0) {
      return res
        .status(400)
        .json({ success: false, error: "El total de la venta es inválido" });
    }

    // Si el cliente manda fecha en formato YYYY-MM-DD, respetamos ese
    // archivo; si no, el service usa venta.fecha / hoy.
    const fechaQuery = parsearFechaQuery(venta.fechaArchivo);
    const guardada = guardarVenta(venta, fechaQuery);

    const skipPrint = req.get("X-Skip-Print") === "1";
    if (skipPrint) {
      return res.json({
        success: true,
        venta: guardada,
        impresion: { success: true, skipped: true },
      });
    }

    let impresion;
    try {
      impresion = await imprimirTicket(guardada);
    } catch (e) {
      impresion = { success: false, error: e.message };
    }

    res.json({ success: true, venta: guardada, impresion });
  } catch (e) {
    console.error("❌ [POS/venta]", e.message);
    res.status(500).json({ success: false, error: e.message });
  }
});

// ==================== POST /api/pos/imprimir ====================
router.post("/imprimir", async (req, res) => {
  try {
    const resultado = await imprimirTicket(req.body);
    if (resultado.success) {
      res.json({ success: true });
    } else {
      res.status(500).json({ success: false, error: resultado.error });
    }
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ==================== POST /api/pos/cerrar-caja ====================
router.post("/cerrar-caja", (req, res) => {
  try {
    const { montoInicial, efectivoDeclarado } = req.body || {};
    const ventas = leerVentasDelDia();

    const totalVentas = ventas.reduce(
      (sum, v) => sum + (Number(v.total) || 0),
      0,
    );

    const totalEfectivo = ventas.reduce((sum, v) => {
      const pagos = normalizarPagos(v);
      return (
        sum +
        pagos
          .filter((p) => p.metodo === "Efectivo")
          .reduce((s, p) => s + p.monto, 0)
      );
    }, 0);

    const cantidadVentasEfectivo = ventas.filter((v) =>
      normalizarPagos(v).some((p) => p.metodo === "Efectivo"),
    ).length;

    const inicial = Number(montoInicial) || 0;
    const declarado = Number(efectivoDeclarado) || 0;
    const esperadoEnCaja = inicial + totalEfectivo;
    const diferencia = declarado - esperadoEnCaja;

    res.json({
      success: true,
      resumen: {
        fecha: new Date().toISOString().slice(0, 10),
        cantidadVentas: ventas.length,
        cantidadVentasEfectivo,
        totalVentas,
        totalEfectivo,
        montoInicial: inicial,
        esperadoEnCaja,
        efectivoDeclarado: declarado,
        diferencia,
      },
    });
  } catch (e) {
    console.error("❌ [POS/cerrar-caja]", e.message);
    res.status(500).json({ success: false, error: e.message });
  }
});

// ==================== GET /api/pos/ventas-hoy ====================
// Query opcional: ?fecha=YYYY-MM-DD (default: hoy).
router.get("/ventas-hoy", (req, res) => {
  try {
    const fecha = parsearFechaQuery(req.query.fecha);
    const ventas = leerVentasDelDia(fecha || new Date());
    res.json({ success: true, total: ventas.length, ventas, fecha: fecha || null });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ==================== GET /api/pos/resumen-dia ====================
// Query opcional: ?fecha=YYYY-MM-DD (default: hoy).
// Devuelve el agregado del día: total, cantidad, desglose por método.
router.get("/resumen-dia", (req, res) => {
  try {
    const fecha = parsearFechaQuery(req.query.fecha);
    const ventas = leerVentasDelDia(fecha || new Date());

    const porMetodo = {};
    let totalFacturado = 0;

    for (const v of ventas) {
      const pagos = normalizarPagos(v);
      for (const p of pagos) {
        porMetodo[p.metodo] = (porMetodo[p.metodo] || 0) + p.monto;
        totalFacturado += p.monto;
      }
    }

    res.json({
      success: true,
      fecha: fecha || new Date().toISOString().slice(0, 10),
      cantidadVentas: ventas.length,
      totalFacturado,
      porMetodo,
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

export default router;