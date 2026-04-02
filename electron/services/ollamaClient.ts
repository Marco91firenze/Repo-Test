/**
 * Ollama Local LLM Client
 *
 * Connects to a locally running Ollama instance for AI-powered CV analysis.
 * Ollama runs entirely on the user's machine - no data leaves the computer.
 * The LLM only receives anonymized, reworded CV data (no PII).
 */

import { AnonymizedProfile, anonymizedProfileToText } from './anonymizer.js';

const DEFAULT_OLLAMA_URL = 'http://localhost:11434';

export interface OllamaStatus {
  available: boolean;
  models: string[];
  url: string;
}

export interface OllamaAnalysisResult {
  fit_score: number;
  experience_score: number;
  skills_score: number;
  location_score: number;
  english_score: number;
  experience_quality_score: number;
  skill_relevance_score: number;
  confidence_level: number;
  summary: string;
  skill_breakdown: { skill: string; percentage: number; assessment: string; evidence: string }[];
  key_strengths: string[];
  gaps: string[];
  risk_factors: string[];
  recommendation: string;
  recommendation_reasoning: string;
  reasoning_chain: {
    experience_reasoning: string;
    skills_reasoning: string;
    location_reasoning: string;
    english_reasoning: string;
    overall_reasoning: string;
  };
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

/**
 * Pull a model from Ollama's registry. This downloads the model locally.
 * Streams progress and calls the onProgress callback with status updates.
 */
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

