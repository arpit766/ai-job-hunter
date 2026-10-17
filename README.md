# AI Job Hunter

Review-first job discovery and application management for **Arpit Kumar** — separate from the [Arpit-Portfolio](https://github.com/arpit766/Arpit-Portfolio) GitHub Pages site.

## Stack

- **Node.js + TypeScript**
- **Next.js** dashboard (`apps/web`)
- **PostgreSQL + Prisma** (jobs, applications, approvals, audit trail)
- **Redis + BullMQ** background scheduler (`apps/worker`)
- **MCP server** (`packages/mcp-server`) with validated tools for Cursor

## Quick start

```bash
cd ai-job-hunter
cp .env.example .env
docker compose up -d
npm install
npx prisma db push
npm run db:seed
npm run build
npm test
```

### Dashboard

```bash
npm run dev:web
# http://localhost:3100
```

### MCP server (Cursor)

Build and point Cursor MCP settings to the stdio server:

```json
{
  "mcpServers": {
    "ai-job-hunter": {
      "command": "node",
      "args": ["/absolute/path/to/ai-job-hunter/packages/mcp-server/dist/index.js"],
      "env": {
        "DATABASE_URL": "postgresql://jobhunter:jobhunter@localhost:5433/jobhunter",
        "REDIS_URL": "redis://localhost:6380",
        "MATCH_THRESHOLD": "75",
        "RESUME_PATH": "/absolute/path/to/ai-job-hunter/data/resume.txt"
      }
    }
  }
}
```

Run `npm run dev:mcp` during development (uses `tsx`).

### Worker / scheduler

Cursor MCP does **not** run cron jobs. Keep the worker running for scheduled discovery ticks:

```bash
npm run dev:worker
```

## MCP tools

| Tool | Purpose |
| --- | --- |
| `search_jobs` | Discover + dedupe + upsert listings |
| `get_job_details` | Fetch job by id |
| `score_job_match` | Rule-based 0–100 score + evidence |
| `generate_tailored_resume` | Resume snapshot from verified seed file |
| `draft_application` | Cover letter + `READY_FOR_REVIEW` |
| `list_pending_applications` | Review queue |
| `approve_application` | Human approval gate |
| `submit_application` | Mock provider (idempotent) |
| `track_application` | Status + audit trail |
| `generate_daily_report` | 24h summary |

## Application workflow

`DISCOVERED → MATCHED → READY_FOR_REVIEW → APPROVED → SUBMITTED → INTERVIEW / REJECTED / WITHDRAWN`

Submission requires:

1. Status `APPROVED`
2. Unique `idempotencyKey`
3. Supported provider (`mock` default; `manual` blocks auto-submit)

## Tests

```bash
npm test
```

Covers deduplication, match scoring, and state transitions.

## Limitations (v0.1)

- Job discovery uses a **mock official-style provider** until real career-page connectors/API keys are configured.
- Tailored resume output is a **deterministic snapshot** from `RESUME_PATH` — plug in an LLM via a provider interface in a follow-up iteration.
- No CAPTCHA bypass or unsupported auto-apply flows.

## Related

- Portfolio: https://arpit766.github.io/Arpit-Portfolio/
- GitHub: https://github.com/arpit766
