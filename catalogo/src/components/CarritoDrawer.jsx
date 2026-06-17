import { formatPrecio } from "../utils/precio";

const WA_NUMERO = "5493764216818";

export default function CarritoDrawer({ items, total, onCambiar, onEliminar, onVaciar, onCerrar, modo }) {
  const enviarWhatsapp = () => {
    if (items.length === 0) return;

    const lineas = items
      .map((i) => {
        const precioUnit = formatPrecio(i.precio, modo);
        const precioTotal = formatPrecio(i.precio * i.cantidad, modo);
        return `• ${i.nombre} x${i.cantidad} — ${precioTotal}`;
      })
      .join("\n");

    const tipo = modo === "mayorista" ? "mayorista" : "minorista";
    const totalFormateado = formatPrecio(total, modo);
    const msg = `Hola! Quiero hacer el siguiente pedido (${tipo}):\n\n${lineas}\n\n*Total: ${totalFormateado}*`;
    const url = `https://wa.me/${WA_NUMERO}?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank");
  };

  const totalFormateado = formatPrecio(total, modo);

  return (
    <>
      <div className="carrito-overlay" onClick={onCerrar} />
      <div className="carrito-drawer">
        <div className="carrito-header">
          <h2>Tu pedido</h2>
          <button className="carrito-cerrar" onClick={onCerrar}>✕</button>
        </div>

        {items.length === 0 ? (
          <p className="carrito-vacio">Todavía no agregaste productos.</p>
        ) : (
          <>
            <ul className="carrito-lista">
              {items.map((item) => (
                <li key={item.id || item.nombre} className="carrito-item">
                  {item.foto && (
                    <img src={item.foto} alt={item.nombre} className="carrito-item-img" />
                  )}
                  <div className="carrito-item-body">
                    <div className="carrito-item-info">
                      <span className="carrito-item-nombre">{item.nombre}</span>
                      <span className="carrito-item-precio">
                        {formatPrecio(item.precio * item.cantidad, modo)}
                      </span>
                    </div>
                    <div className="carrito-item-controles">
                      <button onClick={() => onCambiar(item.nombre, -1)}>−</button>
                      <span>{item.cantidad}</span>
                      <button onClick={() => onCambiar(item.nombre, +1)}>+</button>
                      <button className="carrito-item-quitar" onClick={() => onEliminar(item.nombre)} title="Quitar">✕</button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            <div className="carrito-total">
              <span>Total</span>
              <span>{totalFormateado}</span>
            </div>

            <button className="carrito-wa" onClick={enviarWhatsapp}>
              Enviar pedido por WhatsApp
            </button>
            <button className="carrito-vaciar" onClick={() => { if (confirm("¿Vaciar el carrito?")) onVaciar(); }}>
              Vaciar carrito
            </button>
          </>
        )}
      </div>
    </>
  );
}
