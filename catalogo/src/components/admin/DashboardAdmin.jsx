import { useState, useEffect, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";
import { fetchVentasRango, fetchGastosRango, fetchIngresosRango, fetchComprasRango, fetchProductosAdmin, fetchSaldoInicial, fetchTotalesGenerales, updateConfig, fetchConsignaciones } from "../../services/admin";

const COLORES = ["#0e0e0e", "#b01c1c", "#555", "#888", "#bbb", "#e0e0e0"];
const MESES_ES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
const DIAS_ES  = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];

const fmt     = (n) => n >= 1000 ? `$${(n / 1000).toFixed(0)}k` : `$${n}`;
const fmtFull = (n) => `$${Number(n || 0).toLocaleString("es-AR")}`;
const toISO   = (d) => d.toISOString().split("T")[0];

// ── Helpers de fechas ──────────────────────────────────────────
function getRangoMes(mes, anio) {
  const desde = `${anio}-${String(mes).padStart(2, "0")}-01`;
  const hasta  = toISO(new Date(anio, mes, 0));
  return { desde, hasta };
}

function getRangoSemana(offset = 0) {
  const hoy  = new Date();
  const dia  = hoy.getDay(); // 0=dom
  const lunes = new Date(hoy);
  lunes.setDate(hoy.getDate() - ((dia === 0 ? 7 : dia) - 1) + offset * 7);
  const domingo = new Date(lunes);
  domingo.setDate(lunes.getDate() + 6);
  return { desde: toISO(lunes), hasta: toISO(domingo) };
}

function getRango6Meses() {
  const hoy   = new Date();
  const desde = toISO(new Date(hoy.getFullYear(), hoy.getMonth() - 5, 1));
  return { desde, hasta: toISO(hoy) };
}

// Etiqueta "Lun 09/06" para una fecha ISO
function labelDia(iso) {
  const d = new Date(iso + "T12:00:00");
  return `${DIAS_ES[d.getDay()]} ${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}`;
}

// Número ISO de semana
function isoWeek(dateStr) {
  const d = new Date(dateStr + "T12:00:00");
  const jan4 = new Date(d.getFullYear(), 0, 4);
  const startOfWeek1 = new Date(jan4);
  startOfWeek1.setDate(jan4.getDate() - ((jan4.getDay() || 7) - 1));
  const diff = d - startOfWeek1;
  return Math.floor(diff / (7 * 86400000)) + 1;
}

// Lunes de la semana de una fecha ISO
function lunesDe(dateStr) {
  const d   = new Date(dateStr + "T12:00:00");
  const day = d.getDay() || 7;
  d.setDate(d.getDate() - day + 1);
  return toISO(d);
}

// Agrupar ventas por semana → [{label, desde, total, ganancia}]
function agruparPorSemana(ventas) {
  const map = {};
  ventas.forEach((v) => {
    const lunes = lunesDe(v.fecha);
    if (!map[lunes]) {
      const d = new Date(lunes + "T12:00:00");
      map[lunes] = {
        key: lunes,
        label: `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}`,
        total: 0,
        ganancia: 0,
      };
    }
    map[lunes].total    += v.total_ars || 0;
    map[lunes].ganancia += ((v.precio_unitario || 0) - (v.costo_unitario || 0)) * (v.cantidad || 1);
  });
  return Object.values(map).sort((a, b) => a.key.localeCompare(b.key));
}

// Agrupar ventas por día → [{label, total, ganancia}]
function agruparPorDia(ventas) {
  const map = {};
  ventas.forEach((v) => {
    const k = v.fecha;
    if (!map[k]) map[k] = { key: k, label: labelDia(k), total: 0, ganancia: 0 };
    map[k].total    += v.total_ars || 0;
    map[k].ganancia += ((v.precio_unitario || 0) - (v.costo_unitario || 0)) * (v.cantidad || 1);
  });
  return Object.values(map).sort((a, b) => a.key.localeCompare(b.key));
}

