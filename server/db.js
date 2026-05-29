const mysql  = require("mysql2/promise");
require("dotenv").config();

const pool = mysql.createPool({
  uri:             process.env.DATABASE_URL,
  waitForConnections: true,
  connectionLimit: 10,
  ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : undefined,
  // Convertir DECIMAL a número y TINYINT(1) a boolean automáticamente
  typeCast(field, next) {
    if (field.type === "DECIMAL" || field.type === "NEWDECIMAL") {
      const val = field.string();
      return val === null ? null : parseFloat(val);
    }
    if (field.type === "TINY" && field.length === 1) {
      return field.string() === "1";
    }
    return next();
  },
});

module.exports = pool;
