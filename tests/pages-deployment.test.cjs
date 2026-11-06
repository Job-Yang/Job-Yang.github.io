const test = require("node:test");
const assert = require("node:assert/strict");
const deployPages = require("../scripts/deploy-pages.cjs");

function scenario(states, artifacts = [{ id: 7, name: "github-pages", size_in_bytes: 100, expired: false }]) {
  let elapsed = 0;
  let cursor = 0;
  let identityCalls = 0;
  const calls = [];
  const messages = [];
  const outputs = [];
  const listWorkflowRunArtifacts = () => {};
  const options = {
    context: { repo: { owner: "example", repo: "site" }, runId: 123, sha: "abc123" },
    now: () => elapsed,
    wait: async (ms) => { elapsed += ms; },
    core: {
      getIDToken: async () => { identityCalls++; return "test-oidc-token"; },
      info: (message) => messages.push(message),
      warning: (message) => messages.push(message),
      setOutput: (name, value) => outputs.push({ name, value })
    },
    github: {
      rest: { actions: { listWorkflowRunArtifacts } },
      paginate: async (method, args) => {
        assert.equal(method, listWorkflowRunArtifacts);
        assert.equal(args.run_id, 123);
        return artifacts;
      },
      request: async (route, args) => {
        calls.push({ route, args });
        if (route === "POST /repos/{owner}/{repo}/pages/deployments") {
          assert.equal(args.artifact_id, 7);
          assert.equal(args.pages_build_version, "abc123");
          assert.equal(args.oidc_token, "test-oidc-token");
          return { data: { id: "deployment-1", page_url: "https://example.github.io/" } };
        }
        if (route.endsWith("/cancel")) return { data: {} };
        if (route.startsWith("GET") && route.endsWith("/{deploymentId}")) {
          assert.equal(args.deploymentId, "deployment-1");
          const state = states[Math.min(cursor++, states.length - 1)];
          if (state instanceof Error) throw state;
          return { data: { status: state } };
        }
        throw new Error("Unexpected API route: " + route);
      }
    }
  };
  return {
    options, calls, messages, outputs,
    get elapsed() { return elapsed; },
    get identityCalls() { return identityCalls; },
    get cancels() { return calls.filter((x) => x.route.endsWith("/cancel")).length; },
    get creates() { return calls.filter((x) => x.route === "POST /repos/{owner}/{repo}/pages/deployments").length; }
  };
}

const httpError = (status) => Object.assign(new Error("test request failed"), { status });

test("queued deployment can succeed after the former ten minute cap", async () => {
  const s = scenario([...Array(11).fill("deployment_queued"), "updating_pages", "succeed"]);
  const result = await deployPages({ ...s.options, intervalMs: 60000 });
  assert.equal(s.elapsed, 12 * 60000);
  assert.equal(result.status, "succeed");
  assert.equal(s.creates, 1);
  assert.equal(s.cancels, 0);
  assert.deepEqual(s.outputs, [{ name: "page_url", value: "https://example.github.io/" }]);
  assert.ok(!s.messages.join("\n").includes("test-oidc-token"));
});

test("incomplete and temporary statuses do not count as success", async () => {
  const s = scenario(["", "unknown_status", "deployment_attempt_error", "succeed"]);
  await deployPages(s.options);
  assert.equal(s.elapsed, 45000);
  assert.equal(s.outputs.length, 1);
});

test("terminal content failure stops without announcing success or canceling a final result", async () => {
  const s = scenario(["deployment_content_failed"]);
  await assert.rejects(deployPages(s.options), /terminal failure/);
  assert.equal(s.outputs.length, 0);
  assert.equal(s.cancels, 0);
});

test("a stalled deployment is canceled once at the actual thirty minute deadline", async () => {
  const s = scenario(["updating_pages"]);
  await assert.rejects(deployPages({ ...s.options, intervalMs: 60000 }), /within 30 minutes/);
  assert.equal(s.elapsed, 30 * 60000);
  assert.equal(s.cancels, 1);
  assert.equal(s.outputs.length, 0);
});

test("temporary API failures recover without submitting a duplicate deployment", async () => {
  const s = scenario([httpError(503), httpError(429), "succeed"]);
  await deployPages(s.options);
  assert.equal(s.creates, 1);
  assert.equal(s.cancels, 0);
});

test("authorization failure stops immediately and cancels the pending deployment", async () => {
  const s = scenario([httpError(403)]);
  await assert.rejects(deployPages(s.options), /HTTP 403/);
  assert.equal(s.elapsed, 0);
  assert.equal(s.cancels, 1);
  assert.equal(s.outputs.length, 0);
});

test("repeated API failures are bounded even when the deadline is longer", async () => {
  const s = scenario([httpError(503)]);
  await assert.rejects(deployPages(s.options), /ten consecutive/);
  assert.equal(s.cancels, 1);
  assert.equal(s.elapsed, 9 * 15000);
});

test("missing or ambiguous artifacts fail before identity or deployment writes", async () => {
  for (const artifacts of [[], [
    { id: 7, name: "github-pages", size_in_bytes: 100, expired: false },
    { id: 8, name: "github-pages", size_in_bytes: 100, expired: false }
  ]]) {
    const s = scenario(["succeed"], artifacts);
    await assert.rejects(deployPages(s.options), /Expected one/);
    assert.equal(s.identityCalls, 0);
    assert.equal(s.creates, 0);
  }
});

test("expired or oversized artifact cannot be deployed", async () => {
  for (const artifact of [
    { id: 7, name: "github-pages", size_in_bytes: 100, expired: true },
    { id: 7, name: "github-pages", size_in_bytes: 1073741825, expired: false }
  ]) {
    const s = scenario(["succeed"], [artifact]);
    await assert.rejects(deployPages(s.options));
    assert.equal(s.identityCalls, 0);
    assert.equal(s.creates, 0);
  }
});
