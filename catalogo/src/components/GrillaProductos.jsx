import TarjetaProducto from "./TarjetaProducto";

export default function GrillaProductos({ productos, modo, seccion, onAgregar, onVerDetalle }) {
  if (productos.length === 0) {
    return (
      <p className="sin-resultados">
        {seccion === "stock" ? "No hay productos en stock por ahora." : "No hay productos disponibles."}
      </p>
    );
  }

  return (
    <div className="grilla">
      {productos.map((p, i) => (
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