// ── Componente ─────────────────────────────────────────────────
export default function DashboardAdmin() {
  const now = new Date();

  // ── Modo: mes | semana | rango ─────────────────────────────
  const [modo,       setModo]       = useState("mes");
  const [mesSel,     setMesSel]     = useState(now.getMonth() + 1);
  const [anioSel,    setAnioSel]    = useState(now.getFullYear());
  const [semOffset,  setSemOffset]  = useState(0);      // semana: 0=actual, -1=anterior…
  const [desdeRango, setDesdeRango] = useState(toISO(new Date(now.getFullYear(), now.getMonth(), 1)));
  const [hastaRango, setHastaRango] = useState(toISO(now));

  // ── Datos ────────────────────────────────────────────────────
  const [ventas,       setVentas]       = useState([]);
  const [gastos,       setGastos]       = useState([]);
  const [ingresos,     setIngresos]     = useState([]);
  const [compras,      setCompras]      = useState([]);
  const [ventas6m,     setVentas6m]     = useState([]);
  const [productos,    setProductos]    = useState([]);
  const [totales,      setTotales]      = useState(null);
  const [consigs,      setConsigs]      = useState([]);
  const [saldoInicial, setSaldoInicial] = useState(0);
  const [editandoSaldo, setEditandoSaldo] = useState(false);
  const [saldoTemp,    setSaldoTemp]    = useState("");
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState("");

  // ── Rango activo según modo ───────────────────────────────────
  const rangoActivo = useMemo(() => {
    if (modo === "mes")    return getRangoMes(mesSel, anioSel);
    if (modo === "semana") return getRangoSemana(semOffset);
    return { desde: desdeRango, hasta: hastaRango };
  }, [modo, mesSel, anioSel, semOffset, desdeRango, hastaRango]);

  // ── Fetch ─────────────────────────────────────────────────────
  useEffect(() => {
    setLoading(true);
    setError("");
    const { desde, hasta } = rangoActivo;
    const { desde: d6, hasta: h6 } = getRango6Meses();
    Promise.all([
      fetchVentasRango(desde, hasta),
      fetchGastosRango(desde, hasta),
      fetchIngresosRango(desde, hasta),
      fetchComprasRango(desde, hasta),
      fetchProductosAdmin(),
      fetchTotalesGenerales(),
      fetchSaldoInicial(),
      fetchConsignaciones().catch(() => []),
    ]).then(([vm, gm, im, cm, prods, tots, saldo, cons]) => {
      setVentas(vm);
      setGastos(gm);
      setIngresos(im);
      setCompras(cm);
      setProductos(prods);
      setTotales(tots);
      setSaldoInicial(saldo);
      setConsigs(cons);
      fetchVentasRango(d6, h6).then(setVentas6m);
      setLoading(false);
    }).catch((err) => {
      setError(err.message || "No se pudo conectar con el servidor");
      setLoading(false);
    });
  }, [rangoActivo]);

  // ── Stats del período ─────────────────────────────────────────
  const stats = useMemo(() => {
    const totalVentas   = ventas.reduce((s, v) => s + (v.total_ars || 0), 0);
    const totalGastos   = gastos.reduce((s, g) => s + (g.monto_ars || 0), 0);
    const totalIngresos = ingresos.reduce((s, i) => s + (i.monto_ars || 0), 0);
    const totalCompras  = compras.reduce((s, c) => s + (c.total_ars || 0), 0);
    const costoVentas   = ventas.reduce((s, v) => s + ((v.costo_unitario || 0) * (v.cantidad || 1)), 0);
    const ganancia      = totalVentas - costoVentas - totalGastos;
    const entradas      = totalVentas + totalIngresos;
    const caja          = entradas - totalGastos - totalCompras;
    return { totalVentas, totalGastos, totalIngresos, totalCompras, costoVentas, ganancia, entradas, caja, nVentas: ventas.length, nCompras: compras.length };
  }, [ventas, gastos, ingresos, compras]);

  const disponible = totales
    ? saldoInicial + totales.totalVentas + totales.totalIngresos - totales.totalGastos - totales.totalCompras
    : null;

  const guardarSaldo = async () => {
    await updateConfig("saldo_inicial", Number(saldoTemp) || 0);
    setSaldoInicial(Number(saldoTemp) || 0);
    setEditandoSaldo(false);
  };

  // ── Gráficos ──────────────────────────────────────────────────

  // Por semana (para modo mes/rango con varios días)
  const chartSemanas = useMemo(() => agruparPorSemana(ventas), [ventas]);

  // Por día (para modo semana)
  const chartDias = useMemo(() => agruparPorDia(ventas), [ventas]);

  // Por mes — últimos 6 (siempre visible)
  const chartMeses = useMemo(() => {
    const map = {};
    ventas6m.forEach((v) => {
      const d   = new Date(v.fecha + "T00:00:00");
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      if (!map[key]) map[key] = { label: MESES_ES[d.getMonth()], total: 0, ganancia: 0 };
      map[key].total    += v.total_ars || 0;
      map[key].ganancia += ((v.precio_unitario || 0) - (v.costo_unitario || 0)) * (v.cantidad || 1);
    });
    return Object.values(map);
  }, [ventas6m]);

  // Por canal
  const chartCanal = useMemo(() => {
    const map = {};
    ventas.forEach((v) => {
      const c = v.canal || "Otro";
      map[c] = (map[c] || 0) + (v.total_ars || 0);
    });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [ventas]);

  // Por marca
  const chartMarca = useMemo(() => {
    const map = {};
    ventas.forEach((v) => {
      const m = v.marca || v.producto_nombre?.split(" ")[0] || "Otro";
      map[m] = (map[m] || 0) + (v.total_ars || 0);
    });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 6);
  }, [ventas]);

  // Top productos
  const topProductos = useMemo(() => {
    const map = {};
    ventas.forEach((v) => {
      const k = v.producto_nombre || "Desconocido";
      if (!map[k]) map[k] = { nombre: k, unidades: 0, total: 0 };
      map[k].unidades += v.cantidad || 1;
      map[k].total    += v.total_ars || 0;
    });
    return Object.values(map).sort((a, b) => b.unidades - a.unidades).slice(0, 7);
  }, [ventas]);

  // Stock bajo
  const stockBajo = useMemo(() =>
    productos.filter((p) => p.en_stock && (p.stock || 0) > 0 && (p.stock || 0) <= 3)
      .sort((a, b) => (a.stock || 0) - (b.stock || 0)).slice(0, 8),
  [productos]);
  const sinStock = useMemo(() =>
    productos.filter((p) => p.en_stock && (p.stock || 0) === 0).length,
  [productos]);

  // Últimas ventas
  const ultimasVentas = useMemo(() =>
    [...ventas].sort((a, b) => new Date(b.fecha) - new Date(a.fecha)).slice(0, 8),
  [ventas]);

  // Consig stats
  const consigStats = useMemo(() => {
    const activas   = consigs.filter((c) => c.estado === "activo" || c.estado === "parcial");
    const unidades  = activas.reduce((s, c) => s + (c.cantidad - Number(c.unidades_vendidas || 0)), 0);
    const porCobrar = consigs.reduce((s, c) => s + Number(c.total_por_cobrar || 0), 0);
    const totalVal  = activas.reduce((s, c) => s + (c.cantidad - Number(c.unidades_vendidas || 0)) * Number(c.precio_sugerido || 0), 0);
    const porConsig = {};
    activas.forEach((c) => {
      if (!porConsig[c.consignatario]) porConsig[c.consignatario] = { items: [], porCobrar: 0, unidades: 0 };
      porConsig[c.consignatario].items.push(c);
      porConsig[c.consignatario].porCobrar += Number(c.total_por_cobrar || 0);
      porConsig[c.consignatario].unidades  += c.cantidad - Number(c.unidades_vendidas || 0);
    });
    return { activas: activas.length, unidades, porCobrar, totalVal, porConsig };
  }, [consigs]);

  // ── Label del período activo ──────────────────────────────────
  const periodoLabel = useMemo(() => {
    if (modo === "mes") return `${["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"][mesSel - 1]} ${anioSel}`;
    if (modo === "semana") {
      const { desde, hasta } = getRangoSemana(semOffset);
      const d1 = new Date(desde + "T12:00:00");
      const d2 = new Date(hasta + "T12:00:00");
      const fmt2 = (d) => `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}`;
      return `Semana ${fmt2(d1)} – ${fmt2(d2)}`;
    }
    return `${desdeRango} → ${hastaRango}`;
  }, [modo, mesSel, anioSel, semOffset, desdeRango, hastaRango]);

  if (loading) return <p className="estado">Cargando dashboard...</p>;
  if (error)   return (
    <div style={{ padding: "32px 0", textAlign: "center" }}>
      <p style={{ color: "var(--rojo)", fontWeight: 700, marginBottom: 8 }}>✗ Error al cargar el dashboard</p>
      <p style={{ color: "var(--gris-sub)", fontSize: "0.85rem", marginBottom: 20 }}>{error}</p>
      <button className="btn-registrar" style={{ width: "auto", padding: "10px 24px" }} onClick={() => window.location.reload()}>
        Reintentar
      </button>
    </div>
  );

  // ── Chart semanal / diario según modo ─────────────────────────
  const chartPeriodo = modo === "semana" ? chartDias : chartSemanas;
  const chartPeriodoLabel = modo === "semana" ? "Ventas por día" : "Ventas por semana";

  return (
    <div className="dashboard">

      {/* ── Disponible para pedidos ── */}
      {disponible !== null && (
        <div className={`dash-disponible ${disponible >= 0 ? "positivo" : "negativo"}`}>
          <div className="dash-disp-main">
            <span className="dash-disp-label">💵 Disponible para pedidos</span>
            <span className="dash-disp-num">{fmtFull(disponible)}</span>
            <div className="dash-disp-detalle">
              <span>Saldo inicial: {fmtFull(saldoInicial)}</span>
              <span>+ Ventas: {fmtFull(totales.totalVentas)}</span>
              {totales.totalIngresos > 0 && <span>+ Ingresos: {fmtFull(totales.totalIngresos)}</span>}
              <span>− Gastos: {fmtFull(totales.totalGastos)}</span>
              <span>− Compras: {fmtFull(totales.totalCompras)}</span>
            </div>
          </div>
          <div className="dash-disp-saldo">
            {editandoSaldo ? (
              <div className="dash-disp-edit">
                <input type="number" value={saldoTemp} onChange={(e) => setSaldoTemp(e.target.value)} placeholder="Monto inicial ARS" autoFocus />
                <button onClick={guardarSaldo}>✓ Guardar</button>
                <button onClick={() => setEditandoSaldo(false)}>Cancelar</button>
              </div>
            ) : (
              <button className="dash-disp-btn" onClick={() => { setSaldoTemp(saldoInicial); setEditandoSaldo(true); }}>
                ✏️ Saldo inicial
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Selector de período ── */}
      <div className="dash-periodo-bar">
        {/* Tabs modo */}
        <div className="dash-modo-tabs">
          {[["mes","📅 Mes"],["semana","📆 Semana"],["rango","🗓 Rango"]].map(([k, label]) => (
            <button key={k} className={`dash-modo-tab ${modo === k ? "activo" : ""}`} onClick={() => setModo(k)}>
              {label}
            </button>
          ))}
        </div>

        {/* Controles según modo */}
        <div className="dash-periodo-ctrl">
          {modo === "mes" && (
            <div className="admin-periodo" style={{ marginBottom: 0 }}>
              <select value={mesSel} onChange={(e) => setMesSel(Number(e.target.value))}>
                {["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"]
                  .map((m, i) => <option key={i} value={i+1}>{m}</option>)}
              </select>
              <select value={anioSel} onChange={(e) => setAnioSel(Number(e.target.value))}>
                {[2024, 2025, 2026].map((a) => <option key={a}>{a}</option>)}
              </select>
            </div>
          )}

          {modo === "semana" && (
            <div className="dash-semana-nav">
              <button className="dash-nav-btn" onClick={() => setSemOffset((o) => o - 1)}>‹ Anterior</button>
              <span className="dash-semana-label">{periodoLabel}</span>
              <button className="dash-nav-btn" onClick={() => setSemOffset((o) => o + 1)} disabled={semOffset >= 0}>Siguiente ›</button>
              {semOffset !== 0 && (
                <button className="dash-nav-btn hoy" onClick={() => setSemOffset(0)}>Hoy</button>
              )}
            </div>
          )}

          {modo === "rango" && (
            <div className="dash-rango-inputs">
              <label>
                <span>Desde</span>
                <input type="date" value={desdeRango} max={hastaRango} onChange={(e) => setDesdeRango(e.target.value)} />
              </label>
              <span className="dash-rango-sep">→</span>
              <label>
                <span>Hasta</span>
                <input type="date" value={hastaRango} min={desdeRango} max={toISO(now)} onChange={(e) => setHastaRango(e.target.value)} />
              </label>
            </div>
          )}
        </div>
      </div>

      {/* ── Header período ── */}
      <div className="dash-header">
        <h2 className="dash-titulo">Resumen — {periodoLabel}</h2>
      </div>

      {/* ── Caja del mes ── */}
      <div className={`dash-caja ${stats.caja >= 0 ? "positiva" : "negativa"}`}>
        <div className="dash-caja-main">
          <span className="dash-caja-label">💰 Dinero neto del período</span>
          <span className="dash-caja-num">{fmtFull(stats.caja)}</span>
          <span className="dash-caja-sub">entradas − gastos − compras</span>
        </div>
        <div className="dash-caja-detalle">
          <div className="dash-caja-item entrada">
            <span>Ventas ARS</span>
            <strong>{fmtFull(stats.totalVentas)}</strong>
          </div>
          {stats.totalIngresos > 0 && (
            <div className="dash-caja-item entrada">
              <span>Otros ingresos</span>
              <strong>{fmtFull(stats.totalIngresos)}</strong>
            </div>
          )}
          <div className="dash-caja-item total-entrada">
            <span>Total entradas</span>
            <strong>{fmtFull(stats.entradas)}</strong>
          </div>
          <div className="dash-caja-item salida">
            <span>Gastos</span>
            <strong>− {fmtFull(stats.totalGastos)}</strong>
          </div>
          {stats.totalCompras > 0 && (
            <div className="dash-caja-item salida">
              <span>Compras ({stats.nCompras})</span>
              <strong>− {fmtFull(stats.totalCompras)}</strong>
            </div>
          )}
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="dash-stats">
        <div className="dash-stat">
          <span className="dash-stat-label">Facturación</span>
          <span className="dash-stat-num">{fmtFull(stats.totalVentas)}</span>
          <span className="dash-stat-sub">{stats.nVentas} ventas</span>
        </div>
        <div className="dash-stat">
          <span className="dash-stat-label">Costo productos</span>
          <span className="dash-stat-num">{fmtFull(stats.costoVentas)}</span>
        </div>
        <div className="dash-stat">
          <span className="dash-stat-label">Gastos</span>
          <span className="dash-stat-num">{fmtFull(stats.totalGastos)}</span>
          <span className="dash-stat-sub">{gastos.length} registros</span>
        </div>
        <div className={`dash-stat ${stats.ganancia >= 0 ? "success" : "danger"}`}>
          <span className="dash-stat-label">Ganancia bruta</span>
          <span className="dash-stat-num">{fmtFull(stats.ganancia)}</span>
          <span className="dash-stat-sub">ventas − costos − gastos</span>
        </div>
      </div>

      {/* ── Gráfico por semana / por día ── */}
      {chartPeriodo.length > 0 && (
        <div className="dash-card">
          <h3 className="dash-card-titulo">{chartPeriodoLabel} — {periodoLabel}</h3>
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={chartPeriodo} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={fmt} tick={{ fontSize: 11 }} width={48} />
              <Tooltip formatter={(v) => fmtFull(v)} />
              <Bar dataKey="total"    name="Ventas"   fill="#0e0e0e" radius={[4,4,0,0]} />
              <Bar dataKey="ganancia" name="Ganancia" fill="#b01c1c" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="dash-legend">
            <span><span className="dash-dot negro" />Ventas</span>
            <span><span className="dash-dot rojo"  />Ganancia</span>
          </div>
        </div>
      )}

      {/* ── Últimos 6 meses (siempre) ── */}
      <div className="dash-row">
        <div className="dash-card dash-card-lg">
          <h3 className="dash-card-titulo">Ventas últimos 6 meses</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartMeses} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={fmt} tick={{ fontSize: 11 }} width={45} />
              <Tooltip formatter={(v) => fmtFull(v)} />
              <Bar dataKey="total"    name="Facturación" fill="#0e0e0e" radius={[4,4,0,0]} />
              <Bar dataKey="ganancia" name="Ganancia"    fill="#b01c1c" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="dash-legend">
            <span><span className="dash-dot negro" />Facturación</span>
            <span><span className="dash-dot rojo"  />Ganancia</span>
          </div>
        </div>

        <div className="dash-card">
          <h3 className="dash-card-titulo">Por canal — {periodoLabel}</h3>
          {chartCanal.length === 0 ? (
            <p className="dash-empty">Sin ventas en este período</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={chartCanal} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={11}>
                  {chartCanal.map((_, i) => <Cell key={i} fill={COLORES[i % COLORES.length]} />)}
                </Pie>
                <Tooltip formatter={(v) => fmtFull(v)} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── Por marca + top productos ── */}
      <div className="dash-row">
        <div className="dash-card">
          <h3 className="dash-card-titulo">Ventas por marca — {periodoLabel}</h3>
          {chartMarca.length === 0 ? (
            <p className="dash-empty">Sin ventas en este período</p>
          ) : (
            <div className="dash-barras">
              {chartMarca.map((m, i) => {
                const max = chartMarca[0].value;
                return (
                  <div key={i} className="dash-barra-row">
                    <span className="dash-barra-label">{m.name}</span>
                    <div className="dash-barra-track">
                      <div className="dash-barra-fill" style={{ width: `${(m.value / max) * 100}%` }} />
                    </div>
                    <span className="dash-barra-val">{fmt(m.value)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="dash-card">
          <h3 className="dash-card-titulo">Más vendidos — {periodoLabel}</h3>
          {topProductos.length === 0 ? (
            <p className="dash-empty">Sin ventas en este período</p>
          ) : (
            <div className="dash-top-lista">
              {topProductos.map((p, i) => (
                <div key={i} className="dash-top-item">
                  <span className="dash-top-num">{i + 1}</span>
                  <span className="dash-top-nombre">{p.nombre}</span>
                  <span className="dash-top-uds">{p.unidades} ud.</span>
                  <span className="dash-top-total">{fmt(p.total)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Consignaciones ── */}
      {consigs.length > 0 && (
        <div className="dash-card dash-consig-card">
          <div className="dash-consig-header">
            <h3 className="dash-card-titulo" style={{ margin: 0 }}>🤝 Consignaciones activas</h3>
            <div className="dash-consig-chips">
              <span className="dash-consig-chip">
                <span style={{ color: "#d97706" }}>📦</span> {consigStats.unidades} relojes afuera
              </span>
              {consigStats.porCobrar > 0 && (
                <span className="dash-consig-chip warning">
                  <span>⏳</span> Por cobrar: <strong>{fmtFull(consigStats.porCobrar)}</strong>
                </span>
              )}
              {consigStats.totalVal > 0 && (
                <span className="dash-consig-chip">
                  <span>💲</span> Valor stock: {fmtFull(consigStats.totalVal)}
                </span>
              )}
            </div>
          </div>
          {Object.keys(consigStats.porConsig).length === 0 ? (
            <p className="dash-empty">Sin consignaciones activas</p>
          ) : (
            <div className="dash-consig-lista">
              {Object.entries(consigStats.porConsig).map(([nombre, data]) => (
                <div key={nombre} className="dash-consig-row">
                  <div className="dash-consig-avatar">{nombre.charAt(0).toUpperCase()}</div>
                  <div className="dash-consig-info">
                    <span className="dash-consig-nombre">{nombre}</span>
                    <div className="dash-consig-items">
                      {data.items.map((c) => {
                        const disp = c.cantidad - Number(c.unidades_vendidas || 0);
                        return (
                          <span key={c.id} className="dash-consig-item-chip">
                            {c.producto_nombre}
                            <span className="dash-consig-item-qty">{disp} ud.</span>
                          </span>
                        );
                      })}
                    </div>
                  </div>
                  <div className="dash-consig-nums">
                    <span className="dash-consig-uds">{data.unidades} u.</span>
                    {data.porCobrar > 0 && (
                      <span className="dash-consig-cobrar">{fmtFull(data.porCobrar)}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Stock bajo + últimas ventas ── */}
      <div className="dash-row">
        <div className="dash-card">
          <h3 className="dash-card-titulo">
            Stock bajo
            {sinStock > 0 && <span className="dash-badge-danger">{sinStock} sin stock</span>}
          </h3>
          {stockBajo.length === 0 ? (
            <p className="dash-empty">Todo con stock suficiente 👍</p>
          ) : (
            <div className="dash-stock-lista">
              {stockBajo.map((p) => (
                <div key={p.id} className="dash-stock-item">
                  {p.foto && <img src={p.foto} alt={p.nombre} className="dash-stock-img" />}
                  <div className="dash-stock-info">
                    <span className="dash-stock-nombre">{p.nombre}</span>
                    <span className="dash-stock-marca">{p.marca}</span>
                  </div>
                  <span className={`dash-stock-badge ${p.stock === 1 ? "uno" : "poco"}`}>{p.stock} ud.</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="dash-card">
          <h3 className="dash-card-titulo">Últimas ventas del período</h3>
          {ultimasVentas.length === 0 ? (
            <p className="dash-empty">Sin ventas en este período</p>
          ) : (
            <div className="dash-ventas-lista">
              {ultimasVentas.map((v) => (
                <div key={v.id} className="dash-venta-item">
                  <div className="dash-venta-info">
                    <span className="dash-venta-nombre">{v.producto_nombre}</span>
                    <span className="dash-venta-meta">
                      {v.fecha?.slice(5).replace("-", "/")} · {v.canal} · {v.tipo}
                    </span>
                  </div>
                  <span className="dash-venta-total">{fmtFull(v.total_ars)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
