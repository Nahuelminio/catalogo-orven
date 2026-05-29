import { useState, useEffect, useMemo, useRef } from "react";
import { fetchVentas, createVenta, deleteVenta, fetchProductosAdmin, fetchCajas, decrementarStock, fetchDolar } from "../../services/admin";

const hoy = () => new Date().toISOString().split("T")[0];

const CANALES     = ["Mostrador", "Instagram", "WhatsApp", "MercadoLibre", "Otro"];
const MEDIOS_PAGO = ["Efectivo", "Transferencia", "Débito", "Crédito 1c", "Crédito 3c", "Crédito 6c", "MercadoPago", "Otro"];
const MESES       = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

const FORM_VACIO = {
  fecha: hoy(), producto_id: "", producto_nombre: "", marca: "", categoria: "",
  cantidad: 1, precio_unitario: 0, costo_unitario: 0,
  descuento_pct: 0, medio_pago: "Efectivo",
  tipo: "minorista", canal: "Mostrador", cliente: "", notas: "",
  con_caja: false, producto_caja_id: "", precio_caja_usd: 0,
};

const fmt    = (n) => `$ ${Number(n || 0).toLocaleString("es-AR")}`;
const fmtUSD = (n) => `USD ${Number(n || 0).toLocaleString("es-AR")}`;

