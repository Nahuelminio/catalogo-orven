import { useState, useEffect, useMemo } from "react";
import {
  fetchConsignaciones, createConsignacion, updateConsignacion, deleteConsignacion,
  fetchVentasConsignacion, venderConsignacion, cobrarVentaConsignacion, devolverConsignacion,
  fetchProductosAdmin, decrementarStock, incrementarStock,
} from "../../services/admin";
import Toast from "./Toast";
import { useToast } from "../../hooks/useToast";
import { descargarCSV } from "../../utils/csv";

const hoy       = () => new Date().toISOString().split("T")[0];
const fmt       = (n) => `$ ${Number(n || 0).toLocaleString("es-AR")}`;
const fmtFecha  = (f) => f ? `${f.slice(8,10)}/${f.slice(5,7)}/${f.slice(0,4)}` : "—";

const ESTADO_LABEL = {
  activo:   { txt: "En consignación", cls: "badge-activo"   },
  parcial:  { txt: "Vendido parcial", cls: "badge-parcial"  },
  vendido:  { txt: "Vendido",         cls: "badge-vendido"  },
  devuelto: { txt: "Devuelto",        cls: "badge-devuelto" },
};

const FORM_VACIO = {
  producto_id: "", producto_nombre: "", marca: "",
  cantidad: 1, consignatario: "", fecha_envio: hoy(),
  precio_sugerido: 0, notas: "",
};

const VENTA_FORM_VACIO = {
  cantidad: 1, precio_venta: 0, fecha: hoy(), cobrado: false, notas: "",
};

