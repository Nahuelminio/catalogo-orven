const express = require("express");
const router  = express.Router();
const pool    = require("../db");

// GET /api/configuracion/totales/generales  — tiene que ir ANTES de /:key
router.get("/totales/generales", async (req, res) => {
  try {
    const [[v], [i], [g], [c]] = await Promise.all([
      pool.query("SELECT COALESCE(SUM(total_ars),0) AS total FROM ventas"),
      pool.query("SELECT COALESCE(SUM(monto_ars),0) AS total FROM ingresos"),
      pool.query("SELECT COALESCE(SUM(monto_ars),0) AS total FROM gastos"),
      pool.query("SELECT COALESCE(SUM(total_ars),0) AS total FROM compras"),
    ]);
    res.json({
      totalVentas:   Number(v[0].total),
      totalIngresos: Number(i[0].total),
      totalGastos:   Number(g[0].total),
      totalCompras:  Number(c[0].total),
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/configuracion
router.get("/", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM configuracion");
    const config = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    res.json(config);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/configuracion/:key
router.get("/:key", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT `value` FROM configuracion WHERE `key` = ?", [req.params.key]);
    if (!rows.length) return res.status(404).json({ error: "No encontrado" });
    res.json({ value: rows[0].value });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/configuracion/:key
router.put("/:key", async (req, res) => {
  const { value } = req.body;
  try {
    await pool.query(
      "INSERT INTO configuracion (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = ?",
      [req.params.key, String(value), String(value)]
    );
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
