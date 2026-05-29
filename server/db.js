const mysql  = require("mysql2/promise");
require("dotenv").config();

const pool = mysql.createPool({
  uri:             process.env.DATABASE_URL,
  waitForConnections: true,
  connectionLimit: 10,
  ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : undefined,
});

module.exports = pool;
