import { useState, useMemo } from "react";
import { useProductos } from "../hooks/useProductos";
import { useCarrito } from "../hooks/useCarrito";
import FiltroMarcas from "../components/FiltroMarcas";
import GrillaProductos from "../components/GrillaProductos";
import CarritoDrawer from "../components/CarritoDrawer";
import ModalProducto from "../components/ModalProducto";

const WA_CENTRAL  = "5493764202408";
const STORAGE_KEY = "north_central_carrito";
const MODO        = "minorista";

export default function VistaCentral() {
  const { productos, marcas, loading, error, categoriasPorMarca } = useProductos();

  const [marcaActiva,     setMarcaActiva]     = useState("Todas");
  const [categoriaActiva, setCategoriaActiva] = useState("Todas");
  const [carritoAbierto,  setCarritoAbierto]  = useState(false);
  const [productoModal,   setProductoModal]   = useState(null);

  const { items, agregar, cambiarCantidad, vaciar, total, totalItems } =
    useCarrito(STORAGE_KEY);

  // Solo productos en stock real (sincronizados desde North)
  const productosCentral = useMemo(() =>
    productos.filter(
      (p) =>
        p.en_stock &&
        p.tipo_seccion === "stock" &&
        (p.stock || 0) > 0 &&
        (marcaActiva === "Todas" || p.marca === marcaActiva) &&
        (categoriaActiva === "Todas" || p.categoria === categoriaActiva)
    ),
    [productos, marcaActiva, categoriaActiva]
  );

  const categorias = categoriasPorMarca(marcaActiva);

  const handleMarcaChange = (marca) => {
    setMarcaActiva(marca);
    setCategoriaActiva("Todas");
  };

  const handleAgregar = (producto) => {
    agregar(producto, MODO);
    setCarritoAbierto(true);
  };

  return (
    <div className="app">

      {/* Header Central */}
      <header style={{
        background: "#0a0a0a",
        borderBottom: "3px solid #16a34a",
        padding: "28px 20px 22px",
        textAlign: "center",
        marginBottom: 32,
      }}>
        <p style={{
          margin: "0 0 6px",
          fontSize: "0.65rem",
          letterSpacing: "5px",
          textTransform: "uppercase",
          color: "#16a34a",
          fontWeight: 700,
        }}>
          NORTH SHOP
        </p>
        <h1 style={{
          margin: 0,
          fontSize: "1.5rem",
          fontWeight: 800,
          color: "#f1f5f9",
          letterSpacing: "1px",
        }}>
          Central
        </h1>
        <p style={{
          margin: "8px 0 0",
          fontSize: "0.75rem",
          color: "#64748b",
          letterSpacing: "2px",
          textTransform: "uppercase",
        }}>
          Stock disponible · Pedidos por WhatsApp
        </p>
      </header>

      <main className="contenido">
        {loading && <p className="estado">Cargando productos...</p>}
        {error   && <p className="estado error">Error al cargar productos.</p>}

        {!loading && !error && (
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

            <p className="contador">
              {productosCentral.length} producto{productosCentral.length !== 1 ? "s" : ""} disponibles
            </p>

            {productosCentral.length === 0 && !loading && (
              <p style={{ textAlign: "center", color: "#475569", marginTop: 60, fontSize: "0.95rem" }}>
                Sin stock disponible en este momento.
              </p>
            )}

            <GrillaProductos
              productos={productosCentral}
              modo={MODO}
              seccion="stock"
              onAgregar={handleAgregar}
              onVerDetalle={setProductoModal}
            />
          </>
        )}
      </main>

      {/* Botón carrito flotante */}
      <button
        className="carrito-fab"
        onClick={() => setCarritoAbierto(true)}
        style={{ background: totalItems > 0 ? "#16a34a" : undefined }}
      >
        🛒
        {totalItems > 0 && (
          <span className="carrito-badge" style={{ background: "#15803d" }}>
            {totalItems}
          </span>
        )}
      </button>

      {/* Modal producto */}
      {productoModal && (
        <ModalProducto
          producto={productoModal}
          modo={MODO}
          onAgregar={handleAgregar}
          onCerrar={() => setProductoModal(null)}
        />
      )}

      {/* Carrito */}
      {carritoAbierto && (
        <CarritoDrawer
          items={items}
          total={total}
          modo={MODO}
          onCambiar={cambiarCantidad}
          onVaciar={vaciar}
          onCerrar={() => setCarritoAbierto(false)}
          waNumero={WA_CENTRAL}
          mensajeExtra="Hola! Quiero hacer el siguiente pedido desde el catálogo de la Central:"
        />
      )}
    </div>
  );
}
