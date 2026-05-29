import { useState, useEffect, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { fetchVentasRango, fetchGastosRango, fetchIngresosRango, fetchComprasRango, fetchProductosAdmin, fetchSaldoInicial, fetchTotalesGenerales, updateConfig } from "../../services/admin";

const COLORES = ["#0e0e0e", "#b01c1c", "#555", "#888", "#bbb", "#e0e0e0"];
const MESES_ES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

function getRango6Meses() {
  const hoy = new Date();
  const hasta = hoy.toISOString().split("T")[0];
  const desde = new Date(hoy.getFullYear(), hoy.getMonth() - 5, 1).toISOString().split("T")[0];
  return { desde, hasta };
}

function getMesActual() {
  const hoy = new Date();
  const desde = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().split("T")[0];
  const hasta = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).toISOString().split("T")[0];
  return { desde, hasta, mes: hoy.getMonth(), anio: hoy.getFullYear() };
}

const fmt = (n) => n >= 1000 ? `$${(n / 1000).toFixed(0)}k` : `$${n}`;
const fmtFull = (n) => `$${Number(n || 0).toLocaleString("es-AR")}`;

export default function DashboardAdmin() {
  const [ventas6m,    setVentas6m]    = useState([]);
  const [ventasMes,   setVentasMes]   = useState([]);
  const [gastosMes,   setGastosMes]   = useState([]);
  const [ingresosMes, setIngresosMes] = useState([]);
  const [comprasMes,  setComprasMes]  = useState([]);
  const [productos,   setProductos]   = useState([]);
  const [totales,     setTotales]     = useState(null);
  const [saldoInicial, setSaldoInicial] = useState(0);
  const [editandoSaldo, setEditandoSaldo] = useState(false);
  const [saldoTemp,    setSaldoTemp]   = useState("");
  const [loading,     setLoading]     = useState(true);

  useEffect(() => {
    const { desde: d6, hasta: h6 } = getRango6Meses();
    const { desde: dm, hasta: hm } = getMesActual();
    Promise.all([
      fetchVentasRango(d6, h6),
      fetchGastosRango(dm, hm),
      fetchIngresosRango(dm, hm),
      fetchComprasRango(dm, hm),
      fetchProductosAdmin(),
      fetchTotalesGenerales(),
      fetchSaldoInicial(),
    ]).then(([v6, gm, im, cm, prods, tots, saldo]) => {
      setVentas6m(v6);
      const { desde: dm2, hasta: hm2 } = getMesActual();
      setVentasMes(v6.filter((v) => v.fecha >= dm2 && v.fecha <= hm2));
      setGastosMes(gm);
      setIngresosMes(im);
      setComprasMes(cm);
      setProductos(prods);
      setTotales(tots);
      setSaldoInicial(saldo);
      setLoading(false);
    });
  }, []);

  // ── Stats mes actual ──────────────────────────────────
  const statsMes = useMemo(() => {
    const totalVentas   = ventasMes.reduce((s, v) => s + (v.total_ars || 0), 0);
    const totalGastos   = gastosMes.reduce((s, g) => s + (g.monto_ars || 0), 0);
    const totalIngresos = ingresosMes.reduce((s, i) => s + (i.monto_ars || 0), 0);
    const totalCompras  = comprasMes.reduce((s, c) => s + (c.total_ars || 0), 0);
    const costoVentas   = ventasMes.reduce((s, v) => s + ((v.costo_unitario || 0) * (v.cantidad || 1)), 0);
    const ganancia      = totalVentas - costoVentas - totalGastos;
    const entradas      = totalVentas + totalIngresos;
    const caja          = entradas - totalGastos - totalCompras;
    return { totalVentas, totalGastos, totalIngresos, totalCompras, costoVentas, ganancia, entradas, caja, nVentas: ventasMes.length, nCompras: comprasMes.length };
  }, [ventasMes, gastosMes, ingresosMes, comprasMes]);

  const disponible = totales
    ? saldoInicial + totales.totalVentas + totales.totalIngresos - totales.totalGastos - totales.totalCompras
    : null;

  const guardarSaldo = async () => {
    await updateConfig("saldo_inicial", Number(saldoTemp) || 0);
    setSaldoInicial(Number(saldoTemp) || 0);
    setEditandoSaldo(false);
  };

  // ── Ventas por mes (últimos 6) ────────────────────────
  const chartMeses = useMemo(() => {
    const map = {};
    ventas6m.forEach((v) => {
      const d = new Date(v.fecha + "T00:00:00");
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      if (!map[key]) map[key] = { label: MESES_ES[d.getMonth()], total: 0, ganancia: 0 };
      map[key].total    += v.total_ars || 0;
      map[key].ganancia += ((v.precio_unitario || 0) - (v.costo_unitario || 0)) * (v.cantidad || 1);
    });
    return Object.values(map);
  }, [ventas6m]);

  // ── Ventas por canal ──────────────────────────────────
  const chartCanal = useMemo(() => {
    const map = {};
    ventasMes.forEach((v) => {
      const c = v.canal || "Otro";
      map[c] = (map[c] || 0) + (v.total_ars || 0);
    });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [ventasMes]);

  // ── Ventas por marca ──────────────────────────────────
  const chartMarca = useMemo(() => {
    const map = {};
    ventasMes.forEach((v) => {
      const marca = v.marca || v.producto_nombre?.split(" ")[0] || "Otro";
      map[marca] = (map[marca] || 0) + (v.total_ars || 0);
    });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 6);
  }, [ventasMes]);

  // ── Top productos ─────────────────────────────────────
  const topProductos = useMemo(() => {
    const map = {};
    ventasMes.forEach((v) => {
      const k = v.producto_nombre || "Desconocido";
      if (!map[k]) map[k] = { nombre: k, unidades: 0, total: 0 };
      map[k].unidades += v.cantidad || 1;
      map[k].total    += v.total_ars || 0;
    });
    return Object.values(map).sort((a, b) => b.unidades - a.unidades).slice(0, 7);
  }, [ventasMes]);

  // ── Stock bajo ────────────────────────────────────────
  const stockBajo = useMemo(() =>
    productos.filter((p) => p.en_stock && (p.stock || 0) > 0 && (p.stock || 0) <= 3)
      .sort((a, b) => (a.stock || 0) - (b.stock || 0))
      .slice(0, 8),
  [productos]);

  const sinStock = useMemo(() =>
    productos.filter((p) => p.en_stock && (p.stock || 0) === 0).length,
  [productos]);

  // ── Últimas ventas ────────────────────────────────────
  const ultimasVentas = useMemo(() =>
    [...ventasMes].sort((a, b) => new Date(b.fecha) - new Date(a.fecha)).slice(0, 8),
  [ventasMes]);

  const mesLabel = MESES_ES[getMesActual().mes] + " " + getMesActual().anio;

  if (loading) return <p className="estado">Cargando dashboard...</p>;

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
                <input
                  type="number"
                  value={saldoTemp}
                  onChange={(e) => setSaldoTemp(e.target.value)}
                  placeholder="Monto inicial ARS"
                  autoFocus
                />
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

      {/* ── Título mes ── */}
      <div className="dash-header">
        <h2 className="dash-titulo">Resumen — {mesLabel}</h2>
      </div>

      {/* ── Caja del mes ── */}
      <div className={`dash-caja ${statsMes.caja >= 0 ? "positiva" : "negativa"}`}>
        <div className="dash-caja-main">
          <span className="dash-caja-label">💰 Dinero neto del mes</span>
          <span className="dash-caja-num">{fmtFull(statsMes.caja)}</span>
          <span className="dash-caja-sub">entradas − gastos − compras</span>
        </div>
        <div className="dash-caja-detalle">
          <div className="dash-caja-item entrada">
            <span>Ventas ARS</span>
            <strong>{fmtFull(statsMes.totalVentas)}</strong>
          </div>
          {statsMes.totalIngresos > 0 && (
            <div className="dash-caja-item entrada">
              <span>Otros ingresos</span>
              <strong>{fmtFull(statsMes.totalIngresos)}</strong>
            </div>
          )}
          <div className="dash-caja-item total-entrada">
            <span>Total entradas</span>
            <strong>{fmtFull(statsMes.entradas)}</strong>
          </div>
          <div className="dash-caja-item salida">
            <span>Gastos</span>
            <strong>− {fmtFull(statsMes.totalGastos)}</strong>
          </div>
          {statsMes.totalCompras > 0 && (
            <div className="dash-caja-item salida">
              <span>Compras ({statsMes.nCompras})</span>
              <strong>− {fmtFull(statsMes.totalCompras)}</strong>
            </div>
          )}
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="dash-stats">
        <div className="dash-stat">
          <span className="dash-stat-label">Facturación</span>
          <span className="dash-stat-num">{fmtFull(statsMes.totalVentas)}</span>
          <span className="dash-stat-sub">{statsMes.nVentas} ventas</span>
        </div>
        <div className="dash-stat">
          <span className="dash-stat-label">Costo productos</span>
          <span className="dash-stat-num">{fmtFull(statsMes.costoVentas)}</span>
        </div>
        <div className="dash-stat">
          <span className="dash-stat-label">Gastos</span>
          <span className="dash-stat-num">{fmtFull(statsMes.totalGastos)}</span>
          <span className="dash-stat-sub">{gastosMes.length} registros</span>
        </div>
        <div className={`dash-stat ${statsMes.ganancia >= 0 ? "success" : "danger"}`}>
          <span className="dash-stat-label">Ganancia bruta</span>
          <span className="dash-stat-num">{fmtFull(statsMes.ganancia)}</span>
          <span className="dash-stat-sub">ventas − costos − gastos</span>
        </div>
      </div>

      {/* ── Fila 2: gráfico meses + canal ── */}
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
          <h3 className="dash-card-titulo">Por canal — {mesLabel}</h3>
          {chartCanal.length === 0 ? (
            <p className="dash-empty">Sin ventas este mes</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={chartCanal} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={11}>
                  {chartCanal.map((_, i) => <Cell key={i} fill={COLORES[i % COLORES.length]} />)}
                </Pie>
                <Tooltip formatter={(v) => fmtFull(v)} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── Fila 3: por marca + top productos ── */}
      <div className="dash-row">
        <div className="dash-card">
          <h3 className="dash-card-titulo">Ventas por marca — {mesLabel}</h3>
          {chartMarca.length === 0 ? (
            <p className="dash-empty">Sin ventas este mes</p>
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
          <h3 className="dash-card-titulo">Más vendidos — {mesLabel}</h3>
          {topProductos.length === 0 ? (
            <p className="dash-empty">Sin ventas este mes</p>
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

      {/* ── Fila 4: stock bajo + últimas ventas ── */}
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
          <h3 className="dash-card-titulo">Últimas ventas</h3>
          {ultimasVentas.length === 0 ? (
            <p className="dash-empty">Sin ventas este mes</p>
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
