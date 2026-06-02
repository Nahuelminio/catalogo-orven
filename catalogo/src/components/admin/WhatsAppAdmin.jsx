import { useState, useEffect, useMemo } from "react";
import { fetchProductosAdmin } from "../../services/admin";

const fmtARS = (n) => `$${Number(n || 0).toLocaleString("es-AR")}`;
const fmtUSD = (n) => `USD ${Number(n || 0).toLocaleString("es-AR")}`;

function caption(p, modo) {
  const precio = modo === "mayorista" ? fmtUSD(p.precio_mayorista) : fmtARS(p.precio_minorista);
  return `*${p.nombre}*\n_${p.marca}_\n\n*${precio}*`;
}

export default function WhatsAppAdmin() {
  const [productos,    setProductos]   = useState([]);
  const [modo,         setModo]        = useState("minorista");
  const [marcaFiltro,  setMarcaFiltro] = useState("Todas");
  const [soloStock,    setSoloStock]   = useState(false);
  const [busqueda,     setBusqueda]    = useState("");
  const [copiados,     setCopiados]    = useState({});
  const [copiadoTodo,  setCopiadoTodo] = useState(false);
  const [loading,      setLoading]     = useState(true);

  useEffect(() => {
    fetchProductosAdmin()
      .then((data) => {
        setProductos(data.filter((p) => !p.es_caja));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const marcas = ["Todas", ...new Set(productos.map((p) => p.marca))];

  const filtrados = useMemo(() => {
    const q = busqueda.toLowerCase();
    return productos.filter((p) => {
      const okMarca  = marcaFiltro === "Todas" || p.marca === marcaFiltro;
      const tieneStock = (p.stock || 0) > 0;
      const okStock  = soloStock ? tieneStock : (p.tipo_seccion === "stock" ? tieneStock : true);
      const okBusq   = !q || p.nombre.toLowerCase().includes(q) || p.marca.toLowerCase().includes(q);
      return okMarca && okStock && okBusq;
    });
  }, [productos, marcaFiltro, soloStock, busqueda]);

  // Copiar caption de UN producto
  const copiarUno = (p) => {
    navigator.clipboard.writeText(caption(p, modo)).then(() => {
      setCopiados((prev) => ({ ...prev, [p.id]: true }));
      setTimeout(() => setCopiados((prev) => ({ ...prev, [p.id]: false })), 2000);
    });
  };

  // Copiar imagen al portapapeles
  const [copiadosImg, setCopiadosImg] = useState({});

  const copiarImagen = async (p) => {
    if (!p.foto) return;
    try {
      const pngBlob = await urlAPng(p.foto);
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": pngBlob }),
      ]);
      setCopiadosImg((prev) => ({ ...prev, [p.id]: true }));
      setTimeout(() => setCopiadosImg((prev) => ({ ...prev, [p.id]: false })), 2000);
    } catch (err) {
      console.error("Error copiando imagen:", err);
      // fallback: abrir en nueva pestaña para copiar manualmente
      window.open(p.foto, "_blank");
    }
  };

  // Carga la imagen directo con crossOrigin, la escala si hace falta y devuelve un PNG blob
  const urlAPng = (url, maxPx = 1600) => new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      let { width, height } = img;
      if (width > maxPx || height > maxPx) {
        const ratio = Math.min(maxPx / width, maxPx / height);
        width  = Math.round(width  * ratio);
        height = Math.round(height * ratio);
      }
      const canvas = document.createElement("canvas");
      canvas.width  = width;
      canvas.height = height;
      canvas.getContext("2d").drawImage(img, 0, 0, width, height);
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error("canvas.toBlob devolvió null"));
      }, "image/png");
    };
    img.onerror = () => reject(new Error("No se pudo cargar la imagen"));
    img.src = url;
  });

  // Copiar todos los captions juntos
  const copiarTodos = () => {
    const txt = filtrados
      .map((p) => caption(p, modo))
      .join("\n\n");
    navigator.clipboard.writeText(txt).then(() => {
      setCopiadoTodo(true);
      setTimeout(() => setCopiadoTodo(false), 2500);
    });
  };

  if (loading) return <p className="estado">Cargando productos...</p>;

  return (
    <div>
      {/* Toolbar */}
      <div className="wa-toolbar">
        <div className="wa-toolbar-izq">
          <div className="admin-periodo" style={{ marginBottom: 0 }}>
            <select value={marcaFiltro} onChange={(e) => setMarcaFiltro(e.target.value)}>
              {marcas.map((m) => <option key={m}>{m}</option>)}
            </select>
            <select value={modo} onChange={(e) => setModo(e.target.value)}>
              <option value="minorista">Precio minorista (ARS)</option>
              <option value="mayorista">Precio mayorista (USD)</option>
            </select>
          </div>
          <label className="admin-check" style={{ margin: 0 }}>
            <input type="checkbox" checked={soloStock} onChange={(e) => setSoloStock(e.target.checked)} />
            Solo con stock
          </label>
          <input
            type="text"
            className="admin-search"
            placeholder="Buscar..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            style={{ width: 150 }}
          />
          <span className="contador" style={{ margin: 0 }}>{filtrados.length} productos</span>
        </div>
        <button
          className="btn-registrar"
          style={{ background: copiadoTodo ? "#16a34a" : "#25D366", marginTop: 0 }}
          onClick={copiarTodos}
          disabled={filtrados.length === 0}
        >
          {copiadoTodo ? "✓ ¡Copiado!" : "📋 Copiar todos los captions"}
        </button>
      </div>

      {/* Grid */}
      <div className="wa-grilla">
        {filtrados.map((p) => {
          const precio = modo === "mayorista" ? fmtUSD(p.precio_mayorista) : fmtARS(p.precio_minorista);
          const cap    = caption(p, modo);
          const cop    = copiados[p.id];
          return (
            <div key={p.id} className="wa-card">
              {/* Foto */}
              <div className="wa-img-wrap">
                {p.foto
                  ? <img src={p.foto} alt={p.nombre} className="wa-img" />
                  : <div className="wa-sin-foto">Sin foto</div>
                }
              </div>

              {/* Info */}
              <div className="wa-card-info">
                <span className="wa-card-marca">{p.marca}</span>
                <span className="wa-card-nombre">{p.nombre}</span>
                <span className="wa-card-precio">{precio}</span>
                {p.tipo_seccion === "stock" && (
                  <span className="wa-card-stock">Stock: {p.stock ?? 0}</span>
                )}
              </div>

              {/* Caption preview */}
              <div className="wa-caption-box">
                <pre className="wa-caption-txt">{cap}</pre>
              </div>

              {/* Acciones */}
              <div className="wa-card-acciones">
                <button className="wa-btn-copiar" onClick={() => copiarUno(p)}>
                  {cop ? "✓ Copiado" : "📋 Caption"}
                </button>
                {p.foto && (
                  <button
                    className="wa-btn-foto"
                    onClick={() => copiarImagen(p)}
                    title="Copiar imagen al portapapeles"
                  >
                    {copiadosImg[p.id] ? "✓" : "🖼️"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {filtrados.length === 0 && (
        <p className="admin-empty">No hay productos para mostrar.</p>
      )}
    </div>
  );
}
