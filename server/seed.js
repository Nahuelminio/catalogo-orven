/**
 * seed.js — Importa los CSVs a la nueva base MySQL.
 * Uso: node seed.js
 * Requiere .env con DATABASE_URL
 */
require("dotenv").config();
const fs   = require("fs");
const path = require("path");
const { parse } = require("csv-parse/sync");
const pool = require("./db");

const CSV_DIR = path.join(__dirname, "data");

function leerCSV(nombre) {
  const posibles = [
    path.join(CSV_DIR, nombre),
    path.join(require("os").homedir(), "Downloads", nombre),
  ];
  for (const p of posibles) {
    if (fs.existsSync(p)) {
      return parse(fs.readFileSync(p, "utf8"), {
        columns: true,
        skip_empty_lines: true,
        relax_column_count: true,
        relax_quotes: true,
      });
    }
  }
  throw new Error(`No encontré ${nombre} en ${posibles.join(" ni ")}`);
}

async function seedProductos(conn) {
  const rows = leerCSV("productos_rows.csv");
  console.log(`Importando ${rows.length} productos...`);
  for (const r of rows) {
    await conn.query(
      `INSERT IGNORE INTO productos
         (id, marca, categoria, nombre, descripcion, foto,
          precio_costo_usd, precio_costo_ars, precio_minorista, precio_mayorista,
          stock, en_stock, created_at, updated_at, tipo_seccion, es_caja)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        r.id, r.marca, r.categoria, r.nombre, r.descripcion || null, r.foto || null,
        Number(r.precio_costo_usd) || 0,
        Number(r.precio_costo_ars) || 0,
        Number(r.precio_minorista) || 0,
        Number(r.precio_mayorista) || 0,
        Number(r.stock) || 0,
        r.en_stock === "true" ? 1 : 0,
        r.created_at || null,
        r.updated_at || null,
        r.tipo_seccion || "pedido",
        r.es_caja === "true" ? 1 : 0,
      ]
    );
  }
  console.log("✓ Productos importados");
}

async function seedVentas(conn) {
  const rows = leerCSV("ventas_rows.csv");
  console.log(`Importando ${rows.length} ventas...`);
  for (const r of rows) {
    await conn.query(
      `INSERT IGNORE INTO ventas
         (id, fecha, producto_id, producto_nombre, marca, categoria,
          cantidad, precio_unitario, tipo, canal, cliente, costo_unitario, notas,
          created_at, descuento_pct, medio_pago, total_ars, total_usd,
          con_caja, precio_caja_usd, producto_caja_id)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        r.id, r.fecha, r.producto_id || null, r.producto_nombre, r.marca || null, r.categoria || null,
        Number(r.cantidad) || 1, Number(r.precio_unitario) || 0,
        r.tipo || "minorista", r.canal || "Otro", r.cliente || null,
        Number(r.costo_unitario) || 0, r.notas || null,
        r.created_at || null, Number(r.descuento_pct) || 0, r.medio_pago || "Efectivo",
        Number(r.total_ars) || 0, Number(r.total_usd) || 0,
        r.con_caja === "true" ? 1 : 0, Number(r.precio_caja_usd) || 0,
        r.producto_caja_id || null,
      ]
    );
  }
  console.log("✓ Ventas importadas");
}

async function seedGastos(conn) {
  const rows = leerCSV("gastos_rows.csv");
  console.log(`Importando ${rows.length} gastos...`);
  for (const r of rows) {
    await conn.query(
      "INSERT IGNORE INTO gastos (id, fecha, descripcion, categoria, monto_ars, monto_usd, comprobante, notas, created_at) VALUES (?,?,?,?,?,?,?,?,?)",
      [r.id, r.fecha, r.descripcion, r.categoria, Number(r.monto_ars)||0, Number(r.monto_usd)||0, r.comprobante||null, r.notas||null, r.created_at||null]
    );
  }
  console.log("✓ Gastos importados");
}

async function seedIngresos(conn) {
  const rows = leerCSV("ingresos_rows.csv");
  console.log(`Importando ${rows.length} ingresos...`);
  for (const r of rows) {
    await conn.query(
      "INSERT IGNORE INTO ingresos (id, created_at, fecha, descripcion, categoria, monto_ars, monto_usd, medio_pago, notas) VALUES (?,?,?,?,?,?,?,?,?)",
      [r.id, r.created_at||null, r.fecha, r.descripcion, r.categoria, Number(r.monto_ars)||0, Number(r.monto_usd)||0, r.medio_pago||null, r.notas||null]
    );
  }
  console.log("✓ Ingresos importados");
}

async function seedCompras(conn) {
  const rows = leerCSV("compras_rows.csv");
  console.log(`Importando ${rows.length} compras...`);
  for (const r of rows) {
    await conn.query(
      "INSERT IGNORE INTO compras (id, created_at, fecha, proveedor, producto_id, producto_nombre, cantidad, precio_costo_unitario, total_ars, notas, costo_caja_usd, dolar_dia) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
      [r.id, r.created_at||null, r.fecha, r.proveedor||null, r.producto_id||null, r.producto_nombre, Number(r.cantidad)||1, Number(r.precio_costo_unitario)||0, Number(r.total_ars)||0, r.notas||null, Number(r.costo_caja_usd)||0, Number(r.dolar_dia)||0]
    );
  }
  console.log("✓ Compras importadas");
}

async function seedConfiguracion(conn) {
  const rows = leerCSV("configuracion_rows.csv");
  console.log(`Importando ${rows.length} configuraciones...`);
  for (const r of rows) {
    await conn.query(
      "INSERT INTO configuracion (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)",
      [r.key, r.value]
    );
  }
  console.log("✓ Configuración importada");
}

async function seedFotos(conn) {
  const rows = leerCSV("producto_fotos_rows.csv");
  console.log(`Importando ${rows.length} fotos...`);
  for (const r of rows) {
    await conn.query(
      "INSERT IGNORE INTO producto_fotos (id, producto_id, url, orden, created_at) VALUES (?,?,?,?,?)",
      [r.id, r.producto_id, r.url, Number(r.orden)||0, r.created_at||null]
    );
  }
  console.log("✓ Fotos importadas");
}

async function main() {
  const conn = await pool.getConnection();
  try {
    console.log("Conectado a MySQL. Iniciando importación...\n");

    // Crear schema
    const schema = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
    // Ejecutar cada statement por separado
    const statements = schema.split(";").map(s => s.trim()).filter(Boolean);
    for (const sql of statements) {
      await conn.query(sql);
    }
    console.log("✓ Schema creado\n");

    await conn.beginTransaction();
    await seedProductos(conn);
    await seedVentas(conn);
    await seedGastos(conn);
    await seedIngresos(conn);
    await seedCompras(conn);
    await seedConfiguracion(conn);
    await seedFotos(conn);
    await conn.commit();

    console.log("\n✅ Migración completa!");
  } catch (err) {
    await conn.rollback();
    console.error("❌ Error en la migración:", err.message);
    process.exit(1);
  } finally {
    conn.release();
    pool.end();
  }
}

main();
