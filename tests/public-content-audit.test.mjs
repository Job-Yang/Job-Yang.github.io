import assert from 'node:assert/strict';
import test from 'node:test';
import { scanText } from '../scripts/audit-public-content.mjs';
import { buildPublicFeed } from '../scripts/sync-activity-feed.mjs';

test('blocks organization-only terms without storing them as plaintext fixtures', () => {
  const protectedTerms = [
    String.fromCharCode(68, 79, 76, 77),
    String.fromCharCode(66, 121, 116, 101, 78, 78),
  ];
  for (const term of protectedTerms) {
    assert.deepEqual(
      scanText(`runtime: ${term}`, 'fixture.md').map(({ label }) => label),
      ['组织专属名词'],
    );
  }

  const protectedHosts = [
    `${String.fromCharCode(98, 121, 116, 101, 100, 97, 110, 99, 101)}.net`,
    `${String.fromCharCode(98, 121, 116, 101, 100)}.org`,
    `${String.fromCharCode(108, 97, 114, 107, 111, 102, 102, 105, 99, 101)}.com`,
    `${String.fromCharCode(102, 101, 105, 115, 104, 117)}.cn`,
  ];
  for (const host of protectedHosts) {
    assert.deepEqual(
      scanText(`https://${host}/docs`, 'fixture.md').map(({ label }) => label),
      ['组织专属域名'],
    );
  }
});

test('blocks private projections and editorial workflow metadata', () => {
  const workflowKey = ['source', '_id'].join('');
  const reviewKey = ['review', '_required'].join('');
  const sourceClass = ['source', 'Class'].join('');
  const privateProjection = ['private', 'projection'].join('_');
  const findings = scanText(
    [
      `${workflowKey}: "article-private"`,
      `${reviewKey}: true`,
      `"${sourceClass}": "${privateProjection}"`,
    ].join('\n'),
    'fixture.md',
  );
  assert.deepEqual(
    [...new Set(findings.map(({ label }) => label))].sort(),
    ['公开内容携带来源清单', '内部工作流元数据', '私有来源投影'].sort(),
  );
});

test('blocks precise host execution artifacts', () => {
  const runAlias = ['r', 'c'].join('');
  const artifactPath = ['runtime', 'evidence'].join('-');
  const hostAction = ['spawn', 'agent'].join('_');
  const findings = scanText(
    `${runAlias}.5 data came from ${artifactPath}/timing/run.json and ${hostAction} records.`,
    'fixture.md',
  );
  assert.deepEqual(
    [...new Set(findings.map(({ label }) => label))].sort(),
    ['内部样本版本号', '内部运行产物路径', '宿主调度工具记录'].sort(),
  );
});

test('allows public technical explanations and explicitly synthetic examples', () => {
  assert.deepEqual(
    scanText(
      '以下数字为合成示例，仅解释并行边界，不对应任何实际项目。容器根目录是 /home/claude。',
      'fixture.md',
    ),
    [],
  );
});

test('blocks a concrete private user path', () => {
  const privatePath = ['', 'Users', 'example', 'Documents', 'private', 'file.md'].join('/');
  const findings = scanText(privatePath, 'fixture.md');
  assert.equal(findings[0]?.label, '私有文件路径');
});

test('activity feed only accepts allowlisted public fields', () => {
  const base = {
    schema: 'JobYangActivityFeed:v2',
    visibility: 'public_only',
    generatedAt: '2026-09-22T00:00:00Z',
    threads: [{
      id: 'public-work',
      title: 'Public work',
      summary: 'A public repository update.',
      status: 'building',
    }],
  };
  assert.equal(buildPublicFeed(base).threadCount, 1);
  assert.throws(
    () => buildPublicFeed({
      ...base,
      threads: [{ ...base.threads[0], privateNotes: 'not publishable' }],
    }),
    /non-public fields: privateNotes/,
  );
});
