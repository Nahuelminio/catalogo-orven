import { formatPrecio } from "../utils/precio";

export default function TarjetaProducto({ producto, modo, seccion, onAgregar, onVerDetalle }) {
  const { nombre, descripcion, precio_minorista, precio_mayorista, foto, marca, categoria, stock, tipo_seccion } = producto;
  const precio = modo === "mayorista" ? precio_mayorista : precio_minorista;
  const precioFormateado = formatPrecio(precio, modo);
  const agotado = seccion === "stock" && tipo_seccion === "stock" && (stock || 0) === 0;

  return (
    <div className={`tarjeta${agotado ? " agotado" : ""}`}>
      <div className="tarjeta-imagen" onClick={onVerDetalle} style={{ cursor: "pointer" }}>
        {foto ? (
          <img src={foto} alt={nombre} loading="lazy" />
        ) : (
          <div className="sin-imagen">Sin foto</div>
        )}
        {seccion === "stock" && !agotado && stock > 0 && (
          <span className="chip-disponible">Disponible</span>
        )}
        {agotado && (
          <span className="chip-agotado">Agotado</span>
        )}
      </div>
      <div className="tarjeta-info">
        <span className="tarjeta-marca">{marca}</span>
        <h3 className="tarjeta-nombre">{nombre}</h3>
        <span className="tarjeta-cat">{categoria}</span>
        {descripcion && <p className="tarjeta-desc">{descripcion}</p>}
        <div className="tarjeta-footer">
          {precioFormateado && (
            <p className="tarjeta-precio">{precioFormateado}</p>
          )}
          {agotado ? (
            <span className="btn-agotado">Sin stock</span>
          ) : (
            <button className="btn-agregar" onClick={() => onAgregar(producto)}>
              + Agregar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