    if (!response.ok) {
      throw new Error(`Pull request failed: ${response.statusText}`);
    }

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
          if (onProgress) {
            onProgress(
              data.status || 'downloading',
              data.completed || undefined,
              data.total || undefined
            );
          }
          if (data.error) {
            throw new Error(data.error);
          }
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

/**
 * Ensures a model is available. If Ollama is running but has no suitable model,
 * automatically pulls the default one.
 * Returns the model name to use, or null if Ollama is not available.
 */
export async function ensureModelAvailable(
  preferredModel: string,
  ollamaUrl?: string,
  onProgress?: (status: string, completed?: number, total?: number) => void
): Promise<string | null> {
  const url = ollamaUrl || DEFAULT_OLLAMA_URL;
  const status = await checkOllamaStatus(url);

  if (!status.available) return null;

  // Check if preferred model (or a variant) is already available
  const normalizedPreferred = preferredModel.split(':')[0];
  const existingMatch = status.models.find(m =>
    m === preferredModel || m.startsWith(normalizedPreferred + ':')
  );

  if (existingMatch) return existingMatch;

  // No matching model found - auto-pull the preferred one
  if (onProgress) onProgress('pulling', 0, 100);
  const success = await pullOllamaModel(preferredModel, url, onProgress);

  if (success) return preferredModel;
  return null;
}

export async function analyzeWithOllama(
  anonymizedProfile: AnonymizedProfile,
  jobRequirements: {
    title: string;
    description: string;
    required_skills: string[];
    minimum_experience: number;
    location: string;
    english_level: string;
    scoring_parameters?: Record<string, unknown> | null;
  },
  ollamaUrl?: string,
  model?: string,
  language: string = 'en'
): Promise<OllamaAnalysisResult> {
  const url = ollamaUrl || DEFAULT_OLLAMA_URL;
  const selectedModel = model || 'llama3.1:8b';

  const isRemote = jobRequirements.location.toLowerCase().includes('remote');

  const params = jobRequirements.scoring_parameters || {
    param1: { name: 'Experience', max_score: 40 },
    param2: { name: 'Skills', max_score: 30 },
    param3: { name: 'Location', max_score: isRemote ? 0 : 15 },
    param4: { name: 'English', max_score: isRemote ? 30 : 15 },
  };

  const p1 = (params as any).param1 || { name: 'Experience', max_score: 40 };
  const p2 = (params as any).param2 || { name: 'Skills', max_score: 30 };
  const p3 = (params as any).param3 || { name: 'Location', max_score: isRemote ? 0 : 15 };
  const p4 = (params as any).param4 || { name: 'English', max_score: isRemote ? 30 : 15 };

  const languageInstructions: Record<string, string> = {
    en: 'Write all text fields in English.',
    it: 'Scrivi tutti i campi di testo in ITALIANO.',
    es: 'Escribe todos los campos de texto en ESPAÑOL.',
    fr: 'Écrivez tous les champs de texte en FRANÇAIS.',
    de: 'Schreiben Sie alle Textfelder auf DEUTSCH.',
    'pt-BR': 'Escreva todos os campos de texto em PORTUGUÊS.',
    nl: 'Schrijf alle tekstvelden in het NEDERLANDS.',
  };

  const langInstruction = languageInstructions[language] || languageInstructions['en'];

  const profileText = anonymizedProfileToText(anonymizedProfile);

  const prompt = `You are an expert HR analyst. Assess this ANONYMIZED candidate profile against job requirements.
IMPORTANT: This data has been anonymized for GDPR compliance. No personal information is included.
${langInstruction}

JOB REQUIREMENTS:
Position: ${jobRequirements.title}
${jobRequirements.description ? `Description: ${jobRequirements.description}` : ''}
Required skills: ${jobRequirements.required_skills.join(', ')}
Minimum experience: ${jobRequirements.minimum_experience} years
Location requirement: ${jobRequirements.location}
English requirement: ${jobRequirements.english_level}

SCORING CRITERIA:
1. ${p1.name} (max ${p1.max_score} points)
2. ${p2.name} (max ${p2.max_score} points)
3. ${p3.name} (max ${p3.max_score} points)
4. ${p4.name} (max ${p4.max_score} points)

ANONYMIZED CANDIDATE PROFILE:
${profileText}

${isRemote ? 'NOTE: This is a REMOTE position - location is NOT a factor. Award 0 for location_score.' : ''}

Be strict: Most candidates score 50-75. Only exceptional matches score 80+.

Return ONLY valid JSON:
{
  "fit_score": 0,
  "experience_score": 0,
  "skills_score": 0,
  "location_score": 0,
  "english_score": 0,
  "experience_quality_score": 0,
  "skill_relevance_score": 0,
  "confidence_level": 0,
  "summary": "3-4 sentence assessment addressing all scoring criteria",
  "skill_breakdown": [{"skill": "name", "percentage": 0, "assessment": "text", "evidence": "text"}],
  "key_strengths": ["strength1", "strength2"],
  "gaps": ["gap1"],
  "risk_factors": ["risk1"],
  "recommendation": "strong_yes/yes/maybe/no/strong_no",
  "recommendation_reasoning": "2-3 sentence reasoning",
  "reasoning_chain": {
    "experience_reasoning": "text",
    "skills_reasoning": "text",
    "location_reasoning": "text",
    "english_reasoning": "text",
    "overall_reasoning": "text"
  }
}`;

  const response = await fetch(`${url}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: selectedModel,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      stream: false,
    }),
    signal: AbortSignal.timeout(120000),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Ollama API error: ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';
  const jsonMatch = content.match(/\{[\s\S]*\}/);

  if (!jsonMatch) {
    throw new Error('Failed to parse Ollama response as JSON');
  }

  const analysis = JSON.parse(jsonMatch[0]);

  const totalMax = p1.max_score + p2.max_score + p3.max_score + p4.max_score;

  return {
    fit_score: clamp(analysis.fit_score || 0, 0, 100),
    experience_score: clamp(analysis.experience_score || 0, 0, p1.max_score),
    skills_score: clamp(analysis.skills_score || 0, 0, p2.max_score),
    location_score: isRemote ? 0 : clamp(analysis.location_score || 0, 0, p3.max_score),
    english_score: clamp(analysis.english_score || 0, 0, p4.max_score),
    experience_quality_score: clamp(analysis.experience_quality_score || 0, 0, 100),
    skill_relevance_score: clamp(analysis.skill_relevance_score || 0, 0, 100),
    confidence_level: clamp(analysis.confidence_level || 0, 0, 100),
    summary: analysis.summary || '',
    skill_breakdown: analysis.skill_breakdown || [],
    key_strengths: analysis.key_strengths || [],
    gaps: analysis.gaps || [],
    risk_factors: analysis.risk_factors || [],
    recommendation: analysis.recommendation || 'maybe',
    recommendation_reasoning: analysis.recommendation_reasoning || '',
    reasoning_chain: analysis.reasoning_chain || {
      experience_reasoning: '',
      skills_reasoning: '',
      location_reasoning: isRemote ? 'Not applicable - remote position' : '',
      english_reasoning: '',
      overall_reasoning: '',
    },
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