export default function ConsignacionAdmin() {
  const [items,     setItems]     = useState([]);
  const [productos, setProductos] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [filtro,    setFiltro]    = useState("activo"); // activo|parcial|vendido|devuelto|todos
  const [form,      setForm]      = useState(FORM_VACIO);
  const [editId,    setEditId]    = useState(null);
  const [mostrandoForm, setMostrandoForm] = useState(false);

  // Busqueda de producto en el form
  const [busqProd,   setBusqProd]   = useState("");
  const [dropOpen,   setDropOpen]   = useState(false);

  // Modal vender
  const [ventaModal,  setVentaModal]  = useState(null); // { item }
  const [ventaForm,   setVentaForm]   = useState(VENTA_FORM_VACIO);
  const [ventaHist,   setVentaHist]   = useState([]);
  const [histLoading, setHistLoading] = useState(false);

  const { toast, mostrar, cerrar } = useToast();

  const cargar = () =>
    fetchConsignaciones().then((d) => { setItems(d); setLoading(false); });

  useEffect(() => { cargar(); }, []);
  useEffect(() => { fetchProductosAdmin().then((d) => setProductos(d.filter((p) => !p.es_caja))); }, []);

  // ── Filtro ───────────────────────────────────────────────
  const filtrados = useMemo(() => {
    if (filtro === "todos") return items;
    return items.filter((i) => i.estado === filtro);
  }, [items, filtro]);

  // Contadores para badges en botones de filtro
  const conteos = useMemo(() => {
    const c = { activo: 0, parcial: 0, vendido: 0, devuelto: 0 };
    items.forEach((i) => { if (c[i.estado] !== undefined) c[i.estado]++; });
    return c;
  }, [items]);

  // ── Buscador de producto ─────────────────────────────────
  const prodsFiltrados = useMemo(() => {
    if (!busqProd) return [];
    const q = busqProd.toLowerCase();
    return productos.filter((p) =>
      p.nombre.toLowerCase().includes(q) || p.marca.toLowerCase().includes(q)
    ).slice(0, 8);
  }, [busqProd, productos]);

  const seleccionarProducto = (p) => {
    setForm((f) => ({
      ...f,
      producto_id:     p.id,
      producto_nombre: p.nombre,
      marca:           p.marca,
      precio_sugerido: p.precio_minorista || 0,
    }));
    setBusqProd(p.nombre);
    setDropOpen(false);
  };

  // ── Guardar consignación ────────────────────────────────
  const guardar = async (e) => {
    e.preventDefault();
    if (!form.producto_nombre || !form.consignatario) return;
    try {
      if (editId) {
        await updateConsignacion(editId, form);
        mostrar("Consignación actualizada");
      } else {
        await createConsignacion(form);
        // Decrementar stock si hay producto vinculado
        if (form.producto_id) {
          await decrementarStock(form.producto_id, Number(form.cantidad)).catch(() => {});
        }
        mostrar("Consignación registrada");
      }
      setForm(FORM_VACIO);
      setBusqProd("");
      setEditId(null);
      setMostrandoForm(false);
      cargar();
    } catch (err) {
      mostrar("Error al guardar", "error");
    }
  };

  const cargarParaEditar = (item) => {
    setEditId(item.id);
    setForm({
      producto_id:     item.producto_id || "",
      producto_nombre: item.producto_nombre,
      marca:           item.marca || "",
      cantidad:        item.cantidad,
      consignatario:   item.consignatario,
      fecha_envio:     item.fecha_envio?.slice(0, 10) || hoy(),
      precio_sugerido: item.precio_sugerido || 0,
      notas:           item.notas || "",
    });
    setBusqProd(item.producto_nombre);
    setMostrandoForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancelarEdicion = () => {
    setEditId(null);
    setForm(FORM_VACIO);
    setBusqProd("");
    setMostrandoForm(false);
  };

  // ── Eliminar ────────────────────────────────────────────
  const eliminar = async (item) => {
    if (!confirm(`¿Eliminar consignación de "${item.producto_nombre}" con ${item.consignatario}?`)) return;
    await deleteConsignacion(item.id);
    mostrar("Eliminado", "warn");
    cargar();
  };

  // ── Devolver ────────────────────────────────────────────
  const devolver = async (item) => {
    if (!confirm(`¿Marcar como devuelto?\nEl stock de "${item.producto_nombre}" se restaurará automáticamente.`)) return;
    await devolverConsignacion(item.id);
    const restante = item.cantidad - Number(item.unidades_vendidas || 0);
    if (item.producto_id && restante > 0) {
      await incrementarStock(item.producto_id, restante).catch(() => {});
    }
    mostrar("Marcado como devuelto");
    cargar();
  };

  // ── Modal vender ─────────────────────────────────────────
  const abrirModalVenta = async (item) => {
    setVentaModal(item);
    setVentaForm({ ...VENTA_FORM_VACIO, precio_venta: item.precio_sugerido || 0 });
    setHistLoading(true);
    const hist = await fetchVentasConsignacion(item.id).catch(() => []);
    setVentaHist(hist);
    setHistLoading(false);
  };

  const registrarVenta = async (e) => {
    e.preventDefault();
    const disponible = ventaModal.cantidad - Number(ventaModal.unidades_vendidas || 0);
    if (Number(ventaForm.cantidad) > disponible) {
      mostrar(`Solo quedan ${disponible} unidades disponibles`, "error");
      return;
    }
    try {
      await venderConsignacion(ventaModal.id, ventaForm);
      mostrar("Venta registrada");
      setVentaModal(null);
      cargar();
    } catch (err) {
      mostrar("Error al registrar venta", "error");
    }
  };

  const cobrar = async (consId, ventaId) => {
    await cobrarVentaConsignacion(consId, ventaId);
    mostrar("Marcado como cobrado");
    // Recargar historial
    const hist = await fetchVentasConsignacion(consId).catch(() => []);
    setVentaHist(hist);
    cargar();
  };

  // ── Resumen global ───────────────────────────────────────
  const resumen = useMemo(() => {
    const activos    = items.filter((i) => i.estado === "activo" || i.estado === "parcial");
    const unidades   = activos.reduce((s, i) => s + (i.cantidad - Number(i.unidades_vendidas || 0)), 0);
    const porCobrar  = items.reduce((s, i) => s + Number(i.total_por_cobrar || 0), 0);
    const cobrado    = items.reduce((s, i) => s + (Number(i.total_vendido || 0) - Number(i.total_por_cobrar || 0)), 0);
    return { unidades, porCobrar, cobrado };
  }, [items]);

  // ── Agrupado por consignatario (solo filtrados activos) ──
  const agrupado = useMemo(() => {
    const mapa = {};
    filtrados.forEach((i) => {
      if (!mapa[i.consignatario]) mapa[i.consignatario] = [];
      mapa[i.consignatario].push(i);
    });
    return Object.entries(mapa).sort(([a], [b]) => a.localeCompare(b));
  }, [filtrados]);

  return (
    <div>
      <Toast mensaje={toast.mensaje} tipo={toast.tipo} onClose={cerrar} />

      {/* ── Resumen global ── */}
      <div className="admin-stats">
        <div className="stat-card">
          <span className="stat-num">{items.filter((i) => i.estado === "activo" || i.estado === "parcial").length}</span>
          <span className="stat-label">Activas</span>
        </div>
        <div className="stat-card">
          <span className="stat-num">{resumen.unidades}</span>
          <span className="stat-label">Unidades afuera</span>
        </div>
        <div className="stat-card warning">
          <span className="stat-num" style={{ fontSize: "1rem" }}>{fmt(resumen.porCobrar)}</span>
          <span className="stat-label">Por cobrar</span>
        </div>
        <div className="stat-card success">
          <span className="stat-num" style={{ fontSize: "1rem" }}>{fmt(resumen.cobrado)}</span>
          <span className="stat-label">Ya cobrado</span>
        </div>
      </div>

      {/* ── Toolbar ── */}
      <div className="admin-lista-toolbar" style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {[
            { key: "activo",   label: "🟡 En consig." },
            { key: "parcial",  label: "🔵 Parcial"    },
            { key: "vendido",  label: "✅ Vendido"    },
            { key: "devuelto", label: "🔙 Devuelto"   },
            { key: "todos",    label: "Todos"          },
          ].map(({ key, label }) => (
            <button
              key={key}
              className={`prod-filtro-btn ${filtro === key ? "activo" : ""}`}
              onClick={() => setFiltro(key)}
            >
              {label}
              {key !== "todos" && conteos[key] > 0 && (
                <span style={{ marginLeft: 4, background: "rgba(0,0,0,0.12)", borderRadius: 10, padding: "0 5px", fontSize: "0.75rem" }}>
                  {conteos[key]}
                </span>
              )}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            className="btn-csv"
            onClick={() => descargarCSV(
              items,
              ["consignatario","producto_nombre","marca","cantidad","unidades_vendidas","precio_sugerido","total_vendido","total_por_cobrar","estado","fecha_envio","notas"],
              ["Consignatario","Producto","Marca","Cantidad","Vendidas","Precio sug.","Total vendido","Por cobrar","Estado","Fecha envío","Notas"],
              "consignaciones"
            )}
          >⬇ CSV</button>
          <button
            className="btn-registrar"
            style={{ marginTop: 0 }}
            onClick={() => { setMostrandoForm((v) => !v); if (editId) cancelarEdicion(); }}
          >
            {mostrandoForm ? "✕ Cerrar" : "+ Nueva consignación"}
          </button>
        </div>
      </div>

      {/* ── Formulario ── */}
      {mostrandoForm && (
        <div className="admin-form-card" style={{ marginBottom: 20 }}>
          <h3 className="admin-form-title" style={{ marginBottom: 14 }}>
            {editId ? "✏️ Editar consignación" : "+ Nueva consignación"}
          </h3>
          <form onSubmit={guardar} className="venta-form">
            {/* Producto */}
            <div className="form-label" style={{ position: "relative" }}>
              <span>Producto</span>
              <input
                type="text"
                placeholder="Buscá por nombre o marca..."
                value={busqProd}
                onChange={(e) => {
                  setBusqProd(e.target.value);
                  setDropOpen(true);
                  setForm((f) => ({ ...f, producto_id: "", producto_nombre: e.target.value, marca: "" }));
                }}
                onFocus={() => setDropOpen(true)}
                onBlur={() => setTimeout(() => setDropOpen(false), 150)}
                autoComplete="off"
                required
              />
              {dropOpen && prodsFiltrados.length > 0 && (
                <ul className="prod-dropdown">
                  {prodsFiltrados.map((p) => (
                    <li key={p.id} onMouseDown={() => seleccionarProducto(p)}>
                      <div className="prod-drop-main">
                        {p.foto && <img src={p.foto} alt="" className="prod-drop-img" />}
                        <div>
                          <strong>{p.nombre}</strong>
                          <span className="prod-drop-marca">{p.marca}</span>
                        </div>
                      </div>
                      <span className="prod-drop-precio">Stock: {p.stock ?? 0}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="form-row">
              <label className="form-label">
                <span>Consignatario (quién lo tiene)</span>
                <input
                  type="text"
                  value={form.consignatario}
                  onChange={(e) => setForm((f) => ({ ...f, consignatario: e.target.value }))}
                  placeholder="Nombre del local o persona"
                  required
                />
              </label>
              <label className="form-label">
                <span>Cantidad enviada</span>
                <input
                  type="number" min="1"
                  value={form.cantidad}
                  onChange={(e) => setForm((f) => ({ ...f, cantidad: e.target.value }))}
                />
              </label>
              <label className="form-label">
                <span>Fecha de envío</span>
                <input
                  type="date"
                  value={form.fecha_envio}
                  onChange={(e) => setForm((f) => ({ ...f, fecha_envio: e.target.value }))}
                />
              </label>
            </div>

            <div className="form-row">
              <label className="form-label">
                <span>Precio sugerido de venta (ARS)</span>
                <input
                  type="number" min="0"
                  value={form.precio_sugerido}
                  onChange={(e) => setForm((f) => ({ ...f, precio_sugerido: e.target.value }))}
                />
              </label>
              <label className="form-label">
                <span>Notas</span>
                <input
                  type="text"
                  value={form.notas}
                  onChange={(e) => setForm((f) => ({ ...f, notas: e.target.value }))}
                  placeholder="Acuerdos, porcentaje, etc."
                />
              </label>
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button type="submit" className="btn-registrar">
                {editId ? "✓ Guardar cambios" : "✓ Registrar consignación"}
              </button>
              {editId && (
                <button type="button" onClick={cancelarEdicion}
                  style={{ background: "none", border: "1.5px solid #ddd", borderRadius: 8, padding: "5px 14px", fontSize: "0.82rem", cursor: "pointer" }}>
                  ✕ Cancelar
                </button>
              )}
            </div>
          </form>
        </div>
      )}

      {/* ── Lista agrupada ── */}
      {loading ? <p className="estado">Cargando...</p> : filtrados.length === 0 ? (
        <p className="admin-empty">No hay consignaciones {filtro !== "todos" ? `con estado "${ESTADO_LABEL[filtro]?.txt}"` : ""}.</p>
      ) : (
        agrupado.map(([consignatario, lista]) => (
          <div key={consignatario} style={{ marginBottom: 24 }}>
            {/* Header del consignatario */}
            <div style={{
              background: "var(--gris-bg)",
              borderRadius: "10px 10px 0 0",
              padding: "8px 14px",
              fontWeight: 700,
              fontSize: "0.88rem",
              color: "var(--negro)",
              borderBottom: "2px solid var(--borde)",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}>
              📍 {consignatario}
              <span style={{ fontWeight: 400, color: "var(--gris-sub)", fontSize: "0.8rem" }}>
                — {lista.length} producto{lista.length !== 1 ? "s" : ""}
              </span>
              {(() => {
                const pc = lista.reduce((s, i) => s + Number(i.total_por_cobrar || 0), 0);
                return pc > 0 ? (
                  <span style={{ marginLeft: "auto", color: "#d97706", fontWeight: 700, fontSize: "0.82rem" }}>
                    💰 Por cobrar: {fmt(pc)}
                  </span>
                ) : null;
              })()}
            </div>

            {/* Filas */}
            {lista.map((item) => {
              const disponible = item.cantidad - Number(item.unidades_vendidas || 0);
              const est = ESTADO_LABEL[item.estado] || ESTADO_LABEL.activo;
              return (
                <div key={item.id} style={{
                  display: "grid",
                  gridTemplateColumns: "1fr auto",
                  gap: 8,
                  padding: "10px 14px",
                  borderBottom: "1px solid var(--borde)",
                  background: item.estado === "devuelto" ? "#f9f9f9" : "white",
                  opacity: item.estado === "devuelto" ? 0.65 : 1,
                }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 700, fontSize: "0.88rem" }}>{item.producto_nombre}</span>
                      {item.marca && <span style={{ fontSize: "0.78rem", color: "var(--gris-sub)" }}>{item.marca}</span>}
                      <span className={`badge-consig ${est.cls}`}>{est.txt}</span>
                    </div>
                    <div style={{ fontSize: "0.78rem", color: "var(--gris-sub)", marginTop: 3, display: "flex", gap: 12, flexWrap: "wrap" }}>
                      <span>📅 Enviado: {fmtFecha(item.fecha_envio)}</span>
                      <span>📦 Enviados: {item.cantidad}</span>
                      {Number(item.unidades_vendidas) > 0 && (
                        <span style={{ color: "#16a34a", fontWeight: 600 }}>
                          ✅ Vendidos: {item.unidades_vendidas}
                        </span>
                      )}
                      {disponible > 0 && item.estado !== "devuelto" && (
                        <span style={{ color: "#d97706", fontWeight: 600 }}>🟡 Quedan: {disponible}</span>
                      )}
                      {Number(item.precio_sugerido) > 0 && (
                        <span>💲 Precio sugerido: {fmt(item.precio_sugerido)}</span>
                      )}
                      {Number(item.total_vendido) > 0 && (
                        <span style={{ color: "#16a34a" }}>💵 Vendido: {fmt(item.total_vendido)}</span>
                      )}
                      {Number(item.total_por_cobrar) > 0 && (
                        <span style={{ color: "#d97706", fontWeight: 600 }}>⏳ Por cobrar: {fmt(item.total_por_cobrar)}</span>
                      )}
                      {item.notas && <span>📝 {item.notas}</span>}
                    </div>
                  </div>

                  {/* Acciones */}
                  <div style={{ display: "flex", gap: 4, alignItems: "flex-start", flexShrink: 0 }}>
                    {(item.estado === "activo" || item.estado === "parcial") && disponible > 0 && (
                      <button
                        className="btn-registrar"
                        style={{ fontSize: "0.75rem", padding: "4px 10px", marginTop: 0 }}
                        onClick={() => abrirModalVenta(item)}
                      >
                        💰 Vender
                      </button>
                    )}
                    {item.estado !== "devuelto" && disponible > 0 && (
                      <button
                        className="btn-editar"
                        title="Marcar como devuelto"
                        onClick={() => devolver(item)}
                      >🔙</button>
                    )}
                    <button className="btn-editar" onClick={() => cargarParaEditar(item)} title="Editar">✏️</button>
                    <button className="btn-eliminar" onClick={() => eliminar(item)} title="Eliminar">✕</button>
                  </div>
                </div>
              );
            })}
          </div>
        ))
      )}

      {/* ── Modal registrar venta ── */}
      {ventaModal && (
        <div className="modal-overlay" onClick={() => setVentaModal(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: "1rem" }}>
                💰 Registrar venta — {ventaModal.producto_nombre}
              </h3>
              <button onClick={() => setVentaModal(null)}
                style={{ background: "none", border: "none", fontSize: "1.2rem", cursor: "pointer" }}>✕</button>
            </div>

            <div style={{ fontSize: "0.82rem", color: "var(--gris-sub)", marginBottom: 14, display: "flex", gap: 12 }}>
              <span>📍 {ventaModal.consignatario}</span>
              <span>🟡 Disponibles: <strong>{ventaModal.cantidad - Number(ventaModal.unidades_vendidas || 0)}</strong></span>
              {Number(ventaModal.precio_sugerido) > 0 && (
                <span>💲 Sugerido: <strong>{fmt(ventaModal.precio_sugerido)}</strong></span>
              )}
            </div>

            <form onSubmit={registrarVenta} className="venta-form">
              <div className="form-row">
                <label className="form-label">
                  <span>Cantidad vendida</span>
                  <input type="number" min="1"
                    max={ventaModal.cantidad - Number(ventaModal.unidades_vendidas || 0)}
                    value={ventaForm.cantidad}
                    onChange={(e) => setVentaForm((f) => ({ ...f, cantidad: e.target.value }))}
                    autoFocus
                  />
                </label>
                <label className="form-label">
                  <span>Precio de venta (ARS)</span>
                  <input type="number" min="0"
                    value={ventaForm.precio_venta}
                    onChange={(e) => setVentaForm((f) => ({ ...f, precio_venta: e.target.value }))}
                  />
                </label>
                <label className="form-label">
                  <span>Fecha</span>
                  <input type="date"
                    value={ventaForm.fecha}
                    onChange={(e) => setVentaForm((f) => ({ ...f, fecha: e.target.value }))}
                  />
                </label>
              </div>
              <label className="form-label">
                <span>Notas</span>
                <input type="text" value={ventaForm.notas}
                  onChange={(e) => setVentaForm((f) => ({ ...f, notas: e.target.value }))}
                  placeholder="Opcional..."
                />
              </label>
              <label className="admin-check" style={{ margin: "8px 0" }}>
                <input type="checkbox" checked={ventaForm.cobrado}
                  onChange={(e) => setVentaForm((f) => ({ ...f, cobrado: e.target.checked }))} />
                Ya lo cobraron
              </label>
              <button type="submit" className="btn-registrar">✓ Confirmar venta</button>
            </form>

            {/* Historial de ventas de esta consignación */}
            {!histLoading && ventaHist.length > 0 && (
              <div style={{ marginTop: 20, borderTop: "1px solid var(--borde)", paddingTop: 12 }}>
                <p style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--gris-sub)", marginBottom: 8 }}>
                  HISTORIAL DE VENTAS
                </p>
                {ventaHist.map((v) => (
                  <div key={v.id} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "5px 0", borderBottom: "1px solid var(--borde)", fontSize: "0.8rem",
                  }}>
                    <span>{fmtFecha(v.fecha)} · {v.cantidad} u. · {fmt(v.precio_venta)}</span>
                    {v.cobrado ? (
                      <span style={{ color: "#16a34a", fontWeight: 600 }}>✅ Cobrado</span>
                    ) : (
                      <button
                        style={{ fontSize: "0.73rem", padding: "2px 8px", background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 6, cursor: "pointer", color: "#16a34a", fontWeight: 600 }}
                        onClick={() => cobrar(ventaModal.id, v.id)}
                      >
                        Marcar cobrado
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
