const express = require("express");
const router  = express.Router();
const pool    = require("../db");

router.get("/", async (req, res) => {
  const { mes, anio, desde, hasta } = req.query;
  try {
    let query, params;
    if (desde && hasta) {
      query  = "SELECT * FROM compras WHERE fecha >= ? AND fecha <= ? ORDER BY fecha ASC";
      params = [desde, hasta];
    } else {
      const from = `${anio}-${String(mes).padStart(2,"0")}-01`;
      const to   = new Date(anio, mes, 0).toISOString().split("T")[0];
      query  = "SELECT * FROM compras WHERE fecha >= ? AND fecha <= ? ORDER BY fecha DESC, created_at DESC";
      params = [from, to];
    }
    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post("/", async (req, res) => {
  const { fecha, proveedor, producto_id, producto_nombre, cantidad, precio_costo_unitario, total_ars, notas, costo_caja_usd, dolar_dia } = req.body;
  try {
    const [result] = await pool.query(
      "INSERT INTO compras (fecha, proveedor, producto_id, producto_nombre, cantidad, precio_costo_unitario, total_ars, notas, costo_caja_usd, dolar_dia) VALUES (?,?,?,?,?,?,?,?,?,?)",
      [fecha, proveedor||null, producto_id||null, producto_nombre, cantidad||1, precio_costo_unitario||0, total_ars||0, notas||null, costo_caja_usd||0, dolar_dia||0]
    );
    const [rows] = await pool.query("SELECT * FROM compras WHERE id = ?", [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete("/:id", async (req, res) => {
  try {
    await pool.query("DELETE FROM compras WHERE id = ?", [req.params.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
