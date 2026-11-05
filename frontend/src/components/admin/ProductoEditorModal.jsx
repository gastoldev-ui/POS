// frontend/src/components/admin/ProductoEditorModal.jsx
import { useState, useCallback, useMemo } from "react";
import { api } from "../../api/client";
import GestorImagenes from "./GestorImagenes";

const fmtPrecio = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 2,
});

function parseMoneda(raw) {
  if (raw === null || raw === undefined || raw === "") return "";
  return String(raw).replace(/[^\d.,]/g, "");
}

function parseNumero(raw) {
  if (raw === null || raw === undefined || raw === "") return 0;
  const s = String(raw).replace(/[^\d.,-]/g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function generarNombreCortoPreview(nombreCompleto) {
  const nombre = String(nombreCompleto || "").trim();
  if (!nombre) return "";
  const medidaMatch = nombre.match(
    /\b(\d+(?:[.,]\d+)?)\s*(g|gr|grs|kg|ml|cc|lt|lts|l|u|un|unidades?)\b/i,
  );
  const medida = medidaMatch
    ? `${medidaMatch[1].replace(",", ".")}${medidaMatch[2].toLowerCase()}`
    : "";
  const sinMedida = medida
    ? nombre.replace(medidaMatch[0], "").trim()
    : nombre;
  const tokens = sinMedida
    .replace(/[^\wáéíóúñüÁÉÍÓÚÑÜ\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2);
  const corto = tokens.slice(0, 3).join(" ");
  return medida ? `${corto} ${medida}`.trim() : corto;
}

export default function ProductoEditorModal({
  modo,
  producto,
  onCerrar,
  onGuardado,
}) {
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);

  const inicial = producto || {
    sku: "",
    nombre: "",
    nombreCorto: "",
    marca: "",
    categoria: "",
    subcategoria: "",
    precioVenta: "",
    precioBulto: "",
    costoUnitario: "",
    uxB: 6,
    stock: "",
    activo: true,
    codigosBarras: [],
    imagenes: [],
  };

  const uxBInicial = inicial.uxB != null ? inicial.uxB : 6;
  const costoInicial = inicial.costoUnitario != null ? inicial.costoUnitario : "";
  
  // Si viene precioBulto lo usamos, si no lo calculamos como base (costo * 1.43) * uxB
  const precioBultoCalc = inicial.precioBulto 
    ? inicial.precioBulto 
    : (inicial.precioVenta 
        ? inicial.precioVenta * uxBInicial 
        : (parseNumero(costoInicial) * 1.43) * uxBInicial);

  const [form, setForm] = useState({
    sku: inicial.sku || "",
    nombre: inicial.nombre || "",
    nombreCorto: inicial.nombreCorto || "",
    marca: inicial.marca || "",
    categoria: inicial.categoria || "",
    subcategoria: inicial.subcategoria || "",
    precioVenta: inicial.precioVenta != null ? String(inicial.precioVenta) : "",
    precioBulto: precioBultoCalc > 0 ? String(precioBultoCalc.toFixed(2)) : "",
    costoUnitario: costoInicial ? String(costoInicial) : "",
    uxB: String(uxBInicial),
    stock: inicial.stock != null ? String(inicial.stock) : "",
    activo: Boolean(inicial.activo),
    codigosBarras: Array.isArray(inicial.codigosBarras) ? [...inicial.codigosBarras] : [],
    imagenes: Array.isArray(inicial.imagenes) ? [...inicial.imagenes] : [],
  });

  const [nombreCortoManual, setNombreCortoManual] = useState(
    modo === "editar" && Boolean(inicial.nombreCorto),
  );

  // ==================== CÁLCULOS DERIVADOS ====================

  const costoNum = parseNumero(form.costoUnitario);
  const precioUnitNum = parseNumero(form.precioVenta);
  const precioBultoNum = parseNumero(form.precioBulto);
  const uxBNum = Math.max(1, Math.floor(parseNumero(form.uxB) || 6));

  const margenUnitario = useMemo(() => {
    if (costoNum <= 0 || precioUnitNum <= 0) return null;
    return Math.round(((precioUnitNum - costoNum) / costoNum) * 100);
  }, [costoNum, precioUnitNum]);

  const margenBulto = useMemo(() => {
    if (costoNum <= 0 || precioBultoNum <= 0) return null;
    const costoBulto = costoNum * uxBNum;
    return Math.round(((precioBultoNum - costoBulto) / costoBulto) * 100);
  }, [costoNum, precioBultoNum, uxBNum]);

  const nombreCortoPreview = useMemo(
    () =>
      nombreCortoManual
        ? form.nombreCorto
        : generarNombreCortoPreview(form.nombre),
    [nombreCortoManual, form.nombreCorto, form.nombre],
  );

  const erroresValidacion = useMemo(() => {
    const errs = [];
    if (!form.sku.trim()) errs.push("SKU requerido");
    if (!form.nombre.trim()) errs.push("Nombre requerido");
    if (precioUnitNum <= 0) errs.push("Precio Unit. > 0");
    if (precioBultoNum <= 0) errs.push("Precio Bulto > 0");
    if (costoNum < 0) errs.push("Costo no puede ser negativo");
    if (uxBNum < 1) errs.push("Uds por bulto ≥ 1");
    return errs;
  }, [form.sku, form.nombre, precioUnitNum, precioBultoNum, costoNum, uxBNum]);

  const puedeGuardar = erroresValidacion.length === 0 && !cargando;

  // ==================== HELPERS DE CAMBIO ====================

  const setCampo = (campo, valor) => {
    setForm((prev) => ({ ...prev, [campo]: valor }));
    setError(null);
  };

  const handleNombreChange = (valor) => {
    setForm((prev) => {
      const next = { ...prev, nombre: valor };
      if (!nombreCortoManual) {
        next.nombreCorto = generarNombreCortoPreview(valor);
      }
      return next;
    });
    setError(null);
  };

  const regenerarNombreCorto = () => {
    setForm((prev) => ({
      ...prev,
      nombreCorto: generarNombreCortoPreview(prev.nombre),
    }));
    setNombreCortoManual(false);
  };

  // Lógica solicitada: Costo cambia -> Precio Venta = Costo * 1.43 y Precio Bulto = (Costo * 1.43) * UxB
  const handleCostoChange = (valor) => {
    const limpio = parseMoneda(valor);
    const c = parseNumero(limpio);
    setForm((prev) => {
      const next = { ...prev, costoUnitario: limpio };
      const uxB = Math.max(1, Math.floor(parseNumero(prev.uxB) || 6));
      
      if (c > 0) {
        const basePrecio = Math.round(c * 1.43 * 100) / 100;
        next.precioVenta = basePrecio.toFixed(2);
        next.precioBulto = (basePrecio * uxB).toFixed(2);
      }
      return next;
    });
    setError(null);
  };

  // Si cambia el precio unitario, sugerimos el de bulto
  const handlePrecioUnitarioChange = (valor) => {
    const limpio = parseMoneda(valor);
    const p = parseNumero(limpio);
    setForm((prev) => {
      const next = { ...prev, precioVenta: limpio };
      if (p > 0) {
        const uxB = Math.max(1, Math.floor(parseNumero(prev.uxB) || 6));
        next.precioBulto = (p * uxB).toFixed(2);
      }
      return next;
    });
    setError(null);
  };

  // Si cambia el precio por bulto, recalculamos el precio unitario
  const handlePrecioBultoChange = (valor) => {
    const limpio = parseMoneda(valor);
    const pb = parseNumero(limpio);
    setForm((prev) => {
      const next = { ...prev, precioBulto: limpio };
      if (pb > 0) {
        const uxB = Math.max(1, Math.floor(parseNumero(prev.uxB) || 6));
        next.precioVenta = (Math.round((pb / uxB) * 100) / 100).toFixed(2);
      }
      return next;
    });
    setError(null);
  };

  // Si cambia el uxB, recalculamos el bulto según el unitario actual
  const handleUxBChange = (valor) => {
    setForm((prev) => {
      const next = { ...prev, uxB: valor };
      const uxB = Math.max(1, Math.floor(parseNumero(valor) || 6));
      const p = parseNumero(prev.precioVenta);
      if (p > 0) {
        next.precioBulto = (p * uxB).toFixed(2);
      }
      return next;
    });
  };

  // ==================== GUARDAR ====================

  const handleGuardar = useCallback(async () => {
    if (erroresValidacion.length > 0) {
      setError(`Revisá: ${erroresValidacion.join(" · ")}`);
      return;
    }

    setCargando(true);
    setError(null);

    const imagenesReales = form.imagenes
      .filter((img) => !img.__archivoLocal)
      .map((img) => ({
        archivo: img.archivo,
        alt: img.alt || "",
        orden: img.orden,
      }));
    const imagenesNuevas = form.imagenes.filter((img) => img.__archivoLocal);

    const camposBase = {
      nombre: form.nombre.trim(),
      nombreCorto: (nombreCortoPreview || form.nombreCorto).trim() || undefined,
      marca: form.marca.trim(),
      categoria: form.categoria.trim() || "Sin categoría",
      subcategoria: form.subcategoria.trim(),
      precioVenta: precioUnitNum,
      precioBulto: precioBultoNum,
      costoUnitario: costoNum,
      uxB: uxBNum,
      stock: Math.max(0, Math.floor(Number(form.stock) || 0)),
      activo: form.activo,
      codigosBarras: form.codigosBarras.map((c) => c.trim()).filter(Boolean),
    };

    try {
      if (modo === "crear") {
        const creado = await api.catalogoMaestroCrear({
          ...camposBase,
          imagenes: imagenesReales,
        });
        const sku = creado.sku;
        for (const img of imagenesNuevas) {
          await api.imagenesSubir(sku, img.__archivoLocal);
        }
        const final = await api.catalogoMaestroGet(sku);
        onGuardado(final.producto || final);
      } else {
        let imagenesFinales = [...imagenesReales];
        for (const img of imagenesNuevas) {
          const r = await api.imagenesSubir(form.sku, img.__archivoLocal);
          const archivo = r.imagen?.archivo;
          if (archivo) {
            imagenesFinales.push({
              archivo,
              alt: img.alt || "",
              orden: imagenesFinales.length,
            });
          }
        }
        const actualizado = await api.catalogoMaestroEditar(form.sku, {
          ...camposBase,
          imagenes: imagenesFinales,
        });
        onGuardado(actualizado);
      }
      setCargando(false);
    } catch (e) {
      setCargando(false);
      setError(e.message || "No se pudo guardar el producto");
    }
  }, [
    modo,
    form,
    erroresValidacion,
    nombreCortoPreview,
    precioUnitNum,
    precioBultoNum,
    costoNum,
    uxBNum,
    onGuardado,
  ]);

  if (cargando) {
    return (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-xl p-6 max-w-md">
          <h3 className="font-semibold mb-2">Guardando…</h3>
          <p className="text-sm text-slate-500">Un momento, por favor.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[92vh] overflow-y-auto">
        
        {/* HEADER */}
        <div className="sticky top-0 bg-white px-5 py-3 border-b border-slate-200 flex items-center justify-between z-10">
          <h3 className="font-semibold text-slate-800">
            {modo === "crear" ? "Nuevo producto" : "Editar producto"}
          </h3>
          <button
            type="button"
            onClick={onCerrar}
            className="text-slate-400 hover:text-slate-600 text-xl leading-none"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="mx-5 mt-3 px-3 py-2 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
            {error}
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleGuardar();
          }}
          className="px-5 py-4 space-y-4"
        >
          {/* SECCIÓN: IDENTIFICACIÓN */}
          <fieldset className="border border-slate-200 rounded-lg p-3 space-y-3">
            <legend className="px-1 text-[11px] font-bold uppercase text-slate-500">
              Identificación
            </legend>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  SKU <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.sku}
                  onChange={(e) => setCampo("sku", e.target.value)}
                  disabled={modo === "editar"}
                  placeholder="ej: 7790040000001"
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 disabled:text-slate-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Estado
                </label>
                <select
                  value={String(form.activo)}
                  onChange={(e) => setCampo("activo", e.target.value === "true")}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="true">Activo</option>
                  <option value="false">Inactivo</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Nombre completo <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.nombre}
                onChange={(e) => handleNombreChange(e.target.value)}
                placeholder="Ej: Alfajor Águila Minitorta Clásica 71.5g"
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-medium text-slate-600">
                  Nombre corto (POS)
                </label>
                {nombreCortoManual && (
                  <button
                    type="button"
                    onClick={regenerarNombreCorto}
                    className="text-[10px] text-blue-600 hover:text-blue-800 underline"
                  >
                    ↻ Auto-generar
                  </button>
                )}
              </div>
              <input
                type="text"
                value={nombreCortoPreview}
                onChange={(e) => {
                  setNombreCortoManual(true);
                  setCampo("nombreCorto", e.target.value);
                }}
                placeholder="Se autogenera del nombre completo"
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Marca
                </label>
                <input
                  type="text"
                  value={form.marca}
                  onChange={(e) => setCampo("marca", e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Categoría
                </label>
                <input
                  type="text"
                  value={form.categoria}
                  onChange={(e) => setCampo("categoria", e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Subcategoría
                </label>
                <input
                  type="text"
                  value={form.subcategoria}
                  onChange={(e) => setCampo("subcategoria", e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </fieldset>

          {/* SECCIÓN: PRECIOS Y BULTO */}
          <fieldset className="border border-slate-200 rounded-lg p-3 space-y-3">
            <legend className="px-1 text-[11px] font-bold uppercase text-slate-500">
              Precios y bulto (independientes)
            </legend>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Costo unitario
                </label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={form.costoUnitario}
                    onChange={(e) => handleCostoChange(e.target.value)}
                    placeholder="0,00"
                    className="w-full pl-6 pr-2.5 py-1.5 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Unidades por bulto
                </label>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleUxBChange(String(Math.max(1, uxBNum - 1)))}
                    className="px-2 py-1.5 text-sm rounded border border-slate-300 bg-white hover:bg-slate-100"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    min={1}
                    value={form.uxB}
                    onChange={(e) => handleUxBChange(e.target.value)}
                    className="w-16 text-center px-2 py-1.5 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <button
                    type="button"
                    onClick={() => handleUxBChange(String(uxBNum + 1))}
                    className="px-2 py-1.5 text-sm rounded border border-slate-300 bg-white hover:bg-slate-100"
                  >
                    +
                  </button>
                  <span className="text-xs text-slate-500 ml-1">uds</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 bg-slate-50 p-2 rounded-md border border-slate-200">
              {/* PRECIO UNITARIO */}
              <div>
                <label className="block text-xs font-bold text-emerald-700 mb-1">
                  Precio Venta Unit. <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={form.precioVenta}
                    onChange={(e) => handlePrecioUnitarioChange(e.target.value)}
                    placeholder="0,00"
                    className="w-full pl-6 pr-2.5 py-1.5 border border-emerald-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div className="mt-1 flex justify-between text-[10px]">
                  <span className="text-slate-500">Margen:</span>
                  <span className={`font-bold ${margenUnitario == null ? "text-slate-400" : margenUnitario < 20 ? "text-amber-600" : "text-emerald-600"}`}>
                    {margenUnitario == null ? "—" : `${margenUnitario}%`}
                  </span>
                </div>
              </div>

              {/* PRECIO BULTO */}
              <div>
                <label className="block text-xs font-bold text-blue-700 mb-1">
                  Precio Venta Bulto <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={form.precioBulto}
                    onChange={(e) => handlePrecioBultoChange(e.target.value)}
                    placeholder="0,00"
                    className="w-full pl-6 pr-2.5 py-1.5 border border-blue-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="mt-1 flex justify-between text-[10px]">
                  <span className="text-slate-500">Margen:</span>
                  <span className={`font-bold ${margenBulto == null ? "text-slate-400" : margenBulto < 20 ? "text-amber-600" : "text-blue-600"}`}>
                    {margenBulto == null ? "—" : `${margenBulto}%`}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Stock
                </label>
                <input
                  type="number"
                  min={0}
                  value={form.stock}
                  onChange={(e) => setCampo("stock", e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </fieldset>

          {/* SECCIÓN: CÓDIGOS DE BARRAS */}
          <fieldset className="border border-slate-200 rounded-lg p-3">
            <legend className="px-1 text-[11px] font-bold uppercase text-slate-500">
              Códigos de barras
            </legend>
            <textarea
              value={form.codigosBarras.join("\n")}
              onChange={(e) =>
                setCampo("codigosBarras", e.target.value.split("\n").filter(Boolean))
              }
              rows={2}
              placeholder="Uno por línea. Ej: 7790040000001"
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </fieldset>

          {/* SECCIÓN: IMÁGENES */}
          <fieldset className="border border-slate-200 rounded-lg p-3">
            <legend className="px-1 text-[11px] font-bold uppercase text-slate-500">
              Imágenes (máximo 3)
            </legend>
            <GestorImagenes
              imagenes={form.imagenes}
              onCambio={(imagenes) => setCampo("imagenes", imagenes)}
            />
          </fieldset>

          {/* FOOTER */}
          <div className="sticky bottom-0 bg-white pt-3 border-t border-slate-200">
            {erroresValidacion.length > 0 && (
              <p className="text-[11px] text-red-600 mb-2">
                ⚠️ {erroresValidacion.join(" · ")}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onCerrar}
                className="px-4 py-2 text-sm rounded bg-slate-100 hover:bg-slate-200 text-slate-700"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={!puedeGuardar}
                className="px-4 py-2 text-sm rounded bg-blue-600 hover:bg-blue-700 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {modo === "crear" ? "Crear producto" : "Guardar cambios"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}