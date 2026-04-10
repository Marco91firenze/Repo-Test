import * as fs from 'fs';
// @ts-ignore
import pdfParse from 'pdf-parse';
import crypto from 'crypto';
import { findSkillMatches, extractSkillEvidence, normalizeSkill, type SkillMatchResult } from './skillMatcher.js';
import { type StructuredCVData, type ExtractedSkill, type WorkExperienceEntry, extractPII, anonymizeForLLM } from './anonymizer.js';
import { analyzeWithOllama, ensureModelAvailable } from './ollamaClient.js';
import { saveCVAnalysis, getJob, getSetting, deductCredit, getUserProfile, type Job } from './database.js';

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
  const data = await pdf(fileBuffer);
  return data.text || '';
}

async function extractFromDOCX(filePath: string): Promise<string> {
  const fileBuffer = fs.readFileSync(filePath);
  const text = fileBuffer.toString('utf8', 0, Math.min(200000, fileBuffer.length));
  const textMatches = text.match(/<w:t[^>]*>([^<]+)<\/w:t>/g) || [];
  return textMatches.map(match => match.replace(/<[^>]+>/g, '')).join(' ');
}

// ── Structured CV Parsing (Algorithmic, No AI) ──

function extractYearsOfExperience(text: string): number {
  // Method 1: Direct mentions like "10 years experience"
  const directRegex = /(\d+)\s*\+?\s*(?:years?|yrs?|y\.o\.e\.?)\s*(?:of\s+)?(?:experience|professional|work)/gi;
  const directMatches = Array.from(text.matchAll(directRegex)).map(m => parseInt(m[1]));

  // Method 2: Parse date ranges like "2015 - 2023" or "Jan 2018 - Present"
  const dateRangeRegex = /(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)?\.?\s*(\d{4})\s*[-–—to]+\s*(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)?\.?\s*(\d{4})|present|current|now|ongoing|today)/gi;
  const dateRanges: number[] = [];
  let match;
  while ((match = dateRangeRegex.exec(text)) !== null) {
    const startYear = parseInt(match[1]);
    const endYear = match[2] ? parseInt(match[2]) : new Date().getFullYear();
    if (startYear >= 1970 && startYear <= new Date().getFullYear() && endYear >= startYear) {
      dateRanges.push(endYear - startYear);
    }
  }

  // Use the maximum from direct mentions, or sum of date ranges
  const directMax = directMatches.length > 0 ? Math.max(...directMatches) : 0;
  const dateRangeTotal = dateRanges.length > 0 ? Math.max(...dateRanges) : 0;

  return Math.max(directMax, dateRangeTotal);
}

function extractLocation(text: string): { city: string; country: string } {
  const locationPatterns = [
    // "Based in City" or "Located in City"
    /(?:based|located|living|residing)\s+(?:in|at)\s+([A-Z][a-zA-Zà-ü\s]+)/i,
    // "City, Country" pattern near the top
    /^.*?([A-Z][a-zA-Zà-ü]+(?:\s+[A-Z][a-zA-Zà-ü]+)?)\s*,\s*([A-Z][a-zA-Zà-ü]+(?:\s+[A-Z][a-zA-Zà-ü]+)?)/m,
  ];

  for (const pattern of locationPatterns) {
    const match = text.match(pattern);
    if (match) {
      if (match[2]) {
        return { city: match[1].trim(), country: match[2].trim() };
      }
      return { city: match[1].trim(), country: '' };
    }
  }

  return { city: '', country: '' };
}

