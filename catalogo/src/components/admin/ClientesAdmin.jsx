import { useState, useEffect, useMemo } from "react";
import { fetchClientes, createCliente, updateCliente, deleteCliente, fetchVentasCliente } from "../../services/admin";
import Toast from "./Toast";
import { useToast } from "../../hooks/useToast";

const fmt      = (n) => `$ ${Number(n || 0).toLocaleString("es-AR")}`;
const fmtFecha = (f) => f ? `${f.slice(8,10)}/${f.slice(5,7)}/${f.slice(0,4)}` : "—";

const FORM_VACIO = { nombre: "", whatsapp: "", notas: "" };

export default function ClientesAdmin() {
  const [clientes,      setClientes]      = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [busq,          setBusq]          = useState("");
  const [form,          setForm]          = useState(FORM_VACIO);
  const [editandoId,    setEditandoId]    = useState(null);
  const [guardando,     setGuardando]     = useState(false);
  const [perfilId,      setPerfilId]      = useState(null);
  const [ventas,        setVentas]        = useState([]);
  const [loadingVentas, setLoadingVentas] = useState(false);
  const { toast, mostrar, cerrar } = useToast();

  const cargar = () =>
    fetchClientes()
      .then((d) => { setClientes(d); setLoading(false); })
      .catch(() => setLoading(false));

  useEffect(() => { cargar(); }, []);

  useEffect(() => {
    if (!perfilId) { setVentas([]); return; }
    setLoadingVentas(true);
    fetchVentasCliente(perfilId)
      .then((d) => { setVentas(d); setLoadingVentas(false); })
      .catch(() => setLoadingVentas(false));
  }, [perfilId]);

  const clientesFiltrados = useMemo(() => {
    if (!busq) return clientes;
    const q = busq.toLowerCase();
    return clientes.filter((c) =>
      c.nombre.toLowerCase().includes(q) ||
      (c.whatsapp || "").includes(q)
    );
  }, [clientes, busq]);

  const perfilCliente = useMemo(
    () => clientes.find((c) => c.id === perfilId) || null,
    [clientes, perfilId]
  );

  const stats = useMemo(() => {
    const conCompras   = clientes.filter((c) => Number(c.total_compras) > 0).length;
    const totalRevenue = clientes.reduce((s, c) => s + Number(c.total_gastado || 0), 0);
    const topSpender   = clientes.reduce((top, c) =>
      Number(c.total_gastado) > Number(top?.total_gastado || 0) ? c : top, null);
    return { total: clientes.length, conCompras, totalRevenue, topSpender };
  }, [clientes]);

  const ventasStats = useMemo(() => {
    if (!ventas.length) return null;
    const total  = ventas.reduce((s, v) => s + Number(v.total_ars || 0), 0);
    const ticket = Math.round(total / ventas.length);
    return { total, ticket };
  }, [ventas]);

  const iniciarEdicion = (c) => {
    setEditandoId(c.id);
    setForm({ nombre: c.nombre, whatsapp: c.whatsapp || "", notas: c.notas || "" });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancelarEdicion = () => { setEditandoId(null); setForm(FORM_VACIO); };

  const guardar = async (e) => {
    e.preventDefault();
    if (!form.nombre.trim()) return;
    setGuardando(true);
    try {
      if (editandoId) {
        await updateCliente(editandoId, form);
        mostrar("Cliente actualizado");
      } else {
        await createCliente(form);
        mostrar("Cliente creado");
        setForm(FORM_VACIO);
      }
      setEditandoId(null);
      await cargar();
    } catch {
      mostrar("Error al guardar", "error");
    } finally {
      setGuardando(false);
    }
  };

  const eliminar = async (id) => {
    if (!confirm("¿Eliminar este cliente?\nSus ventas pasadas no se perderán pero quedarán sin cliente asociado.")) return;
    await deleteCliente(id);
    if (perfilId === id) setPerfilId(null);
    await cargar();
    mostrar("Cliente eliminado", "warn");
  };

  return (
    <div style={{ position: "relative" }}>
      <Toast mensaje={toast.mensaje} tipo={toast.tipo} onClose={cerrar} />

      {/* Stats */}
      <div className="admin-stats">
        <div className="stat-card">
          <span className="stat-num">{stats.total}</span>
          <span className="stat-label">Clientes</span>
        </div>
        <div className="stat-card success">
          <span className="stat-num">{stats.conCompras}</span>
          <span className="stat-label">Con compras</span>
        </div>
        <div className="stat-card warning">
          <span className="stat-num" style={{ fontSize: "1rem" }}>{fmt(stats.totalRevenue)}</span>
          <span className="stat-label">Total facturado</span>
        </div>
        {stats.topSpender && Number(stats.topSpender.total_gastado) > 0 && (
          <div className="stat-card">
            <span className="stat-num" style={{ fontSize: "0.82rem", fontWeight: 800 }}>{stats.topSpender.nombre}</span>
            <span className="stat-label">Top · {fmt(stats.topSpender.total_gastado)}</span>
          </div>
        )}
      </div>

      {/* Formulario */}
      <div className="admin-form-card">
        <h3 className="admin-form-title" style={{ marginBottom: 14 }}>
          {editandoId ? "✏️ Editar cliente" : "+ Nuevo cliente"}
        </h3>
        <form onSubmit={guardar} className="venta-form">
          <div className="form-row">
            <label className="form-label">
              <span>Nombre *</span>
              <input type="text" value={form.nombre}
                onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                placeholder="Nombre del cliente" />
            </label>
            <label className="form-label">
              <span>WhatsApp</span>
              <input type="text" value={form.whatsapp}
                onChange={(e) => setForm((f) => ({ ...f, whatsapp: e.target.value }))}
                placeholder="Ej: 5491112345678" />
            </label>
            <label className="form-label">
              <span>Notas</span>
              <input type="text" value={form.notas}
                onChange={(e) => setForm((f) => ({ ...f, notas: e.target.value }))}
                placeholder="Observaciones..." />
            </label>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <button type="submit" className="btn-registrar" disabled={guardando || !form.nombre.trim()}
              style={{ maxWidth: 200 }}>
              {guardando ? "Guardando..." : editandoId ? "✓ Guardar cambios" : "✓ Crear cliente"}
            </button>
            {editandoId && (
              <button type="button" onClick={cancelarEdicion}
                style={{ border: "1.5px solid #ddd", borderRadius: 8, padding: "8px 16px", fontSize: "0.85rem", cursor: "pointer", background: "none", color: "var(--gris-txt)" }}>
                Cancelar
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Lista */}
      <div className="admin-lista-ventas">
        <div className="admin-lista-toolbar">
          <h3 className="admin-form-title" style={{ margin: 0 }}>
            Clientes ({clientes.length})
          </h3>
          <input
            className="admin-search"
            style={{ width: 220 }}
            placeholder="Buscar nombre o WhatsApp..."
            value={busq}
            onChange={(e) => setBusq(e.target.value)}
          />
        </div>

        {loading ? (
          <p className="estado">Cargando...</p>
        ) : clientesFiltrados.length === 0 ? (
          <p className="admin-empty">
            {busq ? `Sin resultados para "${busq}".` : "No hay clientes registrados aún. ¡Crea el primero!"}
          </p>
        ) : (
          <div className="cli-lista">
            {clientesFiltrados.map((c) => {
              const inicial = (c.nombre || "?")[0].toUpperCase();
              return (
                <div key={c.id}
                  className={`cli-card${perfilId === c.id ? " activo" : ""}`}
                  onClick={() => setPerfilId(perfilId === c.id ? null : c.id)}>
                  <div className="cli-avatar">{inicial}</div>
                  <div className="cli-info">
                    <strong className="cli-nombre">{c.nombre}</strong>
                    {c.whatsapp && (
                      <a href={`https://wa.me/${c.whatsapp.replace(/\D/g, "")}`}
                        target="_blank" rel="noreferrer"
                        className="cli-wa"
                        onClick={(e) => e.stopPropagation()}>
                        📱 {c.whatsapp}
                      </a>
                    )}
                    {c.notas && <span className="cli-notas-preview">{c.notas}</span>}
                  </div>
                  <div className="cli-meta">
                    <span className="cli-compras-num">
                      {Number(c.total_compras)} compra{Number(c.total_compras) !== 1 ? "s" : ""}
                    </span>
                    {Number(c.total_gastado) > 0 && (
                      <span className="cli-gastado">{fmt(c.total_gastado)}</span>
                    )}
                  </div>
                  <div className="cli-acciones" onClick={(e) => e.stopPropagation()}>
                    <button className="btn-editar" onClick={() => iniciarEdicion(c)} title="Editar">✏️</button>
                    <button className="btn-eliminar" onClick={() => eliminar(c.id)} title="Eliminar">✕</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Perfil expandido */}
      {perfilCliente && (
        <div className="cli-perfil-overlay" onClick={() => setPerfilId(null)}>
          <div className="cli-perfil" onClick={(e) => e.stopPropagation()}>
            <div className="cli-perfil-header">
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div className="cli-avatar grande">
                  {(perfilCliente.nombre || "?")[0].toUpperCase()}
                </div>
                <div>
                  <h2 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 800 }}>
                    {perfilCliente.nombre}
                  </h2>
                  {perfilCliente.whatsapp && (
                    <a href={`https://wa.me/${perfilCliente.whatsapp.replace(/\D/g, "")}`}
                      target="_blank" rel="noreferrer" className="cli-wa">
                      📱 {perfilCliente.whatsapp}
                    </a>
                  )}
                  {perfilCliente.notas && (
                    <p style={{ margin: "4px 0 0", fontSize: "0.78rem", color: "var(--gris-sub)" }}>
                      {perfilCliente.notas}
                    </p>
                  )}
                </div>
              </div>
              <button className="cli-perfil-cerrar" onClick={() => setPerfilId(null)}>✕</button>
            </div>

            <div className="cli-perfil-stats">
              <div className="stat-card" style={{ flex: 1 }}>
                <span className="stat-num">{Number(perfilCliente.total_compras)}</span>
                <span className="stat-label">Compras</span>
              </div>
              <div className="stat-card warning" style={{ flex: 1 }}>
                <span className="stat-num" style={{ fontSize: "0.95rem" }}>
                  {fmt(perfilCliente.total_gastado)}
                </span>
                <span className="stat-label">Total gastado</span>
              </div>
              {ventasStats && ventasStats.ticket > 0 && (
                <div className="stat-card" style={{ flex: 1 }}>
                  <span className="stat-num" style={{ fontSize: "0.95rem" }}>
                    {fmt(ventasStats.ticket)}
                  </span>
                  <span className="stat-label">Ticket promedio</span>
                </div>
              )}
            </div>

            <h4 className="cli-section-title">Historial de compras</h4>

            {loadingVentas ? (
              <p className="estado">Cargando...</p>
            ) : ventas.length === 0 ? (
              <p className="admin-empty">Sin compras registradas para este cliente.</p>
            ) : (
              <div className="cli-compras-lista">
                {ventas.map((v) => {
                  const totalARS = v.total_ars || v.precio_unitario * v.cantidad;
                  const total    = v.tipo === "mayorista"
                    ? `USD ${Number(v.total_usd || v.precio_unitario * v.cantidad).toLocaleString("es-AR")}`
                    : fmt(totalARS);
                  const costo     = (v.costo_unitario || 0) * (v.cantidad || 1);
                  const margenPct = costo > 0 ? ((totalARS - costo) / totalARS) * 100 : null;
                  const margenColor = margenPct === null ? "#9ca3af"
                    : margenPct >= 30 ? "#16a34a"
                    : margenPct >= 15 ? "#d97706"
                    : "#dc2626";
                  return (
                    <div key={v.id} className="cli-compra-row">
                      <span className="cli-compra-fecha">{fmtFecha(v.fecha)}</span>
                      <div className="cli-compra-prod">
                        <strong>{v.producto_nombre}</strong>
                        {v.marca && <span className="admin-lista-sub">{v.marca}</span>}
                      </div>
                      <span className="admin-lista-sub" style={{ textAlign: "center" }}>×{v.cantidad}</span>
                      <span className="cli-compra-total">{total}</span>
                      {margenPct !== null && (
                        <span style={{ fontSize: "0.7rem", fontWeight: 700, color: margenColor,
                          background: "#f9fafb", borderRadius: 4, padding: "1px 5px", flexShrink: 0 }}>
                          {margenPct.toFixed(0)}%
                        </span>
                      )}
                      <span className="admin-lista-sub" style={{ flexShrink: 0 }}>{v.canal || "—"}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
