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

-- 5. Agregar columna de player_id en event_registrations para vincular al usuario de Supabase Auth
ALTER TABLE public.event_registrations ADD COLUMN IF NOT EXISTS player_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- 6. Trigger para generar notificaciones automáticamente en league_state al inscribirse un jugador
CREATE OR REPLACE FUNCTION public.notify_player_joined()
RETURNS TRIGGER AS $$
DECLARE
    current_event JSONB;
    new_notification JSONB;
    notifications_list JSONB;
BEGIN
    -- Obtener el active_event actual
    SELECT active_event INTO current_event 
    FROM public.league_state 
    WHERE host_id = NEW.host_id;
    
    -- Si hay un evento activo, añadir la notificación
    IF current_event IS NOT NULL THEN
        new_notification := jsonb_build_object(
            'id', NEW.id,
            'player_name', NEW.name,
            'timestamp', NOW(),
            'type', 'join',
            'read', false
        );
        
        -- Inicializar o concatenar en el array de notificaciones
        IF current_event ? 'notifications' THEN
            notifications_list := (current_event->'notifications') || jsonb_build_array(new_notification);
        ELSE
            notifications_list := jsonb_build_array(new_notification);
        END IF;
        
        -- Actualizar la tabla league_state
        UPDATE public.league_state 
        SET active_event = jsonb_set(current_event, '{notifications}', notifications_list),
            updated_at = NOW()
        WHERE host_id = NEW.host_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_player_registered
    AFTER INSERT ON public.event_registrations
    FOR EACH ROW EXECUTE FUNCTION public.notify_player_joined();


-- ========================================================
-- ITERACIÓN 10: AUTO-EDICIÓN DE SKILLS PARA JUGADORES INVITADOS
-- ========================================================

-- 1. Función RPC para permitir a los jugadores actualizar sus propias estadísticas en el roster de la liga (dentro del JSONB de league_state)
CREATE OR REPLACE FUNCTION public.update_player_in_roster(
    p_league_id UUID,
    p_player_id UUID,
    p_name TEXT,
    p_role TEXT,
    p_avatar TEXT,
    p_stats JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_roster JSONB;
    v_updated_roster JSONB;
    v_item JSONB;
BEGIN
    SELECT roster INTO v_roster FROM public.league_state WHERE host_id = p_league_id;
    IF v_roster IS NULL THEN
        RAISE EXCEPTION 'League not found';
    END IF;

    v_updated_roster := '[]'::jsonb;
    FOR v_item IN SELECT * FROM jsonb_array_elements(v_roster)
    LOOP
        IF (v_item->>'id' = p_player_id::text) OR (v_item->>'player_id' = p_player_id::text) OR (v_item->>'name' = p_name) THEN
            v_item := jsonb_set(v_item, '{name}', to_jsonb(p_name));
            v_item := jsonb_set(v_item, '{role}', to_jsonb(p_role));
            v_item := jsonb_set(v_item, '{avatar}', to_jsonb(p_avatar));
            v_item := jsonb_set(v_item, '{stats}', p_stats);
        END IF;
        v_updated_roster := v_updated_roster || jsonb_build_array(v_item);
    END LOOP;

    UPDATE public.league_state
    SET roster = v_updated_roster,
        updated_at = now()
    WHERE host_id = p_league_id;
END;
$$;

-- 2. Política RLS para permitir a los usuarios actualizar su propio registro en event_registrations
CREATE POLICY "Users can update their own event registrations" ON public.event_registrations
    FOR UPDATE USING (player_id = auth.uid() OR name = (SELECT name FROM public.event_registrations WHERE player_id = auth.uid() LIMIT 1));




