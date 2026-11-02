// backend/src/routes/posRoutes.js
import { Router } from "express";
import { imprimirTicket } from "../services/printerService.js";
import { guardarVenta, leerVentasDelDia } from "../services/posService.js";

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

// ==================== POST /api/pos/venta ====================
// Guarda la venta en el JSON del día y dispara la impresión.
// La venta se guarda SIEMPRE primero. Si la impresión falla, la venta
// no se pierde: devuelve impresion.success=false pero venta guardada.
// Si el cliente manda el header X-Skip-Print: 1, no se imprime.
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

    const guardada = guardarVenta(venta);

    // Si el cliente pidió no imprimir, no imprimimos
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

    // Total facturado (todos los medios)
    const totalVentas = ventas.reduce(
      (sum, v) => sum + (Number(v.total) || 0),
      0,
    );

    // Total cobrado en efectivo (soporta pagos combinados)
    const totalEfectivo = ventas.reduce((sum, v) => {
      const pagos = normalizarPagos(v);
      return (
        sum +
        pagos
          .filter((p) => p.metodo === "Efectivo")
          .reduce((s, p) => s + p.monto, 0)
      );
    }, 0);

    // Cantidad de ventas que tuvieron al menos un pago en efectivo
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
router.get("/ventas-hoy", (req, res) => {
  try {
    const ventas = leerVentasDelDia();
    res.json({ success: true, total: ventas.length, ventas });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

export default router;