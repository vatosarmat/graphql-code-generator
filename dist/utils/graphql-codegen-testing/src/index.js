import { oneLine, stripIndent } from 'common-tags';
import { resolve } from 'path';
import { existsSync } from 'fs';
import diff from 'jest-diff';
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
export function useMonorepo({ dirname }) {
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
export * from './typescript';
//# sourceMappingURL=index.js.map