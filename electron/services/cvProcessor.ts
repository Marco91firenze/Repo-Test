import * as fs from 'fs';
// @ts-ignore
import pdfParse from 'pdf-parse';
import crypto from 'crypto';
import { extractPII, extractNameFromFilename } from './anonymizer.js';
import { analyzeWithOllama, ensureModelAvailable } from './ollamaClient.js';
import { saveCVAnalysis, getJob, getSetting, deductCredit, getUserProfile } from './database.js';

const pdf: any = pdfParse;

// ── Text Extraction ──

export async function extractTextFromFile(filePath: string): Promise<string> {
  if (filePath.toLowerCase().endsWith('.pdf')) {
    return extractFromPDF(filePath);
  } else if (filePath.toLowerCase().endsWith('.docx') || filePath.toLowerCase().endsWith('.doc')) {
    return extractFromDOCX(filePath);
  }
  throw new Error('Unsupported file format. Please use PDF or DOCX files.');
}

async function extractFromPDF(filePath: string): Promise<string> {
  const fileBuffer = fs.readFileSync(filePath);

  try {
    const data = await pdf(fileBuffer, { max: 0 });
    const text = data.text || '';
    if (text.trim().length > 0) return text;
  } catch (_pdfErr) {
    // pdf-parse can fail on some PDFs (bad XRef, illegal chars, etc.)
  }

  // Fallback: extract readable UTF-8 fragments from the raw buffer
  try {
    const raw = fileBuffer.toString('utf8');
    // Strip PDF header if it leaks into the text
    const cleaned = raw
      .replace(/^%PDF[^\n]*\n?/, '')
      .replace(/[^\x20-\x7E\xA0-\xFF\n\r\t]/g, ' ')
      .replace(/\s{3,}/g, '\n')
      .trim();
    if (cleaned.length > 50) return cleaned;
  } catch (_) {
    // ignore
  }

  return '';
}

async function extractFromDOCX(filePath: string): Promise<string> {
  const fileBuffer = fs.readFileSync(filePath);
  const text = fileBuffer.toString('utf8', 0, Math.min(200000, fileBuffer.length));
  const textMatches = text.match(/<w:t[^>]*>([^<]+)<\/w:t>/g) || [];
  return textMatches.map(match => match.replace(/<[^>]+>/g, '')).join(' ');
}

// ── Main Processing Pipeline ──

export async function processCVFile(
  filePath: string,
  jobId: string,
  onProgress?: (tokens: number) => void
): Promise<{
  id: string;
  fit_score: number;
  filename: string;
  candidate_name: string;
}> {
  // Credit check (admin accounts bypass)
  const ADMIN_EMAILS = ['marcorome91@gmail.com'];
  const currentProfile = getUserProfile();
  const isAdmin = currentProfile && ADMIN_EMAILS.includes(currentProfile.email.toLowerCase());
  if (!isAdmin) {
    const creditResult = deductCredit();
    if (!creditResult.success) {
      throw new Error('No CV selecting credits remaining. Please purchase more credits to continue.');
    }
  }

  const filename = filePath.split(/[/\\]/).pop() || 'unknown';
  const analysisId = crypto.randomUUID();

  // Step 1: Extract raw text
  let rawText = '';
  try {
    rawText = await extractTextFromFile(filePath);
  } catch (_extractErr) {
    // Text extraction failed — Ollama will still be given empty string
  }

  // Step 2: Get job data
  const jobData = getJob(jobId);
  if (!jobData) throw new Error('Job not found');

  const requiredSkills: string[] = JSON.parse(jobData.required_skills || '[]');
  const isRemote = jobData.is_remote === 1;

  // Step 3: Require Ollama — no silent fallback
  const ollamaUrl = getSetting('ollama_url') || 'http://localhost:11434';
  const preferredModel = getSetting('ollama_model') || 'llama3.1:8b';

  const modelToUse = await ensureModelAvailable(preferredModel, ollamaUrl);
  if (!modelToUse) {
    throw new Error(
      'Ollama is not running. Please start Ollama before analysing CVs. ' +
      'Visit the Credits tab for setup instructions.'
    );
  }

  // Step 4: Call Ollama with full raw CV text (streaming)
  const analysis = await analyzeWithOllama(
    rawText,
    {
      title: jobData.title,
      description: jobData.description || '',
      required_skills: requiredSkills,
      minimum_experience: jobData.minimum_experience,
      location: jobData.location || '',
      english_level: jobData.english_level || '',
      is_remote: isRemote,
    },
    ollamaUrl,
    modelToUse,
    onProgress
  );

  // Step 5: Resolve candidate name
  // Priority: Ollama-extracted name > regex PII extraction > filename parsing
  let candidateName = analysis.candidate_name;

  if (!candidateName && rawText.trim().length > 0) {
    candidateName = extractPII(rawText).name;
  }

  if (!candidateName) {
    candidateName = extractNameFromFilename(filename);
  }

  if (!candidateName) {
    candidateName = filename.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' ');
  }

  // Step 6: Save to database
  saveCVAnalysis({
    id: analysisId,
    job_id: jobId,
    cv_filename: filename,
    candidate_name: candidateName,
    fit_score: analysis.fit_score,
    experience_score: analysis.experience_score,
    skills_score: analysis.skills_score,
    location_score: analysis.location_score,
    english_score: analysis.english_score,
    briefing: analysis.briefing,
    key_strengths: analysis.key_strengths,
    gaps: analysis.gaps,
    recommendation: analysis.recommendation,
    recommendation_reasoning: analysis.recommendation_reasoning,
  });

  return {
    id: analysisId,
    fit_score: analysis.fit_score,
    filename,
    candidate_name: candidateName,
  };
}
