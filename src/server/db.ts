import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import type { Match } from "../shared/types.js";
import { CS2_MAPS } from "../shared/types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = process.env.DATA_DIR || path.join(__dirname, "../../data");
const dbPath = path.join(dataDir, "picksmaps.db");

let db: Database.Database;

export function initDb(): Database.Database {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");

  db.exec(`
    CREATE TABLE IF NOT EXISTS matches (
      id TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )
  `);

  return db;
}

export function getDb(): Database.Database {
  if (!db) initDb();
  return db;
}

export function saveMatch(match: Match): void {
  const stmt = getDb().prepare(`
    INSERT INTO matches (id, data, created_at) VALUES (?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET data = excluded.data
  `);
  stmt.run(match.id, JSON.stringify(match), match.createdAt);
}

export function loadMatch(id: string): Match | null {
  const row = getDb()
    .prepare("SELECT data FROM matches WHERE id = ?")
    .get(id) as { data: string } | undefined;
  if (!row) return null;
  const match = JSON.parse(row.data) as Match;
  match.remainingMaps = match.remainingMaps.filter((m) =>
    CS2_MAPS.includes(m as (typeof CS2_MAPS)[number])
  );
  return match;
}

export function deleteOldMatches(maxAgeMs = 7 * 24 * 60 * 60 * 1000): void {
  const cutoff = Date.now() - maxAgeMs;
  getDb().prepare("DELETE FROM matches WHERE created_at < ?").run(cutoff);
}
