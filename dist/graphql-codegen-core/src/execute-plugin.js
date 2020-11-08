import { DetailedError } from '@graphql-codegen/plugin-helpers';
import { buildASTSchema } from 'graphql';
export async function executePlugin(options, plugin) {
    if (!plugin || !plugin.plugin || typeof plugin.plugin !== 'function') {
        throw new DetailedError(`Invalid Custom Plugin "${options.name}"`, `
        Plugin ${options.name} does not export a valid JS object with "plugin" function.
  
        Make sure your custom plugin is written in the following form:
  
        module.exports = {
          plugin: (schema, documents, config) => {
            return 'my-custom-plugin-content';
          },
        };
        `);
    }
    const outputSchema = options.schemaAst || buildASTSchema(options.schema, options.config);
    const documents = options.documents || [];
    const pluginContext = options.pluginContext || {};
    if (plugin.validate && typeof plugin.validate === 'function') {
        try {
            // FIXME: Sync validate signature with plugin signature
            await plugin.validate(outputSchema, documents, options.config, options.outputFilename, options.allPlugins, pluginContext);
        }
        catch (e) {
            throw new DetailedError(`Plugin "${options.name}" validation failed:`, `
            ${e.message}
          `);
        }
    }
    return Promise.resolve(plugin.plugin(outputSchema, documents, typeof options.config === 'object' ? { ...options.config } : options.config, {
        outputFile: options.outputFilename,
        allPlugins: options.allPlugins,
        pluginContext,
    }));
}
//# sourceMappingURL=execute-plugin.js.map