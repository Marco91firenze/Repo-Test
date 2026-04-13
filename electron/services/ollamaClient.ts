/**
 * Ollama Local LLM Client
 *
 * Two-step analysis pipeline (Option D) with context-window guardrails (Option A):
 *
 *   Step 1 — Extraction call  (num_ctx 2048, num_predict 250)
 *     Send raw CV text only (~750 tokens). Extract name, location,
 *     years of experience, and skills as a small JSON object.
 *
 *   Step 2 — Scoring call  (num_ctx 4096, num_predict 600)
 *     Send the compact extracted facts + job requirements (~800 tokens).
 *     Generate all scores, briefing, strengths, gaps, recommendation.
 *
 * Each call stays well inside its context window, so the stream always
 * terminates cleanly regardless of hardware. No data ever leaves the computer.
 *
 * Default model: llama3.2:3b (~1.9 GB, ~3× faster than 8b on CPU).
 * If any model is already installed, that model is used instead.
 */

const DEFAULT_OLLAMA_URL = 'http://localhost:11434';
const DEFAULT_MODEL = 'llama3.2:3b';

export interface OllamaStatus {
  available: boolean;
  models: string[];
  url: string;
}

export interface OllamaAnalysisResult {
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
}

// ─────────────────────────────────────────────────────────────────────────────
// Status / model management
// ─────────────────────────────────────────────────────────────────────────────

export async function checkOllamaStatus(ollamaUrl?: string): Promise<OllamaStatus> {
  const url = ollamaUrl || DEFAULT_OLLAMA_URL;
  try {
    const response = await fetch(`${url}/api/tags`, { signal: AbortSignal.timeout(3000) });
    if (!response.ok) return { available: false, models: [], url };
    const data = await response.json();
    const models = (data.models || []).map((m: { name: string }) => m.name);
    return { available: true, models, url };
  } catch {
    return { available: false, models: [], url };
  }
}

export async function pullOllamaModel(
  modelName: string,
  ollamaUrl?: string,
  onProgress?: (status: string, completed?: number, total?: number) => void
): Promise<boolean> {
  const url = ollamaUrl || DEFAULT_OLLAMA_URL;
  try {
    const response = await fetch(`${url}/api/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: modelName, stream: true }),
    });
    if (!response.ok) throw new Error(`Pull failed: ${response.statusText}`);

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const data = JSON.parse(line);
          if (onProgress) onProgress(data.status || 'downloading', data.completed, data.total);
          if (data.error) throw new Error(data.error);
        } catch (e: any) {
          if (e.message && !e.message.includes('JSON')) throw e;
        }
      }
    }
    return true;
  } catch (err) {
    console.error('pullOllamaModel failed:', err);
    return false;
  }
}

/**
 * Returns the model to use.
 * Priority:
 *   1. If any model is already installed → use it (prefer preferred model if present)
 *   2. If Ollama is running but empty → pull DEFAULT_MODEL
 *   3. If Ollama is not running → return null
 */
export async function ensureModelAvailable(
  preferredModel: string = DEFAULT_MODEL,
  ollamaUrl?: string,
  onProgress?: (status: string, completed?: number, total?: number) => void
): Promise<string | null> {
  const url = ollamaUrl || DEFAULT_OLLAMA_URL;
  const status = await checkOllamaStatus(url);
  if (!status.available) return null;

  if (status.models.length > 0) {
    const base = preferredModel.split(':')[0];
    const match = status.models.find(m => m === preferredModel || m.startsWith(base + ':'));
    return match || status.models[0];
  }

  if (onProgress) onProgress('pulling', 0, 100);
  const success = await pullOllamaModel(DEFAULT_MODEL, url, onProgress);
  return success ? DEFAULT_MODEL : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared streaming helper
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Make one streaming chat completion call, return the full assembled content.
 * Calls onProgress(tokenOffset + localTokenCount) every 10 tokens.
 */
async function streamingCall(
  url: string,
  model: string,
  userPrompt: string,
  options: { num_ctx: number; num_predict: number },
  onProgress?: (tokens: number) => void,
  tokenOffset: number = 0
): Promise<string> {
  const response = await fetch(`${url}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: userPrompt }],
      temperature: 0.2,
      stream: true,
      options,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Ollama API error ${response.status}: ${errorText}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body from Ollama');

  const decoder = new TextDecoder();
  let buffer = '';
  let fullContent = '';
  let localTokens = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed === 'data: [DONE]') continue;
      const jsonStr = trimmed.startsWith('data: ') ? trimmed.slice(6) : trimmed;
      try {
        const chunk = JSON.parse(jsonStr);
        const delta = chunk.choices?.[0]?.delta?.content;
        if (delta) {
          fullContent += delta;
          localTokens++;
          if (onProgress && localTokens % 10 === 0) onProgress(tokenOffset + localTokens);
        }
      } catch {
        // ignore malformed SSE lines
      }
    }
  }

  if (onProgress) onProgress(tokenOffset + localTokens);
  return fullContent;
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 1 — Extraction call
// ─────────────────────────────────────────────────────────────────────────────

