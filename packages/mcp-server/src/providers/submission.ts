export interface SubmissionRequest {
  applicationId: string;
  jobExternalId: string;
  provider: string;
  idempotencyKey: string;
}

export interface SubmissionResult {
  success: boolean;
  reference?: string;
  message: string;
  raw?: unknown;
}

export async function submitViaMockProvider(req: SubmissionRequest): Promise<SubmissionResult> {
  if (!req.idempotencyKey) {
    return { success: false, message: 'Missing idempotency key' };
  }
  return {
    success: true,
    reference: `mock-${req.applicationId.slice(0, 8)}`,
    message: 'Mock provider accepted application (no external HTTP call).',
    raw: { provider: req.provider, jobExternalId: req.jobExternalId },
  };
}
