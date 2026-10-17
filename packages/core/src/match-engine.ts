import type { CandidateProfileInput, JobInput, MatchResult } from './types.js';
import { normalizeJobText } from './dedup.js';

const BACKEND_KEYWORDS = [
  'backend',
  'microservice',
  'distributed',
  'kafka',
  'go',
  'golang',
  'node',
  'typescript',
  'api',
  'kubernetes',
  'redis',
  'postgresql',
  'mysql',
  'event-driven',
  'sre',
  'platform',
];

const LOCATION_KEYWORDS = ['gurugram', 'gurgaon', 'noida', 'ncr', 'delhi', 'bengaluru', 'bangalore', 'hyderabad', 'pune', 'remote'];

export function scoreJobMatch(candidate: CandidateProfileInput, job: JobInput, minYears = 0): MatchResult {
  const description = normalizeJobText(job.description);
  const title = normalizeJobText(job.title);
  const location = normalizeJobText(job.location);
  const blob = `${title} ${description} ${location}`;

  const evidence: string[] = [];
  const missingSkills: string[] = [];
  const applyReasons: string[] = [];
  const skipReasons: string[] = [];

  let score = 0;

  const skillHits = candidate.skills.filter((skill) => blob.includes(normalizeJobText(skill)));
  const skillRatio = candidate.skills.length ? skillHits.length / candidate.skills.length : 0;
  const skillPoints = Math.round(skillRatio * 35);
  score += skillPoints;
  if (skillHits.length) {
    evidence.push(`Matched skills: ${skillHits.slice(0, 8).join(', ')}`);
  }

  const backendHits = BACKEND_KEYWORDS.filter((kw) => blob.includes(kw));
  const backendPoints = Math.min(25, backendHits.length * 4);
  score += backendPoints;
  if (backendHits.length) {
    evidence.push(`Backend/distributed keywords: ${backendHits.slice(0, 6).join(', ')}`);
  }

  const seniority = /\b(senior|staff|sde-?2|lead)\b/.test(blob);
  const junior = /\b(intern|fresher|0-1)\b/.test(blob);
  if (candidate.yearsExperience >= 3 && (seniority || /\bsoftware engineer\b/.test(blob))) {
    score += 15;
    evidence.push('Seniority band aligns with ~3+ years experience');
  }
  if (junior && candidate.yearsExperience >= 3) {
    score -= 10;
    skipReasons.push('Listing appears junior-level');
  }

  const locationHit = candidate.preferredLocations.some((loc) => location.includes(normalizeJobText(loc)))
    || LOCATION_KEYWORDS.some((loc) => location.includes(loc) && blob.includes('india'));
  if (locationHit) {
    score += 15;
    applyReasons.push('Location matches preferred Indian tech hubs');
  } else {
    skipReasons.push('Location not in preferred list');
  }

  if (candidate.yearsExperience >= minYears) {
    score += 5;
  } else {
    skipReasons.push(`Below configured minimum years (${minYears})`);
  }

  for (const skill of candidate.skills) {
    if (!blob.includes(normalizeJobText(skill)) && BACKEND_KEYWORDS.includes(normalizeJobText(skill))) {
      missingSkills.push(skill);
    }
  }

  score = Math.max(0, Math.min(100, score));

  if (score >= 75) {
    applyReasons.push('Rule-based score meets default threshold (75)');
  } else {
    skipReasons.push('Below default match threshold (75)');
  }

  return { score, evidence, missingSkills: missingSkills.slice(0, 10), applyReasons, skipReasons };
}
