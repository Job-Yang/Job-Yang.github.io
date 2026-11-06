const FINAL_FAILURES = new Set([
  "deployment_failed", "deployment_content_failed", "deployment_cancelled", "deployment_lost"
]);
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Use the official Pages APIs, with a bounded wait that includes the service queue.
// GitHub masks the OIDC token returned by core.getIDToken(); never log request payloads.
module.exports = async function deployPages({
  github, context, core, now = Date.now, wait = delay,
  timeoutMs = 30 * 60 * 1000, intervalMs = 15 * 1000
}) {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || !Number.isFinite(intervalMs) || intervalMs <= 0) {
    throw new Error("Pages timeout and polling interval must be positive finite values.");
  }
  const { owner, repo } = context.repo;
  const artifacts = await github.paginate(github.rest.actions.listWorkflowRunArtifacts, {
    owner, repo, run_id: context.runId
  });
  const candidates = artifacts.filter((item) => item.name === "github-pages" && !item.expired);
  if (candidates.length !== 1) {
    throw new Error(`Expected one current github-pages artifact; found ${candidates.length}.`);
  }
  const artifact = candidates[0];
  if (!artifact.id || !Number.isFinite(artifact.size_in_bytes) || artifact.size_in_bytes <= 0 || artifact.size_in_bytes > 1073741824) {
    throw new Error("Pages artifact must be present, nonempty and within the 1 GB site limit.");
  }
  const oidcToken = await core.getIDToken();
  const { data: deployment } = await github.request("POST /repos/{owner}/{repo}/pages/deployments", {
    owner, repo, artifact_id: artifact.id,
    pages_build_version: context.sha, oidc_token: oidcToken
  });
  const deploymentId = String(deployment.id || deployment.status_url?.split("/").pop() || context.sha);
  if (!/^[a-zA-Z0-9._-]+$/.test(deploymentId)) {
    throw new Error("Pages returned an invalid deployment ID.");
  }
  const deadline = now() + timeoutMs;
  let pending = true;
  let previousStatus;
  let consecutiveErrors = 0;
  const cancel = async () => {
    if (!pending) return;
    pending = false;
    try {
      await github.request("POST /repos/{owner}/{repo}/pages/deployments/{deploymentId}/cancel", {
        owner, repo, deploymentId
      });
      core.info("Canceled the pending Pages deployment.");
    } catch {
      core.warning("Unable to confirm Pages cancellation; inspect the deployment before starting another.");
    }
  };
  core.info(`Deploying artifact ${artifact.id} for ${context.sha}; wait limit ${timeoutMs / 60000} minutes.`);
  try {
    while (now() < deadline) {
      let data;
      try {
        ({ data } = await github.request("GET /repos/{owner}/{repo}/pages/deployments/{deploymentId}", {
          owner, repo, deploymentId
        }));
        consecutiveErrors = 0;
      } catch (error) {
        const status = Number(error.status) || 0;
        if (status === 401 || status === 403 || (status >= 400 && status < 500 && status !== 404 && status !== 429)) {
          throw new Error(`Pages status request rejected (HTTP ${status}).`);
        }
        consecutiveErrors++;
        if (consecutiveErrors >= 10) {
          throw new Error("Pages status could not be checked after ten consecutive request failures.");
        }
        core.warning(`Pages status request failed (HTTP ${status || "network"}); retrying within the wait limit.`);
        await wait(Math.min(intervalMs, Math.max(0, deadline - now())));
        continue;
      }
      if (data.status !== previousStatus) {
        core.info(`Pages deployment status: ${data.status || "not yet reported"}`);
        previousStatus = data.status;
      }
      if (data.status === "succeed") {
        pending = false;
        let url = deployment.page_url;
        if (!url) {
          const { data: pages } = await github.request("GET /repos/{owner}/{repo}/pages", { owner, repo });
          url = pages.html_url;
        }
        core.setOutput("page_url", url);
        core.info("Pages confirmed deployment success.");
        return { deploymentId, page_url: url, status: "succeed" };
      }
      if (FINAL_FAILURES.has(data.status)) {
        pending = false;
        throw new Error(`Pages reported a terminal failure: ${data.status}.`);
      }
      await wait(Math.min(intervalMs, Math.max(0, deadline - now())));
    }
    throw new Error(`Pages did not finish within ${timeoutMs / 60000} minutes; last status: ${previousStatus || "unknown"}.`);
  } catch (error) {
    await cancel();
    throw error;
  }
};
