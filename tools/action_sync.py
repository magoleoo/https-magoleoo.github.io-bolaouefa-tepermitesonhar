import json
import sqlite3
import urllib.request
from datetime import datetime
from pathlib import Path
from tempfile import NamedTemporaryFile
import sys
import os
import csv

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from backend.config import load_settings
from backend.db import connect, initialize_schema
from backend.scoring_engine import persist_leaderboard

def _get_or_create_team(conn, name: str) -> int:
    name = name.strip()
    row = conn.execute("SELECT id FROM teams WHERE name = ?", (name,)).fetchone()
    if row: return row["id"]
    cursor = conn.execute("INSERT INTO teams (name) VALUES (?)", (name,))
    return cursor.lastrowid

def _get_or_create_participant(conn, name: str) -> int:
    name = name.strip()
    slug = name.lower().replace(" ", "-")
    row = conn.execute("SELECT id FROM participants WHERE slug = ?", (slug,)).fetchone()
    if row: return row["id"]
    cursor = conn.execute("INSERT INTO participants (slug, name, access_code) VALUES (?, ?, '123456')", (slug, name))
    return cursor.lastrowid

def main():
    settings = load_settings()
    connection = connect(":memory:")
    connection.row_factory = sqlite3.Row
    SCHEMA_PATH = Path(settings.project_root) / "backend" / "schema.sql"
    initialize_schema(connection, SCHEMA_PATH)

    print("=== INICIANDO INGESTÃO MANUAL VIA CSV ===")

    data_dir = Path(settings.project_root) / "data"

    # 1. Injetar Partidas (Matches)
    matches_csv = data_dir / "knockout_matches.csv"
    match_id_map = {} # label -> id
    if matches_csv.exists():
        with open(matches_csv, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                home_id = _get_or_create_team(connection, row["home_team"])
                away_id = _get_or_create_team(connection, row["away_team"])
                qual_id = _get_or_create_team(connection, row["qualified_team"]) if row.get("qualified_team") else None
                
                score_home = int(row["score_home_90"]) if row.get("score_home_90") and row["score_home_90"].strip() != "" else None
                score_away = int(row["score_away_90"]) if row.get("score_away_90") and row["score_away_90"].strip() != "" else None

                cur = connection.execute(
                    "INSERT INTO matches (season, phase_key, round_label, home_team_id, away_team_id, score_home_90, score_away_90, qualified_team_id, kickoff_utc) "
                    "VALUES (?, ?, ?, ?, ?, ?, ?, ?, '2026-05-30T20:00:00Z')",
                    (settings.default_season, row["phase_key"], row["match_label"], home_id, away_id, score_home, score_away, qual_id)
                )
                match_id = cur.lastrowid
                match_id_map[row["match_label"]] = match_id
        print(f"[1/4] Cadastrou {len(match_id_map)} partidas.")

    # 2. Injetar Palpites Placares
    picks_csv = data_dir / "picks_matches.csv"
    count_picks = 0
    if picks_csv.exists():
        with open(picks_csv, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                if row["participant"].strip().startswith("Fórmula") or row["participant"].strip().startswith("Valores"):
                    continue
                p_id = _get_or_create_participant(connection, row["participant"])
                m_label = row["match_label"]
                if m_label not in match_id_map:
                    continue
                m_id = match_id_map[m_label]
                
                ph = int(row["pred_home"]) if row.get("pred_home") not in (None, "") else None
                pa = int(row["pred_away"]) if row.get("pred_away") not in (None, "") else None

                if ph is not None and pa is not None:
                    connection.execute(
                        "INSERT OR REPLACE INTO participant_match_predictions (participant_id, match_id, predicted_home, predicted_away) "
                        "VALUES (?, ?, ?, ?)",
                        (p_id, m_id, ph, pa)
                    )
                    count_picks += 1
        print(f"[2/4] Injetou {count_picks} palpites de jogos.")

    # 3. Injetar Palpites Classificados
    picks_class_csv = data_dir / "picks_classificados.csv"
    count_class = 0
    if picks_class_csv.exists():
        with open(picks_class_csv, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                if row["participant"].strip() in ("Fórmulas", "Valores Omitidos"):
                    continue
                p_id = _get_or_create_participant(connection, row["participant"])
                t_id = _get_or_create_team(connection, row["qualified_team"]) if row.get("qualified_team") else None
                
                if t_id:
                    connection.execute(
                        "INSERT OR REPLACE INTO participant_phase_picks (participant_id, season, phase_key, qualified_team_id, picks_order) "
                        "VALUES (?, ?, ?, ?, ?)",
                        (p_id, settings.default_season, row["phase"], t_id, count_class)
                    )
                    count_class += 1
        print(f"[3/4] Injetou {count_class} palpites classificados.")

    print("[4/4] Recalculando o Ranking Oficial...")
    ranking = persist_leaderboard(connection, settings.default_season)
    print(f"      -> Ranking gerado para {len(ranking)} participantes.")

    api_dir = settings.project_root / "api"
    api_dir.mkdir(exist_ok=True)

    with open(api_dir / "ranking.json", "w", encoding="utf-8") as f:
        json.dump({"season": settings.default_season, "ranking": ranking}, f, ensure_ascii=False, indent=2)

    rows = connection.execute("SELECT m.*, ht.name as home_team_name, at.name as away_team_name, qt.name as qualified_team_name FROM matches m JOIN teams ht ON ht.id = m.home_team_id JOIN teams at ON at.id = m.away_team_id LEFT JOIN teams qt ON qt.id = m.qualified_team_id").fetchall()
    with open(api_dir / "matches.json", "w", encoding="utf-8") as f:
        json.dump({"matches": [dict(r) for r in rows]}, f, ensure_ascii=False, indent=2)
    
    rows = connection.execute("SELECT id, slug, name, is_active FROM participants ORDER BY name").fetchall()
    with open(api_dir / "participants.json", "w", encoding="utf-8") as f:
        json.dump({"participants": [dict(r) for r in rows]}, f, ensure_ascii=False, indent=2)

    print("=== SUCESSO! JSONs estáticos exportados ===")
    connection.close()

if __name__ == "__main__":
    main()
