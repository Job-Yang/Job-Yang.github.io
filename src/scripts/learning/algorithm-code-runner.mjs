const DEFAULT_TIMEOUT_MS = 1800;
const WORKER_LOAD_TIMEOUT_MS = 10000;
let sequence = 0;

export function runAlgorithmCode({ code, runner, input, timeoutMs = DEFAULT_TIMEOUT_MS }) {
  return new Promise((resolve, reject) => {
    const id = ++sequence;
    const worker = new Worker(
      new URL('./algorithm-code-worker.mjs', import.meta.url),
      { type: 'module' }
    );
    let executionTimeout;
    const loadTimeout = window.setTimeout(() => {
      worker.terminate();
      reject(new Error('TypeScript 执行环境加载超时，请检查网络后重试。'));
    }, WORKER_LOAD_TIMEOUT_MS);

    worker.addEventListener('message', (event) => {
      if (event.data?.type === 'ready') {
        window.clearTimeout(loadTimeout);
        executionTimeout = window.setTimeout(() => {
          worker.terminate();
          reject(new Error(`运行超过 ${timeoutMs}ms，已停止。请检查死循环或过慢逻辑。`));
        }, timeoutMs);
        worker.postMessage({ id, code, runner, input });
        return;
      }
      if (event.data?.id !== id) return;
      window.clearTimeout(executionTimeout);
      worker.terminate();
      if (event.data.ok) {
        resolve(event.data.result);
      } else {
        const error = new Error(event.data.error?.message || '代码运行失败');
        error.name = event.data.error?.name || 'Error';
        error.stack = event.data.error?.stack || '';
        reject(error);
      }
    });
    worker.addEventListener('error', (event) => {
      window.clearTimeout(loadTimeout);
      window.clearTimeout(executionTimeout);
      worker.terminate();
      reject(new Error(event.message || '代码 Worker 启动失败'));
    });
  });
}
