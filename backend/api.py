from fastapi import FastAPI
from pydantic import BaseModel
from typing import List, Optional, Any
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from glicko_engine import Glicko2Engine

app = FastAPI()
engine = Glicko2Engine()

class Player(BaseModel):
    id: str
    nombre: str
    mu: float
    posicion: Optional[str] = ""

class RosterRequest(BaseModel):
    roster: List[Player]

@app.post("/balance_teams")
def balance_teams(request: RosterRequest):
    # Convert Pydantic models to dicts as expected by the engine
    roster_dicts = [player.dict() for player in request.roster]
    
    # Call the balancing algorithm
    result = engine.balance_teams(roster_dicts)
    
    return result

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
