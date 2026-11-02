import * as Device from 'expo-device';
import type { SQLiteDatabase } from 'expo-sqlite';
import { JumpMeasurement } from '@/lib/jumpDetector';
import { Attempt } from '@/lib/sports';
import { ageGroupOf, Gender, JumpRow, MatchMode, Player, SportId } from '@/lib/types';

export const DB_NAME = 'jumpspinlab.db';
const DB_VERSION = 3;

export async function migrate(db: SQLiteDatabase): Promise<void> {
  // foreign keys are a per-connection setting
  await db.execAsync('PRAGMA foreign_keys = ON;');
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const current = row?.user_version ?? 0;
  if (current >= DB_VERSION) return;

  if (current === 0) {
    await db.execAsync(`
      PRAGMA journal_mode = 'wal';
      CREATE TABLE players (
        id INTEGER PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        height_cm REAL NOT NULL,
        gender TEXT NOT NULL,
        age_group TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE TABLE matches (
        id INTEGER PRIMARY KEY NOT NULL,
        mode TEXT NOT NULL,
        attempts INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        finished_at INTEGER
      );
      CREATE TABLE jumps (
        id INTEGER PRIMARY KEY NOT NULL,
        player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
        height_cm REAL NOT NULL,
        flight_ms REAL NOT NULL,
        spin_deg REAL NOT NULL,
        impact_g REAL NOT NULL,
        device_model TEXT,
        created_at INTEGER NOT NULL,
        match_id INTEGER REFERENCES matches(id) ON DELETE SET NULL
      );
      CREATE INDEX idx_jumps_player ON jumps(player_id, created_at);
    `);
  }
  if (current < 2) {
    // v2: age in years and body weight feed the fair-score formula. Players saved with v1
    // only had an age *group*, so start from the middle of the group and a typical weight;
    // both can be corrected in the player screen.
    await db.execAsync(`
      ALTER TABLE players ADD COLUMN age INTEGER NOT NULL DEFAULT 20;
      ALTER TABLE players ADD COLUMN weight_kg REAL NOT NULL DEFAULT 65;
      UPDATE players SET age = CASE age_group
        WHEN 'u15' THEN 13 WHEN '15-24' THEN 20 WHEN '25-39' THEN 30 ELSE 45 END;
    `);
  }
  if (current < 3) {
    // v3: results of the sports that are not measured by the jump detector
    // (value / value2 mean different things per sport, see lib/sports.ts)
    await db.execAsync(`
      CREATE TABLE attempts (
        id INTEGER PRIMARY KEY NOT NULL,
        player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
        sport TEXT NOT NULL,
        value REAL NOT NULL,
        value2 REAL,
        foul INTEGER NOT NULL DEFAULT 0,
        device_model TEXT,
        created_at INTEGER NOT NULL,
        match_id INTEGER REFERENCES matches(id) ON DELETE SET NULL
      );
      CREATE INDEX idx_attempts_sport ON attempts(sport, player_id, created_at);
    `);
  }
  await db.execAsync(`PRAGMA user_version = ${DB_VERSION}`);
}

interface PlayerDbRow {
  id: number;
  name: string;
  height_cm: number;
  weight_kg: number;
  age: number;
  gender: string;
}

interface JumpDbRow {
  id: number;
  player_id: number;
  height_cm: number;
  flight_ms: number;
  spin_deg: number;
  impact_g: number;
  device_model: string | null;
  created_at: number;
  match_id: number | null;
}

const toPlayer = (r: PlayerDbRow): Player => ({
  id: r.id,
  name: r.name,
  heightCm: r.height_cm,
  weightKg: r.weight_kg,
  age: r.age,
  gender: r.gender as Gender,
  ageGroup: ageGroupOf(r.age),
});

const toJump = (r: JumpDbRow): JumpRow => ({
  id: r.id,
  playerId: r.player_id,
  heightCm: r.height_cm,
  flightMs: r.flight_ms,
  spinDeg: r.spin_deg,
  impactG: r.impact_g,
  deviceModel: r.device_model,
  createdAt: r.created_at,
  matchId: r.match_id,
});

export type PlayerInput = Omit<Player, 'id' | 'ageGroup'>;

export async function listPlayers(db: SQLiteDatabase): Promise<Player[]> {
  const rows = await db.getAllAsync<PlayerDbRow>('SELECT * FROM players ORDER BY name COLLATE NOCASE');
  return rows.map(toPlayer);
}

export async function getPlayer(db: SQLiteDatabase, id: number): Promise<Player | null> {
  const row = await db.getFirstAsync<PlayerDbRow>('SELECT * FROM players WHERE id = ?', id);
  return row ? toPlayer(row) : null;
}

