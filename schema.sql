-- =========================================================
-- FULBO B2B SAAS - SUPABASE SCHEMA (V3 - Idempotente)
-- =========================================================

-- Limpieza de instalaciones previas para evitar errores "already exists"
DROP TABLE IF EXISTS event_registrations CASCADE;
DROP TABLE IF EXISTS league_state CASCADE;
DROP TABLE IF EXISTS match_events CASCADE;
DROP TABLE IF EXISTS matches CASCADE;
DROP TABLE IF EXISTS players CASCADE;
DROP TABLE IF EXISTS hosts CASCADE;
DROP TYPE IF EXISTS tactical_role CASCADE;

-- Habilitar extensión UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==========================================
-- 1. HOSTS (Ligas / Canchas)
-- ==========================================
-- Esta tabla vincula a los dueños de las ligas con el sistema Auth de Supabase.
CREATE TABLE hosts (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    organization_name VARCHAR(100),
    mercadopago_access_token TEXT,
    mercadopago_user_id VARCHAR(100),
    subscription_type VARCHAR(50) DEFAULT 'trial',
    subscription_status VARCHAR(50) DEFAULT 'active',
    subscription_ends_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '1 week',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar Row Level Security para que un Host no vea datos de otro
ALTER TABLE hosts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Hosts can manage their own data" ON hosts FOR ALL USING (auth.uid() = id);
CREATE POLICY "Allow public read access to hosts" ON hosts FOR SELECT USING (true);

-- Revocar lectura por defecto de hosts a roles generales para proteger datos sensibles como mercadopago_access_token
REVOKE SELECT ON public.hosts FROM public;
REVOKE SELECT ON public.hosts FROM anon;
REVOKE SELECT ON public.hosts FROM authenticated;

-- Otorgar SELECT solo en las columnas seguras y públicas
GRANT SELECT (id, email, organization_name, subscription_type, subscription_status, subscription_ends_at, mercadopago_user_id, created_at) ON public.hosts TO public;
GRANT SELECT (id, email, organization_name, subscription_type, subscription_status, subscription_ends_at, mercadopago_user_id, created_at) ON public.hosts TO anon;
GRANT SELECT (id, email, organization_name, subscription_type, subscription_status, subscription_ends_at, mercadopago_user_id, created_at) ON public.hosts TO authenticated;
GRANT SELECT (mercadopago_access_token) ON public.hosts TO authenticated;


-- ==========================================
-- 2. PLAYERS (Roster Comunitario)
-- ==========================================
CREATE TYPE tactical_role AS ENUM ('Ancla', 'Creativo', 'Finalizador', 'Capitan');

CREATE TABLE players (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    host_id UUID NOT NULL REFERENCES hosts(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    role tactical_role NOT NULL,
    avatar TEXT, -- URL de imagen o Emoji
    
    -- Estadísticas Granulares (JSONB permite escalabilidad futura sin alterar DDL)
    -- Estructura esperada: {"pac": 80, "sho": 75, "pas": 80, "dri": 85, "def": 60, "phy": 70}
    stats JSONB DEFAULT '{"pac": 75, "sho": 75, "pas": 75, "dri": 75, "def": 75, "phy": 75}'::jsonb,
    
    -- Historial Global (Leaderboard)
    pj INT DEFAULT 0,
    pg INT DEFAULT 0,
    goals INT DEFAULT 0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Políticas de Seguridad para Jugadores
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Hosts can fully manage their own players" ON players
    FOR ALL USING (auth.uid() = host_id);

-- ==========================================
-- 3. MATCHES (Historial de Partidos)
-- ==========================================
CREATE TABLE matches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    host_id UUID NOT NULL REFERENCES hosts(id) ON DELETE CASCADE,
    team_a_score INT DEFAULT 0,
    team_b_score INT DEFAULT 0,
    winner VARCHAR(10), -- 'A', 'B', 'Draw'
    played_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Hosts can fully manage their own matches" ON matches
    FOR ALL USING (auth.uid() = host_id);

-- ==========================================
-- 5. LEAGUE STATE (React State Sync)
-- ==========================================
-- Esta tabla permite sincronizar el estado complejo de React (Glicko, Finanzas, Historial) 
-- directamente en un formato JSONB atado al usuario, garantizando persistencia en la nube sin 
-- necesidad de mapear ORMs complejos en el MVP.
CREATE TABLE league_state (
    host_id UUID PRIMARY KEY REFERENCES hosts(id) ON DELETE CASCADE,
    roster JSONB DEFAULT '[]'::jsonb,
    match_history JSONB DEFAULT '[]'::jsonb,
    active_event JSONB,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE league_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Hosts can fully manage their own league state" ON league_state
    FOR ALL USING (auth.uid() = host_id);
CREATE POLICY "Public can read league state" ON league_state
    FOR SELECT USING (true);

-- ==========================================
-- 6. EVENT REGISTRATIONS (Lobby Público)
-- ==========================================
-- Buzón público para que los jugadores envíen su inscripción desde la Companion App
CREATE TABLE event_registrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    host_id UUID NOT NULL REFERENCES hosts(id) ON DELETE CASCADE,
    player_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    name VARCHAR(100) NOT NULL,
    role VARCHAR(50) NOT NULL,
    stats JSONB NOT NULL,
    avatar TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE event_registrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can insert event registrations" ON event_registrations
    FOR INSERT WITH CHECK (true);
CREATE POLICY "Hosts can fully manage their event registrations" ON event_registrations
    FOR ALL USING (auth.uid() = host_id);
CREATE POLICY "Allow public read access to event registrations" ON event_registrations
    FOR SELECT USING (true);


-- ==========================================
-- 7. AUTH TRIGGER (Auto-registro de Hosts)
-- ==========================================
-- Crea automáticamente el registro en la tabla pública public.hosts cuando un usuario se registra en auth.users
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

CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_host();

-- ==========================================
-- 8. NOTIFICATION TRIGGER (Notificaciones del Lobby)
-- ==========================================
-- Genera automáticamente una notificación en league_state.active_event cada vez que se inserta un registro en event_registrations
CREATE OR REPLACE FUNCTION public.notify_player_joined()
RETURNS TRIGGER AS $$
DECLARE
    current_event JSONB;
    new_notification JSONB;
    notifications_list JSONB;
BEGIN
    SELECT active_event INTO current_event 
    FROM public.league_state 
    WHERE host_id = NEW.host_id;
    
    IF current_event IS NOT NULL THEN
        new_notification := jsonb_build_object(
            'id', NEW.id,
            'player_name', NEW.name,
            'timestamp', NOW(),
            'type', 'join',
            'read', false
        );
        
        IF current_event ? 'notifications' THEN
            notifications_list := (current_event->'notifications') || jsonb_build_array(new_notification);
        ELSE
            notifications_list := jsonb_build_array(new_notification);
        END IF;
        
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

