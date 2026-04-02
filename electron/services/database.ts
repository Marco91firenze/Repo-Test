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
  english_level: string;
  minimum_experience: number;
  required_skills: string;
  description: string;
  status: string;
  scoring_parameters: string | null;
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
  experience_quality_score: number;
  skill_relevance_score: number;
  confidence_level: number;
  years_experience: number;
  location: string;
  english_level: string;
  other_languages: string;
  summary: string;
  skill_breakdown: string;
  key_strengths: string;
  gaps: string;
  risk_factors: string;
  recommendation: string;
  recommendation_reasoning: string;
  reasoning_chain: string;
  skill_evidence: string;
  skill_variations_matched: string;
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
      english_level TEXT,
      minimum_experience INTEGER DEFAULT 0,
      required_skills TEXT DEFAULT '[]',
      description TEXT DEFAULT '',
      status TEXT DEFAULT 'active',
      scoring_parameters TEXT,
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
      experience_quality_score REAL DEFAULT 0,
      skill_relevance_score REAL DEFAULT 0,
      confidence_level REAL DEFAULT 0,
      years_experience INTEGER DEFAULT 0,
      location TEXT DEFAULT '',
      english_level TEXT DEFAULT '',
      other_languages TEXT DEFAULT '',
      summary TEXT DEFAULT '',
      skill_breakdown TEXT DEFAULT '[]',
      key_strengths TEXT DEFAULT '[]',
      gaps TEXT DEFAULT '[]',
      risk_factors TEXT DEFAULT '[]',
      recommendation TEXT DEFAULT '',
      recommendation_reasoning TEXT DEFAULT '',
      reasoning_chain TEXT DEFAULT '{}',
      skill_evidence TEXT DEFAULT '{}',
      skill_variations_matched TEXT DEFAULT '{}',
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
  `);

  return db;
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
  english_level: string;
  minimum_experience: number;
  required_skills: string[];
  description: string;
  scoring_parameters?: Record<string, unknown> | null;
}): Job {
  const stmt = db.prepare(`
    INSERT INTO jobs (id, title, location, english_level, minimum_experience, required_skills, description, status, scoring_parameters)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?)
  `);
  stmt.run(
    jobData.id,
    jobData.title,
    jobData.location,
    jobData.english_level,
    jobData.minimum_experience,
    JSON.stringify(jobData.required_skills),
    jobData.description || '',
    jobData.scoring_parameters ? JSON.stringify(jobData.scoring_parameters) : null
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

export function saveCVAnalysis(data: {
  id: string;
  job_id: string;
  cv_filename: string;
  candidate_name: string;
  fit_score: number;
  experience_score: number;
  skills_score: number;
  location_score: number;
  english_score: number;
  experience_quality_score: number;
  skill_relevance_score: number;
  confidence_level: number;
  years_experience: number;
  location: string;
  english_level: string;
  other_languages: string;
  summary: string;
  skill_breakdown: unknown[];
  key_strengths: string[];
  gaps: string[];
  risk_factors: string[];
  recommendation: string;
  recommendation_reasoning: string;
  reasoning_chain: Record<string, string>;
  skill_evidence: Record<string, string>;
  skill_variations_matched: Record<string, string[]>;
}): void {
  const stmt = db.prepare(`
    INSERT INTO cv_analyses (
      id, job_id, cv_filename, candidate_name, fit_score,
      experience_score, skills_score, location_score, english_score,
      experience_quality_score, skill_relevance_score, confidence_level,
      years_experience, location, english_level, other_languages,
      summary, skill_breakdown, key_strengths, gaps, risk_factors,
      recommendation, recommendation_reasoning, reasoning_chain,
      skill_evidence, skill_variations_matched
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    data.id, data.job_id, data.cv_filename, data.candidate_name, data.fit_score,
    data.experience_score, data.skills_score, data.location_score, data.english_score,
    data.experience_quality_score, data.skill_relevance_score, data.confidence_level,
    data.years_experience, data.location, data.english_level, data.other_languages,
    data.summary,
    JSON.stringify(data.skill_breakdown),
    JSON.stringify(data.key_strengths),
    JSON.stringify(data.gaps),
    JSON.stringify(data.risk_factors),
    data.recommendation, data.recommendation_reasoning,
    JSON.stringify(data.reasoning_chain),
    JSON.stringify(data.skill_evidence),
    JSON.stringify(data.skill_variations_matched)
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
