import { useState, useEffect, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";
import { fetchVentasRango, fetchGastosRango, fetchIngresosRango, fetchComprasRango, fetchProductosAdmin, fetchSaldoInicial, fetchTotalesGenerales, updateConfig, fetchConsignaciones } from "../../services/admin";

const COLORES  = ["#0e0e0e", "#b01c1c", "#555", "#888", "#bbb", "#e0e0e0"];
const MESES_ES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
const MESES_FULL = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const DIAS_ES  = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];

const fmt     = (n) => n >= 1000 ? `$${(n / 1000).toFixed(0)}k` : `$${n}`;
const fmtFull = (n) => `$${Number(n || 0).toLocaleString("es-AR")}`;
const toISO   = (d) => d.toISOString().split("T")[0];
const pct     = (n, d) => d > 0 ? `${((n / d) * 100).toFixed(1)}%` : "—";

// ── Helpers de fechas ──────────────────────────────────────────
function getRangoMes(mes, anio) {
  const desde = `${anio}-${String(mes).padStart(2, "0")}-01`;
  const hasta  = toISO(new Date(anio, mes, 0));
  return { desde, hasta };
}
function getRangoSemana(offset = 0) {
  const hoy  = new Date();
  const dia  = hoy.getDay();
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
function labelDia(iso) {
  const d = new Date(iso + "T12:00:00");
  if (isNaN(d)) return iso;
  return `${DIAS_ES[d.getDay()]} ${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}`;
}
function lunesDe(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr.slice(0, 10) + "T12:00:00");
  if (isNaN(d)) return null;
  const day = d.getDay() || 7;
  d.setDate(d.getDate() - day + 1);
  return toISO(d);
}

// ── Agrupadores ───────────────────────────────────────────────
function agruparPorSemana(ventas) {
  const map = {};
  ventas.forEach((v) => {
    if (!v.fecha) return;
    const lunes = lunesDe(v.fecha);
    if (!lunes) return;
    if (!map[lunes]) {
      const d = new Date(lunes + "T12:00:00");
      map[lunes] = { key: lunes, label: `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}`, total: 0, ganancia: 0, unidades: 0 };
    }
    map[lunes].total    += v.total_ars || 0;
    map[lunes].ganancia += ((v.precio_unitario || 0) - (v.costo_unitario || 0)) * (v.cantidad || 1);
    map[lunes].unidades += v.cantidad || 1;
  });
  return Object.values(map).sort((a, b) => a.key.localeCompare(b.key));
}
function agruparPorDia(ventas) {
  const map = {};
  ventas.forEach((v) => {
    if (!v.fecha) return;
    const k = v.fecha.slice(0, 10);
    if (!map[k]) map[k] = { key: k, label: labelDia(k), total: 0, ganancia: 0, unidades: 0 };
    map[k].total    += v.total_ars || 0;
    map[k].ganancia += ((v.precio_unitario || 0) - (v.costo_unitario || 0)) * (v.cantidad || 1);
    map[k].unidades += v.cantidad || 1;
  });
  return Object.values(map).sort((a, b) => a.key.localeCompare(b.key));
}

// ── Tooltip custom ────────────────────────────────────────────
function TooltipVentas({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload || {};
  return (
    <div style={{ background: "#1e1e1e", border: "1px solid #333", borderRadius: 10, padding: "10px 14px", fontSize: "0.8rem", color: "#e8e8e8", minWidth: 160 }}>
      <div style={{ fontWeight: 700, marginBottom: 6, color: "#fff" }}>{label}</div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, color: "#9ca3af" }}>
        <span>Ventas</span><span style={{ color: "#e8e8e8", fontWeight: 700 }}>{fmtFull(d.total)}</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, color: "#9ca3af" }}>
        <span>Ganancia</span><span style={{ color: "#f87171", fontWeight: 700 }}>{fmtFull(d.ganancia)}</span>
      </div>
      {d.unidades != null && (
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, marginTop: 4, paddingTop: 4, borderTop: "1px solid #333", color: "#9ca3af" }}>
          <span>Relojes</span><span style={{ color: "#60a5fa", fontWeight: 700 }}>{d.unidades} ud.</span>
        </div>
      )}
    </div>
  );
}

