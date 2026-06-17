import { useState, useEffect } from "react";
import { fetchProductos } from "../services/sheets";
import productosJSON from "../services/productos.json";

const USAR_LOCAL = false;
const CACHE_KEY  = "orven_productos_v2";
const CACHE_TTL  = 3 * 60 * 1000; // 3 minutos — después refresca en background

function leerCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    return Array.isArray(data) ? { data, stale: Date.now() - ts > CACHE_TTL } : null;
  } catch { return null; }
}

function guardarCache(data) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ data, ts: Date.now() })); } catch { /* cuota */ }
}

export function useProductos() {
  const cache = leerCache();

  // Si hay caché, arranca con esos datos y sin spinner
  const [productos, setProductos] = useState(cache?.data || []);
  const [loading,   setLoading]   = useState(!cache);
  const [error,     setError]     = useState(null);

  useEffect(() => {
    if (USAR_LOCAL) {
      setProductos(productosJSON.filter((p) => p.en_stock));
      setLoading(false);
      return;
    }
    // Siempre fetchea en background; si hay caché fresca (<3 min) no urge
    fetchProductos()
      .then((data) => {
        setProductos(data);
        setLoading(false);
        guardarCache(data);
      })
      .catch((err) => {
        setError(err);
        setLoading(false);
      });
  }, []);

  const marcas = ["Todas", ...new Set(productos.map((p) => p.marca))];

  const categoriasPorMarca = (marca) => {
    const base = productos.filter((p) => marca === "Todas" || p.marca === marca);
    return ["Todas", ...new Set(base.map((p) => p.categoria))];
  };

  return { productos, marcas, loading, error, categoriaActiva, setCategoriaActiva, categoriasPorMarca };
}
