import { cosmiconfig, defaultLoaders } from 'cosmiconfig';
import { resolve } from 'path';
import { DetailedError } from '@graphql-codegen/plugin-helpers';
import { env } from 'string-env-interpolation';
import yargs from 'yargs';
import { findAndLoadGraphQLConfig } from './graphql-config';
import { loadSchema, loadDocuments } from './load';
function generateSearchPlaces(moduleName) {
    const extensions = ['json', 'yaml', 'yml', 'js', 'config.js'];
    // gives codegen.json...
    const regular = extensions.map(ext => `${moduleName}.${ext}`);
    // gives .codegenrc.json... but no .codegenrc.config.js
    const dot = extensions.filter(ext => ext !== 'config.js').map(ext => `.${moduleName}rc.${ext}`);
    return regular.concat(dot);
}
function customLoader(ext) {
    function loader(filepath, content) {
        if (typeof process !== 'undefined' && 'env' in process) {
            content = env(content);
        }
        if (ext === 'json') {
            return defaultLoaders['.json'](filepath, content);
        }
        if (ext === 'yaml') {
            return defaultLoaders['.yaml'](filepath, content);
        }
        if (ext === 'js') {
            return defaultLoaders['.js'](filepath, content);
        }
    }
    return loader;
}
export async function loadContext(configFilePath) {
    const moduleName = 'codegen';
    const cosmi = cosmiconfig(moduleName, {
        searchPlaces: generateSearchPlaces(moduleName),
        loaders: {
            '.json': customLoader('json'),
            '.yaml': customLoader('yaml'),
            '.yml': customLoader('yaml'),
            '.js': customLoader('js'),
            noExt: customLoader('yaml'),
        },
    });
    const graphqlConfig = await findAndLoadGraphQLConfig(configFilePath);
    if (graphqlConfig) {
        return new CodegenContext({
            graphqlConfig,
        });
    }
    const result = await (configFilePath ? cosmi.load(configFilePath) : cosmi.search(process.cwd()));
    if (!result) {
        if (configFilePath) {
            throw new DetailedError(`Config ${configFilePath} does not exist`, `
        Config ${configFilePath} does not exist.
  
          $ graphql-codegen --config ${configFilePath}
  
        Please make sure the --config points to a correct file.
      `);
        }
        throw new DetailedError(`Unable to find Codegen config file!`, `
        Please make sure that you have a configuration file under the current directory! 
      `);
    }
    if (result.isEmpty) {
        throw new DetailedError(`Found Codegen config file but it was empty!`, `
        Please make sure that you have a valid configuration file under the current directory!
      `);
    }
    return new CodegenContext({
        filepath: result.filepath,
        config: result.config,
    });
}
function getCustomConfigPath(cliFlags) {
    const configFile = cliFlags.config;
    return configFile ? resolve(process.cwd(), configFile) : null;
}
export function buildOptions() {
    return {
        c: {
            alias: 'config',
            type: 'string',
            describe: 'Path to GraphQL codegen YAML config file, defaults to "codegen.yml" on the current directory',
        },
        w: {
            alias: 'watch',
            describe: 'Watch for changes and execute generation automatically. You can also specify a glob expreession for custom watch list.',
            coerce: (watch) => {
                if (watch === 'false') {
                    return false;
                }
                if (typeof watch === 'string' || Array.isArray(watch)) {
                    return watch;
                }
                return true;
            },
        },
        r: {
            alias: 'require',
            describe: 'Loads specific require.extensions before running the codegen and reading the configuration',
            type: 'array',
            default: [],
        },
        o: {
            alias: 'overwrite',
            describe: 'Overwrites existing files',
            type: 'boolean',
        },
        s: {
            alias: 'silent',
            describe: 'Suppresses printing errors',
            type: 'boolean',
        },
        p: {
            alias: 'project',
            describe: 'Name of a project in GraphQL Config',
            type: 'string',
        },
    };
}
export function parseArgv(argv = process.argv) {
    return yargs.options(buildOptions()).parse(argv);
}
export async function createContext(cliFlags = parseArgv(process.argv)) {
    if (cliFlags.require && cliFlags.require.length > 0) {
        await Promise.all(cliFlags.require.map(mod => import(mod)));
    }
    const customConfigPath = getCustomConfigPath(cliFlags);
    const context = await loadContext(customConfigPath);
    updateContextWithCliFlags(context, cliFlags);
    return context;
}
export function updateContextWithCliFlags(context, cliFlags) {
    const config = {
        configFilePath: context.filepath,
    };
    if (cliFlags.watch) {
        config.watch = cliFlags.watch;
    }
    if (cliFlags.overwrite === true) {
        config.overwrite = cliFlags.overwrite;
    }
    if (cliFlags.silent === true) {
        config.silent = cliFlags.silent;
    }
    if (cliFlags.project) {
        context.useProject(cliFlags.project);
    }
    context.updateConfig(config);
}
export class CodegenContext {
    constructor({ config, graphqlConfig, filepath, }) {
        this._pluginContext = {};
        this._config = config;
        this._graphqlConfig = graphqlConfig;
        this.filepath = this._graphqlConfig ? this._graphqlConfig.filepath : filepath;
        this.cwd = this._graphqlConfig ? this._graphqlConfig.dirpath : process.cwd();
    }
    useProject(name) {
        this._project = name;
    }
    getConfig() {
        if (!this.config) {
            if (this._graphqlConfig) {
                const project = this._graphqlConfig.getProject(this._project);
                this.config = {
                    ...project.extension('codegen'),
                    schema: project.schema,
                    documents: project.documents,
                    pluginContext: this._pluginContext,
                };
            }
            else {
                this.config = { ...this._config, pluginContext: this._pluginContext };
            }
        }
        return this.config;
    }
    updateConfig(config) {
        this.config = {
            ...this.getConfig(),
            ...config,
        };
    }
    getPluginContext() {
        return this._pluginContext;
    }
    async loadSchema(pointer) {
        if (this._graphqlConfig) {
            // TODO: SchemaWithLoader won't work here
            return this._graphqlConfig.getProject(this._project).loadSchema(pointer);
        }
        return loadSchema(pointer, this.getConfig());
    }
    async loadDocuments(pointer) {
        if (this._graphqlConfig) {
            // TODO: pointer won't work here
            const documents = await this._graphqlConfig.getProject(this._project).loadDocuments(pointer);
            return documents;
        }
        return loadDocuments(pointer, this.getConfig());
    }
}
export function ensureContext(input) {
    return input instanceof CodegenContext ? input : new CodegenContext({ config: input });
}
//# sourceMappingURL=config.js.map