export default function VentasAdmin() {
  const now = new Date();
  const [mes,  setMes]  = useState(now.getMonth() + 1);
  const [anio, setAnio] = useState(now.getFullYear());

  const [ventas,    setVentas]    = useState([]);
  const [productos, setProductos] = useState([]);
  const [cajas,     setCajas]     = useState([]);
  const [dolar,     setDolar]     = useState(1200);
  const [form,      setForm]      = useState(FORM_VACIO);
  const [busqProd,  setBusqProd]  = useState("");
  const [dropOpen,  setDropOpen]  = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [loading,   setLoading]   = useState(true);
  const inputRef = useRef();

  const cargarVentas = () =>
    fetchVentas(mes, anio).then((d) => { setVentas(d); setLoading(false); });

  useEffect(() => { fetchProductosAdmin().then(setProductos); }, []);
  useEffect(() => { fetchCajas().then(setCajas); }, []);
  useEffect(() => { fetchDolar().then(setDolar); }, []);
  useEffect(() => { setLoading(true); cargarVentas(); }, [mes, anio]);

  // ── Producto seleccionado ──────────────────────────────
  const prodsFiltrados = useMemo(() =>
    busqProd.length > 0
      ? productos.filter((p) =>
          p.nombre.toLowerCase().includes(busqProd.toLowerCase()) ||
          p.marca.toLowerCase().includes(busqProd.toLowerCase())
        ).slice(0, 8)
      : [],
  [busqProd, productos]);

  const seleccionarProducto = (p) => {
    const precio     = form.tipo === "mayorista" ? p.precio_mayorista : p.precio_minorista;
    const cajaMatch  = cajas.find((c) => c.marca?.toLowerCase() === p.marca?.toLowerCase());
    setForm((f) => ({
      ...f,
      producto_id:      p.id,
      producto_nombre:  p.nombre,
      marca:            p.marca,
      categoria:        p.categoria,
      precio_unitario:  precio || 0,
      costo_unitario:   Math.round((p.precio_costo_usd || 0) * dolar),
      producto_caja_id: cajaMatch?.id || "",
      precio_caja_usd:  cajaMatch?.precio_mayorista || 0,
    }));
    setBusqProd(p.nombre);
    setDropOpen(false);
  };

  const handleTipo = (tipo) => {
    const prod = productos.find((p) => p.id === form.producto_id);
    const precio = prod
      ? (tipo === "mayorista" ? prod.precio_mayorista : prod.precio_minorista)
      : form.precio_unitario;
    setForm((f) => ({ ...f, tipo, precio_unitario: precio || 0 }));
  };

  // ── Cálculos ──────────────────────────────────────────
  const precioConDescuento = useMemo(() => {
    const base = Number(form.precio_unitario) || 0;
    const desc = Number(form.descuento_pct)   || 0;
    return base * (1 - desc / 100);
  }, [form.precio_unitario, form.descuento_pct]);

  const totalVenta = useMemo(() =>
    precioConDescuento * (Number(form.cantidad) || 1),
  [precioConDescuento, form.cantidad]);

  const gananciaVenta = useMemo(() =>
    (precioConDescuento - (Number(form.costo_unitario) || 0)) * (Number(form.cantidad) || 1),
  [precioConDescuento, form.costo_unitario, form.cantidad]);

  // ── Registrar ─────────────────────────────────────────
  const registrar = async (e) => {
    e.preventDefault();
    if (!form.producto_nombre) return;
    setGuardando(true);
    try {
      await createVenta({
        fecha:           form.fecha,
        producto_id:     form.producto_id || null,
        producto_nombre: form.producto_nombre,
        marca:           form.marca,
        categoria:       form.categoria,
        cantidad:        Number(form.cantidad),
        precio_unitario: precioConDescuento,
        costo_unitario:  Number(form.costo_unitario),
        descuento_pct:   Number(form.descuento_pct) || 0,
        medio_pago:      form.medio_pago,
        tipo:            form.tipo,
        canal:           form.canal,
        cliente:         form.cliente,
        notas:           form.notas,
        total_ars:       form.tipo === "minorista" ? totalVenta : 0,
        total_usd:       form.tipo === "mayorista" ? totalVenta : 0,
        con_caja:        form.con_caja,
        precio_caja_usd: form.con_caja ? Number(form.precio_caja_usd) || 0 : 0,
      });
      if (form.producto_id) {
        await decrementarStock(form.producto_id, Number(form.cantidad));
      }
      if (form.con_caja && form.producto_caja_id) {
        await decrementarStock(form.producto_caja_id, Number(form.cantidad));
      }
      setForm({ ...FORM_VACIO, fecha: form.fecha });
      setBusqProd("");
      cargarVentas();
    } catch (err) {
      console.error(err);
    } finally {
      setGuardando(false);
    }
  };

  const eliminar = async (id) => {
    if (!confirm("¿Eliminar esta venta?\nNota: el stock del producto NO se restaurará automáticamente.")) return;
    await deleteVenta(id);
    cargarVentas();
  };

  // ── Stats ─────────────────────────────────────────────
  const stats = useMemo(() => {
    const totalARS  = ventas.filter((v) => v.tipo === "minorista").reduce((s, v) => s + (v.total_ars || v.precio_unitario * v.cantidad), 0);
    const totalUSD  = ventas.filter((v) => v.tipo === "mayorista").reduce((s, v) => s + (v.total_usd || v.precio_unitario * v.cantidad), 0);
    const costoTotal = ventas.reduce((s, v) => s + (v.costo_unitario || 0) * v.cantidad, 0);
    return {
      totalARS, totalUSD, costoTotal,
      ganancia: totalARS - costoTotal,
      unidades: ventas.reduce((s, v) => s + v.cantidad, 0),
    };
  }, [ventas]);

  return (
    <div>
      {/* Selector período */}
      <div className="admin-periodo">
        <select value={mes}  onChange={(e) => setMes(Number(e.target.value))}>
          {MESES.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
        </select>
        <select value={anio} onChange={(e) => setAnio(Number(e.target.value))}>
          {[2024,2025,2026].map((a) => <option key={a}>{a}</option>)}
        </select>
      </div>

      {/* Stats */}
      <div className="admin-stats">
        <div className="stat-card"><span className="stat-num">{stats.unidades}</span><span className="stat-label">Unidades</span></div>
        <div className="stat-card success"><span className="stat-num" style={{fontSize:"1.1rem"}}>{fmt(stats.totalARS)}</span><span className="stat-label">Facturación ARS</span></div>
        <div className="stat-card"><span className="stat-num" style={{fontSize:"1.1rem"}}>{fmtUSD(stats.totalUSD)}</span><span className="stat-label">Mayorista USD</span></div>
        <div className="stat-card warning"><span className="stat-num" style={{fontSize:"1.1rem"}}>{fmt(stats.ganancia)}</span><span className="stat-label">Ganancia bruta</span></div>
      </div>

      {/* ── Formulario ── */}
      <div className="admin-form-card">
        <h3 className="admin-form-title">+ Registrar venta</h3>
        <form onSubmit={registrar} className="venta-form">

          {/* Fila 1: fecha, tipo, canal */}
          <div className="form-row">
            <label className="form-label">
              <span>Fecha</span>
              <input type="date" value={form.fecha} onChange={(e) => setForm((f) => ({ ...f, fecha: e.target.value }))} />
            </label>
            <label className="form-label">
              <span>Tipo</span>
              <select value={form.tipo} onChange={(e) => handleTipo(e.target.value)}>
                <option value="minorista">Minorista (ARS)</option>
                <option value="mayorista">Mayorista (USD)</option>
              </select>
            </label>
            <label className="form-label">
              <span>Canal</span>
              <select value={form.canal} onChange={(e) => setForm((f) => ({ ...f, canal: e.target.value }))}>
                {CANALES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </label>
          </div>

          {/* Producto */}
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
                setForm((f) => ({ ...f, producto_id: "", producto_nombre: e.target.value, marca: "", categoria: "" }));
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
                        <strong>{p.nombre}</strong>
                        <span className="prod-drop-marca">{p.marca} · {p.categoria}</span>
                      </div>
                    </div>
                    <span className="prod-drop-precio">
                      {form.tipo === "mayorista" ? fmtUSD(p.precio_mayorista) : fmt(p.precio_minorista)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Fila 2: cantidad, precio, descuento */}
          <div className="form-row">
            <label className="form-label">
              <span>Cantidad</span>
              <input type="number" min="1" value={form.cantidad}
                onChange={(e) => setForm((f) => ({ ...f, cantidad: e.target.value }))} />
            </label>
            <label className="form-label">
              <span>Precio unitario {form.tipo === "mayorista" ? "(USD)" : "(ARS)"}</span>
              <input type="number" value={form.precio_unitario}
                onChange={(e) => setForm((f) => ({ ...f, precio_unitario: e.target.value }))} />
            </label>
            <label className="form-label">
              <span>Descuento %</span>
              <div className="input-con-sufijo">
                <input type="number" min="0" max="100" value={form.descuento_pct}
                  onChange={(e) => setForm((f) => ({ ...f, descuento_pct: e.target.value }))}
                  placeholder="0" />
                <span className="input-sufijo">%</span>
              </div>
            </label>
            <label className="form-label">
              <span>Costo ARS <span style={{fontWeight:400,color:"var(--gris-sub)"}}>@ ${dolar.toLocaleString("es-AR")}</span></span>
              <input type="number" value={form.costo_unitario}
                onChange={(e) => setForm((f) => ({ ...f, costo_unitario: e.target.value }))} />
            </label>
          </div>

          {/* Fila 3: medio de pago, cliente, notas */}
          <div className="form-row">
            <label className="form-label">
              <span>Medio de pago</span>
              <select value={form.medio_pago} onChange={(e) => setForm((f) => ({ ...f, medio_pago: e.target.value }))}>
                {MEDIOS_PAGO.map((m) => <option key={m}>{m}</option>)}
              </select>
            </label>
            <label className="form-label">
              <span>Cliente (opcional)</span>
              <input type="text" value={form.cliente}
                onChange={(e) => setForm((f) => ({ ...f, cliente: e.target.value }))}
                placeholder="Nombre del cliente" />
            </label>
            <label className="form-label">
              <span>Notas</span>
              <input type="text" value={form.notas}
                onChange={(e) => setForm((f) => ({ ...f, notas: e.target.value }))}
                placeholder="Observaciones..." />
            </label>
          </div>

          {/* Caja */}
          <div className="form-row" style={{ alignItems: "flex-end", gap: 16 }}>
            <label className="form-label" style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: "none", paddingBottom: 2 }}>
              <input
                type="checkbox"
                checked={form.con_caja}
                onChange={(e) => setForm((f) => ({ ...f, con_caja: e.target.checked }))}
                style={{ width: 16, height: 16, cursor: "pointer" }}
              />
              <span style={{ fontWeight: 600, fontSize: "0.85rem" }}>🗃️ Con caja</span>
            </label>
            {form.con_caja && (
              <label className="form-label" style={{ flex: 1 }}>
                <span>Tipo de caja</span>
                {cajas.length === 0 ? (
                  <span style={{ fontSize: "0.8rem", color: "var(--gris-sub)", padding: "8px 0", display: "block" }}>
                    No hay cajas cargadas. Creá una en Productos con "Es caja" ✓
                  </span>
                ) : (
                  <select
                    value={form.producto_caja_id}
                    onChange={(e) => {
                      const caja = cajas.find((c) => c.id === Number(e.target.value));
                      setForm((f) => ({
                        ...f,
                        producto_caja_id: e.target.value,
                        precio_caja_usd:  caja?.precio_mayorista || 0,
                      }));
                    }}
                  >
                    <option value="">— Sin caja específica —</option>
                    {cajas.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nombre}{c.marca ? ` (${c.marca})` : ""} · USD {c.precio_mayorista ?? 0} · Stock: {c.stock ?? 0}
                      </option>
                    ))}
                  </select>
                )}
              </label>
            )}
          </div>

          {/* Preview */}
          {form.precio_unitario > 0 && (
            <div className="venta-preview">
              {form.descuento_pct > 0 && (
                <span className="venta-preview-desc">
                  {form.descuento_pct}% off · precio final {form.tipo === "mayorista" ? fmtUSD(precioConDescuento) : fmt(precioConDescuento)} c/u
                </span>
              )}
              <span>
                Total: <strong>{form.tipo === "mayorista" ? fmtUSD(totalVenta) : fmt(totalVenta)}</strong>
              </span>
              {form.tipo === "minorista" && form.costo_unitario > 0 && (
                <span>· Ganancia: <strong>{fmt(gananciaVenta)}</strong></span>
              )}
              {form.con_caja && Number(form.precio_caja_usd) > 0 && (
                <span className="venta-preview-medio">🗃️ Caja: <strong>USD {Number(form.precio_caja_usd).toLocaleString("es-AR")}</strong></span>
              )}
              <span className="venta-preview-medio">💳 {form.medio_pago}</span>
            </div>
          )}

          <button type="submit" className="btn-registrar" disabled={guardando || !form.producto_nombre}>
            {guardando ? "Guardando..." : "✓ Registrar venta"}
          </button>
        </form>
      </div>

      {/* ── Lista ventas ── */}
      <div className="admin-lista-ventas">
        <h3 className="admin-form-title">{MESES[mes-1]} {anio} — {ventas.length} ventas</h3>
        {loading ? <p className="estado">Cargando...</p> : ventas.length === 0 ? (
          <p className="admin-empty">No hay ventas registradas este mes.</p>
        ) : (
          <div className="admin-lista">
            <div className="admin-lista-header venta-grid">
              <span>Fecha</span>
              <span>Producto</span>
              <span>Cant.</span>
              <span>Total</span>
              <span>Pago</span>
              <span>Canal</span>
              <span>Tipo</span>
              <span></span>
            </div>
            {ventas.map((v) => {
              const total = v.tipo === "mayorista"
                ? fmtUSD(v.total_usd || v.precio_unitario * v.cantidad)
                : fmt(v.total_ars    || v.precio_unitario * v.cantidad);
              return (
                <div key={v.id} className="admin-lista-row venta-grid">
                  <span className="admin-lista-sub">{v.fecha?.slice(5).replace("-", "/")}</span>
                  <div style={{ minWidth: 0 }}>
                    <span style={{ fontSize: "0.83rem", fontWeight: 700, color: "var(--negro)", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {v.producto_nombre}
                      {v.con_caja && <span title={`Caja: USD ${v.precio_caja_usd}`} style={{ marginLeft: 5, fontSize: "0.75rem" }}>🗃️</span>}
                    </span>
                    {v.cliente && <span className="admin-lista-sub">{v.cliente}</span>}
                    {v.descuento_pct > 0 && <span className="venta-desc-badge">-{v.descuento_pct}%</span>}
                  </div>
                  <span className="admin-lista-sub" style={{ textAlign: "center" }}>{v.cantidad}</span>
                  <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--rojo)" }}>{total}</span>
                  <span className="admin-lista-sub">{v.medio_pago || "—"}</span>
                  <span className="admin-lista-sub">{v.canal}</span>
                  <span className={`badge-tipo ${v.tipo}`}>{v.tipo}</span>
                  <button className="btn-eliminar" onClick={() => eliminar(v.id)} title="Eliminar">✕</button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
