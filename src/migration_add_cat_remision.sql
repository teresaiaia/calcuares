-- ============================================
-- MIGRACIÓN: Agregar CAT y NRO_REMISION a facturas
-- + corregir constraint de modalidad
-- ============================================

-- 1. Nuevas columnas
ALTER TABLE facturas ADD COLUMN IF NOT EXISTS cat TEXT DEFAULT 'FAC';
ALTER TABLE facturas ADD COLUMN IF NOT EXISTS nro_remision TEXT;

-- 2. Corregir constraint modalidad (incluir Anulada y Bonificación)
ALTER TABLE facturas DROP CONSTRAINT IF EXISTS facturas_modalidad_check;
ALTER TABLE facturas ADD CONSTRAINT facturas_modalidad_check
  CHECK (modalidad IN ('Contado', 'Crédito', 'Anulada', 'Bonificación'));

-- Mismo fix para ordenes_servicio
ALTER TABLE ordenes_servicio DROP CONSTRAINT IF EXISTS ordenes_servicio_modalidad_check;
ALTER TABLE ordenes_servicio ADD CONSTRAINT ordenes_servicio_modalidad_check
  CHECK (modalidad IN ('Contado', 'Crédito', 'Anulada', 'Bonificación'));
