import { readFile } from 'node:fs/promises';
import {
  assertTransition,
  dedupeJobs,
  jobNormalizedHash,
  scoreJobMatch,
  type CandidateProfileInput,
  type JobInput,
} from '@job-hunter/core';
import type { AppConfig } from './config.js';
import { prisma } from './db.js';
import { searchMockJobs } from './providers/mock-search.js';
import { submitViaMockProvider } from './providers/submission.js';

export async function getDefaultCandidate(config: AppConfig) {
  if (config.CANDIDATE_ID) {
    const found = await prisma.candidateProfile.findUnique({ where: { id: config.CANDIDATE_ID } });
    if (found) return found;
  }
  return prisma.candidateProfile.findFirst({ orderBy: { createdAt: 'asc' } });
}

export async function searchJobs(config: AppConfig) {
  const discovered = dedupeJobs(await searchMockJobs({
    companies: config.companies,
    keywords: config.keywords,
    locations: config.locations,
  }));

  const upserted = [];
  for (const job of discovered) {
    const hash = jobNormalizedHash(job);
    const row = await prisma.jobPosting.upsert({
      where: { provider_externalId: { provider: job.provider, externalId: job.externalId } },
      create: { ...job, normalizedHash: hash, isActive: true },
      update: { ...job, normalizedHash: hash, isActive: true },
    });
    upserted.push(row);
  }
  return upserted;
}

export async function scoreJobForCandidate(jobId: string, config: AppConfig) {
  const candidate = await getDefaultCandidate(config);
  if (!candidate) throw new Error('No candidate profile found. Run db:seed first.');

  const job = await prisma.jobPosting.findUnique({ where: { id: jobId } });
  if (!job) throw new Error(`Job not found: ${jobId}`);

  const profile: CandidateProfileInput = {
    skills: candidate.skills,
    yearsExperience: candidate.yearsExperience,
    preferredLocations: candidate.locations,
    resumeText: candidate.resumeText,
  };

  const match = scoreJobMatch(profile, job, 2);
  await prisma.matchScore.create({
    data: {
      jobId: job.id,
      score: match.score,
      evidence: match.evidence,
      missingSkills: match.missingSkills,
      applyReasons: match.applyReasons,
      skipReasons: match.skipReasons,
    },
  });

  let application = await prisma.application.findUnique({
    where: { candidateId_jobId: { candidateId: candidate.id, jobId: job.id } },
  });

  if (!application) {
    application = await prisma.application.create({
      data: {
        candidateId: candidate.id,
        jobId: job.id,
        status: 'DISCOVERED',
        jobDescriptionSnap: job.description,
      },
    });
  }

  const nextStatus = match.score >= config.MATCH_THRESHOLD ? 'MATCHED' : application.status;
  if (application.status === 'DISCOVERED' && nextStatus === 'MATCHED') {
    assertTransition('DISCOVERED', 'MATCHED');
    application = await prisma.application.update({
      where: { id: application.id },
      data: { status: 'MATCHED', matchScore: match.score },
    });
  } else {
    application = await prisma.application.update({
      where: { id: application.id },
      data: { matchScore: match.score },
    });
  }

  await prisma.auditLog.create({
    data: {
      applicationId: application.id,
      action: 'score_job_match',
      metadata: match as object,
    },
  });

  return { job, match, application };
}

export async function prepareApplication(applicationId: string, config: AppConfig) {
  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    include: { job: true, candidate: true },
  });
  if (!application) throw new Error('Application not found');

  if (application.status === 'MATCHED') {
    assertTransition('MATCHED', 'READY_FOR_REVIEW');
    await prisma.application.update({
      where: { id: applicationId },
      data: { status: 'READY_FOR_REVIEW' },
    });
  }

  const resumeText = await readFile(config.RESUME_PATH, 'utf8').catch(() => application.candidate.resumeText);
  const tailored = `# Tailored resume snapshot\n\n${resumeText}\n\n---\nTarget: ${application.job.title} @ ${application.job.company}`;

  const coverLetter = `Dear Hiring Team,\n\nI am applying for the ${application.job.title} role at ${application.job.company}. I bring ${application.candidate.yearsExperience}+ years building Go/Node.js microservices, Kafka pipelines, and production fintech integrations (Paytm, InsuranceDekho).\n\nThank you,\n${application.candidate.fullName}`;

  const updated = await prisma.application.update({
    where: { id: applicationId },
    data: {
      tailoredResumePath: `generated/${applicationId}-resume.md`,
      coverLetter,
      resumeVersionUsed: config.RESUME_PATH,
      jobDescriptionSnap: application.job.description,
    },
    include: { job: true },
  });

  await prisma.auditLog.create({
    data: {
      applicationId,
      action: 'draft_application',
      metadata: { tailoredPreview: tailored.slice(0, 500) },
    },
  });

  return { application: updated, tailoredPreview: tailored.slice(0, 1200), questionsForCandidate: [] };
}

export async function approveApplication(applicationId: string, actor: string, note?: string) {
  const application = await prisma.application.findUnique({ where: { id: applicationId } });
  if (!application) throw new Error('Application not found');
  assertTransition(application.status, 'APPROVED');

  const updated = await prisma.application.update({
    where: { id: applicationId },
    data: { status: 'APPROVED', approvedAt: new Date(), approvedBy: actor },
  });

  await prisma.approvalRecord.create({
    data: { applicationId, approved: true, actor, note },
  });

  await prisma.auditLog.create({
    data: { applicationId, action: 'approve_application', metadata: { actor, note } },
  });

  return updated;
}

export async function submitApplication(applicationId: string, config: AppConfig, idempotencyKey: string) {
  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    include: { job: true },
  });
  if (!application) throw new Error('Application not found');

  if (application.status !== 'APPROVED') {
    throw new Error('Submission blocked: application is not APPROVED');
  }

  const existing = await prisma.submissionAttempt.findUnique({ where: { idempotencyKey } });
  if (existing?.success) {
    return { duplicate: true, attempt: existing };
  }

  if (config.SUBMISSION_PROVIDER === 'manual') {
    throw new Error('Manual provider: submission must be completed by the candidate outside the agent.');
  }

  const result = await submitViaMockProvider({
    applicationId,
    jobExternalId: application.job.externalId,
    provider: application.job.provider,
    idempotencyKey,
  });

  if (!result.success) {
    await prisma.submissionAttempt.create({
      data: {
        applicationId,
        idempotencyKey,
        provider: config.SUBMISSION_PROVIDER,
        success: false,
        responseBody: result as object,
      },
    });
    throw new Error(result.message);
  }

  await prisma.$transaction(async (tx) => {
    await tx.submissionAttempt.create({
      data: {
        applicationId,
        idempotencyKey,
        provider: config.SUBMISSION_PROVIDER,
        success: true,
        responseBody: result as object,
      },
    });
    assertTransition('APPROVED', 'SUBMITTED');
    await tx.application.update({
      where: { id: applicationId },
      data: {
        status: 'SUBMITTED',
        submittedAt: new Date(),
        submissionRef: result.reference,
        idempotencyKey,
      },
    });
    await tx.auditLog.create({
      data: {
        applicationId,
        action: 'submit_application',
        metadata: result as object,
      },
    });
  });

  return { duplicate: false, result };
}
