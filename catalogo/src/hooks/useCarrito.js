import { useState, useEffect } from "react";

const STORAGE_KEY = "orven_carrito";

export function useCarrito() {
  const [items, setItems] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const agregar = (producto, modo) => {
    const precio = modo === "mayorista" ? producto.precio_mayorista : producto.precio_minorista;
    setItems((prev) => {
      const existe = prev.find((i) => i.nombre === producto.nombre);
      if (existe) {
        return prev.map((i) =>
          i.nombre === producto.nombre ? { ...i, cantidad: i.cantidad + 1 } : i
        );
      }
      return [...prev, { ...producto, precio, cantidad: 1 }];
    });
  };

  const cambiarCantidad = (nombre, delta) => {
    setItems((prev) =>
      prev
        .map((i) => i.nombre === nombre ? { ...i, cantidad: i.cantidad + delta } : i)
        .filter((i) => i.cantidad > 0)
    );
  };

  const eliminar = (nombre) => setItems((prev) => prev.filter((i) => i.nombre !== nombre));

  const vaciar = () => setItems([]);

  const total = items.reduce((sum, i) => sum + i.precio * i.cantidad, 0);
  const totalItems = items.reduce((sum, i) => sum + i.cantidad, 0);

  return { items, agregar, cambiarCantidad, eliminar, vaciar, total, totalItems };
}
