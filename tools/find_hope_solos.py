import json

def get_hope_solos(json_file):
    with open(json_file, 'r', encoding='utf-8') as f:
        data = json.load(f)

    hope_solos = {}

    for record in data.get('records', []):
        official = record.get('official')
        if not official or official == '—':
            continue

        # Count how many people picked the official winner/draw
        correct_participants = []
        for p in record.get('picks', []):
            if p.get('pick') == official:
                correct_participants.append(p.get('participant'))

        # If exactly 1 person got it right
        if len(correct_participants) == 1:
            winner = correct_participants[0]
            hope_solos[winner] = hope_solos.get(winner, 0) + 1
            print(f"Hope Solo em {record.get('matchday')} (Oficial: {official}) -> Ganhador: {winner}")

    print("\nTotal Hope Solos na Primeira Fase:")
    for p, count in sorted(hope_solos.items(), key=lambda x: x[1], reverse=True):
        print(f"{p}: {count}")

if __name__ == '__main__':
    get_hope_solos('league-phase.json')
