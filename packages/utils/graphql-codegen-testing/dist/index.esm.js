import { oneLine, stripIndent } from 'common-tags';
import { resolve, join, dirname } from 'path';
import { existsSync } from 'fs';
import diff from 'jest-diff';
import { ModuleResolutionKind, ScriptTarget, JsxEmit, ModuleKind, createSourceFile, ScriptKind, flattenDiagnosticMessageText, createCompilerHost, createProgram } from 'typescript';
import open from 'open';

const { compressToEncodedURIComponent } = require('lz-string');
function validateTs(pluginOutput, options = {
    noEmitOnError: true,
    noImplicitAny: true,
    moduleResolution: ModuleResolutionKind.NodeJs,
    experimentalDecorators: true,
    emitDecoratorMetadata: true,
    target: ScriptTarget.ES5,
    typeRoots: [resolve(require.resolve('typescript'), '../../../@types/')],
    jsx: JsxEmit.Preserve,
    allowJs: true,
    lib: [
        join(dirname(require.resolve('typescript')), 'lib.es5.d.ts'),
        join(dirname(require.resolve('typescript')), 'lib.es6.d.ts'),
        join(dirname(require.resolve('typescript')), 'lib.dom.d.ts'),
        join(dirname(require.resolve('typescript')), 'lib.scripthost.d.ts'),
        join(dirname(require.resolve('typescript')), 'lib.es2015.d.ts'),
        join(dirname(require.resolve('typescript')), 'lib.esnext.asynciterable.d.ts'),
    ],
    module: ModuleKind.ESNext,
}, isTsx = false, isStrict = false, openPlayground = false) {
    if (process.env.SKIP_VALIDATION) {
        return;
    }
    if (isStrict) {
        options.strictNullChecks = true;
        options.strict = true;
        options.strictBindCallApply = true;
        options.strictPropertyInitialization = true;
        options.alwaysStrict = true;
        options.strictFunctionTypes = true;
    }
    const contents = typeof pluginOutput === 'string'
        ? pluginOutput
        : [...(pluginOutput.prepend || []), pluginOutput.content, ...(pluginOutput.append || [])].join('\n');
    try {
        const testFile = `test-file.${isTsx ? 'tsx' : 'ts'}`;
        const result = createSourceFile(testFile, contents, ScriptTarget.ES2016, false, isTsx ? ScriptKind.TSX : undefined);
        const allDiagnostics = result.parseDiagnostics;
        if (allDiagnostics && allDiagnostics.length > 0) {
            const errors = [];
            allDiagnostics.forEach(diagnostic => {
                if (diagnostic.file) {
                    const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
                    const message = flattenDiagnosticMessageText(diagnostic.messageText, '\n');
                    errors.push(`${line + 1},${character + 1}: ${message} ->
    ${contents.split('\n')[line]}`);
                }
                else {
                    errors.push(`${flattenDiagnosticMessageText(diagnostic.messageText, '\n')}`);
                }
                const relevantErrors = errors.filter(e => !e.includes('Cannot find module'));
                if (relevantErrors && relevantErrors.length > 0) {
                    throw new Error(relevantErrors.join('\n'));
                }
            });
        }
    }
    catch (e) {
        if (openPlayground && !process.env) {
            const compressedCode = compressToEncodedURIComponent(contents);
            open('http://www.typescriptlang.org/play/#code/' + compressedCode);
        }
        throw e;
    }
}
function compileTs(contents, options = {
    noEmitOnError: true,
    noImplicitAny: true,
    moduleResolution: ModuleResolutionKind.NodeJs,
    allowSyntheticDefaultImports: true,
    experimentalDecorators: true,
    emitDecoratorMetadata: true,
    target: ScriptTarget.ES5,
    typeRoots: [resolve(require.resolve('typescript'), '../../../@types/')],
    jsx: JsxEmit.Preserve,
    allowJs: true,
    lib: [
        join(dirname(require.resolve('typescript')), 'lib.es5.d.ts'),
        join(dirname(require.resolve('typescript')), 'lib.es6.d.ts'),
        join(dirname(require.resolve('typescript')), 'lib.dom.d.ts'),
        join(dirname(require.resolve('typescript')), 'lib.scripthost.d.ts'),
        join(dirname(require.resolve('typescript')), 'lib.es2015.d.ts'),
        join(dirname(require.resolve('typescript')), 'lib.esnext.asynciterable.d.ts'),
    ],
    module: ModuleKind.ESNext,
}, isTsx = false, openPlayground = false) {
    if (process.env.SKIP_VALIDATION) {
        return;
    }
    try {
        const testFile = `test-file.${isTsx ? 'tsx' : 'ts'}`;
        const host = createCompilerHost(options);
        const program = createProgram([testFile], options, {
            ...host,
            getSourceFile: (fileName, languageVersion, onError, shouldCreateNewSourceFile) => {
                if (fileName === testFile) {
                    return createSourceFile(fileName, contents, options.target);
                }
                return host.getSourceFile(fileName, languageVersion, onError, shouldCreateNewSourceFile);
            },
            writeFile: function () { },
            useCaseSensitiveFileNames: function () {
                return false;
            },
            getCanonicalFileName: function (filename) {
                return filename;
            },
            getCurrentDirectory: function () {
                return '';
            },
            getNewLine: function () {
                return '\n';
            },
        });
        const emitResult = program.emit();
        const allDiagnostics = emitResult.diagnostics;
        const errors = [];
        allDiagnostics.forEach(diagnostic => {
            if (diagnostic.file) {
                const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
                const message = flattenDiagnosticMessageText(diagnostic.messageText, '\n');
                errors.push(`${line + 1},${character + 1}: ${message} ->
  ${contents.split('\n')[line]}`);
            }
            else {
                errors.push(`${flattenDiagnosticMessageText(diagnostic.messageText, '\n')}`);
            }
        });
        const relevantErrors = errors.filter(e => !e.includes('Cannot find module'));
        if (relevantErrors && relevantErrors.length > 0) {
            throw new Error(relevantErrors.join('\n'));
        }
    }
    catch (e) {
        if (openPlayground) {
            const compressedCode = compressToEncodedURIComponent(contents);
            open('http://www.typescriptlang.org/play/#code/' + compressedCode);
        }
        throw e;
    }
}

