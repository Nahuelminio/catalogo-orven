import { useState, useEffect, useMemo } from "react";
import { fetchGastos, createGasto, deleteGasto } from "../../services/admin";
import Toast from "./Toast";
import { useToast } from "../../hooks/useToast";

const hoy = () => new Date().toISOString().split("T")[0];
const CATEGORIAS = ["CM/Plataformas", "Logística", "Operativo", "Otros"];
const FORM_VACIO = { fecha: hoy(), descripcion: "", categoria: "Operativo", monto_ars: "", monto_usd: "", comprobante: "", notas: "" };

export default function GastosAdmin() {
  const now = new Date();
  const [mes, setMes]     = useState(now.getMonth() + 1);
  const [anio, setAnio]   = useState(now.getFullYear());
  const [gastos, setGastos]   = useState([]);
  const [form, setForm]       = useState(FORM_VACIO);
  const [guardando, setGuardando] = useState(false);
  const [loading, setLoading] = useState(true);
  const { toast, mostrar, cerrar } = useToast();

  const cargarGastos = () =>
    fetchGastos(mes, anio).then((d) => { setGastos(d); setLoading(false); });

  useEffect(() => {
    setLoading(true);
    cargarGastos();
  }, [mes, anio]);

  const agregar = async (e) => {
    e.preventDefault();
    if (!form.descripcion || (!form.monto_ars && !form.monto_usd)) return;
    setGuardando(true);
    try {
      await createGasto({
        fecha:       form.fecha,
        descripcion: form.descripcion,
        categoria:   form.categoria,
        monto_ars:   Number(form.monto_ars)  || 0,
        monto_usd:   Number(form.monto_usd)  || 0,
        comprobante: form.comprobante,
        notas:       form.notas,
      });
      setForm({ ...FORM_VACIO, fecha: form.fecha });
      cargarGastos();
      mostrar("Gasto registrado");
    } catch (err) {
      console.error(err);
      mostrar("Error al registrar", "error");
    } finally {
      setGuardando(false);
    }
  };

  const eliminar = async (id) => {
    if (!confirm("¿Eliminar este gasto?")) return;
    await deleteGasto(id);
    cargarGastos();
    mostrar("Gasto eliminado", "warn");
  };

  const stats = useMemo(() => {
    const porCat = CATEGORIAS.map((cat) => ({
      cat,
      total: gastos.filter((g) => g.categoria === cat).reduce((s, g) => s + (g.monto_ars || 0), 0),
    }));
    return {
      totalARS: gastos.reduce((s, g) => s + (g.monto_ars || 0), 0),
      totalUSD: gastos.reduce((s, g) => s + (g.monto_usd || 0), 0),
      cantidad: gastos.length,
      porCat,
    };
  }, [gastos]);

  const fmt    = (n) => `$ ${Number(n || 0).toLocaleString("es-AR")}`;
  const fmtUSD = (n) => `USD ${Number(n || 0).toLocaleString("es-AR")}`;
  const MESES  = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

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
        <div className="stat-card"><span className="stat-num">{stats.cantidad}</span><span className="stat-label">Gastos</span></div>
        <div className="stat-card warning"><span className="stat-num" style={{fontSize:"1.2rem"}}>{fmt(stats.totalARS)}</span><span className="stat-label">Total ARS</span></div>
        {stats.totalUSD > 0 && <div className="stat-card"><span className="stat-num" style={{fontSize:"1.2rem"}}>{fmtUSD(stats.totalUSD)}</span><span className="stat-label">Total USD</span></div>}
        <div className="stat-card muted" style={{gridColumn: stats.totalUSD > 0 ? "auto" : "span 2"}}>
          {stats.porCat.filter(c => c.total > 0).map(({ cat, total }) => (
            <div key={cat} style={{display:"flex",justifyContent:"space-between",fontSize:"0.72rem",color:"var(--gris-txt)"}}>
              <span>{cat}</span><span style={{fontWeight:700}}>{fmt(total)}</span>
            </div>
          ))}
          <span className="stat-label">Por categoría</span>
        </div>
      </div>

      {/* Formulario */}
      <div className="admin-form-card">
        <h3 className="admin-form-title">+ Agregar gasto</h3>
        <form onSubmit={agregar} className="venta-form">
          <div className="form-row">
            <label className="form-label">
              <span>Fecha</span>
              <input type="date" value={form.fecha} onChange={(e) => setForm((f) => ({ ...f, fecha: e.target.value }))} />
            </label>
            <label className="form-label" style={{flex:2}}>
              <span>Descripción</span>
              <input type="text" required placeholder="Ej: Renovación CM, envío Correo..." value={form.descripcion} onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))} />
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
              <span>Comprobante #</span>
              <input type="text" value={form.comprobante} onChange={(e) => setForm((f) => ({ ...f, comprobante: e.target.value }))} placeholder="Opcional" />
            </label>
            <label className="form-label">
              <span>Notas</span>
              <input type="text" value={form.notas} onChange={(e) => setForm((f) => ({ ...f, notas: e.target.value }))} placeholder="..." />
            </label>
          </div>
          <button type="submit" className="btn-registrar" disabled={guardando || !form.descripcion}>
            {guardando ? "Guardando..." : "✓ Agregar gasto"}
          </button>
        </form>
      </div>

      {/* Lista */}
      <div className="admin-lista-ventas">
        <h3 className="admin-form-title">{MESES[mes-1]} {anio} — {gastos.length} gastos</h3>
        {loading ? <p className="estado">Cargando...</p> : gastos.length === 0 ? (
          <p className="admin-empty">No hay gastos registrados este mes.</p>
        ) : (
          <div className="admin-lista">
            <div className="admin-lista-header" style={{gridTemplateColumns:"90px 1fr 120px 110px 110px 36px"}}>
              <span>Fecha</span><span>Descripción</span><span>Categoría</span><span>Monto ARS</span><span>Monto USD</span><span></span>
            </div>
            {gastos.map((g) => (
              <div key={g.id} className="admin-lista-row" style={{gridTemplateColumns:"90px 1fr 120px 110px 110px 36px"}}>
                <span className="admin-lista-sub">{g.fecha}</span>
                <div>
                  <span style={{fontSize:"0.85rem",fontWeight:600,color:"var(--negro)"}}>{g.descripcion}</span>
                  {g.notas && <span className="admin-lista-sub"> — {g.notas}</span>}
                </div>
                <span className={`badge-categoria cat-${g.categoria.split("/")[0].toLowerCase()}`}>{g.categoria}</span>
                <span style={{fontSize:"0.85rem",fontWeight:700,color:"var(--negro)"}}>{g.monto_ars > 0 ? fmt(g.monto_ars) : "—"}</span>
                <span style={{fontSize:"0.85rem",fontWeight:700,color:"var(--gris-txt)"}}>{g.monto_usd > 0 ? fmtUSD(g.monto_usd) : "—"}</span>
                <button className="btn-eliminar" onClick={() => eliminar(g.id)} title="Eliminar">✕</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
