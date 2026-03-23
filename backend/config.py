from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Settings:
    project_root: Path
    database_path: Path
    api_football_key: str
    api_football_host: str
    api_football_base_url: str
    api_football_league_id: int
    default_season: int
    host: str
    port: int


def load_settings() -> Settings:
    project_root = Path(__file__).resolve().parents[1]
    data_dir = project_root / "backend" / "data"
    data_dir.mkdir(parents=True, exist_ok=True)
    return Settings(
        project_root=project_root,
        database_path=Path(os.getenv("BOLAO_DB_PATH", data_dir / "champions_bolao.db")),
        api_football_key=os.getenv("API_FOOTBALL_KEY", ""),
        api_football_host=os.getenv("API_FOOTBALL_HOST", "v3.football.api-sports.io"),
        api_football_base_url=os.getenv("API_FOOTBALL_BASE_URL", "https://v3.football.api-sports.io"),
        api_football_league_id=int(os.getenv("API_FOOTBALL_LEAGUE_ID", "2")),
        default_season=int(os.getenv("BOLAO_DEFAULT_SEASON", "2025")),
        host=os.getenv("BOLAO_BACKEND_HOST", "127.0.0.1"),
        port=int(os.getenv("BOLAO_BACKEND_PORT", "8080")),
    )
