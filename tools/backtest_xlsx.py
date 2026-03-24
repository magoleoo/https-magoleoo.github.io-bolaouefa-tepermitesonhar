#!/usr/bin/env python3
from __future__ import annotations

import json
import re
import sys
import zipfile
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Iterable, List, Tuple
import xml.etree.ElementTree as ET

NS = {"a": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}


@dataclass
class PhaseConfig:
    key: str
    sheet_path: str
    first_header_row: int
    first_rows: Tuple[int, int]
    first_official_row: int
    second_header_row: int
    second_rows: Tuple[int, int]
    second_official_row: int
    class_header_row: int
    class_rows: Tuple[int, int]
    class_official_row: int


PHASES = [
    PhaseConfig(
        key="playoff",
        sheet_path="xl/worksheets/sheet3.xml",
        first_header_row=2,
        first_rows=(3, 23),
        first_official_row=24,
        second_header_row=26,
        second_rows=(27, 47),
        second_official_row=48,
        class_header_row=50,
        class_rows=(51, 71),
        class_official_row=72,
    ),
    PhaseConfig(
        key="round_of_16",
        sheet_path="xl/worksheets/sheet4.xml",
        first_header_row=2,
        first_rows=(3, 22),
        first_official_row=23,
        second_header_row=25,
        second_rows=(26, 45),
        second_official_row=46,
        class_header_row=48,
        class_rows=(49, 68),
        class_official_row=69,
    ),
]


def col_to_num(col: str) -> int:
    value = 0
    for ch in col:
        value = value * 26 + ord(ch.upper()) - 64
    return value


def num_to_col(value: int) -> str:
    chars: List[str] = []
    while value:
        value, rem = divmod(value - 1, 26)
        chars.append(chr(65 + rem))
    return "".join(reversed(chars))


def parse_cell_ref(ref: str) -> Tuple[str, int]:
    match = re.fullmatch(r"([A-Z]+)(\d+)", ref)
    if not match:
        raise ValueError(f"Invalid cell reference: {ref}")
    return match.group(1), int(match.group(2))


def outcome(home: int, away: int) -> str:
    if home > away:
        return "casa"
    if away > home:
        return "visita"
    return "empate"


def safe_float(value: str) -> float | None:
    if value in ("", None):
        return None
    try:
        return float(value)
    except ValueError:
        return None


class Workbook:
    def __init__(self, path: Path) -> None:
        self.path = path
        self.zip = zipfile.ZipFile(path)
        self.shared_strings = self._load_shared_strings()

    def _load_shared_strings(self) -> List[str]:
        if "xl/sharedStrings.xml" not in self.zip.namelist():
            return []
        root = ET.fromstring(self.zip.read("xl/sharedStrings.xml"))
        values = []
        for si in root.findall("a:si", NS):
            values.append("".join(node.text or "" for node in si.findall(".//a:t", NS)))
        return values

    def read_sheet(self, sheet_path: str) -> Dict[int, Dict[str, str]]:
        root = ET.fromstring(self.zip.read(sheet_path))
        rows: Dict[int, Dict[str, str]] = {}
        for row in root.findall(".//a:sheetData/a:row", NS):
            row_number = int(row.attrib["r"])
            values: Dict[str, str] = {}
            for cell in row.findall("a:c", NS):
                col, _ = parse_cell_ref(cell.attrib["r"])
                raw = ""
                value_node = cell.find("a:v", NS)
                if value_node is not None:
                    raw = value_node.text or ""
                    if cell.attrib.get("t") == "s":
                        raw = self.shared_strings[int(raw)]
                values[col] = raw
            rows[row_number] = values
        return rows


def extract_weights(workbook: Workbook) -> Dict[str, Dict[str, float]]:
    rows = workbook.read_sheet("xl/worksheets/sheet19.xml")
    return {
        "playoff": {
            "result": float(rows[3]["M"]),
            "qualified": float(rows[4]["M"]),
            "exact": float(rows[6]["M"]),
        },
        "round_of_16": {
            "result": float(rows[3]["N"]),
            "qualified": float(rows[4]["N"]),
            "exact": float(rows[6]["N"]),
        },
    }


def header_starts(row: Dict[str, str], predicate) -> List[str]:
    starts = []
    for col, value in sorted(row.items(), key=lambda item: col_to_num(item[0])):
        if predicate(value):
            starts.append(col)
    return starts


def match_headers(row: Dict[str, str]) -> List[str]:
    return header_starts(row, lambda value: " x " in value)


def class_headers(row: Dict[str, str]) -> List[str]:
    return header_starts(row, lambda value: value == "CLASSIFICADO")


