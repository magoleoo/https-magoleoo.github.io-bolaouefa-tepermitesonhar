#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
import json
import re
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Tuple


PROJECT_ROOT = Path(__file__).resolve().parents[1]


def normalize_text(value: str) -> str:
    text = str(value or "").strip().lower()
    replacements = (
        ("á", "a"),
        ("à", "a"),
        ("ã", "a"),
        ("â", "a"),
        ("ä", "a"),
        ("é", "e"),
        ("è", "e"),
        ("ê", "e"),
        ("ë", "e"),
        ("í", "i"),
        ("ì", "i"),
        ("î", "i"),
        ("ï", "i"),
        ("ó", "o"),
        ("ò", "o"),
        ("õ", "o"),
        ("ô", "o"),
        ("ö", "o"),
        ("ú", "u"),
        ("ù", "u"),
        ("û", "u"),
        ("ü", "u"),
        ("ç", "c"),
    )
    for source, target in replacements:
        text = text.replace(source, target)
    text = text.replace("-", " ")
    return " ".join(text.split())


def parse_timestamp(value: str) -> datetime:
    raw = str(value or "").strip()
    for date_fmt in ("%d/%m/%Y %H:%M:%S", "%d/%m/%Y %H:%M"):
        try:
            return datetime.strptime(raw, date_fmt)
        except ValueError:
            continue
    return datetime.min


def clean_team_header(value: str) -> str:
    text = str(value or "").strip()
    # Ex.: "Paris Saint-Germain (casa)" -> "Paris Saint-Germain"
    text = re.sub(r"\s*\((?:casa|visita)\)\s*$", "", text, flags=re.IGNORECASE)
    return text


def is_classification_fixture(fixture: Dict[str, object]) -> bool:
    label = normalize_text(str(fixture.get("label", "")))
    matchday = normalize_text(str(fixture.get("matchday", "")))
    return label.startswith("classificado") or matchday.startswith("classificado")


@dataclass
class CsvTie:
    index: int
    home_team: str
    away_team: str
    class_column_index: int


def read_latest_rows_by_participant(csv_path: Path) -> Tuple[List[str], Dict[str, List[str]]]:
    with csv_path.open("r", encoding="utf-8-sig", newline="") as handle:
        rows = list(csv.reader(handle))

    if not rows:
        return [], {}

    header = rows[0]
    by_participant: Dict[str, Tuple[datetime, int, str, List[str]]] = {}
    for row_index, row in enumerate(rows[1:]):
        if len(row) < 3:
            continue

        participant = str(row[2] or "").strip()
        if not participant:
            continue
        if normalize_text(participant) in {"quem e o palpiteiro?", "participante"}:
            # Header repetido no meio do CSV.
            continue

        submitted_at = parse_timestamp(row[0] if row else "")
        candidate = (submitted_at, row_index, participant, row)
        key = normalize_text(participant)
        current = by_participant.get(key)
        if current is None or candidate[:2] > current[:2]:
            by_participant[key] = candidate

    latest = {payload[2]: payload[3] for payload in by_participant.values()}
    return header, latest


def extract_ties_from_header(header: List[str]) -> List[CsvTie]:
    ties: List[CsvTie] = []
    base_columns = 3
    group_size = 5

    for start in range(base_columns, len(header), group_size):
        chunk = header[start : start + group_size]
        if len(chunk) < group_size:
            break

        home_1, away_1, home_2, away_2, class_column = chunk
        if not (home_1 and away_1 and home_2 and away_2 and class_column):
            continue

        ties.append(
            CsvTie(
                index=len(ties) + 1,
                home_team=clean_team_header(home_1),
                away_team=clean_team_header(away_1),
                class_column_index=start + 4,
            )
        )

    return ties


def load_backtest_data(ranking_json_path: Path) -> Dict[str, object]:
    return json.loads(ranking_json_path.read_text(encoding="utf-8"))


def load_phase_official_sequence(backtest_report_path: Path, report_phase_key: str) -> List[str]:
    report = json.loads(backtest_report_path.read_text(encoding="utf-8"))
    participants = report.get("participants", {})
    if not participants:
        return []
    first_participant = next(iter(participants))
    details = participants.get(first_participant, {}).get(report_phase_key, {}).get("class_details", [])
    return [str(item.get("official", "")).strip() for item in details]


def build_classification_fixtures(
    ties: List[CsvTie],
    latest_rows: Dict[str, List[str]],
    official_sequence: List[str],
    canonical_name_map: Dict[str, str],
    participant_order: List[str],
) -> List[Dict[str, object]]:
    participant_rank = {normalize_text(name): index for index, name in enumerate(participant_order)}
    fixtures: List[Dict[str, object]] = []

    for tie in ties:
        picks: List[Dict[str, str]] = []
        for csv_participant, row in latest_rows.items():
            if tie.class_column_index >= len(row):
                continue
            pick_value = str(row[tie.class_column_index] or "").strip()
            if not pick_value:
                continue

            canonical_participant = canonical_name_map.get(
                normalize_text(csv_participant), csv_participant
            )
            picks.append(
                {
                    "participant": canonical_participant,
                    "pick": pick_value,
                    "rank_value": "",
                }
            )

        picks.sort(key=lambda item: participant_rank.get(normalize_text(item["participant"]), 10**9))
        official = official_sequence[tie.index - 1] if tie.index - 1 < len(official_sequence) else ""

        fixtures.append(
            {
                "matchday": f"Classificado {tie.index}",
                "label": f"{tie.home_team} x {tie.away_team}",
                "official": official,
                "picks": picks,
            }
        )

    return fixtures