interface ExtractedFacts {
  candidate_name: string;
  location: string;
  years_experience: number;
  skills: string[];
}

/**
 * Send CV text only. Extract name, location, years of experience, skills.
 * Input: ~750 tokens  |  Output: ~200 tokens  |  num_ctx: 2048
 */
async function extractCVFacts(
  cvRawText: string,
  url: string,
  model: string,
  onProgress?: (tokens: number) => void
): Promise<ExtractedFacts> {
  const prompt = `You are a CV data extractor. Read the CV below and return a JSON object.

CV TEXT:
---
${cvRawText.slice(0, 3000)}
---

Return ONLY valid JSON — no markdown, no explanation:
{
  "candidate_name": "First Last",
  "location": "City name only (single city, no country, no surname)",
  "years_experience": 0,
  "skills": ["skill1", "skill2"]
}

Rules:
- candidate_name: full name from the CV header or contact section. Never use "%PDF", file metadata, or placeholders.
- location: ONE city name only. Never prefix it with the candidate's surname.
- years_experience: total years across ALL listed work experience entries (use synonyms — Sales Executive counts for Business Development).
- skills: every technical and professional skill explicitly mentioned.`;

  const content = await streamingCall(
    url, model, prompt,
    { num_ctx: 2048, num_predict: 250 },
    onProgress, 0
  );

  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(`CV fact extraction returned no JSON. Raw: ${content.slice(0, 300)}`);
  }

  const parsed = JSON.parse(jsonMatch[0]);
  return {
    candidate_name: sanitizeName(parsed.candidate_name),
    location: sanitizeLocation(parsed.location),
    years_experience: Math.max(0, Math.round(Number(parsed.years_experience) || 0)),
    skills: Array.isArray(parsed.skills) ? parsed.skills.filter((s: unknown) => typeof s === 'string') : [],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 2 — Scoring call
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Send compact extracted facts + job requirements. Generate all scores and briefing.
 * Input: ~800 tokens  |  Output: ~550 tokens  |  num_ctx: 4096
 */
async function scoreCandidateAgainstJob(
  facts: ExtractedFacts,
  jobRequirements: {
    title: string;
    description: string;
    required_skills: string[];
    minimum_experience: number;
    location: string;
    english_level: string;
    is_remote: boolean;
  },
  url: string,
  model: string,
  onProgress?: (tokens: number) => void,
  tokenOffset: number = 0
): Promise<Omit<OllamaAnalysisResult, 'candidate_name'>> {
  const { is_remote } = jobRequirements;

  const prompt = `You are an expert senior recruiter. Score the candidate below against the job requirements and return a JSON assessment.

CANDIDATE:
Name: ${facts.candidate_name || 'Unknown'}
Location: ${facts.location || 'Unknown'}
Years of experience: ${facts.years_experience}
Skills: ${facts.skills.length ? facts.skills.join(', ') : 'None listed'}

JOB REQUIREMENTS:
Title: ${jobRequirements.title}
${jobRequirements.description ? `Description: ${jobRequirements.description}` : ''}
Required skills: ${jobRequirements.required_skills.length ? jobRequirements.required_skills.join(', ') : 'Not specified'}
Minimum experience: ${jobRequirements.minimum_experience} years
${!is_remote ? `Location: ${jobRequirements.location}` : 'Location: Remote (not a factor)'}
Minimum English: ${jobRequirements.english_level}

RULES:
- All scores are integers 0–100. Never exceed 100.
- ${is_remote
    ? 'REMOTE ROLE: Location is completely irrelevant. Set location_score to null.'
    : 'Location matters: compare candidate location with job location.'}
- Use synonyms: "Sales Executive" and "Business Development Representative" are the same domain.
- years_experience already accounts for all relevant roles — do not undercount.
- Briefing: at least 4 sentences covering total experience, skill fit, strengths, concerns, and a hiring recommendation.

Return ONLY valid JSON — no markdown, no preamble:
{
  "fit_score": 0,
  "experience_score": 0,
  "skills_score": 0,
  ${is_remote ? '"location_score": null,' : '"location_score": 0,'}
  "english_score": 0,
  "briefing": "Detailed multi-sentence briefing...",
  "key_strengths": ["strength 1", "strength 2"],
  "gaps": ["gap 1"],
  "recommendation": "yes",
  "recommendation_reasoning": "2-sentence explanation."
}
Valid recommendation values: strong_yes | yes | maybe | no | strong_no`;

  const content = await streamingCall(
    url, model, prompt,
    { num_ctx: 4096, num_predict: 600 },
    onProgress, tokenOffset
  );

  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(`Scoring call returned no JSON. Raw: ${content.slice(0, 300)}`);
  }

  const parsed = JSON.parse(jsonMatch[0]);
  return {
    fit_score: clamp(parsed.fit_score ?? 0),
    experience_score: clamp(parsed.experience_score ?? 0),
    skills_score: clamp(parsed.skills_score ?? 0),
    location_score: is_remote ? null : clamp(parsed.location_score ?? 0),
    english_score: clamp(parsed.english_score ?? 0),
    briefing: parsed.briefing || '',
    key_strengths: Array.isArray(parsed.key_strengths) ? parsed.key_strengths : [],
    gaps: Array.isArray(parsed.gaps) ? parsed.gaps : [],
    recommendation: parsed.recommendation || 'maybe',
    recommendation_reasoning: parsed.recommendation_reasoning || '',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Analyse a CV against job requirements using Ollama.
 *
 * Runs two sequential streaming calls so each stays well within its context
 * window. onProgress receives a cumulative token count across both calls.
 */
export async function analyzeWithOllama(
  cvRawText: string,
  jobRequirements: {
    title: string;
    description: string;
    required_skills: string[];
    minimum_experience: number;
    location: string;
    english_level: string;
    is_remote: boolean;
  },
  ollamaUrl?: string,
  model?: string,
  onProgress?: (tokens: number) => void
): Promise<OllamaAnalysisResult> {
  const url = ollamaUrl || DEFAULT_OLLAMA_URL;
  const selectedModel = model || DEFAULT_MODEL;

  // Step 1 — extract facts from raw CV text
  const facts = await extractCVFacts(cvRawText, url, selectedModel, onProgress);

  // Step 2 — score candidate; token counter continues from where step 1 left off
  // We don't have the exact step-1 token count here, so pass a sentinel offset of
  // 50 to make the counter visibly progress between steps.
  const scores = await scoreCandidateAgainstJob(
    facts, jobRequirements, url, selectedModel, onProgress, 50
  );

  return {
    candidate_name: facts.candidate_name,
    ...scores,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────────────

function sanitizeName(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  const name = raw.trim();
  if (name.startsWith('%') || name.length < 2) return '';
  const alphaCount = (name.match(/[a-zA-ZÀ-ÖØ-öø-ÿ]/g) || []).length;
  if (alphaCount < name.length * 0.5) return '';
  return name;
}

function sanitizeLocation(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  const loc = raw.trim();
  // Strip a leading word that looks like a surname (Title-case single word before a space)
  return loc.replace(/^[A-ZÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞ][a-záàâãäåæçèéêëìíîïðñòóôõöøùúûüýþ]+\s+/, '').trim();
}

function clamp(value: number): number {
  return Math.min(100, Math.max(0, isNaN(value) ? 0 : Math.round(value)));
}