// ── Modal de reporte ──────────────────────────────────────────
function ReporteModal({ texto, onClose }) {
  const [copiado, setCopiado] = useState(false);

  const copiar = async () => {
    await navigator.clipboard.writeText(texto);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  const descargar = () => {
    const blob = new Blob([texto], { type: "text/plain;charset=utf-8" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `reporte-orven-${toISO(new Date())}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="rep-overlay" onClick={onClose}>
      <div className="rep-modal" onClick={(e) => e.stopPropagation()}>
        <div className="rep-header">
          <div>
            <h2 className="rep-titulo">📋 Reporte para Claude</h2>
            <p className="rep-sub">Copiá y pegá esto en el chat con Claude para obtener análisis y consejos para tu negocio</p>
          </div>
          <button className="rep-cerrar" onClick={onClose}>✕</button>
        </div>

        <div className="rep-acciones">
          <button className={`rep-btn-copiar ${copiado ? "ok" : ""}`} onClick={copiar}>
            {copiado ? "✓ Copiado!" : "📋 Copiar todo"}
          </button>
          <button className="rep-btn-descargar" onClick={descargar}>
            ⬇ Descargar .txt
          </button>
          <span className="rep-hint">→ Pegalo en Claude y preguntale lo que quieras sobre tu negocio</span>
        </div>

        <textarea className="rep-texto" readOnly value={texto} onClick={(e) => e.target.select()} />

        <div className="rep-sugerencias">
          <p className="rep-sug-titulo">💡 Preguntas sugeridas para hacerle a Claude:</p>
          <div className="rep-sug-chips">
            {[
              "¿Qué productos debería reponer con urgencia?",
              "¿En qué canal debería enfocarme para vender más?",
              "¿Cuál es mi margen real y cómo mejorarlo?",
              "¿Qué marcas me generan más ganancia?",
              "¿Hay productos que debería dejar de vender?",
              "¿Cómo mejorar mi flujo de caja?",
              "¿Qué consignaciones me convienen más?",
            ].map((q) => (
              <span key={q} className="rep-sug-chip">{q}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────
export default function DashboardAdmin() {
  const now = new Date();

  const [modo,       setModo]       = useState("mes");
  const [mesSel,     setMesSel]     = useState(now.getMonth() + 1);
  const [anioSel,    setAnioSel]    = useState(now.getFullYear());
  const [semOffset,  setSemOffset]  = useState(0);
  const [desdeRango, setDesdeRango] = useState(toISO(new Date(now.getFullYear(), now.getMonth(), 1)));
  const [hastaRango, setHastaRango] = useState(toISO(now));
  const [reporteTexto, setReporteTexto] = useState(null);

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

  const rangoActivo = useMemo(() => {
    if (modo === "mes")    return getRangoMes(mesSel, anioSel);
    if (modo === "semana") return getRangoSemana(semOffset);
    return { desde: desdeRango, hasta: hastaRango };
  }, [modo, mesSel, anioSel, semOffset, desdeRango, hastaRango]);

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
      setVentas(vm); setGastos(gm); setIngresos(im); setCompras(cm);
      setProductos(prods); setTotales(tots); setSaldoInicial(saldo); setConsigs(cons);
      fetchVentasRango(d6, h6).then(setVentas6m);
      setLoading(false);
    }).catch((err) => {
      setError(err.message || "No se pudo conectar con el servidor");
      setLoading(false);
    });
  }, [rangoActivo]);

  // ── Stats del período ─────────────────────────────────────
  const stats = useMemo(() => {
    const totalVentas   = ventas.reduce((s, v) => s + (v.total_ars || 0), 0);
    const totalGastos   = gastos.reduce((s, g) => s + (g.monto_ars || 0), 0);
    const totalIngresos = ingresos.reduce((s, i) => s + (i.monto_ars || 0), 0);
    const totalCompras  = compras.reduce((s, c) => s + (c.total_ars || 0), 0);
    const costoVentas   = ventas.reduce((s, v) => s + ((v.costo_unitario || 0) * (v.cantidad || 1)), 0);
    const totalUnidades = ventas.reduce((s, v) => s + (v.cantidad || 1), 0);
    const ganancia      = totalVentas - costoVentas - totalGastos;
    const margenPct     = totalVentas > 0 ? ((ganancia / totalVentas) * 100).toFixed(1) : 0;
    const ticketProm    = ventas.length > 0 ? totalVentas / ventas.length : 0;
    const entradas      = totalVentas + totalIngresos;
    const caja          = entradas - totalGastos - totalCompras;
    return { totalVentas, totalGastos, totalIngresos, totalCompras, costoVentas, ganancia, margenPct, ticketProm, entradas, caja, totalUnidades, nVentas: ventas.length, nCompras: compras.length };
  }, [ventas, gastos, ingresos, compras]);

  const disponible = totales
    ? saldoInicial + totales.totalVentas + totales.totalIngresos - totales.totalGastos - totales.totalCompras
    : null;

  const guardarSaldo = async () => {
    await updateConfig("saldo_inicial", Number(saldoTemp) || 0);
    setSaldoInicial(Number(saldoTemp) || 0);
    setEditandoSaldo(false);
  };

  // ── Gráficos ──────────────────────────────────────────────
  const chartSemanas = useMemo(() => agruparPorSemana(ventas), [ventas]);
  const chartDias    = useMemo(() => agruparPorDia(ventas), [ventas]);

  const chartMeses = useMemo(() => {
    const map = {};
    ventas6m.forEach((v) => {
      if (!v.fecha) return;
      const d   = new Date(v.fecha.slice(0,10) + "T00:00:00");
      if (isNaN(d)) return;
      const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2,"0")}`;
      if (!map[key]) map[key] = { label: `${MESES_ES[d.getMonth()]} ${d.getFullYear()}`, total: 0, ganancia: 0, unidades: 0 };
      map[key].total    += v.total_ars || 0;
      map[key].ganancia += ((v.precio_unitario || 0) - (v.costo_unitario || 0)) * (v.cantidad || 1);
      map[key].unidades += v.cantidad || 1;
    });
    return Object.values(map);
  }, [ventas6m]);

  const chartCanal = useMemo(() => {
    const map = {};
    ventas.forEach((v) => { const c = v.canal || "Otro"; map[c] = (map[c] || 0) + (v.total_ars || 0); });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [ventas]);

  const chartMarca = useMemo(() => {
    const map = {};
    ventas.forEach((v) => { const m = v.marca || v.producto_nombre?.split(" ")[0] || "Otro"; map[m] = (map[m] || 0) + (v.total_ars || 0); });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 6);
  }, [ventas]);

  const topProductos = useMemo(() => {
    const map = {};
    ventas.forEach((v) => {
      const k = v.producto_nombre || "Desconocido";
      if (!map[k]) map[k] = { nombre: k, unidades: 0, total: 0, costo: 0 };
      map[k].unidades += v.cantidad || 1;
      map[k].total    += v.total_ars || 0;
      map[k].costo    += (v.costo_unitario || 0) * (v.cantidad || 1);
    });
    return Object.values(map).sort((a, b) => b.unidades - a.unidades).slice(0, 7);
  }, [ventas]);

  // Productos con margen (ventas del período enriquecidas con %)
  const productosConMargen = useMemo(() => {
    const map = {};
    ventas.forEach((v) => {
      const k = v.producto_nombre || "Desconocido";
      if (!map[k]) map[k] = { nombre: k, totalVenta: 0, totalCosto: 0, unidades: 0 };
      map[k].totalVenta += v.total_ars || 0;
      map[k].totalCosto += (v.costo_unitario || 0) * (v.cantidad || 1);
      map[k].unidades   += v.cantidad || 1;
    });
    return Object.values(map)
      .map((p) => ({ ...p, margen: p.totalVenta > 0 ? ((p.totalVenta - p.totalCosto) / p.totalVenta) * 100 : 0 }))
      .sort((a, b) => b.margen - a.margen);
  }, [ventas]);

  // Productos del catálogo sin ventas en el período
  const sinMovimiento = useMemo(() => {
    const vendidos = new Set(ventas.map((v) => v.producto_nombre?.toUpperCase()));
    return productos
      .filter((p) => p.en_stock && !vendidos.has(p.nombre?.toUpperCase()))
      .sort((a, b) => (b.stock || 0) - (a.stock || 0))
      .slice(0, 10);
  }, [ventas, productos]);

  // Día con más ventas
  const diaPico = useMemo(() => {
    const map = {};
    ventas.forEach((v) => {
      if (!v.fecha) return;
      const k = v.fecha.slice(0, 10);
      if (!map[k]) map[k] = { fecha: k, total: 0, unidades: 0 };
      map[k].total    += v.total_ars || 0;
      map[k].unidades += v.cantidad || 1;
    });
    const dias = Object.values(map).sort((a, b) => b.total - a.total);
    return dias[0] || null;
  }, [ventas]);

  const stockBajo = useMemo(() =>
    productos.filter((p) => p.en_stock && (p.stock || 0) > 0 && (p.stock || 0) <= 3)
      .sort((a, b) => (a.stock || 0) - (b.stock || 0)).slice(0, 8),
  [productos]);
  const sinStock = useMemo(() =>
    productos.filter((p) => p.en_stock && (p.stock || 0) === 0).length,
  [productos]);

  const ultimasVentas = useMemo(() =>
    [...ventas].sort((a, b) => new Date(b.fecha) - new Date(a.fecha)).slice(0, 8),
  [ventas]);

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

  const periodoLabel = useMemo(() => {
    if (modo === "mes") return `${MESES_FULL[mesSel - 1]} ${anioSel}`;
    if (modo === "semana") {
      const { desde, hasta } = getRangoSemana(semOffset);
      const d1 = new Date(desde + "T12:00:00"), d2 = new Date(hasta + "T12:00:00");
      const f = (d) => `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}`;
      return `Semana ${f(d1)} – ${f(d2)}`;
    }
    return `${desdeRango} → ${hastaRango}`;
  }, [modo, mesSel, anioSel, semOffset, desdeRango, hastaRango]);

  // ── Generador de reporte ───────────────────────────────────
  const generarReporte = () => {
    const hoy     = new Date();
    const fmtN    = (n) => `$${Number(n || 0).toLocaleString("es-AR")}`;
    const linea   = "─".repeat(50);
    const seccPct = (n, d) => d > 0 ? ` (${((n/d)*100).toFixed(1)}%)` : "";

    // Canal por unidades
    const canalUds = {};
    const canalCnt = {};
    ventas.forEach((v) => {
      const c = v.canal || "Otro";
      canalUds[c] = (canalUds[c] || 0) + (v.total_ars || 0);
      canalCnt[c] = (canalCnt[c] || 0) + 1;
    });

    // Marca por unidades
    const marcaMap = {};
    ventas.forEach((v) => {
      const m = v.marca || v.producto_nombre?.split(" ")[0] || "Otro";
      if (!marcaMap[m]) marcaMap[m] = { total: 0, unidades: 0 };
      marcaMap[m].total    += v.total_ars || 0;
      marcaMap[m].unidades += v.cantidad || 1;
    });

    // Gastos por categoría
    const gastoCat = {};
    gastos.forEach((g) => {
      const c = g.categoria || "Sin categoría";
      gastoCat[c] = (gastoCat[c] || 0) + (g.monto_ars || 0);
    });

    const lines = [
      `📊 REPORTE DE NEGOCIO — ORVEN`,
      `Generado: ${hoy.toLocaleDateString("es-AR")} ${hoy.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}`,
      `Período analizado: ${periodoLabel}`,
      linea,
      ``,
      `💰 RESUMEN FINANCIERO`,
      `• Facturación total:     ${fmtN(stats.totalVentas)} (${stats.nVentas} ventas, ${stats.totalUnidades} relojes)`,
      `• Costo de mercadería:   ${fmtN(stats.costoVentas)}`,
      `• Otros ingresos:        ${fmtN(stats.totalIngresos)}`,
      `• Gastos del período:    ${fmtN(stats.totalGastos)}`,
      `• Compras del período:   ${fmtN(stats.totalCompras)}`,
      `• Ganancia bruta:        ${fmtN(stats.ganancia)} (margen ${stats.margenPct}%)`,
      `• Neto del período:      ${fmtN(stats.caja)}`,
      `• Ticket promedio:       ${fmtN(Math.round(stats.ticketProm))} por venta`,
      disponible !== null ? `• Disponible (acumulado): ${fmtN(disponible)}` : "",
      diaPico ? `• Mejor día de ventas:   ${labelDia(diaPico.fecha)} — ${fmtN(diaPico.total)} (${diaPico.unidades} relojes)` : "",
      ``,
      `📦 PRODUCTOS MÁS VENDIDOS`,
      ...topProductos.map((p, i) => {
        const margen = p.total > 0 ? ((p.total - p.costo) / p.total * 100).toFixed(0) : 0;
        return `  ${i+1}. ${p.nombre} — ${p.unidades} ud. — ${fmtN(p.total)} (margen ${margen}%)`;
      }),
      topProductos.length === 0 ? "  Sin ventas en este período" : "",
      ``,
      `📈 MARGEN POR PRODUCTO (de mayor a menor)`,
      ...productosConMargen.slice(0, 10).map((p) =>
        `  • ${p.nombre}: ${p.margen.toFixed(1)}% — ${p.unidades} ud. — ${fmtN(p.totalVenta)}`
      ),
      productosConMargen.length === 0 ? "  Sin datos" : "",
      ``,
      `🏷️ VENTAS POR MARCA`,
      ...Object.entries(marcaMap)
        .sort((a, b) => b[1].total - a[1].total)
        .map(([m, d]) => `  • ${m}: ${d.unidades} relojes — ${fmtN(d.total)}${seccPct(d.total, stats.totalVentas)}`),
      Object.keys(marcaMap).length === 0 ? "  Sin datos" : "",
      ``,
      `📡 VENTAS POR CANAL`,
      ...Object.entries(canalUds)
        .sort((a, b) => b[1] - a[1])
        .map(([c, total]) => `  • ${c}: ${canalCnt[c]} ventas — ${fmtN(total)}${seccPct(total, stats.totalVentas)}`),
      Object.keys(canalUds).length === 0 ? "  Sin datos" : "",
      ``,
      `😴 PRODUCTOS SIN MOVIMIENTO ESTE PERÍODO (en catálogo activo)`,
      ...sinMovimiento.slice(0, 10).map((p) => `  • ${p.nombre} (${p.marca || "—"}) — stock: ${p.stock || 0} ud. — precio: ${fmtN(p.precio_ars || p.precio)}`),
      sinMovimiento.length === 0 ? "  Todos los productos tuvieron movimiento" : "",
      sinMovimiento.length > 10 ? `  ... y ${sinMovimiento.length - 10} más` : "",
      ``,
      `⚠️ STOCK CRÍTICO (≤3 unidades)`,
      ...stockBajo.map((p) => `  • ${p.nombre} (${p.marca || "—"}): ${p.stock} ud.`),
      stockBajo.length === 0 ? "  Todo en orden" : "",
      sinStock > 0 ? `  + ${sinStock} productos sin stock` : "",
      ``,
      `💸 GASTOS POR CATEGORÍA`,
      ...Object.entries(gastoCat)
        .sort((a, b) => b[1] - a[1])
        .map(([c, t]) => `  • ${c}: ${fmtN(t)}${seccPct(t, stats.totalGastos)}`),
      gastos.length === 0 ? "  Sin gastos registrados en este período" : "",
      ``,
    ];

    if (consigStats.activas > 0) {
      lines.push(`🤝 CONSIGNACIONES ACTIVAS`);
      lines.push(`  • ${consigStats.activas} consignaciones — ${consigStats.unidades} relojes afuera`);
      lines.push(`  • Valor en calle: ${fmtN(consigStats.totalVal)}`);
      if (consigStats.porCobrar > 0) lines.push(`  • Por cobrar: ${fmtN(consigStats.porCobrar)}`);
      Object.entries(consigStats.porConsig).forEach(([nombre, data]) => {
        lines.push(`  ${nombre} (${data.unidades} relojes):`);
        data.items.forEach((c) => {
          const disp = c.cantidad - Number(c.unidades_vendidas || 0);
          lines.push(`    - ${c.producto_nombre}: ${disp} ud.`);
        });
      });
      lines.push(``);
    }

    lines.push(`📅 TENDENCIA ÚLTIMOS 6 MESES`);
    chartMeses.forEach((m) => {
      const margenM = m.total > 0 ? ((m.ganancia / m.total) * 100).toFixed(0) : 0;
      lines.push(`  • ${m.label}: ${fmtN(m.total)} — ${m.unidades} relojes — ganancia ${fmtN(m.ganancia)} (${margenM}%)`);
    });
    if (chartMeses.length === 0) lines.push("  Sin datos");

    lines.push(``);
    lines.push(`📋 CATÁLOGO GENERAL`);
    lines.push(`  • Total productos activos: ${productos.filter(p => p.en_stock).length}`);
    lines.push(`  • Con stock disponible: ${productos.filter(p => p.en_stock && (p.stock || 0) > 0).length}`);
    lines.push(`  • Sin stock: ${sinStock}`);
    lines.push(`  • Valor total del inventario: ${fmtN(productos.reduce((s, p) => s + (p.costo || 0) * (p.stock || 0), 0))}`);

    lines.push(``);
    lines.push(linea);
    lines.push(`Fin del reporte. Podés preguntarme sobre cualquier aspecto de este negocio.`);

    setReporteTexto(lines.filter(l => l !== undefined).join("\n"));
  };

  const descargarJSON = () => {
    const data = {
      generado: new Date().toISOString(),
      periodo: periodoLabel,
      resumen: stats,
      disponible,
      ventas,
      gastos,
      ingresos,
      compras,
      productos: productos.filter(p => p.en_stock),
      consignaciones: consigs,
      tendencia6meses: chartMeses,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `datos-orven-${toISO(new Date())}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <p className="estado">Cargando dashboard...</p>;
  if (error) return (
    <div style={{ padding: "32px 0", textAlign: "center" }}>
      <p style={{ color: "var(--rojo)", fontWeight: 700, marginBottom: 8 }}>✗ Error al cargar el dashboard</p>
      <p style={{ color: "var(--gris-sub)", fontSize: "0.85rem", marginBottom: 20 }}>{error}</p>
      <button className="btn-registrar" style={{ width: "auto", padding: "10px 24px" }} onClick={() => window.location.reload()}>Reintentar</button>
    </div>
  );

  const chartPeriodo      = modo === "semana" ? chartDias : chartSemanas;
  const chartPeriodoLabel = modo === "semana" ? "Ventas por día" : "Ventas por semana";

  return (
    <div className="dashboard">

      {/* ── Modal reporte ── */}
      {reporteTexto && <ReporteModal texto={reporteTexto} onClose={() => setReporteTexto(null)} />}

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
        <div className="dash-modo-tabs">
          {[["mes","📅 Mes"],["semana","📆 Semana"],["rango","🗓 Rango"]].map(([k, label]) => (
            <button key={k} className={`dash-modo-tab ${modo === k ? "activo" : ""}`} onClick={() => setModo(k)}>{label}</button>
          ))}
        </div>

        <div className="dash-periodo-ctrl">
          {modo === "mes" && (
            <div className="admin-periodo" style={{ marginBottom: 0 }}>
              <select value={mesSel} onChange={(e) => setMesSel(Number(e.target.value))}>
                {MESES_FULL.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
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
              {semOffset !== 0 && <button className="dash-nav-btn hoy" onClick={() => setSemOffset(0)}>Hoy</button>}
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

        {/* Botones de exportar */}
        <div className="dash-export-btns">
          <button className="dash-export-claude" onClick={generarReporte}>
            📋 Generar reporte para Claude
          </button>
          <button className="dash-export-json" onClick={descargarJSON} title="Descargar datos crudos en JSON">
            ⬇ JSON
          </button>
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
          <div className="dash-caja-item entrada"><span>Ventas ARS</span><strong>{fmtFull(stats.totalVentas)}</strong></div>
          {stats.totalIngresos > 0 && <div className="dash-caja-item entrada"><span>Otros ingresos</span><strong>{fmtFull(stats.totalIngresos)}</strong></div>}
          <div className="dash-caja-item total-entrada"><span>Total entradas</span><strong>{fmtFull(stats.entradas)}</strong></div>
          <div className="dash-caja-item salida"><span>Gastos</span><strong>− {fmtFull(stats.totalGastos)}</strong></div>
          {stats.totalCompras > 0 && <div className="dash-caja-item salida"><span>Compras ({stats.nCompras})</span><strong>− {fmtFull(stats.totalCompras)}</strong></div>}
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="dash-stats">
        <div className="dash-stat">
          <span className="dash-stat-label">Facturación</span>
          <span className="dash-stat-num">{fmtFull(stats.totalVentas)}</span>
          <span className="dash-stat-sub">{stats.nVentas} ventas · {stats.totalUnidades} relojes</span>
        </div>
        <div className="dash-stat">
          <span className="dash-stat-label">Ticket promedio</span>
          <span className="dash-stat-num">{fmtFull(Math.round(stats.ticketProm))}</span>
          <span className="dash-stat-sub">por venta</span>
        </div>
        <div className={`dash-stat ${stats.ganancia >= 0 ? "success" : "danger"}`}>
          <span className="dash-stat-label">Ganancia bruta</span>
          <span className="dash-stat-num">{fmtFull(stats.ganancia)}</span>
          <span className="dash-stat-sub">margen {stats.margenPct}%</span>
        </div>
        <div className="dash-stat">
          <span className="dash-stat-label">Gastos</span>
          <span className="dash-stat-num">{fmtFull(stats.totalGastos)}</span>
          <span className="dash-stat-sub">{gastos.length} registros</span>
        </div>
      </div>

      {/* ── Gráfico período (semanas/días) ── */}
      {chartPeriodo.length > 0 && (
        <div className="dash-card">
          <h3 className="dash-card-titulo">{chartPeriodoLabel} — {periodoLabel}</h3>
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={chartPeriodo} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={fmt} tick={{ fontSize: 11 }} width={48} />
              <Tooltip content={<TooltipVentas />} />
              <Bar dataKey="total"    name="Ventas"   fill="#0e0e0e" radius={[4,4,0,0]} />
              <Bar dataKey="ganancia" name="Ganancia" fill="#b01c1c" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="dash-legend">
            <span><span className="dash-dot negro" />Ventas</span>
            <span><span className="dash-dot rojo"  />Ganancia</span>
            <span style={{ marginLeft: "auto", fontSize: "0.78rem", fontWeight: 700, color: "#374151", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 20, padding: "2px 10px" }}>
              🕐 {chartPeriodo.reduce((s, r) => s + r.unidades, 0)} relojes vendidos
            </span>
          </div>
        </div>
      )}

      {/* ── Últimos 6 meses + canal ── */}
      <div className="dash-row">
        <div className="dash-card dash-card-lg">
          <h3 className="dash-card-titulo">Ventas últimos 6 meses</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartMeses} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={fmt} tick={{ fontSize: 11 }} width={45} />
              <Tooltip content={<TooltipVentas />} />
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
          {chartCanal.length === 0 ? <p className="dash-empty">Sin ventas en este período</p> : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={chartCanal} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80}
                  label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`} labelLine={false} fontSize={11}>
                  {chartCanal.map((_, i) => <Cell key={i} fill={COLORES[i % COLORES.length]} />)}
                </Pie>
                <Tooltip formatter={(v) => fmtFull(v)} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── Márgen por producto ── */}
      {productosConMargen.length > 0 && (
        <div className="dash-card">
          <h3 className="dash-card-titulo">Margen por producto — {periodoLabel}</h3>
          <div className="dash-margen-lista">
            {productosConMargen.slice(0, 8).map((p, i) => (
              <div key={i} className="dash-margen-row">
                <span className="dash-margen-nombre">{p.nombre}</span>
                <div className="dash-margen-track">
                  <div className={`dash-margen-fill ${p.margen >= 30 ? "bueno" : p.margen >= 15 ? "medio" : "bajo"}`}
                    style={{ width: `${Math.min(p.margen, 100)}%` }} />
                </div>
                <span className={`dash-margen-pct ${p.margen >= 30 ? "bueno" : p.margen >= 15 ? "medio" : "bajo"}`}>
                  {p.margen.toFixed(0)}%
                </span>
                <span className="dash-margen-uds">{p.unidades} ud.</span>
              </div>
            ))}
          </div>
          <p className="dash-margen-hint">
            <span className="dot-bueno">■</span> ≥30% bueno &nbsp;
            <span className="dot-medio">■</span> 15-30% medio &nbsp;
            <span className="dot-bajo">■</span> &lt;15% bajo
          </p>
        </div>
      )}

      {/* ── Por marca + top productos ── */}
      <div className="dash-row">
        <div className="dash-card">
          <h3 className="dash-card-titulo">Ventas por marca — {periodoLabel}</h3>
          {chartMarca.length === 0 ? <p className="dash-empty">Sin ventas en este período</p> : (
            <div className="dash-barras">
              {chartMarca.map((m, i) => {
                const max = chartMarca[0].value;
                return (
                  <div key={i} className="dash-barra-row">
                    <span className="dash-barra-label">{m.name}</span>
                    <div className="dash-barra-track"><div className="dash-barra-fill" style={{ width: `${(m.value / max) * 100}%` }} /></div>
                    <span className="dash-barra-val">{fmt(m.value)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="dash-card">
          <h3 className="dash-card-titulo">Más vendidos — {periodoLabel}</h3>
          {topProductos.length === 0 ? <p className="dash-empty">Sin ventas en este período</p> : (
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

      {/* ── Productos sin movimiento ── */}
      {sinMovimiento.length > 0 && (
        <div className="dash-card">
          <h3 className="dash-card-titulo">
            😴 Sin movimiento este período
            <span style={{ background: "#fef9c3", color: "#92400e", border: "1px solid #fde68a", borderRadius: 20, padding: "2px 10px", fontSize: "0.72rem", marginLeft: 8, fontWeight: 600, textTransform: "none", letterSpacing: 0 }}>
              {sinMovimiento.length} productos
            </span>
          </h3>
          <div className="dash-sinmov-lista">
            {sinMovimiento.slice(0, 8).map((p) => (
              <div key={p.id} className="dash-sinmov-item">
                {p.foto && <img src={p.foto} alt="" className="dash-stock-img" />}
                <div className="dash-stock-info">
                  <span className="dash-stock-nombre">{p.nombre}</span>
                  <span className="dash-stock-marca">{p.marca || "—"} · {fmtFull(p.precio_ars || p.precio || 0)}</span>
                </div>
                <span className="dash-sinmov-stock">{p.stock || 0} en stock</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Consignaciones ── */}
      {consigs.length > 0 && (
        <div className="dash-card dash-consig-card">
          <div className="dash-consig-header">
            <h3 className="dash-card-titulo" style={{ margin: 0 }}>🤝 Consignaciones activas</h3>
            <div className="dash-consig-chips">
              <span className="dash-consig-chip"><span style={{ color: "#d97706" }}>📦</span> {consigStats.unidades} relojes afuera</span>
              {consigStats.porCobrar > 0 && <span className="dash-consig-chip warning"><span>⏳</span> Por cobrar: <strong>{fmtFull(consigStats.porCobrar)}</strong></span>}
              {consigStats.totalVal > 0 && <span className="dash-consig-chip"><span>💲</span> Valor: {fmtFull(consigStats.totalVal)}</span>}
            </div>
          </div>
          {Object.keys(consigStats.porConsig).length === 0 ? <p className="dash-empty">Sin consignaciones activas</p> : (
            <div className="dash-consig-lista">
              {Object.entries(consigStats.porConsig).map(([nombre, data]) => (
                <div key={nombre} className="dash-consig-row">
                  <div className="dash-consig-avatar">{nombre.charAt(0).toUpperCase()}</div>
                  <div className="dash-consig-info">
                    <span className="dash-consig-nombre">{nombre}</span>
                    <div className="dash-consig-items">
                      {data.items.map((c) => {
                        const disp = c.cantidad - Number(c.unidades_vendidas || 0);
                        return <span key={c.id} className="dash-consig-item-chip">{c.producto_nombre}<span className="dash-consig-item-qty">{disp} ud.</span></span>;
                      })}
                    </div>
                  </div>
                  <div className="dash-consig-nums">
                    <span className="dash-consig-uds">{data.unidades} u.</span>
                    {data.porCobrar > 0 && <span className="dash-consig-cobrar">{fmtFull(data.porCobrar)}</span>}
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
          {stockBajo.length === 0 ? <p className="dash-empty">Todo con stock suficiente 👍</p> : (
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
          {ultimasVentas.length === 0 ? <p className="dash-empty">Sin ventas en este período</p> : (
            <div className="dash-ventas-lista">
              {ultimasVentas.map((v) => (
                <div key={v.id} className="dash-venta-item">
                  <div className="dash-venta-info">
                    <span className="dash-venta-nombre">{v.producto_nombre}</span>
                    <span className="dash-venta-meta">{v.fecha?.slice(5).replace("-","/")} · {v.canal} · {v.tipo}</span>
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
