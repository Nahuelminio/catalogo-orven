import { useState, useEffect } from "react";
import Header from "./components/Header";
import FiltroMarcas from "./components/FiltroMarcas";
import GrillaProductos from "./components/GrillaProductos";
import CarritoDrawer from "./components/CarritoDrawer";
import ModalProducto from "./components/ModalProducto";
import AdminPanel from "./components/AdminPanel";
import { useProductos } from "./hooks/useProductos";
import { useCarrito } from "./hooks/useCarrito";
import "./App.css";

function App() {
  const { productos, marcas, loading, error, categoriasPorMarca } = useProductos();

  // Mantiene el backend de Render despierto: ping cada 8 minutos
  useEffect(() => {
    const BASE = import.meta.env.VITE_API_URL || "http://localhost:3001";
    const ping = () => fetch(`${BASE}/`).catch(() => {});
    ping();
    const id = setInterval(ping, 8 * 60 * 1000);
    return () => clearInterval(id);
  }, []);
  const [marcaActiva, setMarcaActiva] = useState("Todas");
  const [categoriaActiva, setCategoriaActiva] = useState("Todas");
  const [carritoAbierto, setCarritoAbierto] = useState(false);
  const [productoModal, setProductoModal] = useState(null);

  const { items, agregar, cambiarCantidad, eliminar, vaciar, total, totalItems } = useCarrito();

  const [seccion, setSeccion] = useState("stock"); // "pedido" | "stock"
  const [busq, setBusq]       = useState("");

  const vista = new URLSearchParams(window.location.search).get("vista");
  const modo = vista === "mayorista" ? "mayorista" : "minorista";

  if (vista === "admin") return <AdminPanel />;

  const handleMarcaChange = (marca) => {
    setMarcaActiva(marca);
    setCategoriaActiva("Todas");
  };

  const handleAgregar = (producto) => {
    agregar(producto, modo);
    setCarritoAbierto(true);
  };

  const productosFiltrados = productos.filter((p) => {
    const okMarca   = marcaActiva === "Todas" || p.marca === marcaActiva;
    const okCat     = categoriaActiva === "Todas" || p.categoria === categoriaActiva;
    const okSeccion = seccion === "pedido" || p.tipo_seccion === "stock";
    const q         = busq.trim().toLowerCase();
    const okBusq    = !q || p.nombre.toLowerCase().includes(q) || p.marca.toLowerCase().includes(q);
    return okMarca && okCat && okSeccion && okBusq;
  });

  const categorias = categoriasPorMarca(marcaActiva);

  return (
    <div className="app">
      <Header subtitulo="Catálogo de Relojes 2026" />

      <main className="contenido">
        {error && <p className="estado error">Error al cargar productos.</p>}

        {!error && (
          <>
            {/* Toggle En Stock / Por Pedido */}
            <div className="seccion-toggle">
              <button
                className={`seccion-btn ${seccion === "stock" ? "activo" : ""}`}
                onClick={() => { setSeccion("stock"); setMarcaActiva("Todas"); setCategoriaActiva("Todas"); setBusq(""); }}
              >
                <span className="seccion-dot" />
                En Stock
              </button>
              <button
                className={`seccion-btn ${seccion === "pedido" ? "activo" : ""}`}
                onClick={() => { setSeccion("pedido"); setMarcaActiva("Todas"); setCategoriaActiva("Todas"); setBusq(""); }}
              >
                Por Pedido
              </button>
            </div>

            {/* Buscador */}
            <div className="catalogo-busqueda">
              <span className="catalogo-busqueda-icon">🔍</span>
              <input
                type="search"
                className="catalogo-busqueda-input"
                placeholder="Buscar reloj por nombre o marca..."
                value={busq}
                onChange={(e) => { setBusq(e.target.value); setMarcaActiva("Todas"); setCategoriaActiva("Todas"); }}
              />
              {busq && (
                <button className="catalogo-busqueda-clear" onClick={() => setBusq("")}>✕</button>
              )}
            </div>

            {!busq && (
              <>
                <FiltroMarcas
                  marcas={marcas}
                  marcaActiva={marcaActiva}
                  onChange={handleMarcaChange}
                />
                {categorias.length > 2 && (
                  <FiltroMarcas
                    marcas={categorias}
                    marcaActiva={categoriaActiva}
                    onChange={setCategoriaActiva}
                    secundario
                  />
                )}
              </>
            )}

            {!loading && (
              <p className="contador">
                {busq
                  ? `${productosFiltrados.length} resultado${productosFiltrados.length !== 1 ? "s" : ""} para "${busq}"`
                  : `${productosFiltrados.length} producto${productosFiltrados.length !== 1 ? "s" : ""}`
                }
              </p>
            )}

            <GrillaProductos
              productos={productosFiltrados}
              modo={modo}
              seccion={seccion}
              loading={loading}
              onAgregar={handleAgregar}
              onVerDetalle={setProductoModal}
            />
          </>
        )}
      </main>

      {/* Botón flotante del carrito */}
      <button className="carrito-fab" onClick={() => setCarritoAbierto(true)}>
        🛒
        {totalItems > 0 && <span className="carrito-badge">{totalItems}</span>}
      </button>

      {/* Modal de producto */}
      {productoModal && (
        <ModalProducto
          producto={productoModal}
          modo={modo}
          onAgregar={handleAgregar}
          onCerrar={() => setProductoModal(null)}
        />
      )}

      {/* Drawer del carrito */}
      {carritoAbierto && (
        <CarritoDrawer
          items={items}
          total={total}
          modo={modo}
          onCambiar={cambiarCantidad}
          onEliminar={eliminar}
          onVaciar={vaciar}
          onCerrar={() => setCarritoAbierto(false)}
        />
      )}
    </div>
  );
}

export default App;