def upsert_phase_classification_fixtures(
    backtest_data: Dict[str, object],
    phase_key: str,
    new_fixtures: List[Dict[str, object]],
) -> Tuple[int, int]:
    phase_payload = backtest_data.get("phases", {}).get(phase_key, {})
    current_fixtures = list(phase_payload.get("fixtures", []))
    retained = [fixture for fixture in current_fixtures if not is_classification_fixture(fixture)]
    old_count = len(current_fixtures) - len(retained)
    phase_payload["fixtures"] = retained + new_fixtures
    return old_count, len(new_fixtures)


def write_backtest_outputs(backtest_data: Dict[str, object], ranking_json_path: Path, ranking_js_path: Path) -> None:
    ranking_json_path.write_text(
        json.dumps(backtest_data, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    ranking_js_path.write_text(
        "window.backtestData = " + json.dumps(backtest_data, ensure_ascii=False) + ";\n",
        encoding="utf-8",
    )


def main() -> int:
    parser = argparse.ArgumentParser(
        description=(
            "Importa os classificados de Playoff/Oitavas via CSV de Forms e injeta em api/ranking.{json,js}."
        )
    )
    parser.add_argument(
        "--base-dir",
        default=str(PROJECT_ROOT.parent),
        help="Diretório onde estão os CSVs do Forms.",
    )
    parser.add_argument(
        "--playoff-csv",
        default="Bolao UEFA 25_26 OFICIAL - Form_Playoff1aFase.csv",
        help="Nome do CSV do Playoff.",
    )
    parser.add_argument(
        "--oitavas-csv",
        default="Bolao UEFA 25_26 OFICIAL - Form_Oitavas.csv",
        help="Nome do CSV das Oitavas.",
    )
    args = parser.parse_args()

    base_dir = Path(args.base_dir).expanduser().resolve()
    playoff_csv_path = (base_dir / args.playoff_csv).resolve()
    oitavas_csv_path = (base_dir / args.oitavas_csv).resolve()

    ranking_json_path = PROJECT_ROOT / "api" / "ranking.json"
    ranking_js_path = PROJECT_ROOT / "api" / "ranking.js"
    backtest_report_path = PROJECT_ROOT / "backtest-report.json"

    if not playoff_csv_path.exists():
        raise FileNotFoundError(f"CSV de playoff não encontrado: {playoff_csv_path}")
    if not oitavas_csv_path.exists():
        raise FileNotFoundError(f"CSV de oitavas não encontrado: {oitavas_csv_path}")

    backtest_data = load_backtest_data(ranking_json_path)
    ranking_rows = backtest_data.get("ranking", [])
    participant_order = [str(row.get("name", "")).strip() for row in ranking_rows]
    canonical_name_map = {normalize_text(name): name for name in participant_order if name}

    # Playoff
    playoff_header, playoff_latest_rows = read_latest_rows_by_participant(playoff_csv_path)
    playoff_ties = extract_ties_from_header(playoff_header)
    playoff_official_sequence = load_phase_official_sequence(backtest_report_path, "playoff")
    playoff_classified_fixtures = build_classification_fixtures(
        ties=playoff_ties,
        latest_rows=playoff_latest_rows,
        official_sequence=playoff_official_sequence,
        canonical_name_map=canonical_name_map,
        participant_order=participant_order,
    )

    # Oitavas
    oitavas_header, oitavas_latest_rows = read_latest_rows_by_participant(oitavas_csv_path)
    oitavas_ties = extract_ties_from_header(oitavas_header)
    oitavas_official_sequence = load_phase_official_sequence(backtest_report_path, "round_of_16")
    oitavas_classified_fixtures = build_classification_fixtures(
        ties=oitavas_ties,
        latest_rows=oitavas_latest_rows,
        official_sequence=oitavas_official_sequence,
        canonical_name_map=canonical_name_map,
        participant_order=participant_order,
    )

    old_playoff, new_playoff = upsert_phase_classification_fixtures(
        backtest_data, "PLAYOFF", playoff_classified_fixtures
    )
    old_oitavas, new_oitavas = upsert_phase_classification_fixtures(
        backtest_data, "ROUND_OF_16", oitavas_classified_fixtures
    )

    write_backtest_outputs(backtest_data, ranking_json_path, ranking_js_path)

    print("=== IMPORTAÇÃO DE CLASSIFICADOS CONCLUÍDA ===")
    print(f"Playoff: removidos {old_playoff} classificados antigos, inseridos {new_playoff}.")
    print(f"Oitavas: removidos {old_oitavas} classificados antigos, inseridos {new_oitavas}.")
    print(f"CSV playoff: {len(playoff_latest_rows)} participante(s) mais recente(s).")
    print(f"CSV oitavas: {len(oitavas_latest_rows)} participante(s) mais recente(s).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
