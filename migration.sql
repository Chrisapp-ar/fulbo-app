-- ========================================================
-- FULBO B2B SAAS - MIGRACIÓN DE SUSCRIPCIONES
-- Ejecutar este script en el editor de SQL de Supabase
-- ========================================================

-- 1. Añadir columnas de suscripción a la tabla hosts si no existen
ALTER TABLE public.hosts ADD COLUMN IF NOT EXISTS subscription_type VARCHAR(50) DEFAULT 'trial';
ALTER TABLE public.hosts ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(50) DEFAULT 'active';
ALTER TABLE public.hosts ADD COLUMN IF NOT EXISTS subscription_ends_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '1 week';

-- 2. Modificar la función trigger para inicializar correctamente a los nuevos hosts con una semana de trial gratis
CREATE OR REPLACE FUNCTION public.handle_new_host()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.hosts (id, email, subscription_type, subscription_status, subscription_ends_at)
    VALUES (new.id, new.email, 'trial', 'active', NOW() + INTERVAL '1 week');
    
    INSERT INTO public.league_state (host_id, roster, match_history)
    VALUES (new.id, '[]'::jsonb, '[]'::jsonb);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================================
-- CORRECCIÓN: PERMISOS DE INVITADO Y LECTURA PÚBLICA RLS
-- ========================================================

-- 1. Permitir lectura pública de hosts (requerido para validar suscripción en la Companion App)
CREATE POLICY "Allow public read access to hosts" ON public.hosts FOR SELECT USING (true);

-- 2. Por seguridad estricta, revocar permisos de lectura sobre la columna sensible del token a usuarios generales
REVOKE SELECT ON public.hosts FROM public;
REVOKE SELECT ON public.hosts FROM anon;
REVOKE SELECT ON public.hosts FROM authenticated;

-- 3. Volver a otorgar SELECT solo en las columnas seguras y públicas
GRANT SELECT (id, email, organization_name, subscription_type, subscription_status, subscription_ends_at, mercadopago_user_id, created_at) ON public.hosts TO public;
GRANT SELECT (id, email, organization_name, subscription_type, subscription_status, subscription_ends_at, mercadopago_user_id, created_at) ON public.hosts TO anon;
GRANT SELECT (id, email, organization_name, subscription_type, subscription_status, subscription_ends_at, mercadopago_user_id, created_at) ON public.hosts TO authenticated;
GRANT SELECT (mercadopago_access_token) ON public.hosts TO authenticated;

-- 4. Permitir lectura pública de registros de eventos para que la app de invitado verifique el límite de 15 jugadores
CREATE POLICY "Allow public read access to event registrations" ON public.event_registrations FOR SELECT USING (true);

