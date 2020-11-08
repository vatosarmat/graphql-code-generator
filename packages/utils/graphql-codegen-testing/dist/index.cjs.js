'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

const commonTags = require('common-tags');
const path = require('path');
const fs = require('fs');
const diff = _interopDefault(require('jest-diff'));
const typescript = require('typescript');
const open = _interopDefault(require('open'));

const { compressToEncodedURIComponent } = require('lz-string');
function validateTs(pluginOutput, options = {
    noEmitOnError: true,
    noImplicitAny: true,
    moduleResolution: typescript.ModuleResolutionKind.NodeJs,
    experimentalDecorators: true,
    emitDecoratorMetadata: true,
    target: typescript.ScriptTarget.ES5,
    typeRoots: [path.resolve(require.resolve('typescript'), '../../../@types/')],
    jsx: typescript.JsxEmit.Preserve,
    allowJs: true,
    lib: [
        path.join(path.dirname(require.resolve('typescript')), 'lib.es5.d.ts'),
        path.join(path.dirname(require.resolve('typescript')), 'lib.es6.d.ts'),
        path.join(path.dirname(require.resolve('typescript')), 'lib.dom.d.ts'),
        path.join(path.dirname(require.resolve('typescript')), 'lib.scripthost.d.ts'),
        path.join(path.dirname(require.resolve('typescript')), 'lib.es2015.d.ts'),
        path.join(path.dirname(require.resolve('typescript')), 'lib.esnext.asynciterable.d.ts'),
    ],
    module: typescript.ModuleKind.ESNext,
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
        const result = typescript.createSourceFile(testFile, contents, typescript.ScriptTarget.ES2016, false, isTsx ? typescript.ScriptKind.TSX : undefined);
        const allDiagnostics = result.parseDiagnostics;
        if (allDiagnostics && allDiagnostics.length > 0) {
            const errors = [];
            allDiagnostics.forEach(diagnostic => {
                if (diagnostic.file) {
                    const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
                    const message = typescript.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
                    errors.push(`${line + 1},${character + 1}: ${message} ->
    ${contents.split('\n')[line]}`);
                }
                else {
                    errors.push(`${typescript.flattenDiagnosticMessageText(diagnostic.messageText, '\n')}`);
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
    moduleResolution: typescript.ModuleResolutionKind.NodeJs,
    allowSyntheticDefaultImports: true,
    experimentalDecorators: true,
    emitDecoratorMetadata: true,
    target: typescript.ScriptTarget.ES5,
    typeRoots: [path.resolve(require.resolve('typescript'), '../../../@types/')],
    jsx: typescript.JsxEmit.Preserve,
    allowJs: true,
    lib: [
        path.join(path.dirname(require.resolve('typescript')), 'lib.es5.d.ts'),
        path.join(path.dirname(require.resolve('typescript')), 'lib.es6.d.ts'),
        path.join(path.dirname(require.resolve('typescript')), 'lib.dom.d.ts'),
        path.join(path.dirname(require.resolve('typescript')), 'lib.scripthost.d.ts'),
        path.join(path.dirname(require.resolve('typescript')), 'lib.es2015.d.ts'),
        path.join(path.dirname(require.resolve('typescript')), 'lib.esnext.asynciterable.d.ts'),
    ],
    module: typescript.ModuleKind.ESNext,
}, isTsx = false, openPlayground = false) {
    if (process.env.SKIP_VALIDATION) {
        return;
    }
    try {
        const testFile = `test-file.${isTsx ? 'tsx' : 'ts'}`;
        const host = typescript.createCompilerHost(options);
        const program = typescript.createProgram([testFile], options, {
            ...host,
            getSourceFile: (fileName, languageVersion, onError, shouldCreateNewSourceFile) => {
                if (fileName === testFile) {
                    return typescript.createSourceFile(fileName, contents, options.target);
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
                const message = typescript.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
                errors.push(`${line + 1},${character + 1}: ${message} ->
  ${contents.split('\n')[line]}`);
            }
            else {
                errors.push(`${typescript.flattenDiagnosticMessageText(diagnostic.messageText, '\n')}`);
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
        const strippedReceived = commonTags.oneLine `${received}`.replace(/\s\s+/g, ' ');
        const strippedExpected = commonTags.oneLine `${expected}`.replace(/\s\s+/g, ' ');
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
            const diffString = diff(commonTags.stripIndent `${expected}`, commonTags.stripIndent `${received}`, {
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
    const stopDir = path.resolve(cwd, '..');
    while (dirname !== stopDir) {
        try {
            if (fs.existsSync(path.resolve(dirname, 'package.json'))) {
                return dirname;
            }
            dirname = path.resolve(dirname, '..');
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

exports.compileTs = compileTs;
exports.useMonorepo = useMonorepo;
exports.validateTs = validateTs;
//# sourceMappingURL=index.cjs.js.map
