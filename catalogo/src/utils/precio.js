/**
 * Formatea un precio según el modo de venta.
 * - minorista: pesos argentinos  → $ 85.000
 * - mayorista: dólares           → USD 60
 */
export function formatPrecio(precio, modo) {
  if (!precio || precio <= 0) return null;
  if (modo === "mayorista") {
    return `USD ${precio.toLocaleString("es-AR")}`;
  }
  return `$ ${precio.toLocaleString("es-AR")}`;
}
