/**
 * Ollama Local LLM Client
 *
 * Uses streaming to avoid hard timeouts on slow/CPU-only hardware.
 * Default model: llama3.2:3b (~1.9 GB, ~3× faster than 8b on CPU).
 * If any model is already installed, it is used without re-downloading.
 * No data ever leaves the computer.
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
    // Use preferred model if available, otherwise fall back to whatever is installed
    const base = preferredModel.split(':')[0];
    const match = status.models.find(m => m === preferredModel || m.startsWith(base + ':'));
    return match || status.models[0];
  }

  // No models installed — pull the default
  if (onProgress) onProgress('pulling', 0, 100);
  const success = await pullOllamaModel(DEFAULT_MODEL, url, onProgress);
  return success ? DEFAULT_MODEL : null;
}

/**
 * Analyse a CV against job requirements using Ollama's streaming API.
 * onProgress is called with the running token count so the UI can show progress.
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
  const { is_remote } = jobRequirements;

  const prompt = `You are an expert senior recruiter. Analyse the CV below against the job requirements and return a JSON assessment.

RULES:
- Extract the candidate's full name from the CV text. Never use "%PDF", file headers, or placeholders.
- All scores are integers 0–100. Never exceed 100.
- ${is_remote
    ? 'REMOTE ROLE: Location is completely irrelevant. Set location_score to null. Do not factor location into fit_score.'
    : 'Location matters. Compare candidate location with job location.'}
- Use synonyms: "Sales Executive" and "Business Development Representative" are the same domain.
- Years of experience = sum of ALL relevant roles (not just most recent).
- Briefing must be at least 5 sentences: cover total experience, skill fit, strengths, concerns, and a hiring recommendation.

JOB REQUIREMENTS:
Title: ${jobRequirements.title}
${jobRequirements.description ? `Description: ${jobRequirements.description}` : ''}
Required skills: ${jobRequirements.required_skills.length ? jobRequirements.required_skills.join(', ') : 'Not specified'}
Minimum experience: ${jobRequirements.minimum_experience} years
${!is_remote ? `Location: ${jobRequirements.location}` : 'Location: Remote (not a factor)'}
Minimum English: ${jobRequirements.english_level}

CV TEXT:
---
${cvRawText.slice(0, 6000)}
---

Respond ONLY with valid JSON — no markdown, no preamble:
{
  "candidate_name": "First Last",
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

  // ── Streaming request — no hard AbortSignal timeout ──
  const response = await fetch(`${url}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: selectedModel,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      stream: true,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Ollama API error: ${errorText}`);
  }

  // ── Collect streaming chunks ──
  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body from Ollama');

  const decoder = new TextDecoder();
  let buffer = '';
  let fullContent = '';
  let tokenCount = 0;

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
          tokenCount++;
          if (onProgress && tokenCount % 10 === 0) onProgress(tokenCount);
        }
      } catch {
        // ignore malformed SSE lines
      }
    }
  }

  if (onProgress) onProgress(tokenCount);

  // ── Parse the assembled JSON response ──
  const jsonMatch = fullContent.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(`Ollama response did not contain valid JSON. Got: ${fullContent.slice(0, 200)}`);
  }

  const parsed = JSON.parse(jsonMatch[0]);

  return {
    candidate_name: sanitizeName(parsed.candidate_name),
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

function sanitizeName(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  const name = raw.trim();
  if (name.startsWith('%') || name.length < 2) return '';
  const alphaCount = (name.match(/[a-zA-ZÀ-ÖØ-öø-ÿ]/g) || []).length;
  if (alphaCount < name.length * 0.5) return '';
  return name;
}

function clamp(value: number): number {
  return Math.min(100, Math.max(0, isNaN(value) ? 0 : Math.round(value)));
}
