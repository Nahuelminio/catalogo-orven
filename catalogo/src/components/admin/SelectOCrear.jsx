import { useState } from "react";

/**
 * Select con opción de crear valor nuevo.
 * Props: opciones[], valor, onChange(valor), placeholder, label
 */
export default function SelectOCrear({ opciones, valor, onChange, placeholder = "Seleccioná...", label }) {
  const [creando, setCreando] = useState(false);
  const [nuevo, setNuevo]     = useState("");

  const opcionesUnicas = [...new Set(opciones.filter(Boolean))].sort();

  const handleSelect = (e) => {
    if (e.target.value === "__nuevo__") {
      setCreando(true);
      setNuevo("");
    } else {
      setCreando(false);
      onChange(e.target.value);
    }
  };

  const confirmar = () => {
    if (nuevo.trim()) {
      onChange(nuevo.trim());
      setCreando(false);
    }
  };

  return (
    <div className="select-o-crear">
      {!creando ? (
        <select value={valor || ""} onChange={handleSelect}>
          <option value="" disabled>{placeholder}</option>
          {opcionesUnicas.map((op) => (
            <option key={op} value={op}>{op}</option>
          ))}
          <option value="__nuevo__">➕ Nueva {label?.toLowerCase()}...</option>
        </select>
      ) : (
        <div className="select-o-crear-input">
          <input
            type="text"
            autoFocus
            value={nuevo}
            onChange={(e) => setNuevo(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") confirmar(); if (e.key === "Escape") setCreando(false); }}
            placeholder={`Nueva ${label?.toLowerCase() || "opción"}...`}
          />
          <button type="button" onClick={confirmar}>✓</button>
          <button type="button" onClick={() => setCreando(false)} className="btn-cancelar-nuevo">✕</button>
        </div>
      )}
    </div>
  );
}
