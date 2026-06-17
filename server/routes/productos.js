const express = require("express");
const router  = express.Router();
const pool    = require("../db");

// GET /api/productos/publico
router.get("/publico", async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT id,marca,categoria,nombre,descripcion,foto,precio_minorista,precio_mayorista,stock,en_stock,tipo_seccion FROM productos WHERE en_stock = 1 AND (es_caja = 0 OR es_caja IS NULL) ORDER BY marca, nombre"
    );
    res.set("Cache-Control", "public, max-age=120, stale-while-revalidate=600");
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/productos/cajas
router.get("/cajas", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM productos WHERE es_caja = 1 ORDER BY marca, nombre");
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/productos
router.get("/", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM productos ORDER BY marca, nombre");
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/productos/:id
router.get("/:id", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM productos WHERE id = ?", [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: "No encontrado" });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/productos
router.post("/", async (req, res) => {
  const { marca, categoria, nombre, descripcion, foto, precio_costo_usd, precio_costo_ars, precio_minorista, precio_mayorista, stock, en_stock, tipo_seccion, es_caja } = req.body;
  try {
    const [result] = await pool.query(
      `INSERT INTO productos (marca, categoria, nombre, descripcion, foto, precio_costo_usd, precio_costo_ars, precio_minorista, precio_mayorista, stock, en_stock, tipo_seccion, es_caja)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [marca, categoria, nombre, descripcion||null, foto||null, precio_costo_usd||0, precio_costo_ars||0, precio_minorista||0, precio_mayorista||0, stock||0, en_stock??1, tipo_seccion||"pedido", es_caja||0]
    );
    const [rows] = await pool.query("SELECT * FROM productos WHERE id = ?", [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/productos/:id
router.put("/:id", async (req, res) => {
  const fields = req.body;
  const keys   = Object.keys(fields);
  if (!keys.length) return res.status(400).json({ error: "Sin campos" });
  const setClause = keys.map((k) => `\`${k}\` = ?`).join(", ");
  const values    = [...keys.map((k) => fields[k]), req.params.id];
  try {
    await pool.query(`UPDATE productos SET ${setClause} WHERE id = ?`, values);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/productos/:id
router.delete("/:id", async (req, res) => {
  try {
    await pool.query("DELETE FROM productos WHERE id = ?", [req.params.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/productos/:id/stock  { delta: +N o -N }
router.post("/:id/stock", async (req, res) => {
  const { delta } = req.body;
  try {
    await pool.query(
      "UPDATE productos SET stock = GREATEST(0, COALESCE(stock,0) + ?) WHERE id = ?",
      [delta, req.params.id]
    );
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
