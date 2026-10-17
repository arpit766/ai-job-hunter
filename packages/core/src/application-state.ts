import type { ApplicationStatus } from './types.js';

const ALLOWED: Record<ApplicationStatus, ApplicationStatus[]> = {
  DISCOVERED: ['MATCHED', 'WITHDRAWN'],
  MATCHED: ['READY_FOR_REVIEW', 'WITHDRAWN'],
  READY_FOR_REVIEW: ['APPROVED', 'WITHDRAWN', 'REJECTED'],
  APPROVED: ['SUBMITTED', 'WITHDRAWN'],
  SUBMITTED: ['INTERVIEW', 'REJECTED', 'WITHDRAWN'],
  INTERVIEW: ['REJECTED', 'WITHDRAWN'],
  REJECTED: [],
  WITHDRAWN: [],
};

export function canTransition(from: ApplicationStatus, to: ApplicationStatus): boolean {
  return ALLOWED[from]?.includes(to) ?? false;
}

export function assertTransition(from: ApplicationStatus, to: ApplicationStatus): void {
  if (!canTransition(from, to)) {
    throw new Error(`Invalid application transition: ${from} -> ${to}`);
  }
}
