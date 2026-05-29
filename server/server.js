require("dotenv").config();
const express = require("express");
const cors    = require("cors");

const app = express();

// ── CORS ─────────────────────────────────────────────────
const allowedOrigins = [
  process.env.FRONTEND_URL,
  "http://localhost:5173",
  "http://localhost:4173",
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Permitir requests sin origin (mobile apps, curl, etc.)
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
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

// ── HEALTH CHECK ─────────────────────────────────────────
app.get("/", (req, res) => res.json({ status: "ok", app: "Orven API" }));

// ── ARRANQUE ─────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Orven API corriendo en puerto ${PORT}`));
