import fs from 'node:fs';
import path from 'node:path';

const sourceArg = process.argv[2] || process.env.ACTIVITY_FEED_SOURCE;
if (!sourceArg) {
  console.error('Usage: npm run sync:activity -- /absolute/path/to/activity-feed.json');
  process.exit(1);
}

const source = path.resolve(sourceArg);
const target = path.resolve('src/data/activity-feed.json');
const feed = JSON.parse(fs.readFileSync(source, 'utf8'));
const serialized = JSON.stringify(feed, null, 2) + '\n';
const blockedPatterns = [
  ['private path', /(?:\/Users\/|\/Volumes\/|file:\/\/)/i],
  ['internal domain', /(?:https?:\/\/[^/\s]*(?:internal|intranet|corp|private)[^/\s]*|larkoffice\.com)/i],
  ['account identifier', /\b(?:ou|oc|om|on)_[a-z0-9_-]+\b/i],
  ['merge request', /\bMR\s*!?\d+\b/i],
];

if (feed.schema !== 'JobYangActivityFeed:v1') {
  throw new Error(`Unexpected activity feed schema: ${feed.schema}`);
}
if (feed.privacy?.scanStatus !== 'passed' || feed.privacy?.rawSourcesPublished !== false) {
  throw new Error('Activity feed has not passed the public projection gate.');
}
if (!Array.isArray(feed.threads) || feed.threads.length === 0) {
  throw new Error('Activity feed contains no threads.');
}
for (const [label, pattern] of blockedPatterns) {
  if (pattern.test(serialized)) throw new Error(`Activity feed blocked: ${label}`);
}

fs.mkdirSync(path.dirname(target), { recursive: true });
fs.writeFileSync(target, serialized);
console.log(`Activity feed synced: ${feed.threads.length} threads -> ${target}`);
