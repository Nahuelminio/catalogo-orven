import { get, post, put, del } from "./api";

const BASE = import.meta.env.VITE_API_URL || "http://localhost:3001";

// ── PRODUCTOS ────────────────────────────────────────────
export const fetchProductosAdmin = ()       => get("/api/productos");
export const fetchCajas          = ()       => get("/api/productos/cajas");
export const updateProducto      = (id, f)  => put(`/api/productos/${id}`, f);
export const createProducto      = (f)      => post("/api/productos", f);
export const deleteProducto      = (id)     => del(`/api/productos/${id}`);

export async function incrementarStock(productoId, cantidad) {
  return post(`/api/productos/${productoId}/stock`, { delta: cantidad });
}
export async function decrementarStock(productoId, cantidad) {
  return post(`/api/productos/${productoId}/stock`, { delta: -cantidad });
}

// ── STORAGE (Cloudinary vía backend) ────────────────────
export async function subirFoto(file) {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${BASE}/api/fotos/upload`, { method: "POST", body: formData });
  if (!res.ok) throw new Error("Error subiendo imagen");
  const data = await res.json();
  return data.url;
}

// ── GALERÍA DE FOTOS ────────────────────────────────────
export const fetchFotosProducto   = (id)       => get(`/api/fotos/${id}`);
export const vincularFotoProducto = (id, url)  => post(`/api/fotos/${id}`, { url });
export const deleteFotoProducto   = (id)       => del(`/api/fotos/item/${id}`);

export async function agregarFotoProducto(productoId, file) {
  const url = await subirFoto(file);
  await vincularFotoProducto(productoId, url);
  return url;
}

export async function fetchFotosMultiples(productoId) {
  const data = await fetchFotosProducto(productoId);
  return data.map((f) => f.url);
}

// ── CONFIGURACIÓN ────────────────────────────────────────
export async function fetchDolar() {
  const data = await get("/api/configuracion/dolar");
  return Number(data.value) || 1200;
}
export async function fetchSaldoInicial() {
  const data = await get("/api/configuracion/saldo_inicial");
  return Number(data.value) || 0;
}
export async function updateConfig(key, value) {
  return put(`/api/configuracion/${key}`, { value });
}
export async function fetchTotalesGenerales() {
  return get("/api/configuracion/totales/generales");
}

// ── VENTAS ───────────────────────────────────────────────
export const fetchVentas      = (mes, anio)    => get(`/api/ventas?mes=${mes}&anio=${anio}`);
export const fetchVentasRango = (desde, hasta) => get(`/api/ventas?desde=${desde}&hasta=${hasta}`);
export const createVenta      = (v)            => post("/api/ventas", v);
export const deleteVenta      = (id)           => del(`/api/ventas/${id}`);

// ── INGRESOS ────────────────────────────────────────────
export const fetchIngresos      = (mes, anio)    => get(`/api/ingresos?mes=${mes}&anio=${anio}`);
export const fetchIngresosRango = (desde, hasta) => get(`/api/ingresos?desde=${desde}&hasta=${hasta}`);
export const createIngreso      = (i)            => post("/api/ingresos", i);
export const deleteIngreso      = (id)           => del(`/api/ingresos/${id}`);

// ── GASTOS ───────────────────────────────────────────────
export const fetchGastos      = (mes, anio)    => get(`/api/gastos?mes=${mes}&anio=${anio}`);
export const fetchGastosRango = (desde, hasta) => get(`/api/gastos?desde=${desde}&hasta=${hasta}`);
export const createGasto      = (g)            => post("/api/gastos", g);
export const deleteGasto      = (id)           => del(`/api/gastos/${id}`);

// ── COMPRAS ──────────────────────────────────────────────
export const fetchCompras      = (mes, anio)    => get(`/api/compras?mes=${mes}&anio=${anio}`);
export const fetchComprasRango = (desde, hasta) => get(`/api/compras?desde=${desde}&hasta=${hasta}`);
export const createCompra      = (c)            => post("/api/compras", c);
export const deleteCompra      = (id)           => del(`/api/compras/${id}`);
