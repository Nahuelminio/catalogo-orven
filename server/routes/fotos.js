const express    = require("express");
const router     = express.Router();
const pool       = require("../db");
const multer     = require("multer");
const cloudinary = require("cloudinary").v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// POST /api/fotos/upload
router.post("/upload", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Sin archivo" });
  try {
    const resultado = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: "orven", resource_type: "image" },
        (err, result) => (err ? reject(err) : resolve(result))
      );
      stream.end(req.file.buffer);
    });
    res.json({ url: resultado.secure_url });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/fotos/:productoId
router.get("/:productoId", async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT * FROM producto_fotos WHERE producto_id = ? ORDER BY orden, id",
      [req.params.productoId]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/fotos/:productoId  (vincular URL)
router.post("/:productoId", async (req, res) => {
  const { url } = req.body;
  try {
    const [result] = await pool.query(
      "INSERT INTO producto_fotos (producto_id, url) VALUES (?, ?)",
      [req.params.productoId, url]
    );
    const [rows] = await pool.query("SELECT * FROM producto_fotos WHERE id = ?", [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/fotos/item/:id
router.delete("/item/:id", async (req, res) => {
  try {
    await pool.query("DELETE FROM producto_fotos WHERE id = ?", [req.params.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
