import { useState, useEffect, useMemo, useRef } from "react";
import {
  fetchCompras, createCompra, updateCompra, deleteCompra,
  fetchProductosAdmin, incrementarStock, fetchDolar,
} from "../../services/admin";
import Toast from "./Toast";
import { useToast } from "../../hooks/useToast";
import { descargarCSV } from "../../utils/csv";

const hoy      = () => new Date().toISOString().split("T")[0];
const MESES    = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const fmt      = (n) => `$ ${Number(n || 0).toLocaleString("es-AR")}`;
const fmtFecha = (f) => f ? `${f.slice(8,10)}/${f.slice(5,7)}` : "—";

const FORM_VACIO = {
  fecha: hoy(), proveedor: "", producto_id: "", producto_nombre: "",
  cantidad: 1, precio_costo_usd: 0, dolar_dia: "", costo_caja_usd: 0, notas: "",
};

export default function ComprasAdmin() {
  const now = new Date();
  const [mes,  setMes]  = useState(now.getMonth() + 1);
  const [anio, setAnio] = useState(now.getFullYear());

  const [compras,   setCompras]   = useState([]);
  const [productos, setProductos] = useState([]);
  const [form,      setForm]      = useState(FORM_VACIO);
  const [busqProd,  setBusqProd]  = useState("");
  const [dropOpen,  setDropOpen]  = useState(false);
  const [guardando,  setGuardando]  = useState(false);
  const [loading,    setLoading]    = useState(true);
  const [editandoId, setEditandoId] = useState(null);
  const { toast, mostrar, cerrar } = useToast();
  const inputRef  = useRef();
  const formRef   = useRef();

  const cargar = () =>
    fetchCompras(mes, anio).then((d) => { setCompras(d); setLoading(false); });

  useEffect(() => { fetchProductosAdmin().then(setProductos); }, []);
  useEffect(() => { fetchDolar().then((d) => setForm((f) => ({ ...f, dolar_dia: d }))); }, []);
  useEffect(() => { setLoading(true); cargar(); }, [mes, anio]);

  // ── Buscador de producto ──────────────────────────────
  const prodsFiltrados = useMemo(() =>
    busqProd.length > 0
      ? productos.filter((p) =>
          p.nombre.toLowerCase().includes(busqProd.toLowerCase()) ||
          p.marca.toLowerCase().includes(busqProd.toLowerCase())
        ).slice(0, 8)
      : [],
  [busqProd, productos]);

  const seleccionarProducto = (p) => {
    setForm((f) => ({
      ...f,
      producto_id:      p.id,
      producto_nombre:  p.nombre,
      precio_costo_usd: p.precio_costo_usd || 0,
    }));
    setBusqProd(p.nombre);
    setDropOpen(false);
  };

  const totalCompraUSD = useMemo(() =>
    (Number(form.precio_costo_usd) || 0) * (Number(form.cantidad) || 1),
  [form.precio_costo_usd, form.cantidad]);

  const totalCompraARS = useMemo(() =>
    totalCompraUSD * (Number(form.dolar_dia) || 0),
  [totalCompraUSD, form.dolar_dia]);

  // ── Registrar compra ──────────────────────────────────
  const cargarParaEditar = (c) => {
    setEditandoId(c.id);
    setForm({
      fecha:            c.fecha            || hoy(),
      proveedor:        c.proveedor        || "",
      producto_id:      c.producto_id      || "",
      producto_nombre:  c.producto_nombre  || "",
      cantidad:         c.cantidad         || 1,
      precio_costo_usd: c.precio_costo_unitario || 0,
      costo_caja_usd:   c.costo_caja_usd   || 0,
      dolar_dia:        c.dolar_dia        || "",
      notas:            c.notas            || "",
    });
    setBusqProd(c.producto_nombre || "");
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };

  const cancelarEdicion = () => {
    setEditandoId(null);
    setForm({ ...FORM_VACIO, fecha: hoy() });
    setBusqProd("");
  };

  const registrar = async (e) => {
    e.preventDefault();
    if (!form.producto_nombre) return;
    setGuardando(true);
    const payload = {
      fecha:                 form.fecha,
      proveedor:             form.proveedor,
      producto_id:           form.producto_id || null,
      producto_nombre:       form.producto_nombre,
      cantidad:              Number(form.cantidad),
      precio_costo_unitario: Number(form.precio_costo_usd),
      costo_caja_usd:        Number(form.costo_caja_usd) || 0,
      dolar_dia:             Number(form.dolar_dia) || 0,
      total_ars:             totalCompraARS,
      notas:                 form.notas,
    };
    try {
      if (editandoId) {
        await updateCompra(editandoId, payload);
        setEditandoId(null);
        mostrar("Compra actualizada");
      } else {
        await createCompra(payload);
        if (form.producto_id) await incrementarStock(form.producto_id, Number(form.cantidad));
        mostrar("Compra registrada");
      }
      setForm({ ...FORM_VACIO, fecha: form.fecha });
      setBusqProd("");
      cargar();
    } catch (err) {
      console.error(err);
      mostrar("Error al guardar", "error");
    } finally {
      setGuardando(false);
    }
  };

  const eliminar = async (id) => {
    if (!confirm("¿Eliminar esta compra? El stock NO se revertirá automáticamente.")) return;
    try {
      await deleteCompra(id);
      cargar();
      mostrar("Compra eliminada", "warn");
    } catch { mostrar("Error al eliminar", "error"); }
  };

  // ── Stats ─────────────────────────────────────────────
  const stats = useMemo(() => ({
    cantidad:   compras.length,
    totalARS:   compras.reduce((s, c) => s + (c.total_ars || 0), 0),
    unidades:   compras.reduce((s, c) => s + (c.cantidad || 0), 0),
    totalCajaUSD: compras.reduce((s, c) => s + ((c.costo_caja_usd || 0) * (c.cantidad || 0)), 0),
  }), [compras]);

  return (
    <div>
      <Toast mensaje={toast.mensaje} tipo={toast.tipo} onClose={cerrar} />
      {/* Selector período */}
      <div className="admin-periodo">
        <select value={mes}  onChange={(e) => setMes(Number(e.target.value))}>
          {MESES.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
        </select>
        <select value={anio} onChange={(e) => setAnio(Number(e.target.value))}>
          {[new Date().getFullYear()-1, new Date().getFullYear(), new Date().getFullYear()+1].map((a) => <option key={a}>{a}</option>)}
        </select>
      </div>

      {/* Stats */}
      <div className="admin-stats">
        <div className="stat-card">
          <span className="stat-num">{stats.cantidad}</span>
          <span className="stat-label">Compras</span>
        </div>
        <div className="stat-card">
          <span className="stat-num">{stats.unidades}</span>
          <span className="stat-label">Unidades repuestas</span>
        </div>
        <div className="stat-card warning">
          <span className="stat-num" style={{ fontSize: "1.1rem" }}>{fmt(stats.totalARS)}</span>
          <span className="stat-label">Total invertido ARS</span>
        </div>
        {stats.totalCajaUSD > 0 && (
          <div className="stat-card">
            <span className="stat-num" style={{ fontSize: "1.1rem" }}>USD {Number(stats.totalCajaUSD).toLocaleString("es-AR")}</span>
            <span className="stat-label">Total cajas USD</span>
          </div>
        )}
      </div>

      {/* Formulario */}
      <div className="admin-form-card" ref={formRef}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
          <h3 className="admin-form-title" style={{ margin:0 }}>
            {editandoId ? "✏️ Editando compra" : "+ Registrar compra"}
          </h3>
          {editandoId && (
            <button type="button" onClick={cancelarEdicion}
              style={{ background:"none", border:"1.5px solid #ddd", borderRadius:8, padding:"5px 14px", fontSize:"0.82rem", cursor:"pointer", color:"var(--gris-txt)" }}>
              ✕ Cancelar
            </button>
          )}
        </div>
        {editandoId && (
          <div style={{ background:"#fff8e1", border:"1.5px solid #ffd54f", borderRadius:8, padding:"8px 12px", marginBottom:14, fontSize:"0.82rem", color:"#856404", fontWeight:600 }}>
            ✏️ Editando compra existente — el stock <strong>no</strong> se ajustará al guardar
          </div>
        )}
        <form onSubmit={registrar} className="venta-form">

          {/* Fila 1: fecha, proveedor */}
          <div className="form-row">
            <label className="form-label">
              <span>Fecha</span>
              <input type="date" value={form.fecha} onChange={(e) => setForm((f) => ({ ...f, fecha: e.target.value }))} />
            </label>
            <label className="form-label" style={{ flex: 2 }}>
              <span>Proveedor</span>
              <input type="text" value={form.proveedor} onChange={(e) => setForm((f) => ({ ...f, proveedor: e.target.value }))} placeholder="Nombre del proveedor..." />
            </label>
          </div>

          {/* Producto buscador */}
          <div className="form-label" style={{ position: "relative" }}>
            <span>Producto</span>
            <input
              ref={inputRef}
              type="text"
              placeholder="Buscá por nombre o marca..."
              value={busqProd}
              onChange={(e) => {
                setBusqProd(e.target.value);
                setDropOpen(true);
                setForm((f) => ({ ...f, producto_id: "", producto_nombre: e.target.value }));
              }}
              onFocus={() => setDropOpen(true)}
              onBlur={() => setTimeout(() => setDropOpen(false), 150)}
              autoComplete="off"
            />
            {dropOpen && prodsFiltrados.length > 0 && (
              <ul className="prod-dropdown">
                {prodsFiltrados.map((p) => (
                  <li key={p.id} onMouseDown={() => seleccionarProducto(p)}>
                    <div className="prod-drop-main">
                      {p.foto && <img src={p.foto} alt="" className="prod-drop-img" />}
                      <div>
                        <strong>{p.es_caja ? "🗃️ " : ""}{p.nombre}</strong>
                        <span className="prod-drop-marca">{p.marca} · {p.categoria}</span>
                      </div>
                    </div>
                    <span className="prod-drop-precio" style={{ color: "var(--gris-txt)" }}>
                      Stock: {p.stock ?? 0}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Fila 2: cantidad, costo USD, dólar, notas */}
          <div className="form-row">
            <label className="form-label">
              <span>Cantidad</span>
              <input type="number" min="1" value={form.cantidad}
                onChange={(e) => setForm((f) => ({ ...f, cantidad: e.target.value }))} />
            </label>
            <label className="form-label">
              <span>Costo unitario (USD)</span>
              <input type="number" min="0" step="0.01" value={form.precio_costo_usd}
                onChange={(e) => setForm((f) => ({ ...f, precio_costo_usd: e.target.value }))} />
            </label>
            <label className="form-label">
              <span>Dólar del día ($)</span>
              <input type="number" min="0" value={form.dolar_dia}
                onChange={(e) => setForm((f) => ({ ...f, dolar_dia: e.target.value }))}
                placeholder="Ej: 1250" />
            </label>
            <label className="form-label">
              <span>Costo caja (USD) <span style={{fontWeight:400,color:"var(--gris-sub)"}}>c/u</span></span>
              <input type="number" min="0" step="0.5" value={form.costo_caja_usd}
                onChange={(e) => setForm((f) => ({ ...f, costo_caja_usd: e.target.value }))}
                placeholder="0" />
            </label>
            <label className="form-label">
              <span>Notas</span>
              <input type="text" value={form.notas}
                onChange={(e) => setForm((f) => ({ ...f, notas: e.target.value }))}
                placeholder="Observaciones..." />
            </label>
          </div>

          {/* Preview */}
          {form.producto_nombre && (
            <div className="venta-preview">
              <span>{form.cantidad} × {form.producto_nombre}</span>
              <span>USD <strong>{totalCompraUSD.toLocaleString("es-AR")}</strong></span>
              {Number(form.dolar_dia) > 0 && (
                <span>→ <strong>{fmt(totalCompraARS)}</strong></span>
              )}
              {Number(form.costo_caja_usd) > 0 && (
                <span className="venta-preview-medio">🗃️ Caja: USD {Number(form.costo_caja_usd).toLocaleString("es-AR")} c/u</span>
              )}
              <span className="venta-preview-medio">📦 +{form.cantidad} al stock</span>
            </div>
          )}

          <button type="submit" className="btn-registrar" disabled={guardando || !form.producto_nombre}>
            {guardando ? "Guardando..." : editandoId ? "✓ Guardar cambios" : "✓ Registrar compra"}
          </button>
        </form>
      </div>

      {/* Lista */}
      <div className="admin-lista-ventas">
        <div className="admin-lista-toolbar">
          <h3 className="admin-form-title" style={{ margin:0 }}>{MESES[mes-1]} {anio} — {compras.length} compras</h3>
          <button className="btn-csv" onClick={() => descargarCSV(
            compras,
            ["fecha","producto_nombre","proveedor","cantidad","precio_costo_unitario","costo_caja_usd","dolar_dia","total_ars","notas"],
            ["Fecha","Producto","Proveedor","Cantidad","Costo unit. USD","Costo caja USD","Dólar","Total ARS","Notas"],
            `compras-${MESES[mes-1].toLowerCase()}-${anio}`
          )} disabled={!compras.length}>⬇ CSV</button>
        </div>
        {loading ? <p className="estado">Cargando...</p> : compras.length === 0 ? (
          <p className="admin-empty">No hay compras registradas este mes.</p>
        ) : (
          <div className="admin-lista">
            <div className="admin-lista-header compra-grid">
              <span>Fecha</span>
              <span>Producto</span>
              <span>Proveedor</span>
              <span>Cant.</span>
              <span>Costo USD</span>
              <span>Dólar</span>
              <span>Total ARS</span>
              <span></span>
            </div>
            {compras.map((c) => (
              <div key={c.id} className="admin-lista-row compra-grid">
                <span className="admin-lista-sub">{fmtFecha(c.fecha)}</span>
                <div style={{ minWidth: 0 }}>
                  <span style={{ fontSize: "0.83rem", fontWeight: 700, color: "var(--negro)", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.producto_nombre}</span>
                  {c.notas && <span className="admin-lista-sub">{c.notas}</span>}
                </div>
                <span className="admin-lista-sub">{c.proveedor || "—"}</span>
                <span className="admin-lista-sub" style={{ textAlign: "center" }}>{c.cantidad}</span>
                <span className="admin-lista-sub">USD {Number(c.precio_costo_unitario || 0).toLocaleString("es-AR")}</span>
                <span className="admin-lista-sub">{c.dolar_dia > 0 ? `$${Number(c.dolar_dia).toLocaleString("es-AR")}` : "—"}</span>
                <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--negro)" }}>{fmt(c.total_ars)}</span>
                <div style={{ display:"flex", gap:4 }}>
                  <button className="btn-editar" onClick={() => cargarParaEditar(c)} title="Editar">✏️</button>
                  <button className="btn-eliminar" onClick={() => eliminar(c.id)} title="Eliminar">✕</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