def parse_match_predictions(
    rows: Dict[int, Dict[str, str]],
    header_row: int,
    prediction_rows: Tuple[int, int],
    official_row: int,
    match_id_prefix: str,
) -> Tuple[List[Dict[str, object]], Dict[str, Dict[str, object]], Dict[str, Dict[str, object]]]:
    starts = match_headers(rows[header_row])
    matches: List[Dict[str, object]] = []
    official_cells = rows[official_row]
    for index, start in enumerate(starts):
        start_num = col_to_num(start)
        label = rows[header_row][start]
        matches.append(
            {
                "id": f"{match_id_prefix}-m{index + 1}",
                "label": label,
                "start": start,
                "home_col": num_to_col(start_num),
                "away_col": num_to_col(start_num + 2),
                "points_col": num_to_col(start_num + 4),
                "official_home": int(float(official_cells.get(num_to_col(start_num), "0") or 0)),
                "official_away": int(float(official_cells.get(num_to_col(start_num + 2), "0") or 0)),
            }
        )

    by_participant: Dict[str, Dict[str, object]] = {}
    solo_hits: Dict[str, Dict[str, object]] = {}
    row_start, row_end = prediction_rows
    for row_number in range(row_start, row_end + 1):
        row = rows.get(row_number, {})
        participant = row.get("B", "").strip()
        if not participant or participant == "OFICIAL":
            continue
        participant_matches = []
        for match in matches:
            home = safe_float(row.get(match["home_col"], ""))
            away = safe_float(row.get(match["away_col"], ""))
            raw_points = safe_float(row.get(match["points_col"], "")) or 0.0
            participant_matches.append(
                {
                    "id": match["id"],
                    "label": match["label"],
                    "pred_home": int(home) if home is not None else None,
                    "pred_away": int(away) if away is not None else None,
                    "raw_points": raw_points,
                }
            )
        by_participant[participant] = {"row": row_number, "matches": participant_matches}

    for match in matches:
        exact_hits = []
        result_hits = []
        for participant, payload in by_participant.items():
            item = next(entry for entry in payload["matches"] if entry["id"] == match["id"])
            pred_home = item["pred_home"]
            pred_away = item["pred_away"]
            if pred_home is None or pred_away is None:
                continue
            if pred_home == match["official_home"] and pred_away == match["official_away"]:
                exact_hits.append(participant)
                result_hits.append(participant)
            elif outcome(pred_home, pred_away) == outcome(match["official_home"], match["official_away"]):
                result_hits.append(participant)
        solo_hits[match["id"]] = {
            "label": match["label"],
            "exact_participants": exact_hits,
            "successful_participants": result_hits,
        }
    return matches, by_participant, solo_hits


def parse_classifications(
    rows: Dict[int, Dict[str, str]],
    header_row: int,
    prediction_rows: Tuple[int, int],
    official_row: int,
) -> Tuple[List[Dict[str, object]], Dict[str, Dict[str, object]]]:
    starts = class_headers(rows[header_row])
    official_cells = rows[official_row]
    ties: List[Dict[str, object]] = []
    for index, start in enumerate(starts):
        start_num = col_to_num(start)
        ties.append(
            {
                "id": f"c{index + 1}",
                "start": start,
                "pick_col": num_to_col(start_num),
                "points_col": num_to_col(start_num + 4),
                "official": official_cells.get(num_to_col(start_num), "").strip(),
            }
        )

    by_participant: Dict[str, Dict[str, object]] = {}
    row_start, row_end = prediction_rows
    for row_number in range(row_start, row_end + 1):
        row = rows.get(row_number, {})
        participant = row.get("B", "").strip()
        if not participant or participant == "OFICIAL":
            continue
        picks = []
        for tie in ties:
            picks.append(
                {
                    "id": tie["id"],
                    "pick": row.get(tie["pick_col"], "").strip(),
                    "raw_points": safe_float(row.get(tie["points_col"], "")) or 0.0,
                }
            )
        by_participant[participant] = {"row": row_number, "picks": picks}
    return ties, by_participant


def extract_acertos(workbook: Workbook) -> Dict[str, Dict[str, float]]:
    rows = workbook.read_sheet("xl/worksheets/sheet18.xml")
    result: Dict[str, Dict[str, float]] = {}
    for row_number, row in rows.items():
        participant = row.get("B", "").strip()
        if not participant or participant == "APOSTADOR":
            continue
        result[participant] = {
            "round_of_16_result_hits": safe_float(row.get("F", "")) or 0.0,
            "round_of_16_exact_hits": safe_float(row.get("G", "")) or 0.0,
            "round_of_16_qualified_hits": safe_float(row.get("H", "")) or 0.0,
        }
    return result


