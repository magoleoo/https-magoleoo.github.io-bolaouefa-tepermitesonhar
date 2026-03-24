from __future__ import annotations

import json
import sqlite3
from datetime import datetime, timezone
from typing import Any
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from .config import Settings


def _request_json(settings: Settings, path: str, params: dict[str, Any]) -> dict[str, Any]:
    if not settings.api_football_key:
        raise RuntimeError("API_FOOTBALL_KEY não configurada.")
    url = f"{settings.api_football_base_url}{path}?{urlencode(params)}"
    request = Request(
        url,
        headers={
            "x-apisports-key": settings.api_football_key,
            "x-rapidapi-host": settings.api_football_host,
        },
    )
    with urlopen(request, timeout=30) as response:
        return json.loads(response.read().decode("utf-8"))


def _phase_from_round(round_label: str) -> tuple[str, str | None]:
    lower = round_label.lower()
    if "league" in lower:
        return "LEAGUE", None
    if "play-offs" in lower or "playoff" in lower:
        return "PLAYOFF", None
    if "8th finals" in lower or "round of 16" in lower:
        return "ROUND_OF_16", None
    if "quarter" in lower:
        return "QUARTER", None
    if "semi" in lower:
        return "SEMI", None
    if "final" in lower:
        return "FINAL", None
    return "LEAGUE", None


def _ensure_team(connection: sqlite3.Connection, api_team_id: int, name: str, logo: str | None) -> int:
    row = connection.execute("SELECT id FROM teams WHERE api_team_id = ?", (api_team_id,)).fetchone()
    if row:
        connection.execute(
            "UPDATE teams SET name = ?, crest_url = COALESCE(?, crest_url) WHERE id = ?",
            (name, logo, row["id"]),
        )
        return row["id"]
    cursor = connection.execute(
        "INSERT INTO teams (api_team_id, name, crest_url) VALUES (?, ?, ?)",
        (api_team_id, name, logo),
    )
    return int(cursor.lastrowid)


def sync_matches(connection: sqlite3.Connection, settings: Settings, season: int) -> dict[str, Any]:
    payload = _request_json(
        settings,
        "/fixtures",
        {
            "league": settings.api_football_league_id,
            "season": season,
        },
    )
    fixtures = payload.get("response", [])
    synced = 0
    for fixture in fixtures:
        league_info = fixture.get("league", {})
        fixture_info = fixture.get("fixture", {})
        teams = fixture.get("teams", {})
        goals = fixture.get("goals", {})
        score = fixture.get("score", {})
        round_label = league_info.get("round", "Champions League")
        phase_key, leg_label = _phase_from_round(round_label)
        home = teams.get("home", {})
        away = teams.get("away", {})
        home_id = _ensure_team(connection, int(home["id"]), home["name"], home.get("logo"))
        away_id = _ensure_team(connection, int(away["id"]), away["name"], away.get("logo"))
        qualified_team_id = None
        if teams.get("home", {}).get("winner") is True:
            qualified_team_id = home_id
        elif teams.get("away", {}).get("winner") is True:
            qualified_team_id = away_id

        home_ft = goals.get("home")
        away_ft = goals.get("away")
        home_90 = (score.get("halftime") or {}).get("home")
        away_90 = (score.get("halftime") or {}).get("away")
        extra = score.get("extratime") or {}
        penalties = score.get("penalty") or {}

        connection.execute(
            """
            INSERT INTO matches (
              api_fixture_id, season, phase_key, round_label, leg_label, kickoff_utc,
              status_short, status_long, home_team_id, away_team_id,
              score_home_90, score_away_90, score_home_ft, score_away_ft,
              score_home_et, score_away_et, score_home_pen, score_away_pen,
              qualified_team_id, winner_team_id, went_extra_time, went_penalties,
              source_payload_json, source_updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(api_fixture_id) DO UPDATE SET
              season = excluded.season,
              phase_key = excluded.phase_key,
              round_label = excluded.round_label,
              leg_label = excluded.leg_label,
              kickoff_utc = excluded.kickoff_utc,
              status_short = excluded.status_short,
              status_long = excluded.status_long,
              home_team_id = excluded.home_team_id,
              away_team_id = excluded.away_team_id,
              score_home_90 = excluded.score_home_90,
              score_away_90 = excluded.score_away_90,
              score_home_ft = excluded.score_home_ft,
              score_away_ft = excluded.score_away_ft,
              score_home_et = excluded.score_home_et,
              score_away_et = excluded.score_away_et,
              score_home_pen = excluded.score_home_pen,
              score_away_pen = excluded.score_away_pen,
              qualified_team_id = excluded.qualified_team_id,
              winner_team_id = excluded.winner_team_id,
              went_extra_time = excluded.went_extra_time,
              went_penalties = excluded.went_penalties,
              source_payload_json = excluded.source_payload_json,
              source_updated_at = excluded.source_updated_at
            """,
            (
                int(fixture_info["id"]),
                season,
                phase_key,
                round_label,
                leg_label,
                fixture_info["date"],
                (fixture_info.get("status") or {}).get("short"),
                (fixture_info.get("status") or {}).get("long"),
                home_id,
                away_id,
                home_90,
                away_90,
                home_ft,
                away_ft,
                extra.get("home"),
                extra.get("away"),
                penalties.get("home"),
                penalties.get("away"),
                qualified_team_id,
                qualified_team_id,
                int(extra.get("home") is not None or extra.get("away") is not None),
                int(penalties.get("home") is not None or penalties.get("away") is not None),
                json.dumps(fixture, ensure_ascii=False),
                datetime.now(timezone.utc).isoformat(),
            ),
        )
        synced += 1

    connection.commit()
    return {"season": season, "fixtures_synced": synced}
