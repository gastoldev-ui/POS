// src/context/POSContext.jsx
import {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useMemo,
} from 'react';

function generarId() {
  return `pos_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function redondear2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function crearFilaVacia() {
  return {
    id: generarId(),
    tipo: 'producto',
    sku: null,
    nombre: '',
    cantidad: 1,
    precioUnitario: 0,
    subtotal: 0,
    precioEditado: false,
    stock: null,
    imagen: null,
    vacia: true,
    esNuevo: false,
  };
}

const estadoInicial = {
  items: [crearFilaVacia()],
};

function reducer(state, action) {
  switch (action.type) {
    case 'AGREGAR_PRODUCTO': {
      const { filaId, art, cantidad = 1, precioForzado = null } = action.payload;
      if (!art) return state;

      const sku = String(art.sku || art.refId || art.id || '').trim();
      if (!sku) return state;

      const precioUnitario =
        precioForzado !== null && precioForzado !== undefined
          ? Number(precioForzado) || 0
          : Number(
              art.costoConDescuento ?? art.costoUnitario ?? art.precio ?? 0,
            );

      const existenteIdx = state.items.findIndex(
        (it) => !it.vacia && it.sku === sku,
      );

      if (existenteIdx >= 0) {
        const nuevosItems = state.items.map((it, i) => {
          if (i === existenteIdx) {
            const nuevaCantidad =
              it.cantidad + Math.max(1, Number(cantidad) || 1);
            return {
              ...it,
              cantidad: nuevaCantidad,
              subtotal: redondear2(nuevaCantidad * it.precioUnitario),
            };
          }
          if (it.id === filaId) return crearFilaVacia();
          return it;
        });
        return { ...state, items: nuevosItems };
      }

      const cant = Math.max(1, Number(cantidad) || 1);
      const nuevosItems = state.items.map((it) => {
        if (it.id !== filaId) return it;
        return {
          id: it.id,
          tipo: 'producto',
          sku,
          nombre: String(art.nombre || 'Sin nombre'),
          cantidad: cant,
          precioUnitario: redondear2(precioUnitario),
          subtotal: redondear2(cant * precioUnitario),
          precioEditado: false,
          stock: art.stock ?? null,
          imagen: art.imagen || null,
          vacia: false,
          esNuevo: true,
        };
      });

      return { ...state, items: [...nuevosItems, crearFilaVacia()] };
    }

    case 'AGREGAR_MANUAL': {
      const { monto = 0, descripcion = '' } = action.payload;
      const precioUnitario = Number(monto) || 0;

      const nuevoItem = {
        id: generarId(),
        tipo: 'manual',
        sku: null,
        nombre:
          descripcion?.trim() ||
          (precioUnitario > 0 ? 'Monto manual' : 'Art. Kiosco'),
        cantidad: 1,
        precioUnitario,
        subtotal: precioUnitario,
        precioEditado: false,
        stock: null,
        imagen: null,
        vacia: false,
        esNuevo: true,
      };

      const filasReales = state.items.filter((it) => !it.vacia);
      const filaVacia =
        state.items.find((it) => it.vacia) || crearFilaVacia();

      return {
        ...state,
        items: [...filasReales, nuevoItem, filaVacia],
      };
    }

    case 'EDITAR_PRECIO': {
      const { id, nuevoPrecio } = action.payload;
      const precio = Number(nuevoPrecio);
      if (!Number.isFinite(precio) || precio < 0) return state;

      return {
        ...state,
        items: state.items.map((it) =>
          it.id === id
            ? {
                ...it,
                precioUnitario: redondear2(precio),
                subtotal: redondear2(precio * it.cantidad),
                precioEditado: true,
                esNuevo: false,
              }
            : it,
        ),
      };
    }

    case 'EDITAR_CANTIDAD': {
      const { id, nuevaCantidad } = action.payload;
      const cant = Math.max(1, Math.floor(Number(nuevaCantidad) || 1));

      return {
        ...state,
        items: state.items.map((it) =>
          it.id === id
            ? {
                ...it,
                cantidad: cant,
                subtotal: redondear2(cant * it.precioUnitario),
              }
            : it,
        ),
      };
    }

    case 'EDITAR_NOMBRE': {
      const { id, nuevoNombre } = action.payload;
      return {
        ...state,
        items: state.items.map((it) =>
          it.id === id
            ? { ...it, nombre: String(nuevoNombre || '').trim() || it.nombre }
            : it,
        ),
      };
    }

    case 'QUITAR': {
      const { id } = action.payload;
      const sinFila = state.items.filter((it) => it.id !== id);
      return {
        ...state,
        items: sinFila.length === 0 ? [crearFilaVacia()] : sinFila,
      };
    }

    case 'QUITAR_ULTIMA': {
      const filasReales = state.items.filter((it) => !it.vacia);
      if (filasReales.length === 0) return state;

      const sinUltima = filasReales.slice(0, -1);
      return {
        ...state,
        items: [...sinUltima, crearFilaVacia()],
      };
    }

    case 'VACIAR':
      return { ...state, items: [crearFilaVacia()] };

    case 'LIMPIAR_NUEVO': {
      const { id } = action.payload;
      return {
        ...state,
        items: state.items.map((it) =>
          it.id === id ? { ...it, esNuevo: false } : it,
        ),
      };
    }

    default:
      return state;
  }
}

const POSContext = createContext(null);

export function POSProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, estadoInicial);

  const agregarProducto = useCallback(
    (filaId, art, cantidad = 1, precioForzado = null) => {
      dispatch({
        type: 'AGREGAR_PRODUCTO',
        payload: { filaId, art, cantidad, precioForzado },
      });
    },
    [],
  );

  const agregarManual = useCallback((monto = 0, descripcion = '') => {
    dispatch({ type: 'AGREGAR_MANUAL', payload: { monto, descripcion } });
  }, []);

  const editarPrecio = useCallback((id, nuevoPrecio) => {
    dispatch({ type: 'EDITAR_PRECIO', payload: { id, nuevoPrecio } });
  }, []);

  const editarCantidad = useCallback((id, nuevaCantidad) => {
    dispatch({ type: 'EDITAR_CANTIDAD', payload: { id, nuevaCantidad } });
  }, []);

  const editarNombre = useCallback((id, nuevoNombre) => {
    dispatch({ type: 'EDITAR_NOMBRE', payload: { id, nuevoNombre } });
  }, []);

  const quitarItem = useCallback((id) => {
    dispatch({ type: 'QUITAR', payload: { id } });
  }, []);

  const quitarUltima = useCallback(() => {
    dispatch({ type: 'QUITAR_ULTIMA' });
  }, []);

  const vaciar = useCallback(() => dispatch({ type: 'VACIAR' }), []);

  const limpiarNuevo = useCallback((id) => {
    dispatch({ type: 'LIMPIAR_NUEVO', payload: { id } });
  }, []);

  const totales = useMemo(() => {
    const filas = state.items.filter((it) => !it.vacia);
    const totalUnidades = filas.reduce((s, it) => s + it.cantidad, 0);
    const total = redondear2(filas.reduce((s, it) => s + it.subtotal, 0));
    return {
      cantidadItems: filas.length,
      totalUnidades,
      total,
    };
  }, [state.items]);

  /**
   * Construye el ticket con el CONTRATO NUEVO que espera el backend:
   *
   *   { id, fecha, pagos[], metodoPago, total, totalPagado, vuelto, items[] }
   *
   * `pagos` es [{ metodo: string, monto: number }, ...]. El backend
   * (normalizarPagos en posRoutes.js / printerService.js) soporta tanto
   * este contrato como el viejo, pero acá siempre mandamos el nuevo.
   *
   * `metodoPago` es un resumen legible: el nombre del método si hay uno
   * solo, "Mixto" si hay varios. El backend lo ignora para los cálculos
   * (usa pagos[]), pero sirve para logs y para el ticket.
   */
  const construirTicket = useCallback(
    (pagos = []) => {
      const pagosNormalizados = (Array.isArray(pagos) ? pagos : []).map(
        (p) => ({
          metodo: String(p?.metodo || 'Efectivo'),
          monto: redondear2(p?.monto),
        }),
      );

      const totalPagado = redondear2(
        pagosNormalizados.reduce((s, p) => s + p.monto, 0),
      );
      const vuelto = redondear2(Math.max(0, totalPagado - totales.total));

      const metodoPago =
        pagosNormalizados.length === 0
          ? 'Efectivo'
          : pagosNormalizados.length === 1
            ? pagosNormalizados[0].metodo
            : 'Mixto';

      return {
        id: `T-${Date.now()}`,
        fecha: new Date().toISOString(),
        pagos: pagosNormalizados,
        metodoPago,
        total: totales.total,
        totalPagado,
        vuelto,
        items: state.items
          .filter((it) => !it.vacia)
          .map((it) => ({
            tipo: it.tipo,
            sku: it.sku,
            nombre: it.nombre,
            cantidad: it.cantidad,
            precioUnitario: it.precioUnitario,
            subtotal: it.subtotal,
            precioEditado: it.precioEditado,
          })),
      };
    },
    [state.items, totales.total],
  );

  const value = {
    items: state.items,
    itemsReales: state.items.filter((it) => !it.vacia),
    totales,
    agregarProducto,
    agregarManual,
    editarPrecio,
    editarCantidad,
    editarNombre,
    quitarItem,
    quitarUltima,
    vaciar,
    limpiarNuevo,
    construirTicket,
  };

  return <POSContext.Provider value={value}>{children}</POSContext.Provider>;
}

export function usePOS() {
  const ctx = useContext(POSContext);
  if (!ctx) throw new Error('usePOS debe usarse dentro de <POSProvider>');
  return ctx;
}