// backend/src/services/printerService.js
import { printer as ThermalPrinter, types as PrinterTypes } from 'node-thermal-printer';

/**
 * Normaliza los pagos de un ticket a un array [{metodo, monto}].
 * Soporta el contrato nuevo (pagos[]) y el viejo (metodoPago + total).
 */
function normalizarPagos(ticketData) {
  if (Array.isArray(ticketData.pagos) && ticketData.pagos.length > 0) {
    return ticketData.pagos.map((p) => ({
      metodo: String(p.metodo || 'Efectivo'),
      monto: Number(p.monto) || 0,
    }));
  }
  return [
    {
      metodo: ticketData.metodoPago || 'Efectivo',
      monto: Number(ticketData.total) || 0,
    },
  ];
}

/**
 * Genera e imprime un ticket usando ESC/POS.
 * @param {Object} ticketData - Datos del ticket (items, total, etc.)
 * @returns {Promise<{success: boolean, skipped?: boolean, error?: string}>}
 */
export async function imprimirTicket(ticketData) {
  try {
    // ── Guard de desarrollo ──────────────────────────────────────────
    // Si no hay PRINTER_INTERFACE seteada, no intentamos instanciar el
    // driver: node-thermal-printer tira "No driver set!" y ensucia los
    // logs. Devolvemos skipped=true para que el front sepa que no se
    // imprimió, pero la venta YA está guardada por el caller.
    if (!process.env.PRINTER_INTERFACE) {
      console.log(
        '🖨️  [printer] PRINTER_INTERFACE no seteada → skip impresión (modo dev)',
      );
      return {
        success: true,
        skipped: true,
        error: 'Impresora no configurada (modo dev)',
      };
    }

    // La construcción va DENTRO del try para que un fallo del driver
    // no tire abajo el proceso del backend (evita el 502).
    const printer = new ThermalPrinter({
      type: PrinterTypes.EPSON, // o STAR, depende de tu impresora
      interface: process.env.PRINTER_INTERFACE,
      characterSet: 'PC850_MULTILINGUAL', // Para acentos y ñ
      removeSpecialCharacters: false,
      lineCharacter: '-',
    });

    const isConnected = await printer.isPrinterConnected();
    if (!isConnected) {
      return { success: false, error: 'Impresora no conectada' };
    }

    // --- Formato del ticket ---
    printer.alignCenter();
    printer.bold(true);
    printer.println('DULCE REINO');
    printer.bold(false);
    printer.println('Ticket de Venta');
    printer.drawLine();

    printer.alignLeft();
    printer.println(`Fecha: ${new Date(ticketData.fecha).toLocaleString('es-AR')}`);
    printer.println(`Ticket #: ${ticketData.id}`);
    printer.drawLine();

    // Items
    for (const item of ticketData.items) {
      printer.println(item.nombre);
      const lineaCantidadPrecio = `${item.cantidad} x $${item.precioUnitario.toFixed(2)}`;
      printer.leftRight(lineaCantidadPrecio, `$${item.subtotal.toFixed(2)}`);
    }

    printer.drawLine();
    printer.bold(true);
    printer.leftRight('TOTAL', `$${ticketData.total.toFixed(2)}`);
    printer.bold(false);

    // --- Pagos (soporta uno o varios medios) ---
    const pagos = normalizarPagos(ticketData);
    printer.drawLine();
    printer.println('PAGOS:');
    for (const p of pagos) {
      printer.leftRight(p.metodo, `$${p.monto.toFixed(2)}`);
    }

    // Vuelto: solo si lo pagado supera el total
    const totalPagado = pagos.reduce((s, p) => s + p.monto, 0);
    const vuelto = Math.max(0, totalPagado - Number(ticketData.total || 0));
    if (vuelto > 0.001) {
      printer.leftRight('Vuelto:', `$${vuelto.toFixed(2)}`);
    }

    printer.drawLine();
    printer.alignCenter();
    printer.println('¡Gracias por su compra!');
    printer.newLine();
    printer.newLine();
    printer.cut();

    await printer.execute();
    return { success: true };
  } catch (error) {
    console.error('Error al imprimir:', error);
    return { success: false, error: error.message };
  }
}