def build_report(workbook_path: Path) -> Dict[str, object]:
    workbook = Workbook(workbook_path)
    weights = extract_weights(workbook)
    acertos = extract_acertos(workbook)

    participants: Dict[str, Dict[str, object]] = defaultdict(
        lambda: {
            "playoff": {},
            "round_of_16": {},
            "hope_solo": {"playoff": 0, "round_of_16": 0, "total": 0},
        }
    )

    summary = {"phases": {}, "participants": participants}

    for phase in PHASES:
        rows = workbook.read_sheet(phase.sheet_path)
        match_meta_first, first_predictions, first_solo_hits = parse_match_predictions(
            rows, phase.first_header_row, phase.first_rows, phase.first_official_row, f"{phase.key}-first"
        )
        match_meta_second, second_predictions, second_solo_hits = parse_match_predictions(
            rows, phase.second_header_row, phase.second_rows, phase.second_official_row, f"{phase.key}-second"
        )
        ties, class_predictions = parse_classifications(
            rows, phase.class_header_row, phase.class_rows, phase.class_official_row
        )

        phase_weight = weights[phase.key]
        solo_hits_by_match = {**first_solo_hits, **second_solo_hits}
        summary["phases"][phase.key] = {
            "weights": phase_weight,
            "matches_first_leg": [item["label"] for item in match_meta_first],
            "matches_second_leg": [item["label"] for item in match_meta_second],
        }

        all_participants = set(first_predictions) | set(second_predictions) | set(class_predictions)
        for participant in sorted(all_participants):
            first_payload = first_predictions.get(participant, {"matches": []})
            second_payload = second_predictions.get(participant, {"matches": []})
            class_payload = class_predictions.get(participant, {"picks": []})

            result_hits = 0
            exact_hits = 0
            qualified_hits = 0
            calc_match_points = 0.0
            raw_match_points = 0.0
            match_details = []

            for match, payload in list(zip(match_meta_first, first_payload["matches"])) + list(
                zip(match_meta_second, second_payload["matches"])
            ):
                pred_home = payload["pred_home"]
                pred_away = payload["pred_away"]
                raw_points = payload["raw_points"]
                raw_match_points += raw_points
                computed = 0.0
                is_exact = False
                is_result = False
                is_hope_solo = False

                if pred_home is not None and pred_away is not None:
                    is_exact = pred_home == match["official_home"] and pred_away == match["official_away"]
                    if is_exact:
                        computed = phase_weight["exact"]
                        exact_hits += 1
                    else:
                        is_result = (
                            outcome(pred_home, pred_away)
                            == outcome(match["official_home"], match["official_away"])
                        )
                        if is_result:
                            computed = phase_weight["result"]
                            result_hits += 1

                    if (is_exact or is_result) and len(solo_hits_by_match[match["id"]]["successful_participants"]) == 1:
                        is_hope_solo = True
                        participants[participant]["hope_solo"][phase.key] += 1
                        participants[participant]["hope_solo"]["total"] += 1

                calc_match_points += computed
                match_details.append(
                    {
                        "label": match["label"],
                        "predicted": None if pred_home is None or pred_away is None else f"{pred_home}x{pred_away}",
                        "official": f"{match['official_home']}x{match['official_away']}",
                        "raw_points": raw_points,
                        "computed_points": computed,
                        "exact_hit": is_exact,
                        "result_hit": is_result,
                        "hope_solo": is_hope_solo,
                        "solo_hit_type": "placar" if is_hope_solo and is_exact else ("tendencia" if is_hope_solo else ""),
                    }
                )

            calc_class_points = 0.0
            raw_class_points = 0.0
            class_details = []
            for tie, payload in zip(ties, class_payload["picks"]):
                hit = payload["pick"] == tie["official"] and bool(payload["pick"])
                points = phase_weight["qualified"] if hit else 0.0
                if hit:
                    qualified_hits += 1
                calc_class_points += points
                raw_class_points += payload["raw_points"]
                class_details.append(
                    {
                        "pick": payload["pick"],
                        "official": tie["official"],
                        "raw_points": payload["raw_points"],
                        "computed_points": points,
                        "hit": hit,
                    }
                )

            calc_total = calc_match_points + calc_class_points
            raw_total = raw_match_points + raw_class_points
            phase_payload = {
                "result_hits": result_hits,
                "exact_hits": exact_hits,
                "qualified_hits": qualified_hits,
                "computed_match_points": round(calc_match_points, 2),
                "raw_match_points": round(raw_match_points, 2),
                "computed_class_points": round(calc_class_points, 2),
                "raw_class_points": round(raw_class_points, 2),
                "computed_total": round(calc_total, 2),
                "raw_total": round(raw_total, 2),
                "delta_total": round(calc_total - raw_total, 2),
                "match_details": match_details,
                "class_details": class_details,
            }
            if phase.key == "round_of_16" and participant in acertos:
                phase_payload["acertos_sheet"] = acertos[participant]
                phase_payload["delta_acertos"] = {
                    "result_hits": round(
                        (result_hits + exact_hits) - acertos[participant]["round_of_16_result_hits"], 2
                    ),
                    "exact_hits": round(exact_hits - acertos[participant]["round_of_16_exact_hits"], 2),
                    "qualified_hits": round(qualified_hits - acertos[participant]["round_of_16_qualified_hits"], 2),
                }
            participants[participant][phase.key] = phase_payload

    summary["participants"] = dict(sorted(participants.items()))
    return summary


