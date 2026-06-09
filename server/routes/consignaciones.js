const express = require("express");
const router  = express.Router();
const pool    = require("../db");

// ── Crear tablas si no existen ───────────────────────────
async function initTablas() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS consignaciones (
      id               INT AUTO_INCREMENT PRIMARY KEY,
      producto_id      INT,
      producto_nombre  VARCHAR(255) NOT NULL,
      marca            VARCHAR(100),
      cantidad         INT          NOT NULL DEFAULT 1,
      consignatario    VARCHAR(255) NOT NULL,
      fecha_envio      DATE         NOT NULL,
      precio_sugerido  DECIMAL(10,2) DEFAULT 0,
      estado           ENUM('activo','parcial','vendido','devuelto') DEFAULT 'activo',
      notas            TEXT,
      created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS consignacion_ventas (
      id               INT AUTO_INCREMENT PRIMARY KEY,
      consignacion_id  INT          NOT NULL,
      cantidad         INT          NOT NULL DEFAULT 1,
      precio_venta     DECIMAL(10,2) NOT NULL DEFAULT 0,
      fecha            DATE         NOT NULL,
      cobrado          TINYINT(1)   DEFAULT 0,
      notas            TEXT,
      created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (consignacion_id) REFERENCES consignaciones(id) ON DELETE CASCADE
    )
  `);
}
initTablas().catch(console.error);

// ── Helpers ──────────────────────────────────────────────
async function calcEstado(id) {
  const [[cons]]    = await pool.query("SELECT cantidad FROM consignaciones WHERE id = ?", [id]);
  const [[ventas]]  = await pool.query("SELECT COALESCE(SUM(cantidad),0) AS vendidas FROM consignacion_ventas WHERE consignacion_id = ?", [id]);
  const vendidas    = Number(ventas.vendidas);
  const total       = Number(cons.cantidad);
  if (vendidas === 0)           return "activo";
  if (vendidas >= total)        return "vendido";
  return "parcial";
}

// ── GET / — lista con resumen de ventas ──────────────────
router.get("/", async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT c.*,
             COALESCE(SUM(cv.cantidad), 0)                          AS unidades_vendidas,
             COALESCE(SUM(cv.cantidad * cv.precio_venta), 0)        AS total_vendido,
             COALESCE(SUM(CASE WHEN cv.cobrado=0 THEN cv.cantidad * cv.precio_venta ELSE 0 END), 0) AS total_por_cobrar
      FROM consignaciones c
      LEFT JOIN consignacion_ventas cv ON cv.consignacion_id = c.id
      GROUP BY c.id
      ORDER BY c.estado ASC, c.fecha_envio DESC
    `);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /:id/ventas — historial de ventas de una consignación
router.get("/:id/ventas", async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT * FROM consignacion_ventas WHERE consignacion_id = ? ORDER BY fecha DESC",
      [req.params.id]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── POST / — nueva consignación ──────────────────────────
router.post("/", async (req, res) => {
  const { producto_id, producto_nombre, marca, cantidad, consignatario, fecha_envio, precio_sugerido, notas } = req.body;
  try {
    const [result] = await pool.query(
      `INSERT INTO consignaciones (producto_id, producto_nombre, marca, cantidad, consignatario, fecha_envio, precio_sugerido, notas)
       VALUES (?,?,?,?,?,?,?,?)`,
      [producto_id||null, producto_nombre, marca||null, cantidad||1, consignatario, fecha_envio, precio_sugerido||0, notas||null]
    );
    const [rows] = await pool.query("SELECT * FROM consignaciones WHERE id = ?", [result.insertId]);
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── PUT /:id — editar consignación ───────────────────────
router.put("/:id", async (req, res) => {
  const { producto_nombre, marca, cantidad, consignatario, fecha_envio, precio_sugerido, notas } = req.body;
  try {
    await pool.query(
      `UPDATE consignaciones SET producto_nombre=?, marca=?, cantidad=?, consignatario=?, fecha_envio=?, precio_sugerido=?, notas=? WHERE id=?`,
      [producto_nombre, marca||null, cantidad||1, consignatario, fecha_envio, precio_sugerido||0, notas||null, req.params.id]
    );
    const [rows] = await pool.query("SELECT * FROM consignaciones WHERE id = ?", [req.params.id]);
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── DELETE /:id — eliminar consignación ──────────────────
router.delete("/:id", async (req, res) => {
  try {
    await pool.query("DELETE FROM consignaciones WHERE id = ?", [req.params.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── POST /:id/vender — registrar una venta parcial o total
router.post("/:id/vender", async (req, res) => {
  const { cantidad, precio_venta, fecha, cobrado, notas } = req.body;
  try {
    await pool.query(
      `INSERT INTO consignacion_ventas (consignacion_id, cantidad, precio_venta, fecha, cobrado, notas)
       VALUES (?,?,?,?,?,?)`,
      [req.params.id, cantidad||1, precio_venta||0, fecha, cobrado?1:0, notas||null]
    );
    // Actualizar estado
    const estado = await calcEstado(req.params.id);
    await pool.query("UPDATE consignaciones SET estado=? WHERE id=?", [estado, req.params.id]);
    res.json({ ok: true, estado });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── PUT /:id/cobrar — marcar venta como cobrada ──────────
router.put("/:id/cobrar/:ventaId", async (req, res) => {
  try {
    await pool.query("UPDATE consignacion_ventas SET cobrado=1 WHERE id=? AND consignacion_id=?", [req.params.ventaId, req.params.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── POST /:id/devolver — marcar como devuelto ────────────
router.post("/:id/devolver", async (req, res) => {
  try {
    await pool.query("UPDATE consignaciones SET estado='devuelto' WHERE id=?", [req.params.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
