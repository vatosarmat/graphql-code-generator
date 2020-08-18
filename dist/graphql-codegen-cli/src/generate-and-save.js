import { lifecycleHooks } from './hooks';
import { executeCodegen } from './codegen';
import { createWatcher } from './utils/watcher';
import { fileExists, readSync, writeSync, unlinkFile } from './utils/file-system';
import { sync as mkdirpSync } from 'mkdirp';
import { dirname, join, isAbsolute } from 'path';
import { debugLog } from './utils/debugging';
import { ensureContext } from './config';
import { createHash } from 'crypto';
const hash = (content) => createHash('sha1').update(content).digest('base64');
export async function generate(input, saveToFile = true) {
    const context = ensureContext(input);
    const config = context.getConfig();
    await lifecycleHooks(config.hooks).afterStart();
    let previouslyGeneratedFilenames = [];
    function removeStaleFiles(config, generationResult) {
        const filenames = generationResult.map(o => o.filename);
        // find stale files from previous build which are not present in current build
        const staleFilenames = previouslyGeneratedFilenames.filter(f => !filenames.includes(f));
        staleFilenames.forEach(filename => {
            if (shouldOverwrite(config, filename)) {
                unlinkFile(filename, err => {
                    const prettyFilename = filename.replace(`${input.cwd || process.cwd()}/`, '');
                    if (err) {
                        debugLog(`Cannot remove stale file: ${prettyFilename}\n${err}`);
                    }
                    else {
                        debugLog(`Removed stale file: ${prettyFilename}`);
                    }
                });
            }
        });
        previouslyGeneratedFilenames = filenames;
    }
    const recentOutputHash = new Map();
    async function writeOutput(generationResult) {
        if (!saveToFile) {
            return generationResult;
        }
        if (config.watch) {
            removeStaleFiles(config, generationResult);
        }
        await lifecycleHooks(config.hooks).beforeAllFileWrite(generationResult.map(r => r.filename));
        await Promise.all(generationResult.map(async (result) => {
            const exists = fileExists(result.filename);
            if (!shouldOverwrite(config, result.filename) && exists) {
                return;
            }
            const content = result.content || '';
            const currentHash = hash(content);
            let previousHash = recentOutputHash.get(result.filename);
            if (!previousHash && exists) {
                previousHash = hash(readSync(result.filename));
            }
            if (previousHash && currentHash === previousHash) {
                debugLog(`Skipping file (${result.filename}) writing due to indentical hash...`);
                return;
            }
            if (content.length === 0) {
                return;
            }
            recentOutputHash.set(result.filename, currentHash);
            const basedir = dirname(result.filename);
            await lifecycleHooks(result.hooks).beforeOneFileWrite(result.filename);
            await lifecycleHooks(config.hooks).beforeOneFileWrite(result.filename);
            mkdirpSync(basedir);
            const absolutePath = isAbsolute(result.filename)
                ? result.filename
                : join(input.cwd || process.cwd(), result.filename);
            writeSync(absolutePath, result.content);
            await lifecycleHooks(result.hooks).afterOneFileWrite(result.filename);
            await lifecycleHooks(config.hooks).afterOneFileWrite(result.filename);
        }));
        await lifecycleHooks(config.hooks).afterAllFileWrite(generationResult.map(r => r.filename));
        return generationResult;
    }
    // watch mode
    if (config.watch) {
        return createWatcher(context, writeOutput);
    }
    const outputFiles = await executeCodegen(context);
    await writeOutput(outputFiles);
    lifecycleHooks(config.hooks).beforeDone();
    return outputFiles;
}
function shouldOverwrite(config, outputPath) {
    const globalValue = config.overwrite === undefined ? true : !!config.overwrite;
    const outputConfig = config.generates[outputPath];
    if (!outputConfig) {
        debugLog(`Couldn't find a config of ${outputPath}`);
        return globalValue;
    }
    if (isConfiguredOutput(outputConfig) && typeof outputConfig.overwrite === 'boolean') {
        return outputConfig.overwrite;
    }
    return globalValue;
}
function isConfiguredOutput(output) {
    return typeof output.plugins !== 'undefined';
}
//# sourceMappingURL=generate-and-save.js.map