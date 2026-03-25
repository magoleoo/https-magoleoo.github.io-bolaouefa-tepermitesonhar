import json
import sys

def outcome(h, a):
    if h is None or a is None: return None
    if h > a: return 'home'
    if a > h: return 'away'
    return 'draw'

with open('league-phase.json') as f:
    data = json.load(f)

hope_solos = {}
matches_analyzed = 0

for item in data.get('records', []):
    match = item.get('match', {})
    off_h = match.get('score', {}).get('fullTime', {}).get('home')
    off_a = match.get('score', {}).get('fullTime', {}).get('away')
    
    if off_h is None or off_a is None:
        continue
    matches_analyzed += 1
    
    correct_outcomes = []
    
    for p in item.get('participantPredictions', []):
        pred_h = p.get('prediction', {}).get('home')
        pred_a = p.get('prediction', {}).get('away')
        if pred_h is None or pred_a is None:
            continue
            
        if outcome(pred_h, pred_a) == outcome(off_h, off_a):
            correct_outcomes.append(p.get('name'))
            
    if len(correct_outcomes) == 1:
        winner = correct_outcomes[0]
        hope_solos[winner] = hope_solos.get(winner, 0) + 1
        print(f"Hope Solo em {match.get('homeTeam', {}).get('shortName')} x {match.get('awayTeam', {}).get('shortName')} - Vencedor: {winner}")

print(f"Partidas analisadas: {matches_analyzed}")
print("Resultados Finais Hope Solo (Fase de Grupos):", hope_solos)
