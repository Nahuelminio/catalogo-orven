import TarjetaProducto from "./TarjetaProducto";

const SKELETON_COUNT = 8;

export default function GrillaProductos({ productos, modo, seccion, onAgregar, onVerDetalle, loading }) {
  if (loading) {
    return (
      <div className="grilla">
        {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
          <div key={i} className="tarjeta skeleton-card">
            <div className="skeleton-img" />
            <div className="tarjeta-info">
              <div className="skeleton-line w40" />
              <div className="skeleton-line w80" />
              <div className="skeleton-line w55" />
              <div className="skeleton-footer">
                <div className="skeleton-line w45" />
                <div className="skeleton-btn" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (productos.length === 0) {
    return (
      <div className="sin-resultados-box">
        <span className="sin-resultados-icon">🔍</span>
        <p className="sin-resultados">
          {seccion === "stock" ? "No hay productos en stock por ahora." : "No hay productos disponibles."}
        </p>
        <p className="sin-resultados-sub">Probá con otra marca o categoría</p>
      </div>
    );
  }

  return (
    <div className="grilla">
      {productos.map((p) => (
        <TarjetaProducto
          key={p.id}
          producto={p}
          modo={modo}
          seccion={seccion}
          onAgregar={onAgregar}
          onVerDetalle={() => onVerDetalle(p)}
        />
      ))}
    </div>
  );
}
