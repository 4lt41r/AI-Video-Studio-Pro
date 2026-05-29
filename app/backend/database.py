"""SQLite database setup with async access via aiosqlite."""
import aiosqlite
from contextlib import asynccontextmanager
from config import DATABASE_PATH

SCHEMA = """
PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS projects (
    id           TEXT PRIMARY KEY,
    name         TEXT NOT NULL,
    aspect_ratio TEXT NOT NULL DEFAULT '16:9',
    width        INTEGER NOT NULL DEFAULT 1920,
    height       INTEGER NOT NULL DEFAULT 1080,
    fps          REAL NOT NULL DEFAULT 30,
    created_at   TEXT NOT NULL,
    updated_at   TEXT NOT NULL,
    thumbnail    TEXT,
    duration_s   REAL DEFAULT 0,
    settings     TEXT DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS media (
    id           TEXT PRIMARY KEY,
    project_id   TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name         TEXT NOT NULL,
    path         TEXT NOT NULL,
    type         TEXT NOT NULL,
    duration_s   REAL,
    width        INTEGER,
    height       INTEGER,
    fps          REAL,
    has_audio    INTEGER DEFAULT 1,
    size_bytes   INTEGER DEFAULT 0,
    thumbnail    TEXT,
    proxy_path   TEXT,
    created_at   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS timelines (
    project_id   TEXT PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
    state        TEXT NOT NULL DEFAULT '{}',
    version      INTEGER DEFAULT 1,
    saved_at     TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS exports (
    id           TEXT PRIMARY KEY,
    project_id   TEXT REFERENCES projects(id) ON DELETE CASCADE,
    preset       TEXT,
    output_path  TEXT,
    status       TEXT NOT NULL DEFAULT 'pending',
    started_at   TEXT,
    finished_at  TEXT,
    error        TEXT,
    settings     TEXT DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS jobs (
    id           TEXT PRIMARY KEY,
    type         TEXT NOT NULL,
    project_id   TEXT,
    status       TEXT NOT NULL DEFAULT 'pending',
    progress     REAL DEFAULT 0,
    result       TEXT,
    error        TEXT,
    created_at   TEXT NOT NULL,
    updated_at   TEXT NOT NULL
);
"""

@asynccontextmanager
async def get_db():
    async with aiosqlite.connect(DATABASE_PATH) as db:
        db.row_factory = aiosqlite.Row
        await db.execute("PRAGMA journal_mode=WAL")
        await db.execute("PRAGMA foreign_keys=ON")
        yield db

async def init_db():
    async with aiosqlite.connect(DATABASE_PATH) as db:
        db.row_factory = aiosqlite.Row
        await db.executescript(SCHEMA)
        # Migration: add has_audio column if not present (existing databases)
        for migration in [
            "ALTER TABLE media ADD COLUMN has_audio INTEGER DEFAULT 1",
            "ALTER TABLE media ADD COLUMN proxy_path TEXT",
        ]:
            try:
                await db.execute(migration)
                await db.commit()
            except Exception:
                pass  # column already exists
