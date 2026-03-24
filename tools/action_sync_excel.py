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

            meta = part_meta.get(name, {})

            ranking_list.append({
                "participant_id": slugify(name),
                "name": name,
                "total_points": total,
                "first_phase_points": p_1a,
                "playoff_points": p_po,
                "round_of_16_points": p_o8,
                "superclassic_points": p_sc,
                "hope_solo_hits": 0,
                "favorite_team": meta.get("favorito", "-"),
                "scorer_pick": meta.get("artilheiro", "-"),
                "assist_pick": meta.get("garcom", "-")
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

        p_cols = {}
        for c in range(5, 50):
            val = normalize(ws.cell(row=2, column=c).value)
            if val:
                p_cols[val] = c

        match_row = 3
        while True:
            match_lbl = normalize(ws.cell(row=match_row, column=1).value)
            if not match_lbl:
                if match_row > 100: break
                match_row += 1
                continue
            
            home_team = normalize(ws.cell(row=match_row, column=2).value)
            away_team = normalize(ws.cell(row=match_row+1, column=2).value)
            
            if " x " not in match_lbl:
                lbl = f"{home_team} x {away_team}"
            else:
                lbl = match_lbl

            official_score_h = normalize(ws.cell(row=match_row, column=3).value)
            official_score_a = normalize(ws.cell(row=match_row+1, column=3).value)
            official_res = f"{official_score_h}x{official_score_a}" if official_score_h != "" and official_score_a != "" else ""

            sh = None
            sa = None
            try:
                if official_score_h != "": sh = int(official_score_h)
                if official_score_a != "": sa = int(official_score_a)
            except:
                pass

            matches_list.append({
                "phase_key": phase_key,
                "round_label": lbl,
                "home_team_name": home_team,
                "away_team_name": away_team,
                "score_home_90": sh,
                "score_away_90": sa,
                "is_finished": 1 if sh is not None else 0
            })

            fixture = {
                "label": lbl,
                "official": official_res,
                "picks": []
            }

            for p_name, c in p_cols.items():
                ph = str(ws.cell(row=match_row, column=c).value).strip() if ws.cell(row=match_row, column=c).value is not None else ""
                pa = str(ws.cell(row=match_row+1, column=c).value).strip() if ws.cell(row=match_row+1, column=c).value is not None else ""
                
                # Check points in right adjacent column if available
                pts = normalize(ws.cell(row=match_row, column=c+1).value)
                pt_val = ""
                if pts and pts != "None":
                    try:
                        pt_val = str(float(pts))
                    except:
                        pass
                
                if ph != "" and pa != "":
                    fixture["picks"].append({
                        "participant": p_name,
                        "pick": f"{ph}x{pa}",
                        "rank_value": pt_val
                    })

            fixtures.append(fixture)
            match_row += 2

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
