import type { JobInput } from '@job-hunter/core';

export interface SearchParams {
  companies: string[];
  keywords: string[];
  locations: string[];
}

export async function searchMockJobs(params: SearchParams): Promise<JobInput[]> {
  const jobs: JobInput[] = [];
  for (const company of params.companies) {
    for (const location of params.locations) {
      jobs.push({
        externalId: `${company.toLowerCase()}-backend-${location.toLowerCase().replace(/\s+/g, '-')}`,
        provider: 'mock-official',
        title: 'Senior Backend Engineer',
        company,
        location,
        description: `Design distributed microservices with ${params.keywords.join(', ')}. Own APIs, Kafka pipelines, Kubernetes deployments, and observability.`,
        applicationUrl: `https://careers.example.com/${encodeURIComponent(company)}/jobs/backend`,
      });
    }
  }
  return jobs;
}
