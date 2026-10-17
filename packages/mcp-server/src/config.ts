import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  MATCH_THRESHOLD: z.coerce.number().int().min(0).max(100).default(75),
  CANDIDATE_ID: z.string().optional(),
  RESUME_PATH: z.string().default('./data/resume.txt'),
  SUBMISSION_PROVIDER: z.enum(['mock', 'manual']).default('mock'),
});

export type AppConfig = z.infer<typeof envSchema> & {
  companies: string[];
  keywords: string[];
  locations: string[];
};

export function loadConfig(): AppConfig {
  const parsed = envSchema.parse(process.env);
  return {
    ...parsed,
    companies: (process.env.TARGET_COMPANIES ?? 'Stripe,Razorpay,PhonePe,Atlassian')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    keywords: (process.env.TARGET_KEYWORDS ?? 'backend,distributed,kafka,go,node')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    locations: (process.env.TARGET_LOCATIONS ?? 'Bengaluru,Gurugram,Hyderabad,Pune,Noida')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  };
}
