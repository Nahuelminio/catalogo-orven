const express = require("express");
const router  = express.Router();
const pool    = require("../db");

router.get("/", async (req, res) => {
  const { mes, anio, desde, hasta } = req.query;
  try {
    let query, params;
    if (desde && hasta) {
      query  = "SELECT * FROM gastos WHERE fecha >= ? AND fecha <= ? ORDER BY fecha ASC";
      params = [desde, hasta];
    } else {
      const from = `${anio}-${String(mes).padStart(2,"0")}-01`;
      const to   = new Date(anio, mes, 0).toISOString().split("T")[0];
      query  = "SELECT * FROM gastos WHERE fecha >= ? AND fecha <= ? ORDER BY fecha DESC, created_at DESC";
      params = [from, to];
    }
    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post("/", async (req, res) => {
  const { fecha, descripcion, categoria, monto_ars, monto_usd, comprobante, notas } = req.body;
  try {
    const [result] = await pool.query(
      "INSERT INTO gastos (fecha, descripcion, categoria, monto_ars, monto_usd, comprobante, notas) VALUES (?,?,?,?,?,?,?)",
      [fecha, descripcion, categoria, monto_ars||0, monto_usd||0, comprobante||null, notas||null]
    );
    const [rows] = await pool.query("SELECT * FROM gastos WHERE id = ?", [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete("/:id", async (req, res) => {
  try {
    await pool.query("DELETE FROM gastos WHERE id = ?", [req.params.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
