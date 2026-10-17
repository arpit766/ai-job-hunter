export type ApplicationStatus =
  | 'DISCOVERED'
  | 'MATCHED'
  | 'READY_FOR_REVIEW'
  | 'APPROVED'
  | 'SUBMITTED'
  | 'INTERVIEW'
  | 'REJECTED'
  | 'WITHDRAWN';

export interface JobInput {
  externalId: string;
  provider: string;
  title: string;
  company: string;
  location: string;
  description: string;
  applicationUrl: string;
}

export interface CandidateProfileInput {
  skills: string[];
  yearsExperience: number;
  preferredLocations: string[];
  resumeText: string;
}

export interface MatchResult {
  score: number;
  evidence: string[];
  missingSkills: string[];
  applyReasons: string[];
  skipReasons: string[];
}