def markdown_report(report: Dict[str, object], workbook_path: Path) -> str:
    participants: Dict[str, Dict[str, object]] = report["participants"]  # type: ignore[assignment]
    lines = [
        "# Backtest playoff + oitavas",
        "",
        f"Base analisada: `{workbook_path}`",
        "",
        "## Resultado geral",
        "",
    ]

    playoff_ok = 0
    oitavas_ok = 0
    oitavas_acertos_ok = 0
    for payload in participants.values():
        playoff = payload.get("playoff", {})
        round_of_16 = payload.get("round_of_16", {})
        if playoff and abs(playoff.get("delta_total", 0.0)) < 0.001:
            playoff_ok += 1
        if round_of_16 and abs(round_of_16.get("delta_total", 0.0)) < 0.001:
            oitavas_ok += 1
        delta_acertos = round_of_16.get("delta_acertos") if round_of_16 else None
        if delta_acertos and all(abs(value) < 0.001 for value in delta_acertos.values()):
            oitavas_acertos_ok += 1

    lines.extend(
        [
            f"- Playoff: `{playoff_ok}/{len(participants)}` participantes batem exatamente com a planilha.",
            f"- Oitavas: `{oitavas_ok}/{len(participants)}` participantes batem exatamente com a planilha.",
            f"- Oitavas vs aba `Acertos`: `{oitavas_acertos_ok}/{len(participants)}` participantes batem nos contadores de tendência, placar e classificados.",
            "",
            "## Participante por participante",
            "",
            "| Participante | Playoff calc | Playoff planilha | Delta | Oitavas calc | Oitavas planilha | Delta | Hope Solo | Acertos 8as |",
            "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |",
        ]
    )

    for participant, payload in participants.items():
        playoff = payload.get("playoff", {})
        round_of_16 = payload.get("round_of_16", {})
        hope_solo = payload["hope_solo"]["total"]
        acertos = round_of_16.get("acertos_sheet", {}) if round_of_16 else {}
        acertos_label = (
            f"T {int(round_of_16['result_hits'] + round_of_16['exact_hits'])}/{int(acertos.get('round_of_16_result_hits', 0))}"
            f" • P {int(round_of_16['exact_hits'])}/{int(acertos.get('round_of_16_exact_hits', 0))}"
            f" • C {int(round_of_16['qualified_hits'])}/{int(acertos.get('round_of_16_qualified_hits', 0))}"
            if acertos
            else "-"
        )
        playoff_calc = playoff.get("computed_total", 0.0)
        playoff_raw = playoff.get("raw_total", 0.0)
        playoff_delta = playoff.get("delta_total", 0.0)
        oitavas_calc = round_of_16.get("computed_total", 0.0)
        oitavas_raw = round_of_16.get("raw_total", 0.0)
        oitavas_delta = round_of_16.get("delta_total", 0.0)
        lines.append(
            f"| {participant} | {playoff_calc:.2f} | {playoff_raw:.2f} | {playoff_delta:.2f} | "
            f"{oitavas_calc:.2f} | {oitavas_raw:.2f} | {oitavas_delta:.2f} | "
            f"{hope_solo} | {acertos_label} |"
        )

    lines.extend(
        [
            "",
            "## Observações",
            "",
            "- Neste workbook, o placar exato substitui a pontuação de tendência no mata-mata. Exemplo: oitavas usam `6` para exato ou `1` para tendência, não `7` acumulado.",
            "- O relatório reconstrói apenas `PLAYOFF_1aFASE` e `OITAVAS`, porque foram as abas pedidas.",
            "- Contagem de `Hope Solo` considera jogos em que exatamente um participante foi o único a acertar o jogo, seja por `placar exato` ou por `tendência`.",
        ]
    )
    return "\n".join(lines) + "\n"


def main() -> int:
    if len(sys.argv) != 2:
        print("usage: backtest_xlsx.py /path/to/workbook.xlsx", file=sys.stderr)
        return 1

    workbook_path = Path(sys.argv[1]).expanduser().resolve()
    report = build_report(workbook_path)
    root = Path(__file__).resolve().parents[1]
    json_path = root / "backtest-report.json"
    md_path = root / "backtest-report.md"
    json_path.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n")
    md_path.write_text(markdown_report(report, workbook_path), encoding="utf-8")
    print(json_path)
    print(md_path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
