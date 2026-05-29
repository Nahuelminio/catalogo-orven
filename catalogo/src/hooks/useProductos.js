import { useState, useEffect } from "react";
import { fetchProductos } from "../services/sheets";
import productosJSON from "../services/productos.json";

const USAR_LOCAL = false; // true = JSON local, false = Google Sheets en vivo

export function useProductos() {
  const [productos, setProductos] = useState([]);
  const [categoriaActiva, setCategoriaActiva] = useState("Todas");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (USAR_LOCAL) {
      setProductos(productosJSON.filter((p) => p.en_stock));
      setLoading(false);
      return;
    }
    fetchProductos()
      .then(setProductos)
      .catch(setError)
      .finally(() => setLoading(false));
  }, []);

  const marcas = ["Todas", ...new Set(productos.map((p) => p.marca))];

  const categoriasPorMarca = (marca) => {
    const base = productos.filter((p) => marca === "Todas" || p.marca === marca);
    return ["Todas", ...new Set(base.map((p) => p.categoria))];
  };

  return { productos, marcas, loading, error, categoriaActiva, setCategoriaActiva, categoriasPorMarca };
}
