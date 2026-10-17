import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';

const connection = new IORedis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

const queue = new Queue('job-discovery', { connection });

const worker = new Worker(
  'job-discovery',
  async (job) => {
    console.log(JSON.stringify({ level: 'info', msg: 'discovery_tick', jobId: job.id, data: job.data }));
    // Worker hook: call MCP search_jobs or HTTP internal API in deployed environments.
    return { ok: true, at: new Date().toISOString() };
  },
  { connection },
);

async function schedule() {
  await queue.add(
    'discover',
    { source: 'scheduler' },
    { repeat: { every: 1000 * 60 * 60 * 6 }, removeOnComplete: 100 },
  );
  console.log(JSON.stringify({ level: 'info', msg: 'worker_started', repeatEveryHours: 6 }));
}

schedule().catch((err) => {
  console.error(err);
  process.exit(1);
});

process.on('SIGINT', async () => {
  await worker.close();
  await queue.close();
  await connection.quit();
  process.exit(0);
});
