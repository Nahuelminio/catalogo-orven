-- ── PRODUCTOS ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS productos (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  marca               VARCHAR(100),
  categoria           VARCHAR(100),
  nombre              VARCHAR(200),
  descripcion         TEXT,
  foto                TEXT,
  precio_costo_usd    DECIMAL(10,2) DEFAULT 0,
  precio_costo_ars    DECIMAL(10,2) DEFAULT 0,
  precio_minorista    DECIMAL(10,2) DEFAULT 0,
  precio_mayorista    DECIMAL(10,2) DEFAULT 0,
  stock               INT DEFAULT 0,
  en_stock            TINYINT(1) DEFAULT 1,
  created_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  tipo_seccion        VARCHAR(50) DEFAULT 'pedido',
  es_caja             TINYINT(1) DEFAULT 0
);

-- ── VENTAS ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ventas (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  fecha               DATE NOT NULL,
  producto_id         INT,
  producto_nombre     VARCHAR(200),
  marca               VARCHAR(100),
  categoria           VARCHAR(100),
  cantidad            INT DEFAULT 1,
  precio_unitario     DECIMAL(10,2) DEFAULT 0,
  tipo                VARCHAR(20) DEFAULT 'minorista',
  canal               VARCHAR(50) DEFAULT 'Mostrador',
  cliente             VARCHAR(200),
  costo_unitario      DECIMAL(10,2) DEFAULT 0,
  notas               TEXT,
  created_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
  descuento_pct       DECIMAL(5,2) DEFAULT 0,
  medio_pago          VARCHAR(50) DEFAULT 'Efectivo',
  total_ars           DECIMAL(10,2) DEFAULT 0,
  total_usd           DECIMAL(10,2) DEFAULT 0,
  con_caja            TINYINT(1) DEFAULT 0,
  precio_caja_usd     DECIMAL(10,2) DEFAULT 0,
  producto_caja_id    INT
);

-- ── GASTOS ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gastos (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  fecha               DATE NOT NULL,
  descripcion         VARCHAR(200),
  categoria           VARCHAR(100),
  monto_ars           DECIMAL(10,2) DEFAULT 0,
  monto_usd           DECIMAL(10,2) DEFAULT 0,
  comprobante         VARCHAR(200),
  notas               TEXT,
  created_at          DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ── INGRESOS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ingresos (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  created_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
  fecha               DATE NOT NULL,
  descripcion         VARCHAR(200),
  categoria           VARCHAR(100),
  monto_ars           DECIMAL(10,2) DEFAULT 0,
  monto_usd           DECIMAL(10,2) DEFAULT 0,
  medio_pago          VARCHAR(50),
  notas               TEXT
);

-- ── COMPRAS ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS compras (
  id                    INT AUTO_INCREMENT PRIMARY KEY,
  created_at            DATETIME DEFAULT CURRENT_TIMESTAMP,
  fecha                 DATE NOT NULL,
  proveedor             VARCHAR(200),
  producto_id           INT,
  producto_nombre       VARCHAR(200),
  cantidad              INT DEFAULT 1,
  precio_costo_unitario DECIMAL(10,2) DEFAULT 0,
  total_ars             DECIMAL(10,2) DEFAULT 0,
  notas                 TEXT,
  costo_caja_usd        DECIMAL(10,2) DEFAULT 0,
  dolar_dia             DECIMAL(10,2) DEFAULT 0
);

-- ── CONFIGURACION ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS configuracion (
  `key`   VARCHAR(100) PRIMARY KEY,
  `value` TEXT
);

INSERT IGNORE INTO configuracion (`key`, `value`) VALUES
  ('dolar',            '1200'),
  ('moneda_mayorista', 'USD'),
  ('moneda_minorista', 'ARS'),
  ('saldo_inicial',    '0');

-- ── FOTOS DE PRODUCTOS ───────────────────────────────────
CREATE TABLE IF NOT EXISTS producto_fotos (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  producto_id INT NOT NULL,
  url         TEXT NOT NULL,
  orden       INT DEFAULT 0,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);
