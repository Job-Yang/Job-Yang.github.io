import { executeAlgorithmCode } from './algorithm-executor-core.mjs';

self.addEventListener('message', (event) => {
  const { id, code, runner, input } = event.data || {};
  try {
    const result = executeAlgorithmCode(code, runner, input);
    self.postMessage({ id, ok: true, result });
  } catch (error) {
    self.postMessage({
      id,
      ok: false,
      error: {
        name: error?.name || 'Error',
        message: error?.message || String(error),
        stack: error?.stack || '',
      },
    });
  }
});
