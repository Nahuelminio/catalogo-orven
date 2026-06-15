const express = require("express");
const router  = express.Router();
const pool    = require("../db");

// Auto-create table + add cliente_id FK to ventas
(async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS clientes (
        id         INT AUTO_INCREMENT PRIMARY KEY,
        nombre     VARCHAR(200) NOT NULL,
        whatsapp   VARCHAR(50),
        notas      TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await pool.query(`ALTER TABLE ventas ADD COLUMN cliente_id INT NULL`).catch(() => {});
  } catch (err) {
    console.error("Error init clientes:", err.message);
  }
})();

// GET / — all clients with purchase stats
router.get("/", async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT c.*,
             COUNT(v.id)                   AS total_compras,
             COALESCE(SUM(v.total_ars), 0) AS total_gastado
      FROM clientes c
      LEFT JOIN ventas v ON v.cliente_id = c.id
      GROUP BY c.id
      ORDER BY c.nombre ASC
    `);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /:id/ventas — purchase history
router.get("/:id/ventas", async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT * FROM ventas WHERE cliente_id = ? ORDER BY fecha DESC, created_at DESC`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST / — create client
router.post("/", async (req, res) => {
  const { nombre, whatsapp, notas } = req.body;
  if (!nombre) return res.status(400).json({ error: "Nombre requerido" });
  try {
    const [r] = await pool.query(
      "INSERT INTO clientes (nombre, whatsapp, notas) VALUES (?,?,?)",
      [nombre.trim(), whatsapp || null, notas || null]
    );
    const [rows] = await pool.query("SELECT * FROM clientes WHERE id = ?", [r.insertId]);
    res.status(201).json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /:id — update client
router.put("/:id", async (req, res) => {
  const { nombre, whatsapp, notas } = req.body;
  if (!nombre) return res.status(400).json({ error: "Nombre requerido" });
  try {
    await pool.query(
      "UPDATE clientes SET nombre=?, whatsapp=?, notas=? WHERE id=?",
      [nombre.trim(), whatsapp || null, notas || null, req.params.id]
    );
    const [rows] = await pool.query("SELECT * FROM clientes WHERE id = ?", [req.params.id]);
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /:id — unlink ventas then delete
router.delete("/:id", async (req, res) => {
  try {
    await pool.query("UPDATE ventas SET cliente_id = NULL WHERE cliente_id = ?", [req.params.id]);
    await pool.query("DELETE FROM clientes WHERE id = ?", [req.params.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
