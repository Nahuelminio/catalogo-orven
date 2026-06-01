import { useState, useEffect, useMemo, useRef } from "react";
import { fetchProductosAdmin, updateProducto, createProducto, deleteProducto, subirFoto, vincularFotoProducto } from "../../services/admin";
import Toast from "./Toast";
import { useToast } from "../../hooks/useToast";
import GaleriaFotos from "./GaleriaFotos";
import SelectOCrear from "./SelectOCrear";
import DropZona from "./DropZona";

const FORM_NUEVO_VACIO = {
  marca: "", categoria: "", nombre: "", descripcion: "", fotos: [],
  precio_costo_usd: "", precio_minorista: "", precio_mayorista: "",
  stock: 0, en_stock: true, tipo_seccion: "pedido", es_caja: false,
};

export default function ProductosAdmin() {
  const [productos, setProductos]     = useState([]);
  const [loading, setLoading]         = useState(true);
  const [marcaActiva, setMarcaActiva] = useState("Todas");
  const [categoriaActiva, setCategoriaActiva] = useState("Todas");
  const [busqueda, setBusqueda]       = useState("");
  const [sinPrecio, setSinPrecio]     = useState(false);
  const [soloStock, setSoloStock]     = useState(false);
  const [sinStock, setSinStock]       = useState(false);
  const [fotoAmpliada, setFotoAmpliada] = useState(null);
  const [ediciones, setEdiciones]     = useState({});
  const [estados, setEstados]         = useState({});
  const [modificados, setModificados] = useState(new Set());
  const [vistaAdmin, setVistaAdmin]   = useState("grid");
  const [guardandoTodo, setGuardandoTodo] = useState(false);
  const [mostrarFormNuevo, setMostrarFormNuevo] = useState(false);
  const [formNuevo, setFormNuevo]     = useState(FORM_NUEVO_VACIO);
  const [creando, setCreando]         = useState(false);
  const [subiendoFoto, setSubiendoFoto] = useState({});
  const { toast, mostrar, cerrar } = useToast();
  const fileInputRefs = useRef({});

  const recargar = () => fetchProductosAdmin().then((data) => {
    setProductos(data);
    const init = {};
    data.forEach((p) => {
      init[p.id] = {
        nombre:           p.nombre           || "",
        descripcion:      p.descripcion      || "",
        marca:            p.marca            || "",
        categoria:        p.categoria        || "",
        precio_costo_usd: p.precio_costo_usd || 0,
        precio_minorista: p.precio_minorista || 0,
        precio_mayorista: p.precio_mayorista || 0,
        stock:            p.stock            || 0,
        en_stock:         p.en_stock         ?? true,
        tipo_seccion:     p.tipo_seccion     || "pedido",
        es_caja:          p.es_caja          || false,
      };
    });
    setEdiciones(init);
    setLoading(false);
  });

  useEffect(() => { recargar(); }, []);

  const marcas     = ["Todas", ...new Set(productos.map((p) => p.marca))];
  const categorias = marcaActiva === "Todas"
    ? ["Todas", ...new Set(productos.map((p) => p.categoria))]
    : ["Todas", ...new Set(productos.filter((p) => p.marca === marcaActiva).map((p) => p.categoria))];

  // Para selects de edición (sin "Todas")
  const todasMarcas     = [...new Set(productos.map((p) => p.marca))].sort();
  const todasCategorias = [...new Set(productos.map((p) => p.categoria))].sort();

  const stats = useMemo(() => ({
    total:    productos.length,
    sinPrecio: productos.filter((p) => !(ediciones[p.id]?.precio_minorista)).length,
    enStock:  productos.filter((p) => (ediciones[p.id]?.stock || 0) > 0).length,
    sinFoto:  productos.filter((p) => !p.foto).length,
  }), [productos, ediciones]);

  const filtrados = productos.filter((p) => {
    const okMarca     = marcaActiva === "Todas" || p.marca === marcaActiva;
    const okCat       = categoriaActiva === "Todas" || p.categoria === categoriaActiva;
    const q           = busqueda.toLowerCase();
    const okBusq      = !q || p.nombre.toLowerCase().includes(q) || p.marca.toLowerCase().includes(q);
    const vals        = ediciones[p.id] || {};
    const okSinP      = !sinPrecio || !vals.precio_minorista;
    const okSoloStock = !soloStock  || (vals.stock || 0) > 0;
    const okSinStock  = !sinStock   || (vals.stock || 0) === 0;
    return okMarca && okCat && okBusq && okSinP && okSoloStock && okSinStock;
  });

  const handleChange = (id, campo, valor) => {
    const esNum  = ["precio_costo_usd","precio_minorista","precio_mayorista","stock"].includes(campo);
    const esBool = ["es_caja","en_stock"].includes(campo);
    setEdiciones((prev) => ({
      ...prev,
      [id]: { ...prev[id], [campo]: esNum ? Number(valor) : esBool ? Boolean(valor) : valor },
    }));
    setModificados((prev) => new Set([...prev, id]));
    setEstados((prev) => ({ ...prev, [id]: "idle" }));
  };

  const guardar = async (producto) => {
    const { id } = producto;
    const vals = ediciones[id] || {};
    setEstados((prev) => ({ ...prev, [id]: "saving" }));
    try {
      await updateProducto(id, {
        nombre:           vals.nombre,
        descripcion:      vals.descripcion,
        marca:            vals.marca,
        categoria:        vals.categoria,
        precio_costo_usd: vals.precio_costo_usd,
        precio_minorista: vals.precio_minorista,
        precio_mayorista: vals.precio_mayorista,
        stock:            vals.stock,
        en_stock:         vals.en_stock,
        tipo_seccion:     vals.tipo_seccion,
        es_caja:          vals.es_caja,
      });
      setEstados((prev) => ({ ...prev, [id]: "ok" }));
      setModificados((prev) => { const s = new Set(prev); s.delete(id); return s; });
      setTimeout(() => setEstados((prev) => ({ ...prev, [id]: "idle" })), 2500);
    } catch (err) {
      console.error(err);
      setEstados((prev) => ({ ...prev, [id]: "error" }));
    }
  };

  const guardarTodo = async () => {
    setGuardandoTodo(true);
    for (const p of productos.filter((p) => modificados.has(p.id))) await guardar(p);
    setGuardandoTodo(false);
    mostrar("Cambios guardados");
  };

  const eliminar = async (p) => {
    if (!confirm(`¿Eliminar "${p.nombre}"?\nEsto es permanente y no se puede deshacer.`)) return;
    try {
      await deleteProducto(p.id);
      setProductos((prev) => prev.filter((x) => x.id !== p.id));
      mostrar("Producto eliminado", "warn");
    } catch (err) {
      mostrar("Error al eliminar", "error");
    }
  };

  const handleFotoExistente = async (productoId, file) => {
    if (!file) return;
    setSubiendoFoto((prev) => ({ ...prev, [productoId]: true }));
    try {
      const url = await subirFoto(file);
      await updateProducto(productoId, { foto: url });
      setProductos((prev) => prev.map((p) => p.id === productoId ? { ...p, foto: url } : p));
    } catch (err) { console.error(err); }
    setSubiendoFoto((prev) => ({ ...prev, [productoId]: false }));
  };

  const handleFotoNuevo = async (files) => {
    const arr = files instanceof FileList ? Array.from(files) : (Array.isArray(files) ? files : [files]).filter(Boolean);
    if (!arr.length) return;
    setSubiendoFoto((prev) => ({ ...prev, nuevo: true }));
    try {
      const urls = await Promise.all(arr.map((f) => subirFoto(f)));
      setFormNuevo((f) => ({ ...f, fotos: [...f.fotos, ...urls] }));
    } catch (err) { console.error(err); }
    setSubiendoFoto((prev) => ({ ...prev, nuevo: false }));
  };

  const handleCrear = async (e) => {
    e.preventDefault();
    if (!formNuevo.nombre || !formNuevo.marca) return;
    setCreando(true);
    try {
      const { fotos, ...resto } = formNuevo;
      const producto = await createProducto({
        ...resto,
        foto:             fotos[0] || "",
        precio_costo_usd: Number(formNuevo.precio_costo_usd) || 0,
        precio_minorista: Number(formNuevo.precio_minorista) || 0,
        precio_mayorista: Number(formNuevo.precio_mayorista) || 0,
        stock:            Number(formNuevo.stock) || 0,
        tipo_seccion:     formNuevo.tipo_seccion || "pedido",
        es_caja:          formNuevo.es_caja || false,
      });
      // Vinculamos todas las fotos en producto_fotos (galería)
      if (producto?.id && fotos.length) {
        await Promise.all(fotos.map((url) => vincularFotoProducto(producto.id, url)));
      }
      setFormNuevo(FORM_NUEVO_VACIO);
      setMostrarFormNuevo(false);
      recargar();
    } catch (err) { console.error(err); }
    setCreando(false);
  };

  if (loading) return <p className="estado">Cargando productos...</p>;

  return (
    <div>
      <Toast mensaje={toast.mensaje} tipo={toast.tipo} onClose={cerrar} />
      {/* Cabecera con acciones */}
      <div className="admin-section-header">
        <div>
          <p className="admin-sub">
            {filtrados.length} productos
            {modificados.size > 0 && <span className="admin-pendientes"> · {modificados.size} sin guardar</span>}
          </p>
        </div>
        <div className="admin-header-actions">
          {modificados.size > 0 && (
            <button className="admin-guardar-todo" onClick={guardarTodo} disabled={guardandoTodo}>
              {guardandoTodo ? "Guardando..." : `💾 Guardar ${modificados.size} cambio${modificados.size !== 1 ? "s" : ""}`}
            </button>
          )}
          <div className="admin-vista-toggle">
            <button className={vistaAdmin === "grid"  ? "activo" : ""} onClick={() => setVistaAdmin("grid")}>⊞</button>
            <button className={vistaAdmin === "lista" ? "activo" : ""} onClick={() => setVistaAdmin("lista")}>☰</button>
          </div>
        </div>
      </div>

      {/* Botón nuevo producto */}
      <div style={{ marginBottom: "16px" }}>
        <button
          className="btn-nuevo-producto"
          onClick={() => setMostrarFormNuevo((v) => !v)}
        >
          {mostrarFormNuevo ? "✕ Cancelar" : "+ Nuevo producto"}
        </button>
      </div>

      {/* Formulario nuevo producto */}
      {mostrarFormNuevo && (
        <div className="admin-form-card" style={{ marginBottom: "20px" }}>
          <h3 className="admin-form-title">Nuevo producto</h3>
          <form onSubmit={handleCrear} className="venta-form">
            <div className="form-row">
              <label className="form-label">
                <span>Marca *</span>
                <SelectOCrear
                  label="Marca"
                  placeholder="Elegí una marca..."
                  opciones={[...new Set(productos.map((p) => p.marca))]}
                  valor={formNuevo.marca}
                  onChange={(v) => setFormNuevo((f) => ({ ...f, marca: v, categoria: "" }))}
                />
              </label>
              <label className="form-label">
                <span>Categoría *</span>
                <SelectOCrear
                  label="Categoría"
                  placeholder="Elegí una categoría..."
                  opciones={[...new Set(
                    productos
                      .filter((p) => !formNuevo.marca || p.marca === formNuevo.marca)
                      .map((p) => p.categoria)
                  )]}
                  valor={formNuevo.categoria}
                  onChange={(v) => setFormNuevo((f) => ({ ...f, categoria: v }))}
                />
              </label>
            </div>
            <div className="form-row">
              <label className="form-label" style={{ flex: 2 }}>
                <span>Nombre *</span>
                <input type="text" required value={formNuevo.nombre} onChange={(e) => setFormNuevo((f) => ({ ...f, nombre: e.target.value }))} placeholder="Ej: MTP-VD03D-2A" />
              </label>
            </div>
            <div className="form-row">
              <label className="form-label">
                <span>Descripción</span>
                <textarea
                  value={formNuevo.descripcion}
                  onChange={(e) => setFormNuevo((f) => ({ ...f, descripcion: e.target.value }))}
                  placeholder="Descripción del producto..."
                  rows={4}
                  style={{ resize: "vertical", minHeight: "90px" }}
                />
              </label>
            </div>
            <div className="form-row">
              <div className="form-label">
                <span>Foto</span>
                <DropZona
                  onFiles={handleFotoNuevo}
                  previews={formNuevo.fotos}
                  subiendo={subiendoFoto.nuevo}
                  multiple={true}
                />
              </div>
            </div>
            <div className="form-row">
              <label className="form-label">
                <span>Costo USD</span>
                <input type="number" step="0.01" value={formNuevo.precio_costo_usd} onChange={(e) => setFormNuevo((f) => ({ ...f, precio_costo_usd: e.target.value }))} placeholder="0" />
              </label>
              <label className="form-label">
                <span>Precio Minorista (ARS)</span>
                <input type="number" value={formNuevo.precio_minorista} onChange={(e) => setFormNuevo((f) => ({ ...f, precio_minorista: e.target.value }))} placeholder="0" />
              </label>
              <label className="form-label">
                <span>Precio Mayorista (USD)</span>
                <input type="number" value={formNuevo.precio_mayorista} onChange={(e) => setFormNuevo((f) => ({ ...f, precio_mayorista: e.target.value }))} placeholder="0" />
              </label>
              <label className="form-label">
                <span>Stock</span>
                <input type="number" value={formNuevo.stock} onChange={(e) => setFormNuevo((f) => ({ ...f, stock: e.target.value }))} placeholder="0" min="0" />
              </label>
            </div>
            <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
              <button type="submit" className="btn-registrar" disabled={creando}>
                {creando ? "Creando..." : "✓ Crear producto"}
              </button>
              <label className="admin-check">
                <input type="checkbox" checked={formNuevo.en_stock} onChange={(e) => setFormNuevo((f) => ({ ...f, en_stock: e.target.checked }))} />
                Visible en el catálogo
              </label>
              <label className="admin-check">
                <input type="checkbox" checked={formNuevo.tipo_seccion === "stock"} onChange={(e) => setFormNuevo((f) => ({ ...f, tipo_seccion: e.target.checked ? "stock" : "pedido" }))} />
                Sección En Stock
              </label>
              <label className="admin-check" style={{ color: "var(--rojo)" }}>
                <input type="checkbox" checked={formNuevo.es_caja} onChange={(e) => setFormNuevo((f) => ({ ...f, es_caja: e.target.checked, en_stock: false }))} />
                🗃️ Es caja (oculta en catálogo)
              </label>
            </div>
          </form>
        </div>
      )}

      {/* Stats */}
      <div className="admin-stats">
        <div className="stat-card"><span className="stat-num">{stats.total}</span><span className="stat-label">Productos</span></div>
        <div className="stat-card warning"><span className="stat-num">{stats.sinPrecio}</span><span className="stat-label">Sin precio</span></div>
        <div className="stat-card success"><span className="stat-num">{stats.enStock}</span><span className="stat-label">En stock</span></div>
        <div className="stat-card muted"><span className="stat-num">{stats.sinFoto}</span><span className="stat-label">Sin foto</span></div>
      </div>

      {/* Buscador */}
      <div className="admin-buscador">
        <input type="text" placeholder="Buscar producto, marca, categoría..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} className="admin-search" />
        {busqueda && <button className="admin-search-clear" onClick={() => setBusqueda("")}>✕</button>}
      </div>

      {/* Filtro marcas */}
      <div className="filtro-marcas admin-filtro">
        {marcas.map((m) => (
          <button key={m} className={`filtro-btn ${marcaActiva === m ? "activo" : ""}`} onClick={() => { setMarcaActiva(m); setCategoriaActiva("Todas"); }}>{m}</button>
        ))}
      </div>

      {categorias.length > 2 && (
        <div className="filtro-marcas admin-filtro secundario">
          {categorias.map((c) => (
            <button key={c} className={`filtro-btn secundario ${categoriaActiva === c ? "activo" : ""}`} onClick={() => setCategoriaActiva(c)}>{c}</button>
          ))}
        </div>
      )}

      {/* Checkboxes */}
      <div className="admin-extras">
        <label className="admin-check"><input type="checkbox" checked={sinPrecio} onChange={(e) => setSinPrecio(e.target.checked)} />Sin precio</label>
        <label className="admin-check"><input type="checkbox" checked={soloStock} onChange={(e) => { setSoloStock(e.target.checked); if (e.target.checked) setSinStock(false); }} />Con stock</label>
        <label className="admin-check"><input type="checkbox" checked={sinStock}  onChange={(e) => { setSinStock(e.target.checked);  if (e.target.checked) setSoloStock(false); }} />Sin stock</label>
      </div>

      {/* Vista GRID */}
      {vistaAdmin === "grid" && (
        <div className="admin-grilla">
          {filtrados.length === 0 && <p className="admin-empty">No hay productos que coincidan.</p>}
          {filtrados.map((p) => {
            const estado     = estados[p.id] || "idle";
            const vals       = ediciones[p.id] || {};
            const modificado = modificados.has(p.id);
            return (
              <div key={p.id} className={`admin-card ${modificado ? "modificada" : ""}`}>
                <div className="admin-foto" style={{ position: "relative" }}>
                  <div onClick={() => p.foto && setFotoAmpliada({ src: p.foto, nombre: p.nombre })} style={{ cursor: p.foto ? "zoom-in" : "default", width: "100%", height: "100%" }}>
                    {p.foto ? <img src={p.foto} alt={p.nombre} /> : <div className="sin-imagen">Sin foto</div>}
                    {p.foto && <div className="admin-foto-zoom">🔍</div>}
                  </div>
                  {(vals.stock || 0) > 0 && <span className="chip-stock-admin">{vals.stock} en stock</span>}
                </div>
                <GaleriaFotos
                  producto={p}
                  onFotoActualizada={(id, url) =>
                    setProductos((prev) => prev.map((x) => x.id === id ? { ...x, foto: url } : x))
                  }
                />
                <div className="admin-info">
                  <select className="admin-select-marca" value={vals.marca ?? ""} onChange={(e) => handleChange(p.id, "marca", e.target.value)}>
                    {todasMarcas.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                  <input className="admin-input-nombre" value={vals.nombre ?? ""} onChange={(e) => handleChange(p.id, "nombre", e.target.value)} />
                  <select className="admin-select-cat" value={vals.categoria ?? ""} onChange={(e) => handleChange(p.id, "categoria", e.target.value)}>
                    {todasCategorias.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <textarea className="admin-input-desc" value={vals.descripcion ?? ""} onChange={(e) => handleChange(p.id, "descripcion", e.target.value)} placeholder="Sin descripción" rows={5} />
                  <div className="admin-precios">
                    <label><span>Costo USD</span><input type="number" step="0.01" value={vals.precio_costo_usd ?? ""} onChange={(e) => handleChange(p.id, "precio_costo_usd", e.target.value)} placeholder="0" /></label>
                    <label><span>Minorista</span><input type="number" value={vals.precio_minorista ?? ""} onChange={(e) => handleChange(p.id, "precio_minorista", e.target.value)} placeholder="0" /></label>
                    <label><span>Mayorista</span><input type="number" value={vals.precio_mayorista ?? ""} onChange={(e) => handleChange(p.id, "precio_mayorista", e.target.value)} placeholder="0" /></label>
                    <label><span>Stock</span><input type="number" value={vals.stock ?? ""} onChange={(e) => handleChange(p.id, "stock", e.target.value)} placeholder="0" min="0" className={(vals.stock || 0) > 0 ? "admin-input-stock-ok" : ""} /></label>
                  </div>
                  <label className="admin-check" style={{ marginBottom: "4px" }}>
                    <input type="checkbox" checked={vals.en_stock ?? true} onChange={(e) => handleChange(p.id, "en_stock", e.target.checked)} />
                    Visible en catálogo
                  </label>
                  <label className="admin-check" style={{ marginBottom: "4px" }}>
                    <input type="checkbox" checked={vals.tipo_seccion === "stock"} onChange={(e) => handleChange(p.id, "tipo_seccion", e.target.checked ? "stock" : "pedido")} />
                    Sección En Stock
                  </label>
                  <label className="admin-check" style={{ marginBottom: "6px", color: vals.es_caja ? "var(--rojo)" : undefined }}>
                    <input type="checkbox" checked={vals.es_caja || false} onChange={(e) => handleChange(p.id, "es_caja", e.target.checked)} />
                    🗃️ Es caja
                  </label>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button className={`admin-guardar ${estado}`} style={{ flex: 1 }} onClick={() => guardar(p)} disabled={estado === "saving"}>
                      {estado === "saving" ? "Guardando..." : estado === "ok" ? "✓ Guardado" : estado === "error" ? "✗ Error" : modificado ? "● Guardar" : "Guardar"}
                    </button>
                    <button className="btn-eliminar-producto" onClick={() => eliminar(p)} title="Eliminar producto">🗑</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Vista LISTA */}
      {vistaAdmin === "lista" && (
        <div className="admin-lista">
          {filtrados.length === 0 && <p className="admin-empty">No hay productos que coincidan.</p>}
          <div className="admin-lista-header">
            <span>Producto</span><span>Minorista</span><span>Mayorista</span><span>Stock</span><span></span>
          </div>
          {filtrados.map((p) => {
            const estado     = estados[p.id] || "idle";
            const vals       = ediciones[p.id] || {};
            const modificado = modificados.has(p.id);
            return (
              <div key={p.id} className={`admin-lista-row ${modificado ? "modificada" : ""}`}>
                <div className="admin-lista-producto">
                  {p.foto
                    ? <img src={p.foto} alt={p.nombre} className="admin-lista-img" onClick={() => setFotoAmpliada({ src: p.foto, nombre: p.nombre })} style={{ cursor: "zoom-in" }} />
                    : <div className="admin-lista-img sin-imagen-mini" />
                  }
                  <div className="admin-lista-texto">
                    <input className="admin-input-nombre-lista" value={vals.nombre ?? ""} onChange={(e) => handleChange(p.id, "nombre", e.target.value)} />
                    <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                      <select className="admin-select-sub" value={vals.marca ?? ""} onChange={(e) => handleChange(p.id, "marca", e.target.value)}>
                        {todasMarcas.map((m) => <option key={m} value={m}>{m}</option>)}
                      </select>
                      <span className="admin-lista-sub">·</span>
                      <select className="admin-select-sub" value={vals.categoria ?? ""} onChange={(e) => handleChange(p.id, "categoria", e.target.value)}>
                        {todasCategorias.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
                <input type="number" className="admin-lista-input" value={vals.precio_minorista ?? ""} onChange={(e) => handleChange(p.id, "precio_minorista", e.target.value)} placeholder="0" />
                <input type="number" className="admin-lista-input" value={vals.precio_mayorista ?? ""} onChange={(e) => handleChange(p.id, "precio_mayorista", e.target.value)} placeholder="0" />
                <input type="number" className={`admin-lista-input ${(vals.stock || 0) > 0 ? "admin-input-stock-ok" : ""}`} value={vals.stock ?? ""} onChange={(e) => handleChange(p.id, "stock", e.target.value)} placeholder="0" min="0" />
                <div style={{ display: "flex", gap: 4 }}>
                  <button className={`admin-guardar-mini ${estado}`} onClick={() => guardar(p)} disabled={estado === "saving"}>
                    {estado === "saving" ? "…" : estado === "ok" ? "✓" : estado === "error" ? "✗" : modificado ? "●" : "↑"}
                  </button>
                  <button className="btn-eliminar-producto" onClick={() => eliminar(p)} title="Eliminar">🗑</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Lightbox */}
      {fotoAmpliada && (
        <>
          <div className="lightbox-overlay" onClick={() => setFotoAmpliada(null)} />
          <div className="lightbox">
            <button className="lightbox-cerrar" onClick={() => setFotoAmpliada(null)}>✕</button>
            <img src={fotoAmpliada.src} alt={fotoAmpliada.nombre} className="lightbox-img" />
            <p className="lightbox-nombre">{fotoAmpliada.nombre}</p>
          </div>
        </>
      )}
    </div>
  );
}