export async function addPlayer(db: SQLiteDatabase, p: PlayerInput): Promise<number> {
  const r = await db.runAsync(
    `INSERT INTO players (name, height_cm, weight_kg, age, gender, age_group, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    p.name,
    p.heightCm,
    p.weightKg,
    p.age,
    p.gender,
    ageGroupOf(p.age),
    Date.now(),
  );
  return r.lastInsertRowId;
}

export async function updatePlayer(db: SQLiteDatabase, id: number, p: PlayerInput): Promise<void> {
  await db.runAsync(
    `UPDATE players SET name = ?, height_cm = ?, weight_kg = ?, age = ?, gender = ?, age_group = ?
     WHERE id = ?`,
    p.name,
    p.heightCm,
    p.weightKg,
    p.age,
    p.gender,
    ageGroupOf(p.age),
    id,
  );
}

export async function deletePlayer(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('DELETE FROM players WHERE id = ?', id);
}

export async function listJumps(db: SQLiteDatabase, playerId?: number): Promise<JumpRow[]> {
  const rows =
    playerId === undefined
      ? await db.getAllAsync<JumpDbRow>('SELECT * FROM jumps ORDER BY created_at ASC')
      : await db.getAllAsync<JumpDbRow>(
          'SELECT * FROM jumps WHERE player_id = ? ORDER BY created_at ASC',
          playerId,
        );
  return rows.map(toJump);
}

export async function bestHeight(db: SQLiteDatabase, playerId: number): Promise<number> {
  const row = await db.getFirstAsync<{ best: number | null }>(
    'SELECT MAX(height_cm) AS best FROM jumps WHERE player_id = ?',
    playerId,
  );
  return row?.best ?? 0;
}

export async function insertJump(
  db: SQLiteDatabase,
  playerId: number,
  m: JumpMeasurement,
  matchId: number | null = null,
): Promise<number> {
  const r = await db.runAsync(
    `INSERT INTO jumps (player_id, height_cm, flight_ms, spin_deg, impact_g, device_model, created_at, match_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    playerId,
    m.heightCm,
    m.flightMs,
    m.spinDeg,
    m.impactG,
    Device.modelName ?? null,
    Date.now(),
    matchId,
  );
  return r.lastInsertRowId;
}

export async function deleteJump(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('DELETE FROM jumps WHERE id = ?', id);
}

export async function createMatch(
  db: SQLiteDatabase,
  mode: MatchMode,
  attempts: number,
): Promise<number> {
  const r = await db.runAsync(
    'INSERT INTO matches (mode, attempts, created_at) VALUES (?, ?, ?)',
    mode,
    attempts,
    Date.now(),
  );
  return r.lastInsertRowId;
}

export async function finishMatch(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('UPDATE matches SET finished_at = ? WHERE id = ? AND finished_at IS NULL', Date.now(), id);
}

interface AttemptDbRow {
  id: number;
  player_id: number;
  sport: string;
  value: number;
  value2: number | null;
  foul: number;
  created_at: number;
  match_id: number | null;
}

export interface AttemptRow {
  id: number;
  playerId: number;
  sport: SportId;
  attempt: Attempt;
  createdAt: number;
  matchId: number | null;
}

export async function insertAttempt(
  db: SQLiteDatabase,
  playerId: number,
  sport: SportId,
  a: Attempt,
  matchId: number | null = null,
): Promise<number> {
  const r = await db.runAsync(
    `INSERT INTO attempts (player_id, sport, value, value2, foul, device_model, created_at, match_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    playerId,
    sport,
    a.value,
    a.value2 ?? null,
    a.foul ? 1 : 0,
    Device.modelName ?? null,
    Date.now(),
    matchId,
  );
  return r.lastInsertRowId;
}

export async function listAttempts(
  db: SQLiteDatabase,
  sport: SportId,
  playerId?: number,
): Promise<AttemptRow[]> {
  const rows =
    playerId === undefined
      ? await db.getAllAsync<AttemptDbRow>('SELECT * FROM attempts WHERE sport = ? ORDER BY created_at ASC', sport)
      : await db.getAllAsync<AttemptDbRow>(
          'SELECT * FROM attempts WHERE sport = ? AND player_id = ? ORDER BY created_at ASC',
          sport,
          playerId,
        );
  return rows.map((r) => ({
    id: r.id,
    playerId: r.player_id,
    sport: r.sport as SportId,
    attempt: { value: r.value, value2: r.value2 ?? undefined, foul: r.foul === 1 || undefined },
    createdAt: r.created_at,
    matchId: r.match_id,
  }));
}

export async function deleteAttempt(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('DELETE FROM attempts WHERE id = ?', id);
}
