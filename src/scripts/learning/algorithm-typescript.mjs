import ts from 'typescript';

function formatDiagnostic(diagnostic) {
  const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
  if (!diagnostic.file || diagnostic.start === undefined) {
    return `TS${diagnostic.code}: ${message}`;
  }

  const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
  return `第 ${line + 1} 行，第 ${character + 1} 列（TS${diagnostic.code}）：${message}`;
}

export function transpileAlgorithmTypeScript(sourceCode) {
  const result = ts.transpileModule(sourceCode, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.None,
      strict: true,
      isolatedModules: true,
      removeComments: false,
    },
    fileName: 'solution.ts',
    reportDiagnostics: true,
  });

  const errors = (result.diagnostics || []).filter(
    (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error,
  );
  if (errors.length > 0) {
    const error = new SyntaxError(
      `TypeScript 编译失败：\n${errors.slice(0, 5).map(formatDiagnostic).join('\n')}`,
    );
    error.name = 'TypeScriptCompileError';
    throw error;
  }

  return result.outputText.replace(/^"use strict";\s*/, '').trim();
}
