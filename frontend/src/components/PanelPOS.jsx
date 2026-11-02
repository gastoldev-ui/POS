// src/components/PanelPOS.jsx
import { useState, useEffect, useRef } from "react";
import { usePOS } from "../context/POSContext";
import { formatearPrecio } from "../utils/formateo";
import { CATALOGO_MOCK } from "../mocks/catalogoMock";
import { usePOSAtajos } from "../hooks/usePOSAtajos";
import { usePOSBusqueda } from "../hooks/usePOSBusqueda";
import { usePOSCarga } from "../hooks/usePOSCarga";
import CobroModal from "./CobroModal";
import ArqueoCajaModal from "./ArqueoCajaModal";
import HistorialModal from "./HistorialModal";

// Orden de navegación con ← → en la barra superior
const CAMPOS_ORDEN = ["producto", "cantidad", "precio"];

export default function PanelPOS() {
  const pos = usePOS();

  // Modales
  const [modalCobroAbierto, setModalCobroAbierto] = useState(false);
  const [modalArqueoAbierto, setModalArqueoAbierto] = useState(false);
  const [modalHistorialAbierto, setModalHistorialAbierto] = useState(false);

  // Refs para foco
  const inputProductoRef = useRef(null);
  const inputCantidadRef = useRef(null);
  const inputPrecioRef = useRef(null);
  const grillaRef = useRef(null);

  // Flag para ignorar el Enter residual que viene del modal de cobro/arqueo
  const enterBloqueadoRef = useRef(false);

  // Hooks de lógica
  const busqueda = usePOSBusqueda(CATALOGO_MOCK);
  const carga = usePOSCarga({
    onProducto: (art, cantidad, precio) => {
      // La fila vacía es la última del array (invariante de POSContext).
      const filaVacia = pos.items.find((it) => it.vacia);
      if (filaVacia) {
        pos.agregarProducto(filaVacia.id, art, cantidad, precio);
      }
    },
    onManual: (precio, descripcion) => {
      pos.agregarManual(precio, descripcion);
    },
  });

  // Foco inicial en precio (carga rápida tipo teclado)
  useEffect(() => {
    const t = setTimeout(() => {
      inputPrecioRef.current?.focus();
      inputPrecioRef.current?.select();
    }, 100);
    return () => clearTimeout(t);
  }, []);

  // Auto-scroll al fondo: la última fila siempre visible.
  const ultimaFilaId = pos.items[pos.items.length - 1]?.id;
  useEffect(() => {
    const el = grillaRef.current;
    if (!el) return;
    const raf = requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
    return () => cancelAnimationFrame(raf);
  }, [ultimaFilaId, pos.totales.cantidadItems]);

  // -------------------- Navegación ← → entre campos --------------------

  const navegarCampo = (origen, direccion) => {
    const idx = CAMPOS_ORDEN.indexOf(origen);
    if (idx === -1) return;
    const destinoIdx = Math.min(
      CAMPOS_ORDEN.length - 1,
      Math.max(0, idx + direccion),
    );
    const destino = CAMPOS_ORDEN[destinoIdx];

    if (destino === "producto") {
      inputProductoRef.current?.focus();
      inputProductoRef.current?.select();
    } else if (destino === "cantidad") {
      inputCantidadRef.current?.focus();
      inputCantidadRef.current?.select();
    } else if (destino === "precio") {
      inputPrecioRef.current?.focus();
      inputPrecioRef.current?.select();
    }
  };

  // Devuelve true si consumió la tecla (para que el caller haga return)
  const handleFlechasCampo = (origen, e) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      e.stopPropagation();
      navegarCampo(origen, -1);
      return true;
    }
    if (e.key === "ArrowRight") {
      e.preventDefault();
      e.stopPropagation();
      navegarCampo(origen, +1);
      return true;
    }
    return false;
  };

  // -------------------- Acciones reusables --------------------

  const enfocarProducto = () => {
    inputProductoRef.current?.focus();
    inputProductoRef.current?.select();
  };

  const enfocarCantidad = () => {
    if (modalCobroAbierto || modalArqueoAbierto || modalHistorialAbierto) return;
    inputCantidadRef.current?.focus();
    inputCantidadRef.current?.select();
  };

  const enfocarPrecio = () => {
    if (modalCobroAbierto || modalArqueoAbierto || modalHistorialAbierto) return;
    inputPrecioRef.current?.focus();
    inputPrecioRef.current?.select();
  };

  const abrirArqueo = () => setModalArqueoAbierto(true);
  const abrirHistorial = () => setModalHistorialAbierto(true);

  const borrarUltima = () => pos.quitarUltima();

  const cobrar = () => {
    if (pos.totales.cantidadItems > 0) setModalCobroAbierto(true);
  };

  // Callbacks para cerrar modales, blindados contra fugas de teclado
  const cerrarModalCobro = () => {
    setModalCobroAbierto(false);
    enterBloqueadoRef.current = true;
    setTimeout(() => {
      enterBloqueadoRef.current = false;
    }, 150);
  };

  const cerrarModalArqueo = () => {
    setModalArqueoAbierto(false);
    enterBloqueadoRef.current = true;
    setTimeout(() => {
      enterBloqueadoRef.current = false;
    }, 150);
  };

  const cerrarModalHistorial = () => {
    setModalHistorialAbierto(false);
    enterBloqueadoRef.current = true;
    setTimeout(() => {
      enterBloqueadoRef.current = false;
    }, 150);
  };

  // Atajos de teclado (F1/F2/F3/F4/F9/F10). Se desactivan si hay modal abierto.
  usePOSAtajos({
    onBuscar: enfocarProducto,
    onPrecio: enfocarPrecio,
    onHistorial: abrirHistorial,
    onArqueo: abrirArqueo,
    onBorrarUltima: borrarUltima,
    onCobrar: cobrar,
    activo: !modalCobroAbierto && !modalArqueoAbierto && !modalHistorialAbierto,
  });

  // -------------------- Handlers de la barra superior --------------------

  const seleccionarProducto = (art) => {
    busqueda.setBusqueda(art.nombre);
    busqueda.cerrar();
    carga.seleccionar(art);
    setTimeout(enfocarPrecio, 50);
  };

  const handleProductoKeyDown = (e) => {
    // ← / → navegan entre campos. ↑ / ↓ los maneja el dropdown.
    if (handleFlechasCampo("producto", e)) return;
    const res = busqueda.handleKeyDown(e);
    if (!res) return;
    if (res.tipo === "seleccionar") {
      seleccionarProducto(res.art);
    } else if (res.tipo === "pasar-a-precio") {
      enfocarPrecio();
    }
  };

  const handleCantidadKeyDown = (e) => {
    if (handleFlechasCampo("cantidad", e)) return;
    if (e.key === "ArrowUp") {
      e.preventDefault();
      e.stopPropagation();
      carga.incrementarCantidad(1);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      e.stopPropagation();
      carga.incrementarCantidad(-1);
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      enfocarPrecio();
    }
  };

  const confirmarCargaYLimpiar = () => {
    const descripcionTipeada = busqueda.busqueda;
    const r = carga.confirmarCarga(descripcionTipeada);
    if (r.ok) {
      busqueda.limpiar();
    }
    setTimeout(enfocarPrecio, 50);
  };

  const handlePrecioKeyDown = (e) => {
    if (handleFlechasCampo("precio", e)) return;
    if (e.key === "Enter") {
      e.preventDefault();
      if (enterBloqueadoRef.current) return; // Frena el Enter residual
      confirmarCargaYLimpiar();
    }
  };

  // -------------------- Edición inline en la grilla --------------------

  const handleEditarPrecio = (id, valor) => {
    const n = Number(valor);
    if (Number.isFinite(n) && n >= 0 && n <= 999000) {
      pos.editarPrecio(id, n);
    }
  };

  const handleEditarCantidad = (id, valor) => {
    const n = parseInt(valor, 10);
    if (Number.isFinite(n) && n >= 1) {
      pos.editarCantidad(id, n);
    }
  };

  // -------------------- Render --------------------

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-50 text-slate-800 overflow-hidden">
      {/* HEADER */}
      <header className="bg-slate-100 border-b border-slate-300 px-4 py-2 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-3xl">🧾</span>
          <div>
            <h1 className="font-bold text-slate-800 text-lg leading-tight">
              POS Rápido
            </h1>
            <p className="text-xs text-slate-500 capitalize">
              {new Date().toLocaleDateString("es-AR", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          </div>
        </div>

        {/* Botones F1-F10 azul #51A2FF */}
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <AtajoBoton onClick={enfocarProducto} tecla="F1" label="Escanear" />
          <AtajoBoton onClick={enfocarPrecio} tecla="F2" label="Precio" />
          <AtajoBoton onClick={abrirHistorial} tecla="F3" label="Historial" />
          <AtajoBoton onClick={abrirArqueo} tecla="F4" label="Caja" />
          <AtajoBoton onClick={borrarUltima} tecla="F9" label="Borrar" />
          <AtajoBoton onClick={cobrar} tecla="F10" label="Cobrar" />
        </div>
      </header>

      {/* INPUT SUPERIOR */}
      <div className="p-3 bg-white border-b border-slate-200 shadow-sm z-10 relative flex-shrink-0">
        <div className="flex gap-2 items-start">
          {/* Producto */}
          <div className="relative flex-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
              Producto (F1)
            </label>
            <input
              ref={inputProductoRef}
              type="text"
              value={busqueda.busqueda}
              onChange={(e) => {
                busqueda.handleChange(e.target.value);
                carga.setError(null);
                if (carga.artSeleccionado) carga.deseleccionar();
              }}
              onKeyDown={handleProductoKeyDown}
              placeholder="Escanear o buscar..."
              className="w-full text-base border-2 border-indigo-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 h-[50px]"
            />
            {busqueda.dropAbierto && busqueda.resultados.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl z-50 max-h-64 overflow-y-auto">
                {busqueda.resultados.map((a, i) => (
                  <div
                    key={a.sku}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => seleccionarProducto(a)}
                    className={`px-3 py-2 cursor-pointer flex justify-between items-center text-sm ${
                      i === busqueda.indiceDrop
                        ? "bg-indigo-50"
                        : "hover:bg-slate-50"
                    }`}
                  >
                    <div className="truncate flex-1">
                      <span className="font-semibold text-slate-800">
                        {a.nombre}
                      </span>
                      <span className="text-[10px] text-slate-500 ml-2">
                        {a.sku}
                      </span>
                    </div>
                    <span className="font-bold text-slate-700 ml-2">
                      {formatearPrecio(a.costoUnitario)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Cantidad (sin botones − / +, con ↑ ↓ y ← →) */}
          <div className="w-28 flex-shrink-0">
            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
              Cant.
            </label>
            <input
              ref={inputCantidadRef}
              type="number"
              min={1}
              value={carga.cantidad}
              onChange={(e) => carga.cambiarCantidad(e.target.value)}
              onFocus={(e) => e.target.select()}
              onKeyDown={handleCantidadKeyDown}
              className="w-full text-center text-lg font-bold border-2 border-slate-300 rounded-lg bg-white h-[50px] px-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </div>

          {/* Precio */}
          <div className="w-52 flex-shrink-0">
            <label className="text-[10px] font-bold text-sky-600 uppercase block mb-1">
              Precio (Enter)
            </label>
            <div className="flex items-center border-2 border-sky-400 rounded-lg overflow-hidden bg-sky-50 h-[50px] focus-within:ring-2 focus-within:ring-sky-500">
              <span className="pl-3 text-sky-500 text-xl font-bold">$</span>
              <input
                ref={inputPrecioRef}
                type="number"
                value={carga.precio}
                onChange={(e) => carga.cambiarPrecio(e.target.value)}
                onKeyDown={handlePrecioKeyDown}
                placeholder="0.00"
                className="w-full px-2 py-2 text-right text-xl font-bold bg-transparent border-0 text-sky-900 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none placeholder-sky-300"
              />
            </div>
          </div>
        </div>

        {carga.error && (
          <div className="mt-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1">
            ⚠️ {carga.error}
          </div>
        )}
      </div>

      {/* GRILLA */}
      <div ref={grillaRef} className="flex-1 overflow-y-auto bg-slate-50 p-2">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-slate-500 uppercase bg-slate-100 sticky top-0 z-10">
            <tr>
              <th className="px-2 py-1 w-10">#</th>
              <th className="px-2 py-1">Producto</th>
              <th className="px-2 py-1 w-28 text-center">Cant.</th>
              <th className="px-2 py-1 w-36 text-right">P. Unit.</th>
              <th className="px-2 py-1 w-32 text-right">Subtotal</th>
              <th className="px-2 py-1 w-12"></th>
            </tr>
          </thead>
          <tbody>
            {pos.items.map((it, idx) => {
              if (it.vacia) {
                return (
                  <tr key={it.id} className="bg-slate-50/50">
                    <td className="px-2 py-2 text-slate-300 font-mono">
                      {idx + 1}
                    </td>
                    <td className="px-2 py-2 text-slate-400 italic" colSpan={4}>
                      Esperando próximo ítem…
                    </td>
                    <td></td>
                  </tr>
                );
              }
              return (
                <tr
                  key={it.id}
                  className={`border-b border-slate-200 hover:bg-white transition-colors ${
                    it.esNuevo ? "bg-emerald-50/60" : "bg-white"
                  }`}
                >
                  <td className="px-2 py-1 text-slate-400 font-mono text-xs">
                    {idx + 1}
                  </td>
                  <td className="px-2 py-1">
                    <input
                      type="text"
                      value={it.nombre}
                      onChange={(e) => pos.editarNombre(it.id, e.target.value)}
                      onFocus={(e) => e.target.select()}
                      className="w-full bg-transparent border-0 focus:outline-none focus:bg-indigo-50 rounded px-1 py-0.5 text-base text-slate-800 font-medium"
                    />
                    <div className="text-[10px] text-slate-400 font-mono px-1">
                      {it.sku ? `SKU ${it.sku}` : "Manual"}
                      {it.precioEditado && (
                        <span className="ml-1 text-amber-600">· editado</span>
                      )}
                    </div>
                  </td>
                  <td className="px-2 py-1">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() =>
                          pos.editarCantidad(it.id, it.cantidad - 1)
                        }
                        disabled={it.cantidad <= 1}
                        className="px-3 py-1 text-base font-bold text-slate-600 hover:bg-slate-100 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        −
                      </button>
                      <input
                        type="number"
                        value={it.cantidad}
                        min={1}
                        onChange={(e) =>
                          handleEditarCantidad(it.id, e.target.value)
                        }
                        onFocus={(e) => e.target.select()}
                        className="w-14 text-center bg-transparent border border-transparent hover:border-slate-300 focus:border-indigo-400 focus:bg-white rounded px-1 py-0.5 font-bold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      <button
                        onClick={() =>
                          pos.editarCantidad(it.id, it.cantidad + 1)
                        }
                        className="px-3 py-1 text-base font-bold text-slate-600 hover:bg-slate-100 rounded"
                      >
                        +
                      </button>
                    </div>
                  </td>
                  <td className="px-2 py-1 text-right">
                    <input
                      type="number"
                      value={it.precioUnitario}
                      onChange={(e) =>
                        handleEditarPrecio(it.id, e.target.value)
                      }
                      onFocus={(e) => e.target.select()}
                      className="w-32 text-sm text-right bg-transparent border border-transparent hover:border-slate-300 focus:border-sky-400 focus:bg-sky-50 rounded px-1 py-0.5 font-semibold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </td>
                  <td className="px-2 py-1 text-right font-bold text-base text-slate-800">
                    {formatearPrecio(it.subtotal)}
                  </td>
                  <td className="px-2 py-1 text-center">
                    <button
                      onClick={() => pos.quitarItem(it.id)}
                      className="text-slate-300 hover:text-red-500 font-bold text-lg leading-none px-1"
                      title="Quitar ítem"
                    >
                      ×
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* FOOTER: totales a la izquierda, COBRAR a la derecha */}
      <footer className="bg-white border-t-2 border-slate-300 px-4 py-3 flex items-center justify-between flex-shrink-0 shadow-[0_-4px_6px_-4px_rgba(0,0,0,0.1)]">
        <div className="flex gap-6 text-slate-600">
          <div>
            <p className="text-[10px] font-bold uppercase text-slate-400">
              Ítems
            </p>
            <p className="text-2xl font-black text-slate-700">
              {pos.totales.cantidadItems}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase text-slate-400">
              Unidades
            </p>
            <p className="text-2xl font-black text-slate-700">
              {pos.totales.totalUnidades}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <button
            onClick={cobrar}
            disabled={pos.totales.cantidadItems === 0}
            className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-black text-xl px-8 py-3 rounded-xl shadow-lg transition-colors flex items-center gap-3"
          >
            💵 COBRAR
            <span className="text-xs font-mono opacity-80 border border-white/30 rounded px-1.5 py-0.5">
              F10
            </span>
          </button>
          <div className="text-right">
            <p className="text-[10px] font-bold uppercase text-slate-400">
              Total
            </p>
            <p className="text-5xl font-black text-slate-900 leading-none">
              {formatearPrecio(pos.totales.total)}
            </p>
          </div>
        </div>
      </footer>

      {/* MODALES */}
      {modalCobroAbierto && <CobroModal onCerrar={cerrarModalCobro} />}

      {modalArqueoAbierto && <ArqueoCajaModal onCerrar={cerrarModalArqueo} />}

      {modalHistorialAbierto && (
        <HistorialModal onCerrar={cerrarModalHistorial} />
      )}
    </div>
  );
}

/**
 * Botón pastel de atajo. Ahora azul #51A2FF sólido, texto blanco.
 */
function AtajoBoton({ onClick, tecla, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ backgroundColor: "#51A2FF" }}
      className="flex items-center gap-1.5 px-2.5 py-1.5 text-sm font-semibold text-white border border-[#3a8be6] rounded-lg transition-colors hover:brightness-110 active:brightness-95 shadow-sm"
    >
      <kbd className="text-[10px] font-mono bg-white/25 border border-white/40 rounded px-1 py-0.5 text-white">
        {tecla}
      </kbd>
      {label}
    </button>
  );
}