function extractEnglishLevel(text: string): string {
  const textLower = text.toLowerCase();

  // Look for CEFR levels
  const cefrMatch = text.match(/\b(C2|C1|B2|B1|A2|A1)\b/);
  if (cefrMatch) return cefrMatch[1];

  // Look for descriptive levels
  if (/\bnative\s*(?:speaker|english|language)\b/i.test(text) ||
      /\benglish\s*[:\-–]?\s*native\b/i.test(text) ||
      /\bmother\s*tongue\s*[:\-–]?\s*english\b/i.test(text)) return 'Native';
  if (/\b(?:fluent|proficient)\s*(?:in\s+)?english\b/i.test(text) ||
      /\benglish\s*[:\-–]?\s*(?:fluent|proficient)\b/i.test(text)) return 'C1';
  if (/\badvanced\s*(?:english|level)\b/i.test(text) ||
      /\benglish\s*[:\-–]?\s*advanced\b/i.test(text)) return 'C1';
  if (/\bintermediate\s*(?:english|level)\b/i.test(text) ||
      /\benglish\s*[:\-–]?\s*intermediate\b/i.test(text)) return 'B1';

  // Look for IELTS/TOEFL scores
  const ieltsMatch = text.match(/IELTS\s*[:\-–]?\s*(\d\.?\d?)/i);
  if (ieltsMatch) {
    const score = parseFloat(ieltsMatch[1]);
    if (score >= 8) return 'C2';
    if (score >= 7) return 'C1';
    if (score >= 5.5) return 'B2';
    return 'B1';
  }

  // Check if the CV itself is written in fluent English (heuristic)
  const englishWords = textLower.split(/\s+/).length;
  if (englishWords > 300) return 'B2'; // Assume at least upper-intermediate if CV is in English

  return 'Unknown';
}

function extractOtherLanguages(text: string): string[] {
  const languages: string[] = [];
  const langPatterns = [
    /\b(Spanish|French|German|Italian|Portuguese|Dutch|Chinese|Mandarin|Japanese|Korean|Arabic|Russian|Hindi|Polish|Swedish|Danish|Norwegian|Finnish|Turkish|Greek|Czech|Romanian|Hungarian|Thai|Vietnamese|Indonesian|Malay)\s*[:\-–]?\s*(?:native|fluent|proficient|advanced|intermediate|basic|C[12]|B[12]|A[12])/gi,
    /\b(?:native|fluent|proficient|advanced|intermediate|basic)\s*(?:in\s+)?(Spanish|French|German|Italian|Portuguese|Dutch|Chinese|Mandarin|Japanese|Korean|Arabic|Russian|Hindi|Polish|Swedish|Danish|Norwegian|Finnish|Turkish|Greek|Czech|Romanian|Hungarian|Thai|Vietnamese|Indonesian|Malay)\b/gi,
  ];

  for (const pattern of langPatterns) {
    let m;
    while ((m = pattern.exec(text)) !== null) {
      const lang = m[1];
      if (!languages.includes(lang)) {
        languages.push(lang);
      }
    }
  }

  return languages;
}

function extractEducation(text: string): string {
  const textLower = text.toLowerCase();
  if (/\b(ph\.?d|doctorate|doctoral)\b/i.test(text)) return 'PhD';
  if (/\b(master|msc|m\.sc|mba|m\.a\.|ma\b|meng|m\.eng)/i.test(text)) return 'Master\'s Degree';
  if (/\b(bachelor|bsc|b\.sc|b\.a\.|ba\b|beng|b\.eng|laurea)\b/i.test(text)) return 'Bachelor\'s Degree';
  if (/\b(diploma|associate|hnd|foundation degree)\b/i.test(text)) return 'Diploma';
  if (/\b(high school|secondary|a-level|abitur|maturità)\b/i.test(text)) return 'High School';
  return 'Unknown';
}

function extractCertifications(text: string): string[] {
  const certs: string[] = [];
  const certPatterns = [
    /\b(AWS\s+(?:Certified|Solutions?\s+Architect|Developer|SysOps)[\w\s-]*)/gi,
    /\b(Azure\s+(?:Certified|Administrator|Developer|Solutions?\s+Architect)[\w\s-]*)/gi,
    /\b(Google\s+Cloud\s+(?:Certified|Professional)[\w\s-]*)/gi,
    /\b(PMP|PRINCE2|Scrum\s+Master|PSM\s+[I]+|CSPO|CSM)\b/gi,
    /\b(CISSP|CISM|CEH|CompTIA\s+Security\+|CompTIA\s+A\+|CompTIA\s+Network\+)\b/gi,
    /\b(Kubernetes\s+(?:Certified|CKA|CKAD|CKS)[\w\s-]*)/gi,
    /\b(ITIL|Six\s+Sigma|Lean)\b/gi,
    /\b(Salesforce\s+(?:Certified|Administrator|Developer)[\w\s-]*)/gi,
    /\b(SAP\s+(?:Certified|Consultant)[\w\s-]*)/gi,
  ];

  for (const pattern of certPatterns) {
    let m;
    while ((m = pattern.exec(text)) !== null) {
      const cert = m[1].trim();
      if (!certs.some(c => c.toLowerCase() === cert.toLowerCase())) {
        certs.push(cert);
      }
    }
  }

  return certs;
}