function compareStrings(a, b) {
    return a.includes(b);
}
expect.extend({
    toBeSimilarStringTo(received, expected) {
        const strippedReceived = oneLine `${received}`.replace(/\s\s+/g, ' ');
        const strippedExpected = oneLine `${expected}`.replace(/\s\s+/g, ' ');
        if (compareStrings(strippedReceived, strippedExpected)) {
            return {
                message: () => `expected 
   ${received}
   not to be a string containing (ignoring indents)
   ${expected}`,
                pass: true,
            };
        }
        else {
            const diffString = diff(stripIndent `${expected}`, stripIndent `${received}`, {
                expand: this.expand,
            });
            const hasExpect = diffString && diffString.includes('- Expect');
            const message = hasExpect
                ? `Difference:\n\n${diffString}`
                : `expected 
      ${received}
      to be a string containing (ignoring indents)
      ${expected}`;
            return {
                message: () => message,
                pass: false,
            };
        }
    },
});
function findProjectDir(dirname) {
    const originalDirname = dirname;
    const cwd = process.cwd();
    const stopDir = resolve(cwd, '..');
    while (dirname !== stopDir) {
        try {
            if (existsSync(resolve(dirname, 'package.json'))) {
                return dirname;
            }
            dirname = resolve(dirname, '..');
        }
        catch (e) {
            // ignore
        }
    }
    throw new Error(`Coudn't find project's root from: ${originalDirname}`);
}
function useMonorepo({ dirname }) {
    const cwd = findProjectDir(dirname);
    return {
        correctCWD() {
            let spyProcessCwd;
            beforeEach(() => {
                spyProcessCwd = jest.spyOn(process, 'cwd').mockReturnValue(cwd);
            });
            afterEach(() => {
                spyProcessCwd.mockRestore();
            });
        },
    };
}

export { compileTs, useMonorepo, validateTs };
//# sourceMappingURL=index.esm.js.map
