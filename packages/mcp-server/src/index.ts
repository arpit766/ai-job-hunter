#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { loadConfig } from './config.js';
import { prisma } from './db.js';
import {
  approveApplication,
  prepareApplication,
  scoreJobForCandidate,
  searchJobs,
  submitApplication,
} from './services.js';

const config = loadConfig();

const server = new McpServer({
  name: 'ai-job-hunter',
  version: '0.1.0',
});

function ok(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
}

function err(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return { content: [{ type: 'text' as const, text: JSON.stringify({ error: message }) }], isError: true as const };
}

const searchJobsSchema = z.object({
  companies: z.array(z.string()).optional(),
  keywords: z.array(z.string()).optional(),
  locations: z.array(z.string()).optional(),
});

server.registerTool(
  'search_jobs',
  {
    title: 'Search jobs',
    description: 'Discover and upsert job postings using configured companies, keywords, and locations.',
    inputSchema: searchJobsSchema,
  },
  async (args) => {
    try {
      if (args.companies) config.companies = args.companies;
      if (args.keywords) config.keywords = args.keywords;
      if (args.locations) config.locations = args.locations;
      const jobs = await searchJobs(config);
      return ok({ count: jobs.length, jobs });
    } catch (error) {
      return err(error);
    }
  },
);

server.registerTool(
  'get_job_details',
  {
    title: 'Get job details',
    description: 'Fetch a job posting by id.',
    inputSchema: z.object({ jobId: z.string().min(1) }),
  },
  async ({ jobId }) => {
    try {
      const job = await prisma.jobPosting.findUnique({ where: { id: jobId } });
      if (!job) return ok({ error: 'NOT_FOUND' });
      return ok(job);
    } catch (error) {
      return err(error);
    }
  },
);

server.registerTool(
  'score_job_match',
  {
    title: 'Score job match',
    description: 'Score a job against the default candidate profile and persist match evidence.',
    inputSchema: z.object({ jobId: z.string().min(1) }),
  },
  async ({ jobId }) => {
    try {
      return ok(await scoreJobForCandidate(jobId, config));
    } catch (error) {
      return err(error);
    }
  },
);

server.registerTool(
  'generate_tailored_resume',
  {
    title: 'Generate tailored resume',
    description: 'Generate a tailored resume snapshot (verified facts only) for an application.',
    inputSchema: z.object({ applicationId: z.string().min(1) }),
  },
  async ({ applicationId }) => {
    try {
      const draft = await prepareApplication(applicationId, config);
      return ok({
        applicationId,
        tailoredPreview: draft.tailoredPreview,
        resumeVersionUsed: draft.application.resumeVersionUsed,
      });
    } catch (error) {
      return err(error);
    }
  },
);

server.registerTool(
  'draft_application',
  {
    title: 'Draft application',
    description: 'Draft cover letter and move application to READY_FOR_REVIEW when eligible.',
    inputSchema: z.object({ applicationId: z.string().min(1) }),
  },
  async ({ applicationId }) => {
    try {
      return ok(await prepareApplication(applicationId, config));
    } catch (error) {
      return err(error);
    }
  },
);

server.registerTool(
  'list_pending_applications',
  {
    title: 'List pending applications',
    description: 'List applications awaiting review or approval.',
    inputSchema: z.object({
      status: z
        .enum(['READY_FOR_REVIEW', 'APPROVED', 'MATCHED', 'DISCOVERED'])
        .default('READY_FOR_REVIEW'),
    }),
  },
  async ({ status }) => {
    try {
      const rows = await prisma.application.findMany({
        where: { status },
        include: { job: true },
        orderBy: { updatedAt: 'desc' },
        take: 50,
      });
      return ok({ count: rows.length, applications: rows });
    } catch (error) {
      return err(error);
    }
  },
);

server.registerTool(
  'approve_application',
  {
    title: 'Approve application',
    description: 'Explicitly approve an application for submission.',
    inputSchema: z.object({
      applicationId: z.string().min(1),
      actor: z.string().min(1),
      note: z.string().optional(),
    }),
  },
  async ({ applicationId, actor, note }) => {
    try {
      return ok(await approveApplication(applicationId, actor, note));
    } catch (error) {
      return err(error);
    }
  },
);

server.registerTool(
  'submit_application',
  {
    title: 'Submit application',
    description: 'Submit an approved application via a supported provider (mock by default).',
    inputSchema: z.object({
      applicationId: z.string().min(1),
      idempotencyKey: z.string().min(8),
    }),
  },
  async ({ applicationId, idempotencyKey }) => {
    try {
      return ok(await submitApplication(applicationId, config, idempotencyKey));
    } catch (error) {
      return err(error);
    }
  },
);

server.registerTool(
  'track_application',
  {
    title: 'Track application',
    description: 'Track application status, audit trail, and submission attempts.',
    inputSchema: z.object({ applicationId: z.string().min(1) }),
  },
  async ({ applicationId }) => {
    try {
      const application = await prisma.application.findUnique({
        where: { id: applicationId },
        include: {
          job: true,
          auditLogs: { orderBy: { createdAt: 'desc' }, take: 20 },
          submissionAttempts: true,
        },
      });
      if (!application) return ok({ error: 'NOT_FOUND' });
      return ok(application);
    } catch (error) {
      return err(error);
    }
  },
);

server.registerTool(
  'generate_daily_report',
  {
    title: 'Generate daily report',
    description: 'Summarize discoveries, matches, pending reviews, and submissions for the last 24h.',
    inputSchema: z.object({}),
  },
  async () => {
    try {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const [jobs, pending, submitted, audits] = await Promise.all([
        prisma.jobPosting.count({ where: { discoveredAt: { gte: since } } }),
        prisma.application.count({ where: { status: 'READY_FOR_REVIEW' } }),
        prisma.application.count({ where: { status: 'SUBMITTED', submittedAt: { gte: since } } }),
        prisma.auditLog.count({ where: { createdAt: { gte: since } } }),
      ]);
      return ok({
        windowHours: 24,
        jobsDiscovered: jobs,
        pendingReview: pending,
        submittedLast24h: submitted,
        auditEventsLast24h: audits,
        matchThreshold: config.MATCH_THRESHOLD,
      });
    } catch (error) {
      return err(error);
    }
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
