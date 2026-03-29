from __future__ import annotations

import json
import sqlite3
import unicodedata
from collections import defaultdict
from typing import Any


PHASE_RULES = {
    "LEAGUE": {"result": 0.85, "qualified": 4.2, "order": 2.0, "exact": 0.0, "favorite": 2.0},
    "PLAYOFF": {"result": 0.5, "qualified": 1.5, "exact": 3.0, "favorite": 0.0},
    "ROUND_OF_16": {"result": 1.0, "qualified": 3.0, "exact": 6.0, "favorite": 4.0},
    "QUARTER": {"result": 1.44, "qualified": 4.32, "exact": 8.64, "favorite": 6.0},
    "SEMI": {"result": 2.08, "qualified": 6.24, "exact": 12.48, "favorite": 8.0},
    "FINAL": {"result": 7.0, "qualified": 7.0, "exact": 23.8, "favorite": 10.0},
}

SUPERCLASSIC_PHASES = {"LEAGUE", "PLAYOFF", "ROUND_OF_16", "QUARTER"}
SUPERCLASSIC_TEAM_ALIASES = {
    "bayern de munique": "bayern munchen",
    "bayern munich": "bayern munchen",
    "psg": "paris saint germain",
}
SUPERCLASSIC_ELIGIBLE_TEAMS = {
    "real madrid",
    "barcelona",
    "bayern munchen",
    "manchester city",
    "liverpool",
    "chelsea",
    "paris saint germain",
}


def round2(value: float) -> float:
    return round(value + 1e-9, 2)


def normalize_text(value: str | None) -> str:
    if not value:
        return ""
    normalized = (
        unicodedata.normalize("NFD", value)
        .encode("ascii", "ignore")
        .decode("ascii")
        .lower()
        .replace("-", " ")
    )
    return " ".join(normalized.split())


def canonical_team_key(team_name: str | None) -> str:
    normalized = normalize_text(team_name)
    return SUPERCLASSIC_TEAM_ALIASES.get(normalized, normalized)


def is_superclassic_match(match: sqlite3.Row) -> bool:
    if match["phase_key"] not in SUPERCLASSIC_PHASES:
        return False
    if bool(match["is_superclassic"]):
        return True
    home = canonical_team_key(match["home_team_name"])
    away = canonical_team_key(match["away_team_name"])
    return home in SUPERCLASSIC_ELIGIBLE_TEAMS and away in SUPERCLASSIC_ELIGIBLE_TEAMS


def match_result(home: int | None, away: int | None) -> str | None:
    if home is None or away is None:
        return None
    if home > away:
        return "HOME"
    if away > home:
        return "AWAY"
    return "DRAW"


def list_contains(items: list[str], value: str | None) -> bool:
    return value is not None and value in items


def evaluate_prediction_hit(match: sqlite3.Row, prediction: sqlite3.Row) -> str | None:
    official_result_90 = match_result(match["score_home_90"], match["score_away_90"])
    predicted_result = match_result(prediction["predicted_home"], prediction["predicted_away"])
    if official_result_90 is None or predicted_result is None:
        return None

    is_exact_90 = (
        prediction["predicted_home"] == match["score_home_90"]
        and prediction["predicted_away"] == match["score_away_90"]
    )
    if is_exact_90:
        return "exact_90"

    # Se houver prorrogação com placar disponível, vale meio acerto de placar exato.
    if (
        match["went_extra_time"]
        and match["score_home_et"] is not None
        and match["score_away_et"] is not None
        and prediction["predicted_home"] == match["score_home_et"]
        and prediction["predicted_away"] == match["score_away_et"]
    ):
        return "exact_et"

    if predicted_result == official_result_90:
        return "result"
    return None


def is_correct_league_order(official: list[str], picked_team: str, position_index: int | None) -> bool:
    if not official or picked_team is None or position_index is None:
        return False

    idx = int(position_index)
    # Aceita origem 0-based ou 1-based por segurança com fontes mistas.
    candidate_indexes = [idx]
    if idx > 0:
        candidate_indexes.append(idx - 1)

    for candidate in candidate_indexes:
        if 0 <= candidate < len(official) and official[candidate] == picked_team:
            return True
    return False


