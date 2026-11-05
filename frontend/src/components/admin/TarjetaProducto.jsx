// frontend/src/components/admin/TarjetaProducto.jsx
import CarruselImagenes from "./CarruselImagenes";

const fmtPrecio = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 2,
});

export default function TarjetaProducto({ producto, onEditar, onEliminar }) {
  const {
    sku,
    nombre,
    marca,
    precioVenta,
    precioBulto,
    costoUnitario,
    uxB,
    stock,
    activo,
    imagenes = [],
  } = producto || {};

  const unidadesPorBulto = uxB || 6;
  
  // Leemos el precioBulto directo. Si no existe (productos viejos), calculamos el fallback.
  const precioBultoMostrar = typeof precioBulto === "number" 
    ? precioBulto 
    : (precioVenta * unidadesPorBulto) || 0;

  // Cálculo de márgenes independientes
  const margenUnitario = costoUnitario > 0 && precioVenta > 0
    ? Math.round(((precioVenta - costoUnitario) / costoUnitario) * 100) : 0;

  const costoBulto = costoUnitario * unidadesPorBulto;
  const margenBulto = costoBulto > 0 && precioBultoMostrar > 0
    ? Math.round(((precioBultoMostrar - costoBulto) / costoBulto) * 100) : 0;

  return (
    <article className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col hover:shadow-md transition-shadow group h-full">
      
      {/* IMAGEN AUTO-AJUSTABLE */}
      <div className="relative p-2 bg-slate-50 border-b border-slate-100 group-hover:border-slate-300">
        <div className="relative w-full aspect-[4/3] overflow-hidden rounded-lg bg-white flex items-center justify-center">
          <CarruselImagenes 
            imagenes={imagenes} 
            ancho="w-full" 
            alto="h-full" 
            objectFit="object-contain" 
          />
          {!activo && (
            <div className="absolute inset-0 bg-black/30 flex items-center justify-center rounded-lg">
              <span className="text-white font-semibold text-[10px] bg-black/70 px-1.5 py-0.5 rounded">
                Inactivo
              </span>
            </div>
          )}
        </div>
      </div>

      {/* CUERPO */}
      <div className="p-2.5 flex-1 flex flex-col">
        <div className="flex justify-between items-start mb-1 gap-2">
          <span
            className={`text-[9px] font-mono font-semibold px-1 py-0.5 rounded truncate ${
              activo
                ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                : "bg-slate-50 text-slate-600 border border-slate-100"
            }`}
            title={sku}
          >
            {sku || "—"}
          </span>
        </div>

        <h4 className="text-[11px] font-semibold text-slate-800 leading-tight mb-1 line-clamp-2 min-h-[2em]">
          {nombre || "Sin nombre"}
        </h4>
        {marca && <p className="text-[10px] text-slate-500 mb-1 truncate">{marca}</p>}

        {/* PRECIOS Y MARGENES */}
        <div className="mt-2 space-y-1.5 text-sm font-bold">
          
          {/* Costo arriba con el mismo tamaño */}
          <div className="flex justify-between items-baseline gap-1">
            <span className="text-red-600 uppercase">Costo</span>
            <span className="text-red-600">{fmtPrecio.format(costoUnitario || 0)}</span>
          </div>

          {/* Unitario */}
          <div className="pt-1.5 border-t border-slate-100">
            <div className="flex justify-between items-baseline gap-1">
              <span className="text-[10px] text-emerald-600 uppercase">Unit.</span>
              <span className="text-emerald-600">{fmtPrecio.format(precioVenta || 0)}</span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className="text-[9px] text-slate-400">Margen:</span>
              <span className="text-[10px] text-emerald-600">{margenUnitario}%</span>
            </div>
          </div>

          {/* Bulto */}
          <div className="pt-1.5 border-t border-slate-100">
            <div className="flex justify-between items-baseline gap-1">
              <span className="text-[10px] text-blue-600 uppercase">Bulto ({unidadesPorBulto}u)</span>
              <span className="text-blue-600">{fmtPrecio.format(precioBultoMostrar)}</span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className="text-[9px] text-slate-400">Margen:</span>
              <span className="text-[10px] text-blue-600">{margenBulto}%</span>
            </div>
          </div>
        </div>

        <div className="mt-2 flex items-center gap-1 text-[10px]">
          <span className="text-slate-500">Stock:</span>
          <span
            className={`font-mono font-semibold ${
              stock === 0
                ? "text-red-600"
                : stock < 10
                ? "text-amber-600"
                : "text-green-600"
            }`}
          >
            {stock == null ? "—" : stock}
          </span>
        </div>
      </div>

      {/* BOTONES */}
      <div className="mt-auto border-t border-slate-100 px-2 py-1.5 flex justify-center gap-1.5">
        <button
          type="button"
          onClick={() => onEditar(producto)}
          className="flex-1 px-2 py-1 text-[11px] font-medium rounded bg-blue-600 hover:bg-blue-700 text-white transition-colors"
        >
          Editar
        </button>
        <button
          type="button"
          onClick={() => onEliminar(producto)}
          className="flex-1 px-2 py-1 text-[11px] font-medium rounded bg-red-600 hover:bg-red-700 text-white transition-colors"
        >
          Eliminar
        </button>
      </div>
    </article>
  );
}