function extractWorkExperience(text: string): WorkExperienceEntry[] {
  const entries: WorkExperienceEntry[] = [];

  // Look for section headers
  const sectionRegex = /(?:work\s+)?experience|employment\s+history|professional\s+experience|work\s+history/gi;
  const sectionMatch = sectionRegex.exec(text);
  if (!sectionMatch) return entries;

  // Get text after the experience section header
  const experienceText = text.substring(sectionMatch.index).substring(0, 3000);

  // Match role entries: "Role Title" followed by date patterns
  const roleRegex = /([A-Z][a-zA-Z\s/&-]{3,50})\s*[-–|]\s*.*?(\d{4})\s*[-–to]+\s*(?:(\d{4})|present|current|now)/gi;
  let m;
  while ((m = roleRegex.exec(experienceText)) !== null) {
    const role = m[1].trim();
    const startYear = parseInt(m[2]);
    const endYear = m[3] ? parseInt(m[3]) : new Date().getFullYear();

    if (role.length > 3 && startYear >= 1980) {
      entries.push({
        roleTitle: role,
        durationYears: Math.max(1, endYear - startYear),
        responsibilities: [],
      });
    }
  }

  return entries.slice(0, 10);
}

export function parseCV(rawText: string, requiredSkills: string[]): StructuredCVData {
  const pii = extractPII(rawText);
  const skillMatches = findSkillMatches(rawText, requiredSkills);
  const location = extractLocation(rawText);

  const skills: ExtractedSkill[] = [];
  for (const [skillName, match] of skillMatches.entries()) {
    if (match.found) {
      skills.push({
        name: skillName,
        yearsUsed: 0,
        level: match.confidence >= 80 ? 'advanced' : match.confidence >= 50 ? 'intermediate' : 'beginner',
      });
    }
  }

  return {
    name: pii.name,
    email: pii.email,
    phone: pii.phone,
    address: pii.address,
    totalYearsExperience: extractYearsOfExperience(rawText),
    locationCity: location.city,
    locationCountry: location.country,
    englishLevel: extractEnglishLevel(rawText),
    otherLanguages: extractOtherLanguages(rawText),
    skills,
    educationLevel: extractEducation(rawText),
    certifications: extractCertifications(rawText),
    workExperienceSummary: extractWorkExperience(rawText),
    recentRoleTitles: [],
  };
}

// ── Algorithmic Scoring (Fallback when Ollama unavailable) ──