def calculate_leaderboard(connection: sqlite3.Connection, season: int) -> list[dict[str, Any]]:
    participants = connection.execute(
        "SELECT id, name, created_at FROM participants WHERE is_active = 1 ORDER BY name"
    ).fetchall()
    matches = connection.execute(
        """
        SELECT m.*, ht.name AS home_team_name, at.name AS away_team_name,
               qt.name AS qualified_team_name
        FROM matches m
        JOIN teams ht ON ht.id = m.home_team_id
        JOIN teams at ON at.id = m.away_team_id
        LEFT JOIN teams qt ON qt.id = m.qualified_team_id
        WHERE m.season = ?
        ORDER BY m.kickoff_utc, m.id
        """,
        (season,),
    ).fetchall()
    predictions = connection.execute(
        """
        SELECT p.participant_id, m.phase_key, p.match_id, p.predicted_home, p.predicted_away
        FROM participant_match_predictions p
        JOIN matches m ON m.id = p.match_id
        WHERE m.season = ?
        """,
        (season,),
    ).fetchall()
    phase_picks = connection.execute(
        """
        SELECT pp.participant_id, pp.phase_key, pp.pick_slot, pp.position_index, t.name AS team_name, pp.raw_value
        FROM participant_phase_picks pp
        LEFT JOIN teams t ON t.id = pp.team_id
        WHERE pp.season = ?
        """,
        (season,),
    ).fetchall()
    special_picks = connection.execute(
        """
        SELECT participant_id, pick_type, raw_value
        FROM participant_special_picks
        WHERE season = ?
        """,
        (season,),
    ).fetchall()
    season_state_row = connection.execute(
        "SELECT * FROM season_state WHERE season = ?",
        (season,),
    ).fetchone()

    if season_state_row is None:
        season_state = {}
    else:
        season_state = dict(season_state_row)

    official_lists = {
        "LEAGUE": json.loads(season_state.get("league_top8_json") or "[]"),
        "PLAYOFF": json.loads(season_state.get("playoff_winners_json") or "[]"),
        "ROUND_OF_16": json.loads(season_state.get("round_of_16_json") or "[]"),
        "QUARTER": json.loads(season_state.get("quarter_finals_json") or "[]"),
        "SEMI": json.loads(season_state.get("semi_finals_json") or "[]"),
        "FINAL": [],
    }
    champion_team_id = season_state.get("champion_team_id")
    champion_name = None
    if champion_team_id:
        row = connection.execute("SELECT name FROM teams WHERE id = ?", (champion_team_id,)).fetchone()
        champion_name = row["name"] if row else None
    if champion_name:
        official_lists["FINAL"] = [champion_name]
    top_scorer_name = season_state.get("top_scorer_name")
    top_assist_name = season_state.get("top_assist_name")

    predictions_by_match: dict[int, list[sqlite3.Row]] = defaultdict(list)
    predictions_by_participant: dict[int, dict[int, sqlite3.Row]] = defaultdict(dict)
    for row in predictions:
        predictions_by_match[row["match_id"]].append(row)
        predictions_by_participant[row["participant_id"]][row["match_id"]] = row

    superclassic_match_ids = {
        match["id"]
        for match in matches
        if is_superclassic_match(match)
    }

    solo_hit_lookup: dict[tuple[int, int], str] = {}
    for match in matches:
        successful: list[tuple[int, str]] = []
        for prediction in predictions_by_match.get(match["id"], []):
            hit_type = evaluate_prediction_hit(match, prediction)
            if hit_type is not None:
                successful.append((prediction["participant_id"], hit_type))
        if len(successful) == 1:
            participant_id, hit_type = successful[0]
            solo_hit_lookup[(participant_id, match["id"])] = hit_type

    picks_by_participant: dict[int, dict[str, list[dict[str, Any]]]] = defaultdict(
        lambda: defaultdict(list)
    )
    for row in phase_picks:
        value = row["team_name"] or row["raw_value"]
        if value:
            picks_by_participant[row["participant_id"]][row["phase_key"]].append(
                {"value": value, "position_index": row["position_index"]}
            )

    special_by_participant: dict[int, dict[str, str]] = defaultdict(dict)
    for row in special_picks:
        special_by_participant[row["participant_id"]][row["pick_type"]] = row["raw_value"]

    leaderboard: list[dict[str, Any]] = []
    for participant in participants:
        totals = {
            "LEAGUE": 0.0,
            "PLAYOFF": 0.0,
            "ROUND_OF_16": 0.0,
            "QUARTER": 0.0,
            "SEMI": 0.0,
            "FINAL": 0.0,
            "superclassic": 0.0,
            "hope_solo_hits": 0,
            "favorite_team": 0.0,
            "top_scorer": 0.0,
            "top_assist": 0.0,
        }
        total_hits = 0
        matches_predicted = 0
        participant_champion_pick = None
        final_phase_picks = picks_by_participant.get(participant["id"], {}).get("FINAL", [])
        if final_phase_picks:
            participant_champion_pick = final_phase_picks[0].get("value")

        for match in matches:
            prediction = predictions_by_participant.get(participant["id"], {}).get(match["id"])
            if not prediction:
                continue
            matches_predicted += 1
            phase_key = match["phase_key"]
            rules = PHASE_RULES.get(phase_key, {})
            hit_type = evaluate_prediction_hit(match, prediction)
            if hit_type is None:
                continue

            if hit_type in {"exact_90", "exact_et"}:
                total_hits += 1
                exact_points = rules.get("exact", 0.0)
                if hit_type == "exact_et":
                    exact_points *= 0.5

                final_draw_wrong_champion = (
                    phase_key == "FINAL"
                    and match_result(match["score_home_90"], match["score_away_90"]) == "DRAW"
                    and champion_name
                    and participant_champion_pick
                    and participant_champion_pick != champion_name
                )

                if final_draw_wrong_champion:
                    # Regra especial: final empatada + campeão errado = apenas 23.80 por placar.
                    exact_points = rules.get("exact", 0.0)
                    if (participant["id"], match["id"]) in solo_hit_lookup:
                        totals["hope_solo_hits"] += 1
                else:
                    if match["id"] in superclassic_match_ids:
                        superclassic_bonus = exact_points
                        exact_points *= 2
                        totals["superclassic"] += superclassic_bonus
                    if (participant["id"], match["id"]) in solo_hit_lookup:
                        exact_points *= 2
                        totals["hope_solo_hits"] += 1
                totals[phase_key] += exact_points
            elif hit_type == "result":
                total_hits += 1
                result_points = rules.get("result", 0.0)
                if (participant["id"], match["id"]) in solo_hit_lookup:
                    result_points *= 2
                    totals["hope_solo_hits"] += 1
                totals[phase_key] += result_points

        for phase_key, official in official_lists.items():
            rules = PHASE_RULES.get(phase_key, {})
            for picked in picks_by_participant.get(participant["id"], {}).get(phase_key, []):
                matches_predicted += 1
                picked_team = picked.get("value")
                if list_contains(official, picked_team):
                    total_hits += 1
                    totals[phase_key] += rules.get("qualified", 0.0)
                    if (
                        phase_key == "LEAGUE"
                        and is_correct_league_order(official, picked_team, picked.get("position_index"))
                    ):
                        totals[phase_key] += rules.get("order", 0.0)

        favorite_team = special_by_participant.get(participant["id"], {}).get("favorite_team")
        if favorite_team:
            matches_predicted += 1
            hit = False
            if list_contains(official_lists["LEAGUE"], favorite_team):
                totals["favorite_team"] += PHASE_RULES["LEAGUE"]["favorite"]
                hit = True
            if list_contains(official_lists["ROUND_OF_16"], favorite_team):
                totals["favorite_team"] += PHASE_RULES["ROUND_OF_16"]["favorite"]
                hit = True
            if list_contains(official_lists["QUARTER"], favorite_team):
                totals["favorite_team"] += PHASE_RULES["QUARTER"]["favorite"]
                hit = True
            if list_contains(official_lists["SEMI"], favorite_team):
                totals["favorite_team"] += PHASE_RULES["SEMI"]["favorite"]
                hit = True
            if champion_name and favorite_team == champion_name:
                totals["favorite_team"] += PHASE_RULES["FINAL"]["favorite"]
                hit = True
            if hit:
                total_hits += 1

        top_scorer = special_by_participant.get(participant["id"], {}).get("top_scorer")
        if top_scorer:
            matches_predicted += 1
            if top_scorer == top_scorer_name:
                totals["top_scorer"] = 15.0
                total_hits += 1

        top_assist = special_by_participant.get(participant["id"], {}).get("top_assist")
        if top_assist:
            matches_predicted += 1
            if top_assist == top_assist_name:
                totals["top_assist"] = 15.0
                total_hits += 1

        accuracy = round2((total_hits / matches_predicted) * 100) if matches_predicted > 0 else 0.0
        totals["total_hits"] = total_hits
        totals["matches_predicted"] = matches_predicted
        totals["accuracy"] = accuracy

        total_points = (
            totals["LEAGUE"]
            + totals["PLAYOFF"]
            + totals["ROUND_OF_16"]
            + totals["QUARTER"]
            + totals["SEMI"]
            + totals["FINAL"]
            + totals["favorite_team"]
            + totals["top_scorer"]
            + totals["top_assist"]
        )
        leaderboard.append(
            {
                "participant_id": participant["id"],
                "name": participant["name"],
                "total_points": round2(total_points),
                "first_phase_points": round2(totals["LEAGUE"]),
                "playoff_points": round2(totals["PLAYOFF"]),
                "round_of_16_points": round2(totals["ROUND_OF_16"]),
                "quarter_points": round2(totals["QUARTER"]),
                "semi_points": round2(totals["SEMI"]),
                "final_points": round2(totals["FINAL"]),
                "superclassic_points": round2(totals["superclassic"]),
                "hope_solo_hits": totals["hope_solo_hits"],
                "favorite_team_points": round2(totals["favorite_team"]),
                "top_scorer_points": round2(totals["top_scorer"]),
                "top_assist_points": round2(totals["top_assist"]),
                "breakdown": totals,
                "created_at": participant["created_at"],
            }
        )

    leaderboard.sort(key=lambda item: (-item["total_points"], -item["breakdown"]["total_hits"], -item["breakdown"]["accuracy"], item["created_at"], item["name"]))
    return leaderboard


def persist_leaderboard(connection: sqlite3.Connection, season: int) -> list[dict[str, Any]]:
    leaderboard = calculate_leaderboard(connection, season)
    connection.execute("DELETE FROM leaderboard_entries WHERE season = ?", (season,))
    for row in leaderboard:
        connection.execute(
            """
            INSERT INTO leaderboard_entries (
              season, participant_id, total_points, first_phase_points, playoff_points,
              round_of_16_points, quarter_points, semi_points, final_points,
              superclassic_points, hope_solo_hits, favorite_team_points,
              top_scorer_points, top_assist_points, breakdown_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                season,
                row["participant_id"],
                row["total_points"],
                row["first_phase_points"],
                row["playoff_points"],
                row["round_of_16_points"],
                row["quarter_points"],
                row["semi_points"],
                row["final_points"],
                row["superclassic_points"],
                row["hope_solo_hits"],
                row["favorite_team_points"],
                row["top_scorer_points"],
                row["top_assist_points"],
                json.dumps(row["breakdown"], ensure_ascii=False),
            ),
        )
    connection.commit()
    return leaderboard
