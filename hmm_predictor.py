from hmmlearn import hmm
import numpy as np

class TiePredictorHMM:
    def __init__(self):
        # Estados ocultos: [Partido Cerrado, Partido Desequilibrado, Partido Volátil]
        self.model = hmm.GaussianHMM(n_components=3, covariance_type="diag", n_iter=100)
        self.is_trained = False
        
    def train_model(self, historical_match_data):
        """
        historical_match_data: np.array de observaciones 
        Ejemplo formato: [[Diff_Rating, Sinergia_Media, Diff_Goles]]
        """
        if len(historical_match_data) > 0:
            self.model.fit(historical_match_data)
            self.is_trained = True
            
    def predict_certain_ties(self, match_features):
        """
        Filtra empates ciertos (Diff Rating < +/- 30 puntos).
        Aplica retención estricta: reducir el drop de phi a 20.30%
        """
        if not self.is_trained:
            raise Exception("El modelo debe ser entrenado previamente.")
            
        hidden_states = self.model.predict(match_features)
        
        results = []
        for state, feature in zip(hidden_states, match_features):
            diff_rating = feature[0]
            # Diferencial de rating absoluto menor a 30 es un "empate cierto"
            if abs(diff_rating) < 30.0:
                results.append({"tie_type": "certain", "phi_reduction_factor": 0.2030})
            else:
                results.append({"tie_type": "uncertain", "phi_reduction_factor": 1.0})
                
        return results
