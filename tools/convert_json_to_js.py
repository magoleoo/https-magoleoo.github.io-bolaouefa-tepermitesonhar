import json
import os

files_to_convert = [
    ("api/ranking.json", "window.backtestData"),
    ("api/matches.json", "window.apiMatchesData"),
    ("league-phase.json", "window.leaguePhaseData"),
    ("superclassicos.json", "window.superclassicData")
]

for filepath, var_name in files_to_convert:
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            data = f.read()
        js_path = filepath.replace(".json", ".js")
        with open(js_path, "w", encoding="utf-8") as f:
            f.write(f"{var_name} = {data};\n")
        print(f"Converted {filepath} to {js_path}")
    except Exception as e:
        print(f"Failed to convert {filepath}: {e}")
