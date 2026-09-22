import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { auditFiles } from './audit-public-content.mjs';

const allowedStatuses = new Set(['queued', 'building', 'verifying', 'shipped', 'blocked', 'stale']);
const allowedThreadKeys = new Set([
  'id',
  'title',
  'statusLabel',
  'summary',
  'latestEvidence',
  'nextGate',
  'href',
  'status',
  'updatedAt',
  'metrics',
]);

export function buildPublicFeed(input) {
  if (input.schema !== 'JobYangActivityFeed:v2') {
    throw new Error(`Unexpected activity feed schema: ${input.schema}`);
  }
  if (input.visibility !== 'public_only') {
    throw new Error('Activity feed must explicitly declare visibility=public_only.');
  }
  if (!Array.isArray(input.threads) || input.threads.length === 0) {
    throw new Error('Activity feed contains no threads.');
  }

  const threads = input.threads.map((thread, index) => {
    const unexpected = Object.keys(thread).filter((key) => !allowedThreadKeys.has(key));
    if (unexpected.length) {
      throw new Error(`Thread ${index + 1} contains non-public fields: ${unexpected.join(', ')}`);
    }
    if (!thread.id || !thread.title || !thread.summary || !allowedStatuses.has(thread.status)) {
      throw new Error(`Thread ${index + 1} is missing required public fields.`);
    }
    return Object.fromEntries(
      Object.entries(thread).filter(([key]) => allowedThreadKeys.has(key)),
    );
  });

  const statusCounts = Object.fromEntries(
    [...allowedStatuses]
      .map((status) => [status, threads.filter((thread) => thread.status === status).length])
      .filter(([, count]) => count > 0),
  );
  return {
    schema: input.schema,
    visibility: input.visibility,
    generatedAt: input.generatedAt || new Date().toISOString(),
    threadCount: threads.length,
    statusCounts,
    threads,
  };
}

function main() {
  const sourceArg = process.argv[2] || process.env.ACTIVITY_FEED_SOURCE;
  if (!sourceArg) {
    console.error('Usage: npm run sync:activity -- /absolute/path/to/public-activity-feed.json');
    process.exit(1);
  }

  const source = path.resolve(sourceArg);
  const target = path.resolve('src/data/activity-feed.json');
  const input = JSON.parse(fs.readFileSync(source, 'utf8'));
  const output = buildPublicFeed(input);
  const serialized = `${JSON.stringify(output, null, 2)}\n`;
  const tempPath = path.join('.git', 'activity-feed-public-candidate.json');
  fs.writeFileSync(tempPath, serialized);
  const findings = auditFiles([tempPath]);
  fs.rmSync(tempPath);
  if (findings.length) {
    throw new Error(
      `Activity feed blocked:\n${findings.map(({ label, line }) => `- line ${line}: ${label}`).join('\n')}`,
    );
  }

  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, serialized);
  console.log(`Public activity feed synced: ${output.threads.length} threads -> ${target}`);
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  main();
}