function algorithmicScore(
  structured: StructuredCVData,
  skillMatches: Map<string, SkillMatchResult>,
  jobData: Job,
  rawText: string
): {
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
  reasoning_chain: Record<string, string>;
} {
  const requiredSkills: string[] = JSON.parse(jobData.required_skills || '[]');
  const isRemote = jobData.location?.toLowerCase().includes('remote') ?? false;

  // Experience score (0-40)
  const minExp = jobData.minimum_experience || 0;
  let experienceScore = 0;
  if (minExp === 0) {
    experienceScore = 30;
  } else {
    const ratio = structured.totalYearsExperience / minExp;
    experienceScore = Math.min(40, Math.round(ratio * 30));
  }

  // Skills score (0-30)
  let matchedCount = 0;
  let totalConfidence = 0;
  const skillBreakdown: { skill: string; percentage: number; assessment: string; evidence: string }[] = [];

  for (const skill of requiredSkills) {
    const canonical = normalizeSkill(skill);
    const match = skillMatches.get(canonical);
    if (match?.found) {
      matchedCount++;
      totalConfidence += match.confidence;
      skillBreakdown.push({
        skill: canonical,
        percentage: match.confidence,
        assessment: match.confidence >= 80 ? 'Strong match' : match.confidence >= 50 ? 'Moderate match' : 'Weak match',
        evidence: extractSkillEvidence(rawText, canonical),
      });
    } else {
      skillBreakdown.push({
        skill: canonical,
        percentage: match?.relatedFound?.length ? 20 : 0,
        assessment: match?.relatedFound?.length ? 'Related skills found' : 'Not found',
        evidence: '',
      });
    }
  }

  const skillsRatio = requiredSkills.length > 0 ? matchedCount / requiredSkills.length : 0;
  const avgConfidence = matchedCount > 0 ? totalConfidence / matchedCount : 0;
  // Weight both coverage (how many matched) and quality (confidence level)
  const skillsScore = Math.round(skillsRatio * 20 + (avgConfidence / 100) * skillsRatio * 10);

  // Location score (0-15)
  let locationScore = 0;
  if (isRemote) {
    locationScore = 15; // Remote job = location is irrelevant, full marks
  } else {
    const jobLocation = (jobData.location || '').toLowerCase();
    const cvLocation = `${structured.locationCity} ${structured.locationCountry}`.toLowerCase();
    if (cvLocation.includes(jobLocation) || jobLocation.includes(structured.locationCity.toLowerCase())) {
      locationScore = 15;
    } else if (structured.locationCountry && jobLocation.includes(structured.locationCountry.toLowerCase())) {
      locationScore = 10;
    } else {
      locationScore = 5;
    }
  }

  // English score (0-15)
  const englishMap: Record<string, number> = { 'Native': 15, 'C2': 15, 'C1': 13, 'B2': 11, 'B1': 8, 'A2': 4, 'A1': 2, 'Unknown': 7 };
  const englishScore = englishMap[structured.englishLevel] ?? 7;

  const fitScore = Math.min(100, experienceScore + skillsScore + locationScore + englishScore);

  // Generate insights
  const keyStrengths: string[] = [];
  const gaps: string[] = [];
  const riskFactors: string[] = [];

  if (structured.totalYearsExperience >= (minExp || 0)) {
    keyStrengths.push(`${structured.totalYearsExperience} years of experience meets the ${minExp} year requirement`);
  }
  if (matchedCount > requiredSkills.length * 0.7) {
    keyStrengths.push(`${matchedCount}/${requiredSkills.length} required skills matched`);
  }
  if (structured.certifications.length > 0) {
    keyStrengths.push(`Certified: ${structured.certifications.slice(0, 3).join(', ')}`);
  }

  const missingSkills = requiredSkills.filter(s => {
    const canonical = normalizeSkill(s);
    const match = skillMatches.get(canonical);
    return !match?.found;
  });
  if (missingSkills.length > 0) {
    gaps.push(`Missing skills: ${missingSkills.join(', ')}`);
  }
  if (structured.totalYearsExperience < (minExp || 0)) {
    gaps.push(`${structured.totalYearsExperience} years experience is below the ${minExp} year minimum`);
  }

  if (structured.educationLevel !== 'Unknown') {
    keyStrengths.push(`Education: ${structured.educationLevel}`);
  }
  if (structured.otherLanguages.length > 0) {
    keyStrengths.push(`Multilingual: ${structured.otherLanguages.join(', ')}`);
  }
  if (structured.workExperienceSummary.length > 0) {
    const roles = structured.workExperienceSummary.map(w => w.roleTitle).slice(0, 3);
    keyStrengths.push(`Recent roles: ${roles.join(', ')}`);
  }

  // Check for related/partial matches
  const partialMatches = requiredSkills.filter(s => {
    const canonical = normalizeSkill(s);
    const match = skillMatches.get(canonical);
    return !match?.found && match?.relatedFound && match.relatedFound.length > 0;
  });
  if (partialMatches.length > 0) {
    gaps.push(`Partial matches (related skills found): ${partialMatches.map(s => normalizeSkill(s)).join(', ')}`);
  }

  if (structured.totalYearsExperience === 0) {
    riskFactors.push('Could not determine years of experience from CV');
  }
  if (structured.englishLevel === 'Unknown') {
    riskFactors.push('English level could not be determined');
  }
  if (matchedCount < requiredSkills.length * 0.3) {
    riskFactors.push(`Low skill coverage: only ${matchedCount}/${requiredSkills.length} required skills found`);
  }

  let recommendation = 'maybe';
  if (fitScore >= 75) recommendation = 'yes';
  if (fitScore >= 85) recommendation = 'strong_yes';
  if (fitScore < 50) recommendation = 'no';
  if (fitScore < 35) recommendation = 'strong_no';

  const expQuality = Math.min(100, Math.round((experienceScore / 40) * 100));
  const skillRelevance = Math.min(100, Math.round(skillsRatio * 100));
  // Higher confidence when we have more data points
  let confidence = 40;
  if (structured.totalYearsExperience > 0) confidence += 15;
  if (matchedCount > 0) confidence += 10;
  if (matchedCount > requiredSkills.length * 0.5) confidence += 10;
  if (structured.educationLevel !== 'Unknown') confidence += 5;
  if (structured.englishLevel !== 'Unknown') confidence += 5;
  if (structured.certifications.length > 0) confidence += 5;
  confidence = Math.min(95, confidence);

  return {
    fit_score: fitScore,
    experience_score: experienceScore,
    skills_score: skillsScore,
    location_score: locationScore,
    english_score: englishScore,
    experience_quality_score: expQuality,
    skill_relevance_score: skillRelevance,
    confidence_level: confidence,
    summary: `Candidate with ${structured.totalYearsExperience} years of experience and ${structured.educationLevel !== 'Unknown' ? structured.educationLevel : 'undetermined education'}. Skills coverage: ${matchedCount}/${requiredSkills.length} required skills matched${avgConfidence > 0 ? ' (avg confidence: ' + Math.round(avgConfidence) + '%)' : ''}. English: ${structured.englishLevel}. Location: ${structured.locationCity || 'Unknown'}.${structured.certifications.length > 0 ? ' Certifications: ' + structured.certifications.slice(0,2).join(', ') + '.' : ''}`,
    skill_breakdown: skillBreakdown,
    key_strengths: keyStrengths,
    gaps,
    risk_factors: riskFactors,
    recommendation,
    recommendation_reasoning: `Based on algorithmic analysis: ${fitScore}/100 overall fit. ${keyStrengths.length > 0 ? keyStrengths[0] + '.' : ''} ${gaps.length > 0 ? gaps[0] + '.' : ''}`,
    reasoning_chain: {
      experience_reasoning: `${structured.totalYearsExperience} years detected. Required: ${minExp}. Score: ${experienceScore}/40.`,
      skills_reasoning: `${matchedCount}/${requiredSkills.length} skills matched. Score: ${skillsScore}/30.`,
      location_reasoning: isRemote ? 'Not applicable - remote position' : `Location: ${structured.locationCity || 'Unknown'}. Score: ${locationScore}/15.`,
      english_reasoning: `Detected level: ${structured.englishLevel}. Score: ${englishScore}/15.`,
      overall_reasoning: `Total fit score: ${fitScore}/100. Recommendation: ${recommendation}.`,
    },
  };
}

