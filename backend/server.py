from __future__ import annotations

import json
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from .config import load_settings
from .db import connect, initialize_schema
from .scoring_engine import persist_leaderboard
from .sync_api_football import sync_matches

SETTINGS = load_settings()
SCHEMA_PATH = Path(__file__).with_name("schema.sql")


class ApiHandler(BaseHTTPRequestHandler):
    def _json(self, status: int, payload: dict) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def _read_json_body(self) -> dict:
        length = int(self.headers.get("Content-Length", "0"))
        if not length:
            return {}
        return json.loads(self.rfile.read(length).decode("utf-8"))

    def do_OPTIONS(self) -> None:
        self.send_response(HTTPStatus.NO_CONTENT)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.end_headers()

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        params = parse_qs(parsed.query)
        season = int(params.get("season", [str(SETTINGS.default_season)])[0])
        connection = connect(SETTINGS.database_path)
        initialize_schema(connection, SCHEMA_PATH)
        try:
            if parsed.path == "/health":
                self._json(200, {"status": "ok", "database": str(SETTINGS.database_path)})
                return
            if parsed.path == "/api/participants":
                rows = connection.execute(
                    "SELECT id, slug, name, is_active FROM participants ORDER BY name"
                ).fetchall()
                self._json(200, {"participants": [dict(row) for row in rows]})
                return
            if parsed.path == "/api/matches":
                phase = params.get("phase", [None])[0]
                query = """
                    SELECT m.*, ht.name AS home_team_name, at.name AS away_team_name
                    FROM matches m
                    JOIN teams ht ON ht.id = m.home_team_id
                    JOIN teams at ON at.id = m.away_team_id
                    WHERE m.season = ?
                """
                values: list[object] = [season]
                if phase:
                    query += " AND m.phase_key = ?"
                    values.append(phase)
                query += " ORDER BY m.kickoff_utc, m.id"
                rows = connection.execute(query, tuple(values)).fetchall()
                self._json(200, {"matches": [dict(row) for row in rows]})
                return
            if parsed.path == "/api/ranking":
                rows = connection.execute(
                    """
                    SELECT le.*, p.name, p.created_at
                    FROM leaderboard_entries le
                    JOIN participants p ON p.id = le.participant_id
                    WHERE le.season = ?
                    ORDER BY le.total_points DESC, json_extract(le.breakdown_json, '$.total_hits') DESC, json_extract(le.breakdown_json, '$.accuracy') DESC, p.created_at ASC, p.name ASC
                    """,
                    (season,),
                ).fetchall()
                self._json(200, {"ranking": [dict(row) for row in rows]})
                return
            if parsed.path == "/api/me/predictions":
                participant_id = int(params.get("participant_id", [0])[0])
                match_preds = connection.execute(
                    "SELECT match_id, predicted_home, predicted_away FROM participant_match_predictions WHERE participant_id = ?",
                    (participant_id,)
                ).fetchall()
                special_preds = connection.execute(
                    "SELECT pick_type, raw_value FROM participant_special_picks WHERE participant_id = ? AND season = ?",
                    (participant_id, season)
                ).fetchall()
                phase_preds = connection.execute(
                    "SELECT phase_key, pick_slot, team_id, raw_value, position_index FROM participant_phase_picks WHERE participant_id = ? AND season = ?",
                    (participant_id, season)
                ).fetchall()
                self._json(200, {
                    "match_predictions": [dict(r) for r in match_preds],
                    "special_picks": [dict(r) for r in special_preds],
                    "phase_picks": [dict(r) for r in phase_preds],
                })
                return
            self._json(404, {"error": "Rota não encontrada."})
        finally:
            connection.close()

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        payload = self._read_json_body()
        connection = connect(SETTINGS.database_path)
        initialize_schema(connection, SCHEMA_PATH)
        try:
            if parsed.path == "/api/admin/sync":
                season = int(payload.get("season", SETTINGS.default_season))
                result = sync_matches(connection, SETTINGS, season)
                self._json(200, result)
                return
            if parsed.path == "/api/admin/recalculate":
                season = int(payload.get("season", SETTINGS.default_season))
                ranking = persist_leaderboard(connection, season)
                self._json(200, {"season": season, "entries": ranking})
                return
            if parsed.path == "/api/admin/season-state":
                season = int(payload.get("season", SETTINGS.default_season))
                connection.execute(
                    """
                    INSERT INTO season_state (
                      season, league_top8_json, playoff_winners_json, round_of_16_json,
                      quarter_finals_json, semi_finals_json, champion_team_id,
                      top_scorer_name, top_assist_name, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                    ON CONFLICT(season) DO UPDATE SET
                      league_top8_json = excluded.league_top8_json,
                      playoff_winners_json = excluded.playoff_winners_json,
                      round_of_16_json = excluded.round_of_16_json,
                      quarter_finals_json = excluded.quarter_finals_json,
                      semi_finals_json = excluded.semi_finals_json,
                      champion_team_id = excluded.champion_team_id,
                      top_scorer_name = excluded.top_scorer_name,
                      top_assist_name = excluded.top_assist_name,
                      updated_at = CURRENT_TIMESTAMP
                    """,
                    (
                        season,
                        json.dumps(payload.get("league_top8", []), ensure_ascii=False),
                        json.dumps(payload.get("playoff_winners", []), ensure_ascii=False),
                        json.dumps(payload.get("round_of_16", []), ensure_ascii=False),
                        json.dumps(payload.get("quarter_finals", []), ensure_ascii=False),
                        json.dumps(payload.get("semi_finals", []), ensure_ascii=False),
                        payload.get("champion_team_id"),
                        payload.get("top_scorer_name"),
                        payload.get("top_assist_name"),
                    ),
                )
                connection.commit()
                self._json(200, {"status": "season_state_updated", "season": season})
                return
            if parsed.path == "/api/login":
                slug = payload.get("slug")
                access_code = payload.get("access_code")
                row = connection.execute(
                    "SELECT id, slug, name FROM participants WHERE slug = ? AND access_code = ? AND is_active = 1",
                    (slug, access_code)
                ).fetchone()
                if row:
                    self._json(200, {"user": dict(row)})
                else:
                    self._json(401, {"error": "Credenciais incorretas."})
                return
            if parsed.path == "/api/me/predictions":
                participant_id = int(payload.get("participant_id", 0))
                match_id = int(payload.get("match_id", 0))
                predicted_home = int(payload.get("predicted_home", 0))
                predicted_away = int(payload.get("predicted_away", 0))
                connection.execute("""
                    INSERT INTO participant_match_predictions (participant_id, match_id, predicted_home, predicted_away, submitted_at)
                    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
                    ON CONFLICT(participant_id, match_id) DO UPDATE SET
                    predicted_home = excluded.predicted_home,
                    predicted_away = excluded.predicted_away,
                    submitted_at = CURRENT_TIMESTAMP
                """, (participant_id, match_id, predicted_home, predicted_away))
                connection.commit()
                self._json(200, {"status": "ok"})
                return
            if parsed.path == "/api/me/picks/special":
                participant_id = int(payload.get("participant_id", 0))
                season = int(payload.get("season", SETTINGS.default_season))
                pick_type = payload.get("pick_type")
                raw_value = payload.get("raw_value")
                connection.execute("""
                    INSERT INTO participant_special_picks (participant_id, season, pick_type, raw_value, submitted_at)
                    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
                    ON CONFLICT(participant_id, season, pick_type) DO UPDATE SET
                    raw_value = excluded.raw_value,
                    submitted_at = CURRENT_TIMESTAMP
                """, (participant_id, season, pick_type, raw_value))
                connection.commit()
                self._json(200, {"status": "ok"})
                return
            if parsed.path == "/api/me/picks/phase":
                participant_id = int(payload.get("participant_id", 0))
                season = int(payload.get("season", SETTINGS.default_season))
                phase_key = payload.get("phase_key")
                pick_slot = payload.get("pick_slot", "")
                raw_value = payload.get("raw_value")
                position_index = int(payload.get("position_index", 0))
                connection.execute("""
                    INSERT INTO participant_phase_picks (participant_id, season, phase_key, pick_slot, raw_value, position_index, submitted_at)
                    VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                    ON CONFLICT(participant_id, season, phase_key, pick_slot, position_index) DO UPDATE SET
                    raw_value = excluded.raw_value,
                    submitted_at = CURRENT_TIMESTAMP
                """, (participant_id, season, phase_key, pick_slot, raw_value, position_index))
                connection.commit()
                self._json(200, {"status": "ok"})
                return
            self._json(404, {"error": "Rota não encontrada."})
        except Exception as exc:  # noqa: BLE001
            self._json(500, {"error": str(exc)})
        finally:
            connection.close()


def main() -> None:
    connection = connect(SETTINGS.database_path)
    initialize_schema(connection, SCHEMA_PATH)
    connection.close()
    server = ThreadingHTTPServer((SETTINGS.host, SETTINGS.port), ApiHandler)
    print(f"Backend do bolao ouvindo em http://{SETTINGS.host}:{SETTINGS.port}")
    server.serve_forever()


if __name__ == "__main__":
    main()
