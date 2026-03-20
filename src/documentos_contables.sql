-- ============================================
-- MÓDULO: DOCUMENTOS CONTABLES - Ares Paraguay SRL
-- ============================================

-- FACTURAS
CREATE TABLE IF NOT EXISTS facturas (
  id BIGSERIAL PRIMARY KEY,
  nro_factura TEXT NOT NULL UNIQUE,
  fecha DATE NOT NULL,
  cliente TEXT NOT NULL,
  modalidad TEXT NOT NULL CHECK (modalidad IN ('Contado', 'Crédito')),
  moneda TEXT NOT NULL DEFAULT '₲' CHECK (moneda IN ('₲', 'USD')),
  concepto TEXT,
  rubro TEXT,
  monto NUMERIC(18,2) NOT NULL DEFAULT 0,
  estado TEXT NOT NULL DEFAULT 'Pendiente',
  observaciones TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ÓRDENES DE SERVICIO
CREATE TABLE IF NOT EXISTS ordenes_servicio (
  id BIGSERIAL PRIMARY KEY,
  nro_os TEXT NOT NULL UNIQUE,
  fecha DATE NOT NULL,
  cliente TEXT NOT NULL,
  modalidad TEXT NOT NULL CHECK (modalidad IN ('Contado', 'Crédito')),
  moneda TEXT NOT NULL DEFAULT '₲' CHECK (moneda IN ('₲', 'USD')),
  concepto TEXT,
  rubro TEXT,
  monto NUMERIC(18,2) NOT NULL DEFAULT 0,
  estado TEXT NOT NULL DEFAULT 'Pendiente',
  observaciones TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RECIBOS (RO y RNO)
CREATE TABLE IF NOT EXISTS recibos (
  id BIGSERIAL PRIMARY KEY,
  nro_recibo TEXT NOT NULL UNIQUE,
  tipo TEXT NOT NULL CHECK (tipo IN ('RO', 'RNO')),
  fecha DATE NOT NULL,
  cliente TEXT NOT NULL,
  moneda TEXT NOT NULL DEFAULT '₲' CHECK (moneda IN ('₲', 'USD')),
  monto NUMERIC(18,2) NOT NULL DEFAULT 0,
  detalle TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RECIBO ↔ DOCUMENTO (relación N a N)
CREATE TABLE IF NOT EXISTS recibo_documentos (
  id BIGSERIAL PRIMARY KEY,
  recibo_id BIGINT NOT NULL REFERENCES recibos(id) ON DELETE CASCADE,
  tipo_documento TEXT NOT NULL CHECK (tipo_documento IN ('factura', 'orden_servicio')),
  documento_id BIGINT NOT NULL,
  monto_aplicado NUMERIC(18,2) DEFAULT 0
);

-- REMISIONES
CREATE TABLE IF NOT EXISTS remisiones (
  id BIGSERIAL PRIMARY KEY,
  nro_remision TEXT NOT NULL UNIQUE,
  fecha DATE NOT NULL,
  cliente TEXT NOT NULL,
  concepto TEXT,
  tipo_vinculo TEXT CHECK (tipo_vinculo IN ('factura', 'orden_servicio', NULL)),
  vinculo_id BIGINT,
  observaciones TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: solo admin puede operar (ajustar según política existente)
ALTER TABLE facturas ENABLE ROW LEVEL SECURITY;
ALTER TABLE ordenes_servicio ENABLE ROW LEVEL SECURITY;
ALTER TABLE recibos ENABLE ROW LEVEL SECURITY;
ALTER TABLE recibo_documentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE remisiones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for admin" ON facturas FOR ALL USING (true);
CREATE POLICY "Allow all for admin" ON ordenes_servicio FOR ALL USING (true);
CREATE POLICY "Allow all for admin" ON recibos FOR ALL USING (true);
CREATE POLICY "Allow all for admin" ON recibo_documentos FOR ALL USING (true);
CREATE POLICY "Allow all for admin" ON remisiones FOR ALL USING (true);
