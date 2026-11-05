// frontend/src/components/admin/CarruselImagenes.jsx
//
// Carrusel de imágenes de producto reutilizable.
// Recibe un array de { archivo, alt, orden } y renderiza la principal con
// flechas ← → y dots. Sin librerías externas: solo estado de React + Tailwind.

import { useState } from "react";

export default function CarruselImagenes({ imagenes = [], ancho = "w-48", alto = "h-32" }) {
  const lista = Array.isArray(imagenes) ? imagenes.filter(Boolean) : [];
  const [indice, setIndice] = useState(0);

  if (lista.length === 0) {
    return (
      <div className={`flex items-center justify-center ${ancho} ${alto} rounded-md bg-slate-100 border border-slate-200`}>
        <span className="text-slate-400 text-sm">Sin imagen</span>
      </div>
    );
  }

  const total = lista.length;
  const actual = lista[indice % total];
  const src = `/img/productos/${actual.archivo}`;
  const alt = actual.alt || `Imagen ${indice + 1} de ${total}`;

  const siguiente = () => setIndice((i) => (i + 1) % total);
  const anterior = () => setIndice((i) => (i - 1 + total) % total);

  return (
    <div className="relative group">
      <div className={`relative overflow-hidden rounded-md bg-slate-100 ${ancho} ${alto}`}>
        <img
          src={src}
          alt={alt}
          className="w-full h-full object-cover"
          loading="lazy"
        />
        {/* Flechas */}
        {total > 1 && (
          <>
            <button
              type="button"
              onClick={anterior}
              className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white px-2 py-1 rounded-full text-slate-600 shadow-sm transition-colors"
              aria-label="Imagen anterior"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={siguiente}
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white px-2 py-1 rounded-full text-slate-600 shadow-sm transition-colors"
              aria-label="Imagen siguiente"
            >
              ›
            </button>
          </>
        )}
      </div>

      {/* Dots */}
      {total > 1 && (
        <div className="flex justify-center gap-1 mt-2">
          {lista.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setIndice(i)}
              className={`w-2 h-2 rounded-full transition-colors ${
                i === indice ? "bg-blue-600" : "bg-slate-300 hover:bg-slate-400"
              }`}
              aria-label={`Ver imagen ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
