import math
from datetime import datetime

class Glicko2Engine:
    def __init__(self, tau=0.5):
        self.tau = tau  # Constante del sistema para la volatilidad
        
    def apply_time_decay(self, current_phi, last_played_at, current_time):
        """
        Incrementa la incertidumbre (phi) basada en la inactividad.
        Aplica decaimiento temporal estricto.
        """
        days_inactive = (current_time - last_played_at).days
        if days_inactive <= 0:
            return current_phi
            
        c = 10.0 # Factor de decaimiento empírico
        new_phi = math.sqrt(current_phi**2 + (c**2 * days_inactive))
        return min(new_phi, 350.0) # Cap a 350 para jugadores unrated
        
    def calculate_synergy(self, player_1_stats, player_2_stats, synergy_record):
        """
        Factor WAR: Synergy = (Wins - ExpectedWins) / MatchesPlayed
        """
        matches = synergy_record.get('matches_played_together', 0)
        if matches == 0:
            return 0.0
            
        wins = synergy_record.get('wins_together', 0)
        expected_wins = synergy_record.get('expected_wins', 0.0)
        
        return (wins - expected_wins) / matches
        
    def balance_teams(self, roster):
        """
        1. Asigna posiciones defensivas/porteros (Anclas)
        2. Bloquea paridad posicional
        3. Evita Sinergia desproporcionada separando jugadores
        """
        # Separar Anclas/Porteros de los demas
        anclas = [p for p in roster if p.get('posicion', '').lower() in ['ancla', 'portero', 'arquero', 'defensa']]
        otros = [p for p in roster if p.get('posicion', '').lower() not in ['ancla', 'portero', 'arquero', 'defensa']]

        # Ordenar por mu descendente
        anclas.sort(key=lambda x: x.get('mu', 1500), reverse=True)
        otros.sort(key=lambda x: x.get('mu', 1500), reverse=True)

        team_a = []
        team_b = []
        mu_a = 0.0
        mu_b = 0.0

        # Distribuir anclas equitativamente
        for p in anclas:
            diff_size = len(team_a) - len(team_b)
            if diff_size == 0:
                if mu_a <= mu_b:
                    team_a.append(p)
                    mu_a += p.get('mu', 1500)
                else:
                    team_b.append(p)
                    mu_b += p.get('mu', 1500)
            elif diff_size < 0:
                team_a.append(p)
                mu_a += p.get('mu', 1500)
            else:
                team_b.append(p)
                mu_b += p.get('mu', 1500)

        # Distribuir los demas jugadores
        for p in otros:
            diff_size = len(team_a) - len(team_b)
            if diff_size == 0:
                if mu_a <= mu_b:
                    team_a.append(p)
                    mu_a += p.get('mu', 1500)
                else:
                    team_b.append(p)
                    mu_b += p.get('mu', 1500)
            elif diff_size < 0:
                team_a.append(p)
                mu_a += p.get('mu', 1500)
            else:
                team_b.append(p)
                mu_b += p.get('mu', 1500)

        return {
            "team_a": team_a,
            "team_b": team_b,
            "mu_a": mu_a,
            "mu_b": mu_b
        }
