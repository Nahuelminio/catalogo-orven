require("dotenv").config();
const express     = require("express");
const cors        = require("cors");
const compression = require("compression");

const app = express();

app.use(compression()); // gzip todas las respuestas

// ── CORS ─────────────────────────────────────────────────
const allowedOrigins = [
  process.env.FRONTEND_URL,
  "http://localhost:5173",
  "http://localhost:4173",
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Sin origin (apps móviles, curl, Postman, etc.) → permitir
    if (!origin) return callback(null, true);
    // localhost en cualquier puerto → permitir (desarrollo local)
    if (/^http:\/\/localhost(:\d+)?$/.test(origin)) return callback(null, true);
    // Orígenes de producción autorizados
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: origen no permitido: ${origin}`));
  },
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── RUTAS ─────────────────────────────────────────────────
app.use("/api/productos",     require("./routes/productos"));
app.use("/api/ventas",        require("./routes/ventas"));
app.use("/api/gastos",        require("./routes/gastos"));
app.use("/api/ingresos",      require("./routes/ingresos"));
app.use("/api/compras",       require("./routes/compras"));
app.use("/api/configuracion", require("./routes/configuracion"));
app.use("/api/fotos",         require("./routes/fotos"));
app.use("/api/consignaciones",require("./routes/consignaciones"));

// ── HEALTH CHECK ─────────────────────────────────────────
app.get("/", (req, res) => res.json({ status: "ok", app: "Orven API" }));

// ── ARRANQUE ─────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Orven API corriendo en puerto ${PORT}`));
