import { useState, useEffect, useRef } from "react";
import { fetchFotosProducto, agregarFotoProducto, deleteFotoProducto, updateProducto } from "../../services/admin";

export default function GaleriaFotos({ producto }) {
  const [fotos, setFotos]       = useState([]);
  const [subiendo, setSubiendo] = useState(false);
  const inputRef                = useRef();

  const cargar = () =>
    fetchFotosProducto(producto.id).then(setFotos);

  useEffect(() => { cargar(); }, [producto.id]);

  const handleSubir = async (files) => {
    if (!files?.length) return;
    setSubiendo(true);
    for (const file of Array.from(files)) {
      try {
        const url = await agregarFotoProducto(producto.id, file);
        // Si el producto no tiene foto principal, la primera sube como principal
        if (!producto.foto) {
          await updateProducto(producto.id, { foto: url });
        }
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
    await updateProducto(producto.id, { foto: url });
    // Actualizar visualmente (la tarjeta se refresca en el próximo recargar general)
    alert("Foto principal actualizada. Recargá para ver el cambio.");
  };

  return (
    <div className="galeria-admin">
      <div className="galeria-thumbs">
        {/* Foto principal del producto */}
        {producto.foto && !fotos.find((f) => f.url === producto.foto) && (
          <div className="galeria-thumb principal">
            <img src={producto.foto} alt="principal" />
            <span className="galeria-badge">Principal</span>
          </div>
        )}

        {/* Fotos adicionales */}
        {fotos.map((f) => (
          <div key={f.id} className={`galeria-thumb ${f.url === producto.foto ? "principal" : ""}`}>
            <img src={f.url} alt="" />
            {f.url === producto.foto && <span className="galeria-badge">Principal</span>}
            <div className="galeria-thumb-acciones">
              {f.url !== producto.foto && (
                <button onClick={() => setPrincipal(f.url)} title="Usar como principal">⭐</button>
              )}
              <button onClick={() => handleEliminar(f.id)} title="Eliminar">✕</button>
            </div>
          </div>
        ))}

        {/* Botón agregar */}
        <div
          className="galeria-thumb galeria-add"
          onClick={() => inputRef.current?.click()}
        >
          {subiendo ? <span className="galeria-loading">⏳</span> : <span>+</span>}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          style={{ display: "none" }}
          onChange={(e) => handleSubir(e.target.files)}
        />
      </div>
      <p className="galeria-hint">{fotos.length} foto{fotos.length !== 1 ? "s" : ""} · ⭐ = principal · podés subir varias a la vez</p>
    </div>
  );
}
