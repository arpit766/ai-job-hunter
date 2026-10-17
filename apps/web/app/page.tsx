import { prisma } from '../lib/prisma';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const applications = await prisma.application.findMany({
    include: { job: true, candidate: true },
    orderBy: { updatedAt: 'desc' },
    take: 30,
  });

  const counts = await prisma.application.groupBy({
    by: ['status'],
    _count: { _all: true },
  });

  return (
    <main>
      <h1>AI Job Hunter</h1>
      <p className="lead">Review-first workflow — nothing submits without explicit approval.</p>

      <section className="grid" style={{ marginBottom: '1.5rem' }}>
        {counts.map((row) => (
          <div key={row.status} className="card">
            <h2>{row.status}</h2>
            <p className="meta">{row._count._all} applications</p>
          </div>
        ))}
      </section>

      <section className="grid">
        {applications.map((app) => (
          <article key={app.id} className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
              <div>
                <h2>{app.job.title}</h2>
                <p className="meta">{app.job.company} · {app.job.location}</p>
              </div>
              <span className="pill">{app.status}</span>
            </div>
            <p className="meta" style={{ marginTop: '0.75rem' }}>
              Match score: <span className="score">{app.matchScore ?? '—'}</span> · Candidate: {app.candidate.fullName}
            </p>
            <p className="meta" style={{ marginTop: '0.5rem' }}>
              <a href={app.job.applicationUrl} target="_blank" rel="noreferrer">Application URL</a>
            </p>
          </article>
        ))}
      </section>
    </main>
  );
}
