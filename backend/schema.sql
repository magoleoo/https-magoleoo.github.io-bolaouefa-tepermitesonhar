CREATE TABLE IF NOT EXISTS participants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL UNIQUE,
  access_code TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS teams (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  api_team_id INTEGER UNIQUE,
  name TEXT NOT NULL UNIQUE,
  short_name TEXT,
  is_former_champion INTEGER NOT NULL DEFAULT 0,
  crest_url TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS matches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  api_fixture_id INTEGER UNIQUE,
  season INTEGER NOT NULL,
  phase_key TEXT NOT NULL,
  round_label TEXT NOT NULL,
  leg_label TEXT,
  kickoff_utc TEXT NOT NULL,
  status_short TEXT,
  status_long TEXT,
  home_team_id INTEGER NOT NULL REFERENCES teams(id),
  away_team_id INTEGER NOT NULL REFERENCES teams(id),
  score_home_90 INTEGER,
  score_away_90 INTEGER,
  score_home_ft INTEGER,
  score_away_ft INTEGER,
  score_home_et INTEGER,
  score_away_et INTEGER,
  score_home_pen INTEGER,
  score_away_pen INTEGER,
  qualified_team_id INTEGER REFERENCES teams(id),
  winner_team_id INTEGER REFERENCES teams(id),
  went_extra_time INTEGER NOT NULL DEFAULT 0,
  went_penalties INTEGER NOT NULL DEFAULT 0,
  is_superclassic INTEGER NOT NULL DEFAULT 0,
  source_payload_json TEXT,
  source_updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_matches_season_phase ON matches(season, phase_key);

CREATE TABLE IF NOT EXISTS participant_match_predictions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  participant_id INTEGER NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  predicted_home INTEGER NOT NULL,
  predicted_away INTEGER NOT NULL,
  submitted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(participant_id, match_id)
);

CREATE TABLE IF NOT EXISTS participant_phase_picks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  participant_id INTEGER NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  season INTEGER NOT NULL,
  phase_key TEXT NOT NULL,
  pick_slot TEXT NOT NULL,
  team_id INTEGER REFERENCES teams(id),
  raw_value TEXT,
  position_index INTEGER,
  submitted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(participant_id, season, phase_key, pick_slot, position_index)
);

CREATE TABLE IF NOT EXISTS participant_special_picks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  participant_id INTEGER NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  season INTEGER NOT NULL,
  pick_type TEXT NOT NULL,
  raw_value TEXT NOT NULL,
  team_id INTEGER REFERENCES teams(id),
  submitted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(participant_id, season, pick_type)
);

CREATE TABLE IF NOT EXISTS season_state (
  season INTEGER PRIMARY KEY,
  league_top8_json TEXT,
  playoff_winners_json TEXT,
  round_of_16_json TEXT,
  quarter_finals_json TEXT,
  semi_finals_json TEXT,
  champion_team_id INTEGER REFERENCES teams(id),
  top_scorer_name TEXT,
  top_assist_name TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS leaderboard_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  season INTEGER NOT NULL,
  participant_id INTEGER NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  total_points REAL NOT NULL,
  first_phase_points REAL NOT NULL DEFAULT 0,
  playoff_points REAL NOT NULL DEFAULT 0,
  round_of_16_points REAL NOT NULL DEFAULT 0,
  quarter_points REAL NOT NULL DEFAULT 0,
  semi_points REAL NOT NULL DEFAULT 0,
  final_points REAL NOT NULL DEFAULT 0,
  superclassic_points REAL NOT NULL DEFAULT 0,
  hope_solo_hits INTEGER NOT NULL DEFAULT 0,
  favorite_team_points REAL NOT NULL DEFAULT 0,
  top_scorer_points REAL NOT NULL DEFAULT 0,
  top_assist_points REAL NOT NULL DEFAULT 0,
  breakdown_json TEXT NOT NULL,
  calculated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(season, participant_id)
);
