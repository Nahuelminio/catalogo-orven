import { useState } from "react";
import DashboardAdmin  from "./admin/DashboardAdmin";
import ProductosAdmin  from "./admin/ProductosAdmin";
import VentasAdmin     from "./admin/VentasAdmin";
import GastosAdmin     from "./admin/GastosAdmin";
import IngresosAdmin   from "./admin/IngresosAdmin";
import ComprasAdmin    from "./admin/ComprasAdmin";
import WhatsAppAdmin   from "./admin/WhatsAppAdmin";

const TABS = [
  { key: "dashboard", label: "📊 Dashboard" },
  { key: "productos", label: "📦 Productos" },
  { key: "ventas",    label: "💰 Ventas" },
  { key: "compras",   label: "🛒 Compras" },
  { key: "ingresos",  label: "💵 Ingresos" },
  { key: "gastos",    label: "💸 Gastos" },
  { key: "whatsapp",  label: "📲 WhatsApp" },
];

export default function AdminPanel() {
  const [tab, setTab] = useState("dashboard");

  return (
    <div className="admin-panel">
      {/* Header */}
      <div className="admin-header">
        <h1 className="admin-titulo">Panel de Administración</h1>
      </div>

      {/* Tabs */}
      <div className="admin-tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`admin-tab ${tab === t.key ? "activo" : ""}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Contenido */}
      <div className="admin-tab-content">
        {tab === "dashboard" && <DashboardAdmin />}
        {tab === "productos" && <ProductosAdmin />}
        {tab === "ventas"    && <VentasAdmin />}
        {tab === "compras"   && <ComprasAdmin />}
        {tab === "ingresos"  && <IngresosAdmin />}
        {tab === "gastos"    && <GastosAdmin />}
        {tab === "whatsapp"  && <WhatsAppAdmin />}
      </div>
    </div>
  );
}
