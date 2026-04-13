import Database from 'better-sqlite3';
import path from 'path';
import { app } from 'electron';

export interface UserProfile {
  id: string;
  company_name: string;
  email: string;
  credits_remaining: number;
  total_cvs_selected: number;
  created_at: string;
}

export interface Job {
  id: string;
  title: string;
  location: string;
  is_remote: number;
  english_level: string;
  minimum_experience: number;
  required_skills: string;
  description: string;
  status: string;
  created_at: string;
}

export interface CVAnalysis {
  id: string;
  job_id: string;
  cv_filename: string;
  candidate_name: string;
  fit_score: number;
  experience_score: number;
  skills_score: number;
  location_score: number;
  english_score: number;
  briefing: string;
  key_strengths: string;
  gaps: string;
  recommendation: string;
  recommendation_reasoning: string;
  created_at: string;
}

export interface PurchaseRecord {
  id: string;
  stripe_session_id: string;
  credits_purchased: number;
  synced: number;
  created_at: string;
}

let db: Database.Database;

const getDbPath = () => {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'cv-fit-check.db');
};

export function initializeDatabase() {
  const dbPath = getDbPath();
  db = new Database(dbPath);

  db.pragma('foreign_keys = ON');
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS user_profile (
      id TEXT PRIMARY KEY,
      company_name TEXT NOT NULL,
      email TEXT NOT NULL,
      credits_remaining INTEGER DEFAULT 10,
      total_cvs_selected INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      location TEXT,
      is_remote INTEGER DEFAULT 0,
      english_level TEXT,
      minimum_experience INTEGER DEFAULT 0,
      required_skills TEXT DEFAULT '[]',
      description TEXT DEFAULT '',
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS cv_analyses (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL,
      cv_filename TEXT NOT NULL,
      candidate_name TEXT DEFAULT '',
      fit_score REAL DEFAULT 0,
      experience_score REAL DEFAULT 0,
      skills_score REAL DEFAULT 0,
      location_score REAL DEFAULT 0,
      english_score REAL DEFAULT 0,
      briefing TEXT DEFAULT '',
      key_strengths TEXT DEFAULT '[]',
      gaps TEXT DEFAULT '[]',
      recommendation TEXT DEFAULT '',
      recommendation_reasoning TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS synced_purchases (
      id TEXT PRIMARY KEY,
      stripe_session_id TEXT UNIQUE,
      credits_purchased INTEGER,
      synced_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_cv_analyses_job_id ON cv_analyses(job_id);
    CREATE INDEX IF NOT EXISTS idx_cv_analyses_fit_score ON cv_analyses(fit_score DESC);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_cv_unique ON cv_analyses(job_id, cv_filename);
  `);

  // Migrations for existing installs
  runMigrations();

  return db;
}

function runMigrations() {
  // Add is_remote to jobs table if missing
  try {
    db.exec('ALTER TABLE jobs ADD COLUMN is_remote INTEGER DEFAULT 0');
  } catch (_) { /* column already exists */ }

  // Remove legacy scoring_parameters column if present (no-op in SQLite, just skip)
  // Add briefing to cv_analyses if missing
  try {
    db.exec("ALTER TABLE cv_analyses ADD COLUMN briefing TEXT DEFAULT ''");
  } catch (_) { /* column already exists */ }

  // Add unique index if missing
  try {
    db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_cv_unique ON cv_analyses(job_id, cv_filename)');
  } catch (_) { /* index already exists or conflict with existing duplicates */ }
}

export function getDatabase() {
  if (!db) {
    initializeDatabase();
  }
  return db;
}

export function closeDatabase() {
  if (db) {
    db.close();
  }
}

// ── User Profile ──

export function getUserProfile(): UserProfile | undefined {
  const stmt = db.prepare('SELECT * FROM user_profile LIMIT 1');
  return stmt.get() as UserProfile | undefined;
}

export function createUserProfile(data: { id: string; company_name: string; email: string }): UserProfile {
  const stmt = db.prepare(`
    INSERT INTO user_profile (id, company_name, email, credits_remaining, total_cvs_selected)
    VALUES (?, ?, ?, 10, 0)
  `);
  stmt.run(data.id, data.company_name, data.email);
  return getUserProfile()!;
}

export function updateCredits(credits_remaining: number, total_cvs_selected?: number): void {
  if (total_cvs_selected !== undefined) {
    db.prepare('UPDATE user_profile SET credits_remaining = ?, total_cvs_selected = ?').run(credits_remaining, total_cvs_selected);
  } else {
    db.prepare('UPDATE user_profile SET credits_remaining = ?').run(credits_remaining);
  }
}

export function deductCredit(): { success: boolean; credits_remaining: number } {
  const profile = getUserProfile();
  if (!profile || profile.credits_remaining <= 0) {
    return { success: false, credits_remaining: profile?.credits_remaining ?? 0 };
  }
  const newCredits = profile.credits_remaining - 1;
  const newTotal = profile.total_cvs_selected + 1;
  updateCredits(newCredits, newTotal);
  return { success: true, credits_remaining: newCredits };
}

// ── Settings ──

export function getSetting(key: string): string | undefined {
  const stmt = db.prepare('SELECT value FROM settings WHERE key = ?');
  const row = stmt.get(key) as { value: string } | undefined;
  return row?.value;
}

export function setSetting(key: string, value: string): void {
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value);
}

export function getAllSettings(): Record<string, string> {
  const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
  const settings: Record<string, string> = {};
  for (const row of rows) {
    settings[row.key] = row.value;
  }
  return settings;
}

// ── Jobs ──

export function createJob(jobData: {
  id: string;
  title: string;
  location: string;
  is_remote: number;
  english_level: string;
  minimum_experience: number;
  required_skills: string[];
  description: string;
}): Job {
  const stmt = db.prepare(`
    INSERT INTO jobs (id, title, location, is_remote, english_level, minimum_experience, required_skills, description, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')
  `);
  stmt.run(
    jobData.id,
    jobData.title,
    jobData.location,
    jobData.is_remote ? 1 : 0,
    jobData.english_level,
    jobData.minimum_experience,
    JSON.stringify(jobData.required_skills),
    jobData.description || ''
  );
  return getJob(jobData.id)!;
}

export function getJobs(): Job[] {
  const stmt = db.prepare("SELECT * FROM jobs WHERE status = 'active' ORDER BY created_at DESC");
  return stmt.all() as Job[];
}

export function getJob(jobId: string): Job | undefined {
  const stmt = db.prepare('SELECT * FROM jobs WHERE id = ?');
  return stmt.get(jobId) as Job | undefined;
}

export function deleteJob(jobId: string): void {
  db.prepare('DELETE FROM jobs WHERE id = ?').run(jobId);
}

// ── CV Analyses ──

export function getExistingFilenames(jobId: string): Set<string> {
  const rows = db.prepare('SELECT cv_filename FROM cv_analyses WHERE job_id = ?').all(jobId) as { cv_filename: string }[];
  return new Set(rows.map(r => r.cv_filename));
}

export function saveCVAnalysis(data: {
  id: string;
  job_id: string;
  cv_filename: string;
  candidate_name: string;
  fit_score: number;
  experience_score: number;
  skills_score: number;
  location_score: number | null;
  english_score: number;
  briefing: string;
  key_strengths: string[];
  gaps: string[];
  recommendation: string;
  recommendation_reasoning: string;
}): void {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO cv_analyses (
      id, job_id, cv_filename, candidate_name,
      fit_score, experience_score, skills_score, location_score, english_score,
      briefing, key_strengths, gaps, recommendation, recommendation_reasoning
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    data.id,
    data.job_id,
    data.cv_filename,
    data.candidate_name,
    Math.min(100, Math.max(0, data.fit_score || 0)),
    Math.min(100, Math.max(0, data.experience_score || 0)),
    Math.min(100, Math.max(0, data.skills_score || 0)),
    data.location_score === null ? null : Math.min(100, Math.max(0, data.location_score || 0)),
    Math.min(100, Math.max(0, data.english_score || 0)),
    data.briefing || '',
    JSON.stringify(data.key_strengths || []),
    JSON.stringify(data.gaps || []),
    data.recommendation || 'maybe',
    data.recommendation_reasoning || ''
  );
}

export function getResultsForJob(jobId: string): CVAnalysis[] {
  const stmt = db.prepare('SELECT * FROM cv_analyses WHERE job_id = ? ORDER BY fit_score DESC');
  return stmt.all(jobId) as CVAnalysis[];
}

export function deleteResult(resultId: string): void {
  db.prepare('DELETE FROM cv_analyses WHERE id = ?').run(resultId);
}

export function clearResultsForJob(jobId: string): void {
  db.prepare('DELETE FROM cv_analyses WHERE job_id = ?').run(jobId);
}

// ── Purchase Sync ──

export function isPurchaseSynced(stripeSessionId: string): boolean {
  const stmt = db.prepare('SELECT id FROM synced_purchases WHERE stripe_session_id = ?');
  return !!stmt.get(stripeSessionId);
}

export function markPurchaseSynced(id: string, stripeSessionId: string, credits: number): void {
  db.prepare('INSERT OR IGNORE INTO synced_purchases (id, stripe_session_id, credits_purchased) VALUES (?, ?, ?)').run(id, stripeSessionId, credits);
  const profile = getUserProfile();
  if (profile) {
    updateCredits(profile.credits_remaining + credits);
  }
}
