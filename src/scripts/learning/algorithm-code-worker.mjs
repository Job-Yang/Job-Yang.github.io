import { executeAlgorithmCode } from './algorithm-executor-core.mjs';
import { transpileAlgorithmTypeScript } from './algorithm-typescript.mjs';

self.postMessage({ type: 'ready' });

self.addEventListener('message', (event) => {
  const { id, code, runner, input } = event.data || {};
  try {
    const javascript = transpileAlgorithmTypeScript(code);
    const result = executeAlgorithmCode(javascript, runner, input);
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
