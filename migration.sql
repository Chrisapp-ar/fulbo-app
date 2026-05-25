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
