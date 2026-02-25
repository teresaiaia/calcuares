-- ============================================================
-- Correccion de vulnerabilidades de seguridad - Supabase
-- Fecha: 2026-02-25
-- Reporte: Security Advisor (22 Feb 2026)
-- Proyecto: CALCU (kxmramlwuyxugohpkyii)
-- ============================================================

-- CORRECCION 1: Habilitar RLS en tabla public.articulos
-- Problema: La tabla articulos es publica sin Row Level Security,
-- permitiendo acceso no autorizado a los datos.
-- Solucion: Activar RLS y crear politica de acceso para usuarios autenticados.

ALTER TABLE public.articulos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Acceso completo para usuarios autenticados"
ON public.articulos
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- CORRECCION 2: Eliminar Security Definer en vista_compras_cargas
-- Problema: La vista usa SECURITY DEFINER, ejecutandose con permisos
-- del creador en vez del usuario que consulta, saltandose politicas RLS.
-- Solucion: Cambiar a SECURITY INVOKER para respetar permisos del usuario.

ALTER VIEW public.vista_compras_cargas SET (security_invoker = on);
