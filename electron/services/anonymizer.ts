/**
 * GDPR-Compliant Anonymization Pipeline
 *
 * Strips all PII from extracted CV data and produces an anonymized profile
 * that can safely be sent to a local LLM without privacy concerns.
 *
 * The LLM never sees: names, emails, phone numbers, addresses, company names, dates of birth.
 * The LLM only sees: skills list, years of experience, city-level location, language levels,
 * education level (degree type only), certifications.
 */

export interface StructuredCVData {
  // PII fields (kept separate, never sent to LLM)
  name: string;
  email: string;
  phone: string;
  address: string;

  // Job-relevant facts (anonymized for LLM)
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

/**
 * Takes structured CV data and strips all PII, producing an anonymized profile
 * safe to pass to a local LLM for scoring.
 */
export function anonymizeForLLM(data: StructuredCVData): AnonymizedProfile {
  return {
    totalYearsExperience: data.totalYearsExperience,
    locationCity: data.locationCity || 'Unknown',
    englishLevel: data.englishLevel || 'Unknown',
    otherLanguages: data.otherLanguages,
    skills: data.skills.map(s => ({
      name: s.name,
      yearsUsed: s.yearsUsed,
      level: s.level,
    })),
    educationLevel: data.educationLevel || 'Unknown',
    certifications: data.certifications,
    experienceSummary: data.workExperienceSummary.map(w => ({
      role: w.roleTitle,
      durationYears: w.durationYears,
      // Strip company names from responsibilities
      keyResponsibilities: w.responsibilities.map(r => stripCompanyNames(r)),
    })),
  };
}

/**
 * Generates a text summary of the anonymized profile for the LLM prompt.
 */
export function anonymizedProfileToText(profile: AnonymizedProfile): string {
  const lines: string[] = [];

  lines.push(`Total professional experience: ${profile.totalYearsExperience} years`);
  lines.push(`Location: ${profile.locationCity}`);
  lines.push(`English level: ${profile.englishLevel}`);

  if (profile.otherLanguages.length > 0) {
    lines.push(`Other languages: ${profile.otherLanguages.join(', ')}`);
  }

  lines.push(`Education: ${profile.educationLevel}`);

  if (profile.certifications.length > 0) {
    lines.push(`Certifications: ${profile.certifications.join(', ')}`);
  }

  lines.push('');
  lines.push('Skills:');
  for (const skill of profile.skills) {
    const years = skill.yearsUsed > 0 ? ` (${skill.yearsUsed}+ years)` : '';
    const level = skill.level !== 'unknown' ? ` [${skill.level}]` : '';
    lines.push(`  - ${skill.name}${years}${level}`);
  }

  if (profile.experienceSummary.length > 0) {
    lines.push('');
    lines.push('Work experience:');
    for (const exp of profile.experienceSummary) {
      lines.push(`  - ${exp.role} (${exp.durationYears} year${exp.durationYears !== 1 ? 's' : ''})`);
      for (const resp of exp.keyResponsibilities.slice(0, 3)) {
        lines.push(`    * ${resp}`);
      }
    }
  }

  return lines.join('\n');
}

// ── PII Extraction Helpers ──

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_REGEX = /(\+?\d{1,4}[\s.-]?)?(\(?\d{1,4}\)?[\s.-]?)?\d{3,4}[\s.-]?\d{3,4}/g;
const ADDRESS_INDICATORS = /\b(street|road|avenue|blvd|boulevard|drive|lane|via|piazza|rue|straße|strasse|platz)\b/gi;

export function extractPII(rawText: string): { name: string; email: string; phone: string; address: string } {
  // Extract email
  const emailMatch = rawText.match(EMAIL_REGEX);
  const email = emailMatch ? emailMatch[0] : '';

  // Extract phone - look for phone-like patterns
  const phoneMatch = rawText.match(PHONE_REGEX);
  const phone = phoneMatch ? phoneMatch[0] : '';

  // Extract name - typically the first prominent line of text
  const lines = rawText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  let name = '';
  for (const line of lines.slice(0, 5)) {
    // Name is usually a short line (2-4 words) near the top that's not an email/phone/URL
    const cleanLine = line.replace(EMAIL_REGEX, '').replace(PHONE_REGEX, '').trim();
    if (cleanLine.length > 2 && cleanLine.length < 60 && cleanLine.split(/\s+/).length <= 5) {
      // Skip lines that look like headers (all caps common words)
      if (!/^(CURRICULUM|RESUME|CV|PERSONAL|CONTACT|PROFILE|SUMMARY|OBJECTIVE)/i.test(cleanLine)) {
        name = cleanLine;
        break;
      }
    }
  }

  // Extract address indicators
  const addressMatch = rawText.match(ADDRESS_INDICATORS);
  const address = addressMatch ? 'Address detected' : '';

  return { name, email, phone, address };
}

function stripCompanyNames(text: string): string {
  // Remove common company suffixes and formats that might identify organizations
  return text
    .replace(/\b(at|for|with)\s+[A-Z][a-zA-Z&.\s]{2,30}(Inc|LLC|Ltd|GmbH|S\.r\.l|S\.p\.A|Corp|Co|AG|BV|NV)\b/gi, '')
    .replace(/\b[A-Z][a-zA-Z]{2,}\s+(Inc|LLC|Ltd|GmbH|S\.r\.l|S\.p\.A|Corp|Co|AG|BV|NV)\b/gi, '[company]')
    .trim();
}
