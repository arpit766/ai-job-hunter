import { createHash } from 'node:crypto';
import type { JobInput } from './types.js';

export function normalizeJobText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

export function jobNormalizedHash(job: Pick<JobInput, 'company' | 'title' | 'location' | 'description'>): string {
  const payload = [
    normalizeJobText(job.company),
    normalizeJobText(job.title),
    normalizeJobText(job.location),
    normalizeJobText(job.description).slice(0, 2000),
  ].join('|');
  return createHash('sha256').update(payload).digest('hex');
}

export function dedupeJobs<T extends JobInput>(jobs: T[]): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const job of jobs) {
    const hash = jobNormalizedHash(job);
    if (seen.has(hash)) continue;
    seen.add(hash);
    result.push(job);
  }
  return result;
}
