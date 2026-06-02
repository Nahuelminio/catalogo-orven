import { useState, useEffect } from "react";

const STORAGE_KEY = "orven_carrito";

export function useCarrito(storageKey = STORAGE_KEY) {
  const [items, setItems] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(items));
  }, [items, storageKey]);

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

  const vaciar = () => setItems([]);

  const total = items.reduce((sum, i) => sum + i.precio * i.cantidad, 0);
  const totalItems = items.reduce((sum, i) => sum + i.cantidad, 0);

  return { items, agregar, cambiarCantidad, vaciar, total, totalItems };
}
