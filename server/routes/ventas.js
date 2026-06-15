const express = require("express");
const router  = express.Router();
const pool    = require("../db");

router.get("/", async (req, res) => {
  const { mes, anio, desde, hasta } = req.query;
  try {
    let query, params;
    if (desde && hasta) {
      query  = "SELECT * FROM ventas WHERE fecha >= ? AND fecha <= ? ORDER BY fecha ASC, created_at ASC";
      params = [desde, hasta];
    } else {
      const from = `${anio}-${String(mes).padStart(2,"0")}-01`;
      const to   = new Date(anio, mes, 0).toISOString().split("T")[0];
      query  = "SELECT * FROM ventas WHERE fecha >= ? AND fecha <= ? ORDER BY fecha DESC, created_at DESC";
      params = [from, to];
    }
    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post("/", async (req, res) => {
  const { fecha, producto_id, producto_nombre, marca, categoria, cantidad, precio_unitario, tipo, canal, cliente, cliente_id, costo_unitario, notas, descuento_pct, medio_pago, total_ars, total_usd, con_caja, precio_caja_usd, producto_caja_id } = req.body;
  try {
    const [result] = await pool.query(
      `INSERT INTO ventas (fecha, producto_id, producto_nombre, marca, categoria, cantidad, precio_unitario, tipo, canal, cliente, cliente_id, costo_unitario, notas, descuento_pct, medio_pago, total_ars, total_usd, con_caja, precio_caja_usd, producto_caja_id)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [fecha, producto_id||null, producto_nombre, marca||null, categoria||null, cantidad||1, precio_unitario||0, tipo||"minorista", canal||"Mostrador", cliente||null, cliente_id||null, costo_unitario||0, notas||null, descuento_pct||0, medio_pago||"Efectivo", total_ars||0, total_usd||0, con_caja?1:0, precio_caja_usd||0, producto_caja_id||null]
    );
    const [rows] = await pool.query("SELECT * FROM ventas WHERE id = ?", [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put("/:id", async (req, res) => {
  const { fecha, producto_nombre, marca, categoria, cantidad, precio_unitario, tipo, canal, cliente, cliente_id, costo_unitario, notas, descuento_pct, medio_pago, total_ars, total_usd, con_caja, precio_caja_usd } = req.body;
  try {
    await pool.query(
      `UPDATE ventas SET fecha=?, producto_nombre=?, marca=?, categoria=?, cantidad=?, precio_unitario=?,
       tipo=?, canal=?, cliente=?, cliente_id=?, costo_unitario=?, notas=?, descuento_pct=?, medio_pago=?,
       total_ars=?, total_usd=?, con_caja=?, precio_caja_usd=?
       WHERE id=?`,
      [fecha, producto_nombre, marca||null, categoria||null, cantidad||1, precio_unitario||0,
       tipo||"minorista", canal||"Mostrador", cliente||null, cliente_id||null, costo_unitario||0, notas||null,
       descuento_pct||0, medio_pago||"Efectivo", total_ars||0, total_usd||0, con_caja?1:0,
       precio_caja_usd||0, req.params.id]
    );
    const [rows] = await pool.query("SELECT * FROM ventas WHERE id = ?", [req.params.id]);
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete("/:id", async (req, res) => {
  try {
    await pool.query("DELETE FROM ventas WHERE id = ?", [req.params.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
