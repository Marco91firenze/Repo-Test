/**
 * PII extraction helpers for CV processing.
 *
 * extractPII: pulls candidate name from raw CV text.
 * extractNameFromFilename: parses name from CV filename as fallback.
 */

export interface StructuredCVData {
  name: string;
  email: string;
  phone: string;
  address: string;
  totalYearsExperience: number;
  locationCity: string;
  locationCountry: string;
  englishLevel: string;
  otherLanguages: string[];
  skills: ExtractedSkill[];
  educationLevel: string;
  certifications: string[];
  workExperienceSummary: WorkExperienceEntry[];
  recentRoleTitles: string[];
}

export interface ExtractedSkill {
  name: string;
  yearsUsed: number;
  level: 'expert' | 'advanced' | 'intermediate' | 'beginner' | 'unknown';
}

export interface WorkExperienceEntry {
  roleTitle: string;
  durationYears: number;
  responsibilities: string[];
}

export interface AnonymizedProfile {
  totalYearsExperience: number;
  locationCity: string;
  englishLevel: string;
  otherLanguages: string[];
  skills: { name: string; yearsUsed: number; level: string }[];
  educationLevel: string;
  certifications: string[];
  experienceSummary: { role: string; durationYears: number; keyResponsibilities: string[] }[];
}

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_REGEX = /(\+?\d{1,4}[\s.-]?)?(\(?\d{1,4}\)?[\s.-]?)?\d{3,4}[\s.-]?\d{3,4}/g;
const ADDRESS_INDICATORS = /\b(street|road|avenue|blvd|boulevard|drive|lane|via|piazza|rue|straße|strasse|platz)\b/gi;

export function extractPII(rawText: string): { name: string; email: string; phone: string; address: string } {
  const emailMatch = rawText.match(EMAIL_REGEX);
  const email = emailMatch ? emailMatch[0] : '';

  const phoneMatch = rawText.match(PHONE_REGEX);
  const phone = phoneMatch ? phoneMatch[0] : '';

  const lines = rawText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  let name = '';

  for (const line of lines.slice(0, 8)) {
    const cleanLine = line.replace(EMAIL_REGEX, '').replace(PHONE_REGEX, '').trim();

    // Skip obvious garbage: PDF headers, binary noise, lines with < 50% alpha chars
    if (cleanLine.startsWith('%PDF')) continue;
    if (cleanLine.startsWith('%')) continue;
    const alphaChars = (cleanLine.match(/[a-zA-ZÀ-ÖØ-öø-ÿ]/g) || []).length;
    if (alphaChars < cleanLine.length * 0.5) continue;
    if (alphaChars < 3) continue;

    const wordCount = cleanLine.split(/\s+/).length;
    if (
      cleanLine.length > 2 &&
      cleanLine.length < 60 &&
      wordCount >= 2 &&
      wordCount <= 5 &&
      !/^(CURRICULUM|RESUME|CV|PERSONAL|CONTACT|PROFILE|SUMMARY|OBJECTIVE|EDUCATION|EXPERIENCE|SKILLS)/i.test(cleanLine) &&
      !cleanLine.includes('@') &&
      !cleanLine.includes('http')
    ) {
      name = cleanLine;
      break;
    }
  }

  const addressMatch = rawText.match(ADDRESS_INDICATORS);
  const address = addressMatch ? 'Address detected' : '';

  return { name, email, phone, address };
}

/**
 * Derives a candidate name from a CV filename.
 * Handles patterns like:
 *   CV_BusinessDev_7_Marco_De_Luca.pdf  → "Marco De Luca"
 *   Marco_Rossi_CV.pdf                  → "Marco Rossi"
 *   marco-rossi.pdf                     → "Marco Rossi"
 */
export function extractNameFromFilename(filename: string): string {
  // Strip extension and path
  const base = filename.replace(/\.[^.]+$/, '').split(/[/\\]/).pop() || '';

  // Split on underscores, hyphens, spaces
  const parts = base.split(/[_\-\s]+/).filter(p => p.length > 0);

  // Filter out common non-name tokens
  const skipWords = new Set([
    'cv', 'resume', 'curriculum', 'vitae', 'candidato', 'candidate',
    'bd', 'businessdev', 'business', 'dev', 'developer', 'manager',
    'senior', 'junior', 'lead', 'head', 'director',
  ]);

  // Find the first sequence of 2+ consecutive capitalised word-like parts that aren't numbers
  const nameParts: string[] = [];
  for (const part of parts) {
    if (/^\d+$/.test(part)) {
      if (nameParts.length >= 2) break; // number after 2+ name parts = we're done
      nameParts.length = 0; // number before name = reset
      continue;
    }
    if (skipWords.has(part.toLowerCase())) {
      if (nameParts.length >= 2) break;
      nameParts.length = 0;
      continue;
    }
    if (/^[a-zA-ZÀ-ÖØ-öø-ÿ]{2,}$/.test(part)) {
      nameParts.push(part.charAt(0).toUpperCase() + part.slice(1).toLowerCase());
    }
  }

  return nameParts.length >= 2 ? nameParts.join(' ') : '';
}
