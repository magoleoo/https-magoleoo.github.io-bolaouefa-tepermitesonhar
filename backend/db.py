from __future__ import annotations

import sqlite3
from pathlib import Path
from typing import Iterable


def connect(database_path: Path) -> sqlite3.Connection:
    connection = sqlite3.connect(database_path)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


def initialize_schema(connection: sqlite3.Connection, schema_path: Path) -> None:
    connection.executescript(schema_path.read_text(encoding="utf-8"))
    connection.commit()


def fetch_all(connection: sqlite3.Connection, query: str, params: Iterable[object] = ()) -> list[sqlite3.Row]:
    cursor = connection.execute(query, tuple(params))
    return cursor.fetchall()


def fetch_one(connection: sqlite3.Connection, query: str, params: Iterable[object] = ()) -> sqlite3.Row | None:
    cursor = connection.execute(query, tuple(params))
    return cursor.fetchone()
