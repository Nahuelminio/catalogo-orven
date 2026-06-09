import { useState, useEffect } from "react";
import { fetchProductosAdmin } from "../services/admin";
import DashboardAdmin  from "./admin/DashboardAdmin";
import ProductosAdmin  from "./admin/ProductosAdmin";
import VentasAdmin     from "./admin/VentasAdmin";
import GastosAdmin     from "./admin/GastosAdmin";
import IngresosAdmin   from "./admin/IngresosAdmin";
import ComprasAdmin    from "./admin/ComprasAdmin";
import WhatsAppAdmin      from "./admin/WhatsAppAdmin";
import ConsignacionAdmin  from "./admin/ConsignacionAdmin";

const TABS = [
  { key: "dashboard",    label: "📊 Dashboard",     Comp: DashboardAdmin    },
  { key: "productos",    label: "📦 Productos",     Comp: ProductosAdmin    },
  { key: "ventas",       label: "💰 Ventas",        Comp: VentasAdmin       },
  { key: "compras",      label: "🛒 Compras",       Comp: ComprasAdmin      },
  { key: "consignacion", label: "🤝 Consignación",  Comp: ConsignacionAdmin },
  { key: "ingresos",     label: "💵 Ingresos",      Comp: IngresosAdmin     },
  { key: "gastos",       label: "💸 Gastos",        Comp: GastosAdmin       },
  { key: "whatsapp",     label: "📲 WhatsApp",      Comp: WhatsAppAdmin     },
];

export default function AdminPanel() {
  const [tab,       setTab]      = useState("dashboard");
  const [montados,  setMontados] = useState(new Set(["dashboard"]));
  const [stockBadge, setStockBadge] = useState(0);

  useEffect(() => {
    fetchProductosAdmin()
      .then((prods) => {
        const bajo = prods.filter((p) => !p.es_caja && p.en_stock && (p.stock ?? 0) <= 2).length;
        setStockBadge(bajo);
      })
      .catch(() => {});
  }, []);

  const cambiarTab = (key) => {
    setTab(key);
    setMontados((prev) => new Set([...prev, key]));
  };

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
            onClick={() => cambiarTab(t.key)}
            style={{ position: "relative" }}
          >
            {t.label}
            {t.key === "productos" && stockBadge > 0 && (
              <span className="tab-badge">{stockBadge}</span>
            )}
          </button>
        ))}
      </div>

      {/* Contenido — cada tab se monta al visitarse y queda vivo (sin re-fetch) */}
      <div className="admin-tab-content">
        {TABS.map(({ key, Comp }) =>
          montados.has(key) ? (
            <div key={key} style={{ display: tab === key ? "block" : "none" }}>
              <Comp />
            </div>
          ) : null
        )}
      </div>
    </div>
  );
}
