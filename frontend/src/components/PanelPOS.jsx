// src/components/PanelPOS.jsx
import { usePOS } from "../context/POSContext";
import { formatearPrecio } from "../utils/formateo";
import { useCatalogoMaestro } from "../hooks/useCatalogoMaestro";
import { usePOSAtajos } from "../hooks/usePOSAtajos";
import { usePOSBusqueda } from "../hooks/usePOSBusqueda";
import { usePOSCarga } from "../hooks/usePOSCarga";
import { usePOSModales } from "../hooks/usePOSModales";
import { usePOSFoco } from "../hooks/usePOSFoco";
import { usePOSHandlers } from "../hooks/usePOSHandlers";
import CobroModal from "./CobroModal";
import ArqueoCajaModal from "./ArqueoCajaModal";
import HistorialModal from "./HistorialModal";
import POSHeader from "./panel/POSHeader";
import POSFooter from "./panel/POSFooter";
import GrillaItems from "./panel/GrillaItems";
import BarraCarga from "./panel/BarraCarga";

export default function PanelPOS({ onAbrirAdmin }) {
  const pos = usePOS();

  const modales = usePOSModales();

  const modalAbierto =
    modales.cobroAbierto || modales.arqueoAbierto || modales.historialAbierto;

  const foco = usePOSFoco({
    items: pos.items,
    totales: pos.totales,
    modalAbierto,
  });

  const catalogo = useCatalogoMaestro();
  const busqueda = usePOSBusqueda(catalogo.productos);
  const carga = usePOSCarga({
    onProducto: (art, cantidad, precio) => {
      const filaVacia = pos.items.find((it) => it.vacia);
      if (filaVacia) {
        pos.agregarProducto(filaVacia.id, art, cantidad, precio);
      }
    },
    onManual: (precio, descripcion, cantidad) => {
      pos.agregarManual(precio, descripcion, cantidad);
    },
  });

  const handlers = usePOSHandlers({ foco, busqueda, carga, modales, pos });

  const borrarUltima = () => pos.quitarUltima();

  const cobrar = () => {
    if (pos.totales.cantidadItems > 0) modales.abrirCobro();
  };

  const cerrarModalCobro = () => {
    modales.cerrarCobro(() => foco.enfocarPrecio());
  };

  usePOSAtajos({
    onBuscar: foco.enfocarProducto,
    onPrecio: foco.enfocarPrecio,
    onHistorial: modales.abrirHistorial,
    onArqueo: modales.abrirArqueo,
    onBorrarUltima: borrarUltima,
    onCobrar: cobrar,
    activo: !modalAbierto,
  });

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-50 text-slate-800 overflow-hidden">
      <POSHeader
        onEscanear={foco.enfocarProducto}
        onPrecio={foco.enfocarPrecio}
        onHistorial={modales.abrirHistorial}
        onArqueo={modales.abrirArqueo}
        onBorrarUltima={borrarUltima}
        onCobrar={cobrar}
        onAbrirAdmin={onAbrirAdmin}
      />

      <BarraCarga
        productoRef={foco.refs.producto}
        cantidadRef={foco.refs.cantidad}
        precioRef={foco.refs.precio}
        busqueda={busqueda.busqueda}
        dropAbierto={busqueda.dropAbierto}
        resultados={busqueda.resultados}
        indiceDrop={busqueda.indiceDrop}
        cantidad={carga.cantidad}
        precio={carga.precio}
        error={carga.error}
        onProductoChange={handlers.handleProductoChange}
        onProductoKeyDown={handlers.handleProductoKeyDown}
        onCantidadChange={handlers.handleCantidadChange}
        onCantidadKeyDown={handlers.handleCantidadKeyDown}
        onPrecioChange={handlers.handlePrecioChange}
        onPrecioKeyDown={handlers.handlePrecioKeyDown}
        onSeleccionarProducto={handlers.seleccionarProducto}
      />
      {catalogo.cargando && (
        <div className="bg-indigo-50 border-b border-indigo-200 px-4 py-2 text-sm text-indigo-700 flex-shrink-0">
          ⏳ Cargando catálogo...
        </div>
      )}

      {catalogo.error && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-2 text-sm text-red-700 flex-shrink-0">
          ⚠️ Error al cargar catálogo: {catalogo.error}
          <button
            onClick={() => catalogo.recargar()}
            className="ml-2 underline font-semibold"
          >
            Reintentar
          </button>
        </div>
      )}

      {!catalogo.cargando &&
        !catalogo.error &&
        catalogo.productos.length === 0 && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-sm text-amber-800 flex-shrink-0">
            📦 El catálogo está vacío. Importá un Excel desde{" "}
            <button
              onClick={onAbrirAdmin}
              className="underline font-semibold hover:text-amber-900"
            >
              el panel de administración
            </button>{" "}
            para empezar a vender.
          </div>
        )}

      <GrillaItems
        grillaRef={foco.refs.grilla}
        items={pos.items}
        onEditarNombre={pos.editarNombre}
        onEditarCantidad={handlers.handleEditarCantidad}
        onEditarPrecio={handlers.handleEditarPrecio}
        onQuitarItem={pos.quitarItem}
        formatearPrecio={formatearPrecio}
      />

      <POSFooter
        cantidadItems={pos.totales.cantidadItems}
        totalUnidades={pos.totales.totalUnidades}
        total={pos.totales.total}
        onCobrar={cobrar}
      />

      {modales.cobroAbierto && <CobroModal onCerrar={cerrarModalCobro} />}

      {modales.arqueoAbierto && (
        <ArqueoCajaModal onCerrar={modales.cerrarArqueo} />
      )}

      {modales.historialAbierto && (
        <HistorialModal onCerrar={modales.cerrarHistorial} />
      )}
    </div>
  );
}
