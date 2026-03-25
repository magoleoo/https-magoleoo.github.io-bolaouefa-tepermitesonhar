import json
import os
import re
from pathlib import Path
import openpyxl

def slugify(s):
    if not s: return ""
    return str(s).strip().lower().replace(" ", "-")

def normalize(s):
    if not s or s == "None": return ""
    return str(s).strip()

def main():
    print("=== INICIANDO PARSER OFICIAL DO EXCEL ===")
    project_root = Path(os.path.dirname(__file__)).parent
    file_path = project_root / "data" / "Bolao_UEFA_25_26_OFICIAL.xlsx"
    if not os.path.exists(file_path):
        print(f"ERRO: Não encontrou {file_path}")
        return

    wb = openpyxl.load_workbook(file_path, data_only=True)

    # 1. PARSE 1a FASE (For Base Participants and Matchday 1)
    ws_1a = wb['1a FASE'] if '1a FASE' in wb.sheetnames else None
    
    participants = []
    part_meta = {} # name -> {artilheiro, garcom, favorito}

    if ws_1a:
        # Participantes estão na Row 2, a partir da Coluna 3
        # Mas vamos procurar a string 'PALPITE'
        r_palpite = 2
        col_start = 3
        while normalize(ws_1a.cell(row=r_palpite, column=col_start).value) != "" and col_start < 50:
            p_name = normalize(ws_1a.cell(row=r_palpite, column=col_start).value)
            if p_name:
                participants.append({"name": p_name, "col": col_start})
            col_start += 1

        # Metadados
        r_art = 5
        r_gar = 6
        r_fav = 7
        for p in participants:
            c = p["col"]
            part_meta[p["name"]] = {
                "artilheiro": normalize(ws_1a.cell(row=r_art, column=c).value),
                "garcom": normalize(ws_1a.cell(row=r_gar, column=c).value),
                "favorito": normalize(ws_1a.cell(row=r_fav, column=c).value)
            }

    # 2. PARSE RANKING TAB
    ranking_list = []
    ws_rank = wb['Ranking'] if 'Ranking' in wb.sheetnames else None
    if ws_rank:
        for r in range(5, 50):
            name = normalize(ws_rank.cell(row=r, column=4).value)
            if not name:
                continue
            
            try:
                total = float(ws_rank.cell(row=r, column=5).value or 0)
                p_1a = float(ws_rank.cell(row=r, column=6).value or 0)
                p_po = float(ws_rank.cell(row=r, column=7).value or 0)
                p_o8 = float(ws_rank.cell(row=r, column=8).value or 0)
                p_sc = float(ws_rank.cell(row=r, column=12).value or 0)
            except:
                total, p_1a, p_po, p_o8, p_sc = 0, 0, 0, 0, 0

            favorito = normalize(ws_rank.cell(row=r, column=13).value)
            garcom = normalize(ws_rank.cell(row=r, column=14).value)
            artilheiro = normalize(ws_rank.cell(row=r, column=15).value)

            ranking_list.append({
                "participant_id": slugify(name),
                "name": name,
                "total_points": total,
                "first_phase_points": p_1a,
                "playoff_points": p_po,
                "round_of_16_points": p_o8,
                "superclassic_points": p_sc,
                "hope_solo_hits": 0,
                "favorite_team": favorito if favorito else "-",
                "scorer_pick": artilheiro if artilheiro else "-",
                "assist_pick": garcom if garcom else "-"
            })

    # Sort Ranking by Total
    ranking_list.sort(key=lambda x: x["total_points"], reverse=True)

    # 3. EXTRAIR PHASES (Palpites)
    phases = {}

    matches_list = []

    def extract_knockout(sheet_name, phase_key):
        if sheet_name not in wb.sheetnames:
            return
        ws = wb[sheet_name]
        fixtures = []

        # Find ALL participant rows mapped to names, since names repeat 4 or 5 times down the sheet!
        from collections import defaultdict
        p_row_lists = defaultdict(list)
        for r in range(3, 120):
            name = normalize(ws.cell(row=r, column=2).value)
            if name and name != "None" and name != "" and name.lower() != "oficial" and name.lower() != "resultado":
                p_row_lists[name].append(r)

        # Matches are spaced columns across Row 2. e.g. Col 3, Col 8, Col 13
        for c in range(3, 200, 5):
            match_lbl = normalize(ws.cell(row=2, column=c).value)
            if not match_lbl or match_lbl == "None" or " x " not in match_lbl:
                continue

            # Look up official score by searching "oficial" down column 2
            official_score_h = ""
            official_score_a = ""
            for out_r in range(30, 100):
                if normalize(ws.cell(row=out_r, column=2).value).lower() in ["resultado oficial", "oficial", "placar", "resultado"]:
                    # Because official score blocks might also repeat, ensure we grab the one with actual numbers
                    oh = normalize(ws.cell(row=out_r, column=c).value)
                    oa = normalize(ws.cell(row=out_r, column=c+2).value)
                    op = normalize(ws.cell(row=out_r, column=c+1).value)
                    if oh != "" and oa != "" and op == "x":
                        official_score_h = oh
                        official_score_a = oa
                        break
            
            official_res = f"{official_score_h}x{official_score_a}" if official_score_h != "" and official_score_a != "" else "-"

            fixture = {
                "label": match_lbl,
                "official": official_res,
                "picks": []
            }

            for p_name, rows in p_row_lists.items():
                best_ph, best_pa, best_pts = "", "", ""
                
                # Check each row this participant appears in
                for pr in rows:
                    ph = normalize(ws.cell(row=pr, column=c).value)
                    sep = normalize(ws.cell(row=pr, column=c+1).value)
                    pa = normalize(ws.cell(row=pr, column=c+2).value)
                    pts = normalize(ws.cell(row=pr, column=c+4).value)
                    
                    # We want the section that has 'x' in the middle column
                    if sep == "x" and ph != "" and pa != "":
                        best_ph = ph
                        best_pa = pa
                        if pts and pts != "None":
                            try:
                                best_pts = str(float(pts))
                            except: pass
                        break
                
                if best_ph != "" and best_pa != "" and best_ph != "None" and best_pa != "None":
                    fixture["picks"].append({
                        "participant": p_name,
                        "pick": f"{best_ph}x{best_pa}",
                        "rank_value": best_pts
                    })

            if fixture["picks"]:
                fixtures.append(fixture)

        if fixtures:
            phases[phase_key] = {"fixtures": fixtures}

    extract_knockout('PLAYOFF_1aFASE', 'PLAYOFF')
    extract_knockout('OITAVAS', 'ROUND_OF_16')

    # LEAGUE PHASE
    if ws_1a:
        fixtures_1a = []
        r = 8
        while r < 200:
            md = normalize(ws_1a.cell(row=r, column=1).value)
            if not md: break
            
            off = normalize(ws_1a.cell(row=r, column=2).value)
            
            fixture = {
                "label": md,
                "official": off,
                "picks": []
            }
            
            for p in participants:
                pick_val = normalize(ws_1a.cell(row=r, column=p["col"]).value)
                if pick_val:
                    fixture["picks"].append({
                        "participant": p["name"],
                        "pick": pick_val,
                        "rank_value": ""
                    })
            if fixture["picks"]:
                fixtures_1a.append(fixture)
            r += 1
            
        if fixtures_1a:
            phases["LEAGUE"] = {"fixtures": fixtures_1a}


    # Calculate Hope Solo Hits
    hope_solos = {p["name"]: 0 for p in ranking_list}
    for phase_key, phase_data in phases.items():
        for fixture in phase_data["fixtures"]:
            off = fixture.get("official", "")
            if not off or off == "-" or off == "None": continue

            def is_hit(p, o):
                if not p or p == "None": return False
                if p == o: return True
                if "x" in p and "x" in o:
                    try:
                        ph, pa = map(int, p.split("x"))
                        oh, oa = map(int, o.split("x"))
                        if (ph > pa and oh > oa) or (ph < pa and oh < oa) or (ph == pa and oh == oa):
                            return True
                    except: pass
                return False

            correct_picks = []
            for pk in fixture["picks"]:
                if is_hit(pk["pick"], off):
                    correct_picks.append(pk["participant"])
            
            if len(correct_picks) == 1:
                hope_solos[correct_picks[0]] = hope_solos.get(correct_picks[0], 0) + 1
                        
    for r in ranking_list:
        r["hope_solo_hits"] = hope_solos.get(r["name"], 0)

    # OUTPUT JSON
    out_dir = project_root / "api"
    out_dir.mkdir(exist_ok=True)

    ranking_json = {
        "season": 2026,
        "ranking": ranking_list,
        "phases": phases
    }

    with open(out_dir / "ranking.json", "w", encoding="utf-8") as f:
        json.dump(ranking_json, f, ensure_ascii=False, indent=2)

    with open(out_dir / "matches.json", "w", encoding="utf-8") as f:
        json.dump({"matches": matches_list}, f, ensure_ascii=False, indent=2)

    print(f"=== SUCESSO! api/ranking.json GERAÇÃO CONCLUÍDA ({len(ranking_list)} particpantes) ===")

if __name__ == "__main__":
    main()
