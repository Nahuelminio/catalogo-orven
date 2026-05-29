import { useState, useEffect, useRef } from "react";
import { fetchFotosProducto, agregarFotoProducto, deleteFotoProducto, updateProducto } from "../../services/admin";

// onFotoActualizada(url) → le avisa al padre para que actualice producto.foto en el estado
export default function GaleriaFotos({ producto, onFotoActualizada }) {
  const [fotos,     setFotos]     = useState([]);
  const [subiendo,  setSubiendo]  = useState(false);
  const [error,     setError]     = useState("");
  // foto principal local (para refrescar sin esperar al padre)
  const [fotoPrincipal, setFotoPrincipal] = useState(producto.foto || "");
  const inputRef = useRef();

  const cargar = () => fetchFotosProducto(producto.id).then(setFotos);

  useEffect(() => { cargar(); }, [producto.id]);
  // sincronizar si el padre cambia foto
  useEffect(() => { setFotoPrincipal(producto.foto || ""); }, [producto.foto]);

  const handleSubir = async (files) => {
    if (!files?.length) return;
    setSubiendo(true);
    setError("");
    let primeraUrl = null;
    for (const file of Array.from(files)) {
      try {
        const url = await agregarFotoProducto(producto.id, file);
        if (!primeraUrl) primeraUrl = url;
      } catch (err) {
        console.error(err);
        setError("Error al subir: " + (err.message || "revisá las credenciales de Cloudinary en Render"));
      }
    }
    // Si no tenía foto principal, la primera subida queda como principal
    if (primeraUrl && !fotoPrincipal) {
      try {
        await updateProducto(producto.id, { foto: primeraUrl });
        setFotoPrincipal(primeraUrl);
        onFotoActualizada?.(producto.id, primeraUrl);
      } catch (err) { console.error(err); }
    }
    await cargar();
    setSubiendo(false);
  };

  const handleEliminar = async (id) => {
    if (!confirm("¿Eliminar esta foto?")) return;
    await deleteFotoProducto(id);
    cargar();
  };

  const setPrincipal = async (url) => {
    try {
      await updateProducto(producto.id, { foto: url });
      setFotoPrincipal(url);
      onFotoActualizada?.(producto.id, url);
    } catch (err) {
      setError("No se pudo cambiar la foto principal");
    }
  };

  return (
    <div className="galeria-admin">
      <div className="galeria-thumbs">
        {/* Foto principal */}
        {fotoPrincipal && !fotos.find((f) => f.url === fotoPrincipal) && (
          <div className="galeria-thumb principal">
            <img src={fotoPrincipal} alt="principal" />
            <span className="galeria-badge">Principal</span>
          </div>
        )}

        {/* Fotos de la galería */}
        {fotos.map((f) => (
          <div key={f.id} className={`galeria-thumb ${f.url === fotoPrincipal ? "principal" : ""}`}>
            <img src={f.url} alt="" />
            {f.url === fotoPrincipal && <span className="galeria-badge">Principal</span>}
            <div className="galeria-thumb-acciones">
              {f.url !== fotoPrincipal && (
                <button onClick={() => setPrincipal(f.url)} title="Usar como principal">⭐</button>
              )}
              <button onClick={() => handleEliminar(f.id)} title="Eliminar">✕</button>
            </div>
          </div>
        ))}

        {/* Botón agregar */}
        <div className="galeria-thumb galeria-add" onClick={() => inputRef.current?.click()}>
          {subiendo ? <span className="galeria-loading">⏳</span> : <span>+</span>}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          style={{ display: "none" }}
          onChange={(e) => { handleSubir(e.target.files); e.target.value = ""; }}
        />
      </div>

      {error && (
        <p style={{ color: "var(--rojo)", fontSize: "0.75rem", marginTop: "4px" }}>
          ⚠️ {error}
        </p>
      )}

      <p className="galeria-hint">
        {fotos.length} foto{fotos.length !== 1 ? "s" : ""} · ⭐ = principal · podés subir varias a la vez
      </p>
    </div>
  );
}
