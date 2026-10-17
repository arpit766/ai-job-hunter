import { describe, expect, it } from 'vitest';
import { assertTransition, canTransition, dedupeJobs, jobNormalizedHash, scoreJobMatch } from '@job-hunter/core';

describe('job deduplication', () => {
  it('removes duplicate listings with same normalized content', () => {
    const jobs = [
      {
        externalId: 'a1',
        provider: 'mock',
        title: 'Backend Engineer',
        company: 'Acme',
        location: 'Bengaluru',
        description: 'Build APIs with Go and Kafka.',
        applicationUrl: 'https://example.com/1',
      },
      {
        externalId: 'a2',
        provider: 'mock',
        title: 'Backend   Engineer',
        company: 'Acme',
        location: 'Bengaluru',
        description: 'Build APIs with Go and Kafka.',
        applicationUrl: 'https://example.com/2',
      },
    ];
    expect(dedupeJobs(jobs)).toHaveLength(1);
    expect(jobNormalizedHash(jobs[0])).toBe(jobNormalizedHash(jobs[1]));
  });
});

describe('match engine', () => {
  const candidate = {
    skills: ['go', 'kafka', 'kubernetes', 'redis', 'postgresql', 'node.js'],
    yearsExperience: 3.5,
    preferredLocations: ['bengaluru', 'gurugram'],
    resumeText: 'Backend engineer with kafka and kubernetes',
  };

  it('scores backend roles above threshold when aligned', () => {
    const result = scoreJobMatch(candidate, {
      externalId: '1',
      provider: 'mock',
      title: 'Senior Backend Engineer',
      company: 'ProductCo',
      location: 'Bengaluru, India',
      description: 'Build distributed microservices with Go, Kafka, Kubernetes, Redis, and PostgreSQL.',
      applicationUrl: 'https://example.com/job',
    });
    expect(result.score).toBeGreaterThanOrEqual(75);
    expect(result.evidence.length).toBeGreaterThan(0);
  });
});

describe('application state machine', () => {
  it('allows review-first happy path', () => {
    expect(canTransition('DISCOVERED', 'MATCHED')).toBe(true);
    expect(canTransition('MATCHED', 'READY_FOR_REVIEW')).toBe(true);
    expect(canTransition('READY_FOR_REVIEW', 'APPROVED')).toBe(true);
    expect(canTransition('APPROVED', 'SUBMITTED')).toBe(true);
    assertTransition('APPROVED', 'SUBMITTED');
  });

  it('blocks submit without approval', () => {
    expect(canTransition('READY_FOR_REVIEW', 'SUBMITTED')).toBe(false);
    expect(() => assertTransition('MATCHED', 'SUBMITTED')).toThrow();
  });
});
