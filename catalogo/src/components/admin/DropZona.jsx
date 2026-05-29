import { useState, useRef } from "react";

/**
 * Zona de drag & drop para subir imágenes.
 * Props:
 *   onFiles(FileList) — se llama cuando el usuario suelta o selecciona archivos
 *   previews[]        — array de URLs para mostrar como grid
 *   subiendo          — bool, muestra loading
 *   multiple          — permite varios archivos (default false)
 */
export default function DropZona({ onFiles, previews = [], subiendo = false, multiple = false }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef();

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files?.length) onFiles(e.dataTransfer.files);
  };

  const handleDrag = (e) => { e.preventDefault(); setDragging(true); };
  const handleLeave = () => setDragging(false);

  const handleClick = () => inputRef.current?.click();

  return (
    <div
      className={`dropzona ${dragging ? "dragover" : ""} ${previews.length > 0 ? "tiene-fotos" : ""}`}
      onClick={handleClick}
      onDragOver={handleDrag}
      onDragEnter={handleDrag}
      onDragLeave={handleLeave}
      onDrop={handleDrop}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple={multiple}
        style={{ display: "none" }}
        onChange={(e) => onFiles(e.target.files)}
      />

      {subiendo ? (
        <div className="dropzona-estado">
          <span className="dropzona-spinner" />
          <p>Subiendo...</p>
        </div>
      ) : previews.length === 0 ? (
        <div className="dropzona-estado">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#bbb" strokeWidth="1.5">
            <rect x="3" y="3" width="18" height="18" rx="3"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <polyline points="21,15 16,10 5,21"/>
          </svg>
          <p className="dropzona-titulo">Arrastrá fotos acá</p>
          <p className="dropzona-sub">o hacé clic para seleccionar{multiple ? " (podés elegir varias)" : ""}</p>
        </div>
      ) : (
        <div className="dropzona-grid" onClick={(e) => e.stopPropagation()}>
          {previews.map((url, i) => (
            <div key={i} className="dropzona-preview">
              <img src={url} alt={`foto ${i+1}`} />
            </div>
          ))}
          {/* Botón para agregar más */}
          <div className="dropzona-preview dropzona-mas" onClick={handleClick}>
            <span>+</span>
          </div>
        </div>
      )}
    </div>
  );
}
