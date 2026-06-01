import { useState, useEffect, useMemo } from "react";
import { fetchIngresos, createIngreso, deleteIngreso } from "../../services/admin";
import Toast from "./Toast";
import { useToast } from "../../hooks/useToast";

const hoy = () => new Date().toISOString().split("T")[0];
const CATEGORIAS = ["Venta mayorista", "Consignación", "Transferencia cliente", "Reembolso", "Otro"];
const MEDIOS_PAGO = ["Efectivo", "Transferencia", "Débito", "Crédito", "MercadoPago", "Otro"];
const FORM_VACIO = { fecha: hoy(), descripcion: "", categoria: "Otro", monto_ars: "", monto_usd: "", medio_pago: "Transferencia", notas: "" };
const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

const fmt    = (n) => `$ ${Number(n || 0).toLocaleString("es-AR")}`;
const fmtUSD = (n) => `USD ${Number(n || 0).toLocaleString("es-AR")}`;

export default function IngresosAdmin() {
  const now = new Date();
  const [mes,  setMes]  = useState(now.getMonth() + 1);
  const [anio, setAnio] = useState(now.getFullYear());

  const [ingresos,  setIngresos]  = useState([]);
  const [form,      setForm]      = useState(FORM_VACIO);
  const [guardando, setGuardando] = useState(false);
  const [loading,   setLoading]   = useState(true);
  const { toast, mostrar, cerrar } = useToast();

  const cargarIngresos = () =>
    fetchIngresos(mes, anio).then((d) => { setIngresos(d); setLoading(false); });

  useEffect(() => { setLoading(true); cargarIngresos(); }, [mes, anio]);

  const agregar = async (e) => {
    e.preventDefault();
    if (!form.descripcion || (!form.monto_ars && !form.monto_usd)) return;
    setGuardando(true);
    try {
      await createIngreso({
        fecha:       form.fecha,
        descripcion: form.descripcion,
        categoria:   form.categoria,
        monto_ars:   Number(form.monto_ars) || 0,
        monto_usd:   Number(form.monto_usd) || 0,
        medio_pago:  form.medio_pago,
        notas:       form.notas,
      });
      setForm({ ...FORM_VACIO, fecha: form.fecha });
      cargarIngresos();
      mostrar("Ingreso registrado");
    } catch (err) {
      console.error(err);
      mostrar("Error al registrar", "error");
    } finally {
      setGuardando(false);
    }
  };

  const eliminar = async (id) => {
    if (!confirm("¿Eliminar este ingreso?")) return;
    await deleteIngreso(id);
    cargarIngresos();
    mostrar("Ingreso eliminado", "warn");
  };

  const stats = useMemo(() => {
    const totalARS = ingresos.reduce((s, i) => s + (i.monto_ars || 0), 0);
    const totalUSD = ingresos.reduce((s, i) => s + (i.monto_usd || 0), 0);
    const porCat   = CATEGORIAS.map((cat) => ({
      cat,
      total: ingresos.filter((i) => i.categoria === cat).reduce((s, i) => s + (i.monto_ars || 0), 0),
    })).filter((c) => c.total > 0);
    return { totalARS, totalUSD, cantidad: ingresos.length, porCat };
  }, [ingresos]);

  return (
    <div>
      <Toast mensaje={toast.mensaje} tipo={toast.tipo} onClose={cerrar} />
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
        <div className="stat-card">
          <span className="stat-num">{stats.cantidad}</span>
          <span className="stat-label">Ingresos</span>
        </div>
        <div className="stat-card success">
          <span className="stat-num" style={{ fontSize: "1.1rem" }}>{fmt(stats.totalARS)}</span>
          <span className="stat-label">Total ARS</span>
        </div>
        {stats.totalUSD > 0 && (
          <div className="stat-card">
            <span className="stat-num" style={{ fontSize: "1.1rem" }}>{fmtUSD(stats.totalUSD)}</span>
            <span className="stat-label">Total USD</span>
          </div>
        )}
        {stats.porCat.length > 0 && (
          <div className="stat-card muted">
            {stats.porCat.map(({ cat, total }) => (
              <div key={cat} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem", color: "var(--gris-txt)" }}>
                <span>{cat}</span>
                <span style={{ fontWeight: 700 }}>{fmt(total)}</span>
              </div>
            ))}
            <span className="stat-label">Por categoría</span>
          </div>
        )}
      </div>

      {/* Formulario */}
      <div className="admin-form-card">
        <h3 className="admin-form-title">+ Registrar ingreso</h3>
        <form onSubmit={agregar} className="venta-form">
          <div className="form-row">
            <label className="form-label">
              <span>Fecha</span>
              <input type="date" value={form.fecha} onChange={(e) => setForm((f) => ({ ...f, fecha: e.target.value }))} />
            </label>
            <label className="form-label" style={{ flex: 2 }}>
              <span>Descripción</span>
              <input type="text" required placeholder="Ej: Pago cliente Juan, cobro consignación..." value={form.descripcion} onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))} />
            </label>
            <label className="form-label">
              <span>Categoría</span>
              <select value={form.categoria} onChange={(e) => setForm((f) => ({ ...f, categoria: e.target.value }))}>
                {CATEGORIAS.map((c) => <option key={c}>{c}</option>)}
              </select>
            </label>
          </div>
          <div className="form-row">
            <label className="form-label">
              <span>Monto ARS</span>
              <input type="number" min="0" value={form.monto_ars} onChange={(e) => setForm((f) => ({ ...f, monto_ars: e.target.value }))} placeholder="0" />
            </label>
            <label className="form-label">
              <span>Monto USD (opcional)</span>
              <input type="number" min="0" value={form.monto_usd} onChange={(e) => setForm((f) => ({ ...f, monto_usd: e.target.value }))} placeholder="0" />
            </label>
            <label className="form-label">
              <span>Medio de pago</span>
              <select value={form.medio_pago} onChange={(e) => setForm((f) => ({ ...f, medio_pago: e.target.value }))}>
                {MEDIOS_PAGO.map((m) => <option key={m}>{m}</option>)}
              </select>
            </label>
            <label className="form-label">
              <span>Notas</span>
              <input type="text" value={form.notas} onChange={(e) => setForm((f) => ({ ...f, notas: e.target.value }))} placeholder="..." />
            </label>
          </div>
          <button type="submit" className="btn-registrar" disabled={guardando || !form.descripcion}>
            {guardando ? "Guardando..." : "✓ Registrar ingreso"}
          </button>
        </form>
      </div>

      {/* Lista */}
      <div className="admin-lista-ventas">
        <h3 className="admin-form-title">{MESES[mes-1]} {anio} — {ingresos.length} ingresos</h3>
        {loading ? <p className="estado">Cargando...</p> : ingresos.length === 0 ? (
          <p className="admin-empty">No hay ingresos registrados este mes.</p>
        ) : (
          <div className="admin-lista">
            <div className="admin-lista-header" style={{ gridTemplateColumns: "90px 1fr 150px 110px 110px 110px 36px" }}>
              <span>Fecha</span>
              <span>Descripción</span>
              <span>Categoría</span>
              <span>Monto ARS</span>
              <span>Monto USD</span>
              <span>Medio pago</span>
              <span></span>
            </div>
            {ingresos.map((ing) => (
              <div key={ing.id} className="admin-lista-row" style={{ gridTemplateColumns: "90px 1fr 150px 110px 110px 110px 36px" }}>
                <span className="admin-lista-sub">{ing.fecha}</span>
                <div>
                  <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--negro)" }}>{ing.descripcion}</span>
                  {ing.notas && <span className="admin-lista-sub"> — {ing.notas}</span>}
                </div>
                <span className="badge-tipo minorista" style={{ fontSize: "0.72rem" }}>{ing.categoria}</span>
                <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--rojo)" }}>
                  {ing.monto_ars > 0 ? fmt(ing.monto_ars) : "—"}
                </span>
                <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--gris-txt)" }}>
                  {ing.monto_usd > 0 ? fmtUSD(ing.monto_usd) : "—"}
                </span>
                <span className="admin-lista-sub">{ing.medio_pago || "—"}</span>
                <button className="btn-eliminar" onClick={() => eliminar(ing.id)} title="Eliminar">✕</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
