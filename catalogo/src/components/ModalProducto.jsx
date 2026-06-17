import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { formatPrecio } from "../utils/precio";
import { prepararDescripcion } from "../utils/descripcion";
import { fetchFotosMultiples } from "../services/admin";

export default function ModalProducto({ producto, modo, onAgregar, onCerrar }) {
  const { nombre, descripcion, precio_minorista, precio_mayorista, foto, marca, categoria, id, stock, tipo_seccion } = producto;
  const precio           = modo === "mayorista" ? precio_mayorista : precio_minorista;
  const precioFormateado = formatPrecio(precio, modo);
  const agotado          = tipo_seccion === "stock" && (stock || 0) === 0;

  const [fotos, setFotos]          = useState(foto ? [foto] : []);
  const [fotoActiva, setFotoActiva] = useState(foto || "");

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    fetchFotosMultiples(id).then((urls) => {
      if (cancelled) return;
      const todas = foto ? [foto, ...urls.filter((u) => u !== foto)] : urls;
      if (todas.length > 0) { setFotos(todas); setFotoActiva(todas[0]); }
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [id]);

  const handleAgregar = () => { onAgregar(producto); onCerrar(); };

  return (
    <>
      <div className="modal-overlay" onClick={onCerrar} />
      <div className="modal-producto">
        <button className="modal-cerrar" onClick={onCerrar}>✕</button>

        {/* Imagen principal + thumbnails superpuestos */}
        <div className="modal-imagen">
          {fotoActiva
            ? <img src={fotoActiva} alt={nombre} />
            : <div className="sin-imagen">📷 Sin foto</div>
          }
          {fotos.length > 1 && (
            <div className="modal-thumbs">
              {fotos.map((url, i) => (
                <div
                  key={i}
                  className={`modal-thumb ${url === fotoActiva ? "activa" : ""}`}
                  onClick={() => setFotoActiva(url)}
                >
                  <img src={url} alt={`foto ${i + 1}`} />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="modal-info">
          <span className="tarjeta-marca">{marca}</span>
          <h2 className="modal-nombre">{nombre}</h2>
          <span className="tarjeta-cat">{categoria}</span>
          {descripcion && (
            <div className="modal-desc">
              <ReactMarkdown>{prepararDescripcion(descripcion)}</ReactMarkdown>
            </div>
          )}
          {precioFormateado && <p className="modal-precio">{precioFormateado}</p>}
          {agotado ? (
            <div className="modal-agotado">
              <span className="chip-agotado" style={{ position: "static", fontSize: "0.85rem", padding: "6px 16px" }}>Agotado</span>
              <p className="modal-agotado-txt">Este producto no tiene stock disponible en este momento.</p>
            </div>
          ) : (
            <button className="btn-agregar modal-btn-agregar" onClick={handleAgregar}>
              + Agregar al pedido
            </button>
          )}
        </div>
      </div>
    </>
  );
}
