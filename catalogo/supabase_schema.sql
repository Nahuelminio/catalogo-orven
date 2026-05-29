-- ══════════════════════════════════════════════
-- ORVEN — Schema Supabase
-- Ejecutar en: Supabase → SQL Editor → Run
-- ══════════════════════════════════════════════

-- 1. CONFIGURACIÓN (dólar, etc.)
CREATE TABLE IF NOT EXISTS configuracion (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
INSERT INTO configuracion (key, value) VALUES
  ('dolar', '1200'),
  ('moneda_mayorista', 'USD'),
  ('moneda_minorista', 'ARS')
ON CONFLICT (key) DO NOTHING;

-- 2. PRODUCTOS
CREATE TABLE IF NOT EXISTS productos (
  id                BIGSERIAL PRIMARY KEY,
  marca             TEXT NOT NULL DEFAULT '',
  categoria         TEXT NOT NULL DEFAULT '',
  nombre            TEXT NOT NULL,
  descripcion       TEXT DEFAULT '',
  foto              TEXT DEFAULT '',
  precio_costo_usd  NUMERIC(10,2) DEFAULT 0,
  precio_costo_ars  NUMERIC(10,2) DEFAULT 0,
  precio_minorista  NUMERIC(10,2) DEFAULT 0,
  precio_mayorista  NUMERIC(10,2) DEFAULT 0,
  stock             INTEGER DEFAULT 0,
  en_stock          BOOLEAN DEFAULT TRUE,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-actualizar updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER productos_updated_at
  BEFORE UPDATE ON productos
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 3. VENTAS
CREATE TABLE IF NOT EXISTS ventas (
  id               BIGSERIAL PRIMARY KEY,
  fecha            DATE NOT NULL DEFAULT CURRENT_DATE,
  producto_id      BIGINT REFERENCES productos(id) ON DELETE SET NULL,
  producto_nombre  TEXT NOT NULL,   -- denormalizado por si se borra el producto
  marca            TEXT DEFAULT '',
  categoria        TEXT DEFAULT '',
  cantidad         INTEGER NOT NULL DEFAULT 1,
  precio_unitario  NUMERIC(10,2) NOT NULL DEFAULT 0,
  tipo             TEXT NOT NULL DEFAULT 'minorista' CHECK (tipo IN ('minorista','mayorista')),
  canal            TEXT DEFAULT '',   -- mostrador, instagram, whatsapp, etc.
  cliente          TEXT DEFAULT '',
  costo_unitario   NUMERIC(10,2) DEFAULT 0,
  notas            TEXT DEFAULT '',
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Columnas calculadas como vistas para no duplicar lógica
CREATE OR REPLACE VIEW ventas_detalle AS
SELECT
  v.*,
  v.precio_unitario * v.cantidad                       AS total,
  (v.precio_unitario - v.costo_unitario) * v.cantidad  AS ganancia,
  CASE WHEN v.precio_unitario > 0
    THEN ROUND(((v.precio_unitario - v.costo_unitario) / v.precio_unitario * 100)::numeric, 1)
    ELSE 0
  END AS margen_pct
FROM ventas v;

-- 4. GASTOS
CREATE TABLE IF NOT EXISTS gastos (
  id           BIGSERIAL PRIMARY KEY,
  fecha        DATE NOT NULL DEFAULT CURRENT_DATE,
  descripcion  TEXT NOT NULL,
  categoria    TEXT NOT NULL DEFAULT 'Operativo'
               CHECK (categoria IN ('CM/Plataformas','Logística','Operativo','Otros')),
  monto_ars    NUMERIC(10,2) DEFAULT 0,
  monto_usd    NUMERIC(10,2) DEFAULT 0,
  comprobante  TEXT DEFAULT '',
  notas        TEXT DEFAULT '',
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ══════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- El catálogo es público (lectura). Escritura solo con auth.
-- ══════════════════════════════════════════════
ALTER TABLE productos    ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas       ENABLE ROW LEVEL SECURITY;
ALTER TABLE gastos       ENABLE ROW LEVEL SECURITY;
ALTER TABLE configuracion ENABLE ROW LEVEL SECURITY;

-- Lectura pública de productos y configuracion (catálogo web)
CREATE POLICY "productos_lectura_publica"
  ON productos FOR SELECT USING (en_stock = TRUE);

CREATE POLICY "config_lectura_publica"
  ON configuracion FOR SELECT USING (TRUE);

-- Escritura solo para usuarios autenticados (admin)
CREATE POLICY "productos_admin"
  ON productos FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "ventas_admin"
  ON ventas FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "gastos_admin"
  ON gastos FOR ALL USING (auth.role() = 'authenticated');

-- Para que el admin pueda ver TODOS los productos (incluidos sin stock)
DROP POLICY IF EXISTS "productos_lectura_publica" ON productos;

CREATE POLICY "productos_lectura_publica"
  ON productos FOR SELECT
  USING (TRUE);  -- admin filtra en frontend; RLS más estricto se agrega luego con auth
