import { get } from "./api";

export async function fetchProductos() {
  const data = await get("/api/productos/publico");
  return data.map((p) => ({ ...p, _id: p.id }));
}

export async function fetchDolar() {
  const data = await get("/api/configuracion/dolar");
  return Number(data.value) || 1200;
}
