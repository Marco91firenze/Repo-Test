/**
 * Ollama Local LLM Client
 *
 * Connects to a locally running Ollama instance for AI-powered CV analysis.
 * Ollama runs entirely on the user's machine — full CV text is processed locally.
 * No data ever leaves the computer.
 */

const DEFAULT_OLLAMA_URL = 'http://localhost:11434';

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

    if (!response.ok) throw new Error(`Pull request failed: ${response.statusText}`);

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
  } catch (error) {
    console.error('Failed to pull Ollama model:', error);
    return false;
  }
}

export async function ensureModelAvailable(
  preferredModel: string,
  ollamaUrl?: string,
  onProgress?: (status: string, completed?: number, total?: number) => void
): Promise<string | null> {
  const url = ollamaUrl || DEFAULT_OLLAMA_URL;
  const status = await checkOllamaStatus(url);

  if (!status.available) return null;

  const normalizedPreferred = preferredModel.split(':')[0];
  const existingMatch = status.models.find(m =>
    m === preferredModel || m.startsWith(normalizedPreferred + ':')
  );

  if (existingMatch) return existingMatch;

  if (onProgress) onProgress('pulling', 0, 100);
  const success = await pullOllamaModel(preferredModel, url, onProgress);

  return success ? preferredModel : null;
}

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
  model?: string
): Promise<OllamaAnalysisResult> {
  const url = ollamaUrl || DEFAULT_OLLAMA_URL;
  const selectedModel = model || 'llama3.1:8b';
  const { is_remote } = jobRequirements;

  const prompt = `You are an expert senior recruiter with deep knowledge across industries and roles. Your task is to carefully analyse the CV below against the job requirements and produce a thorough, honest assessment.

IMPORTANT RULES:
- You MUST extract the candidate's full name from the CV text (first and last name). Do NOT use "%PDF", file headers, or placeholder text as the name.
- All scores must be integers between 0 and 100 (inclusive). Never exceed 100.
- ${is_remote ? 'This is a REMOTE position. Location is completely irrelevant. Set location_score to null and do NOT factor location into the fit_score at all.' : 'Location matters. Compare the candidate\'s location with the job location.'}
- Use your knowledge of synonyms and related experience. For example: "Sales Executive" and "Business Development Representative" are the same domain; count all relevant experience even if the title differs.
- Total years of experience = sum of ALL relevant roles, not just the most recent.
- Be nuanced and fair. Write the briefing as you would in a real recruitment report — concrete, specific, and actionable.
- The briefing must be at least 5 sentences covering: total relevant experience, skill fit assessment, strengths, concerns or gaps, and a clear hiring recommendation with reasoning.

JOB REQUIREMENTS:
Title: ${jobRequirements.title}
${jobRequirements.description ? `Description: ${jobRequirements.description}` : ''}
Required skills: ${jobRequirements.required_skills.length > 0 ? jobRequirements.required_skills.join(', ') : 'Not specified'}
Minimum experience: ${jobRequirements.minimum_experience} years
${!is_remote ? `Location: ${jobRequirements.location}` : 'Location: Remote (location not a factor)'}
Minimum English level required: ${jobRequirements.english_level}

CV TEXT:
---
${cvRawText.slice(0, 8000)}
---

Respond ONLY with valid JSON. No markdown. No preamble. No trailing text. The JSON must match this exact shape:
{
  "candidate_name": "First Last",
  "fit_score": 0,
  "experience_score": 0,
  "skills_score": 0,
  ${is_remote ? '"location_score": null,' : '"location_score": 0,'}
  "english_score": 0,
  "briefing": "Detailed multi-sentence briefing...",
  "key_strengths": ["strength 1", "strength 2", "strength 3"],
  "gaps": ["gap 1", "gap 2"],
  "recommendation": "strong_yes",
  "recommendation_reasoning": "Concise 2-sentence explanation of the recommendation."
}

Valid recommendation values: "strong_yes", "yes", "maybe", "no", "strong_no"`;

  const response = await fetch(`${url}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: selectedModel,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      stream: false,
    }),
    signal: AbortSignal.timeout(180000),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Ollama API error: ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';

  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Ollama response did not contain valid JSON');
  }

  const parsed = JSON.parse(jsonMatch[0]);

  return {
    candidate_name: sanitizeName(parsed.candidate_name),
    fit_score: clamp(parsed.fit_score ?? 0, 0, 100),
    experience_score: clamp(parsed.experience_score ?? 0, 0, 100),
    skills_score: clamp(parsed.skills_score ?? 0, 0, 100),
    location_score: is_remote ? null : clamp(parsed.location_score ?? 0, 0, 100),
    english_score: clamp(parsed.english_score ?? 0, 0, 100),
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
  // Reject PDF headers, binary garbage, or anything that starts with %
  if (name.startsWith('%') || name.length < 2) return '';
  // Reject lines that are mostly non-alpha characters
  const alphaCount = (name.match(/[a-zA-ZÀ-ÖØ-öø-ÿ]/g) || []).length;
  if (alphaCount < name.length * 0.5) return '';
  return name;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, isNaN(value) ? min : value));
}
