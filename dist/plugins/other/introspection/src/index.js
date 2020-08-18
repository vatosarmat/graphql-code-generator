import { introspectionFromSchema } from 'graphql';
import { removeFederation } from '@graphql-codegen/plugin-helpers';
import { extname } from 'path';
export const plugin = async (schema, _documents, pluginConfig) => {
    const cleanSchema = pluginConfig.federation ? removeFederation(schema) : schema;
    const introspection = introspectionFromSchema(cleanSchema, { descriptions: true });
    return pluginConfig.minify ? JSON.stringify(introspection) : JSON.stringify(introspection, null, 2);
};
export const validate = async (schema, documents, config, outputFile) => {
    if (extname(outputFile) !== '.json') {
        throw new Error(`Plugin "introspection" requires extension to be ".json"!`);
    }
};
//# sourceMappingURL=index.js.map