// ── Main Processing Pipeline ──

export async function processCVFile(
  filePath: string,
  jobId: string
): Promise<{
  id: string;
  fit_score: number;
  filename: string;
  candidate_name: string;
}> {
  // Step 0: Check credits (admin bypass for owner account)
  const ADMIN_EMAILS = ['marcorome91@gmail.com'];
  const currentProfile = getUserProfile();
  const isAdmin = currentProfile && ADMIN_EMAILS.includes(currentProfile.email.toLowerCase());
  if (!isAdmin) {
    const creditResult = deductCredit();
    if (!creditResult.success) {
      throw new Error('No CV selecting credits remaining. Please purchase more credits to continue.');
    }
  }

  try {
    // Step 1: Extract raw text
    const rawText = await extractTextFromFile(filePath);
    if (!rawText || rawText.trim().length < 50) {
      throw new Error('Could not extract sufficient text from CV file');
    }

    // Step 2: Get job data
    const jobData = getJob(jobId);
    if (!jobData) throw new Error('Job not found');

    const requiredSkills: string[] = JSON.parse(jobData.required_skills || '[]');

    // Step 3: Algorithmic extraction (parse CV into structured data)
    const structured = parseCV(rawText, requiredSkills);
    const skillMatches = findSkillMatches(rawText, requiredSkills);

    // Step 4: Try Ollama (AI scoring on anonymized data) or fall back to algorithmic
    let analysis;
    const useOllama = getSetting('ollama_enabled') === 'true';

    if (useOllama) {
      try {
        const ollamaUrl = getSetting('ollama_url') || 'http://localhost:11434';
        const preferredModel = getSetting('ollama_model') || 'llama3.1:8b';

        // Auto-detect Ollama and pull model if needed
        const modelToUse = await ensureModelAvailable(preferredModel, ollamaUrl);

        if (modelToUse) {
          // Anonymize before sending to LLM
          const anonymizedProfile = anonymizeForLLM(structured);

          const ollamaResult = await analyzeWithOllama(
            anonymizedProfile,
            {
              title: jobData.title,
              description: jobData.description || '',
              required_skills: requiredSkills,
              minimum_experience: jobData.minimum_experience,
              location: jobData.location || '',
              english_level: jobData.english_level || '',
              scoring_parameters: jobData.scoring_parameters ? JSON.parse(jobData.scoring_parameters) : null,
            },
            ollamaUrl,
            modelToUse
          );

          analysis = ollamaResult;
        } else {
          // Ollama not available, fall back to algorithmic
          analysis = algorithmicScore(structured, skillMatches, jobData, rawText);
        }
      } catch (ollamaError) {
        // Ollama failed, fall back to algorithmic
        console.error('Ollama analysis failed, using algorithmic fallback:', ollamaError);
        analysis = algorithmicScore(structured, skillMatches, jobData, rawText);
      }
    } else {
      // Ollama not enabled, use algorithmic
      analysis = algorithmicScore(structured, skillMatches, jobData, rawText);
    }

    // Step 5: Build skill evidence and variations
    const skillEvidence: Record<string, string> = {};
    const skillVariationsMatched: Record<string, string[]> = {};
    for (const [skill, match] of skillMatches.entries()) {
      if (match.found) {
        skillEvidence[skill] = extractSkillEvidence(rawText, skill);
        skillVariationsMatched[skill] = match.variations;
      }
    }

    // Step 6: Save to database
    const analysisId = crypto.randomUUID();
    const filename = filePath.split(/[/\\]/).pop() || 'unknown';
    const candidateName = structured.name || filename.replace(/\.\w+$/, '');

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
      experience_quality_score: analysis.experience_quality_score,
      skill_relevance_score: analysis.skill_relevance_score,
      confidence_level: analysis.confidence_level,
      years_experience: structured.totalYearsExperience,
      location: structured.locationCity || '',
      english_level: structured.englishLevel,
      other_languages: structured.otherLanguages.join(', '),
      summary: analysis.summary,
      skill_breakdown: analysis.skill_breakdown,
      key_strengths: analysis.key_strengths,
      gaps: analysis.gaps,
      risk_factors: analysis.risk_factors,
      recommendation: analysis.recommendation,
      recommendation_reasoning: analysis.recommendation_reasoning,
      reasoning_chain: analysis.reasoning_chain,
      skill_evidence: { ...skillEvidence, ...(analysis as any).skill_evidence },
      skill_variations_matched: { ...skillVariationsMatched, ...(analysis as any).skill_variations_matched },
    });

    return {
      id: analysisId,
      fit_score: analysis.fit_score,
      filename,
      candidate_name: candidateName,
    };
  } catch (error) {
    throw new Error(`CV processing failed: ${String(error)}`);
  }
}
