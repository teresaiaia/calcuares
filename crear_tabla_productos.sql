-- SCRIPT SQL PARA CREAR TABLA DE PRODUCTOS EN SUPABASE
-- Ejecuta este script en: Supabase Dashboard → SQL Editor → New Query

-- Crear tabla de productos
CREATE TABLE IF NOT EXISTS public.productos (
    id BIGSERIAL PRIMARY KEY,
    cod TEXT,
    brand TEXT,
    ori TEXT,
    prod TEXT,
    cat TEXT DEFAULT 'UC',
    pp DECIMAL(10,2) DEFAULT 0,
    frt DECIMAL(10,2) DEFAULT 0,
    bnk DECIMAL(10,2) DEFAULT 0,
    adu DECIMAL(10,2) DEFAULT 0,
    serv DECIMAL(10,2) DEFAULT 0,
    trng DECIMAL(10,2) DEFAULT 0,
    extr DECIMAL(10,2) DEFAULT 0,
    margin DECIMAL(10,2) DEFAULT 0,
    fixed_price DECIMAL(10,2) DEFAULT 0,
    price_in_eur BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Crear índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_productos_cod ON public.productos(cod);
CREATE INDEX IF NOT EXISTS idx_productos_cat ON public.productos(cat);
CREATE INDEX IF NOT EXISTS idx_productos_brand ON public.productos(brand);

-- Habilitar RLS (Row Level Security)
ALTER TABLE public.productos ENABLE ROW LEVEL SECURITY;

-- Crear políticas de acceso público (permite lectura/escritura a todos)
CREATE POLICY "Enable read access for all users" ON public.productos
    FOR SELECT USING (true);

CREATE POLICY "Enable insert for all users" ON public.productos
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for all users" ON public.productos
    FOR UPDATE USING (true);

CREATE POLICY "Enable delete for all users" ON public.productos
    FOR DELETE USING (true);

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar updated_at
CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON public.productos
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

COMMENT ON TABLE public.productos IS 'Tabla de productos para calculadora de precios Ares';
