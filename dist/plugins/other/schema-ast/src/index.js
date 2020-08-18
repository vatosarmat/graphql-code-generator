import { printSchema } from 'graphql';
import { removeFederation } from '@graphql-codegen/plugin-helpers';
import { extname } from 'path';
import { printSchemaWithDirectives } from '@graphql-tools/utils';
export const plugin = async (schema, _documents, { commentDescriptions = false, includeDirectives = false, federation }) => {
    const outputSchema = federation ? removeFederation(schema) : schema;
    if (includeDirectives) {
        return printSchemaWithDirectives(outputSchema);
    }
    return printSchema(outputSchema, { commentDescriptions: commentDescriptions });
};
export const validate = async (_schema, _documents, _config, outputFile, allPlugins) => {
    const singlePlugin = allPlugins.length === 1;
    if (singlePlugin && extname(outputFile) !== '.graphql') {
        throw new Error(`Plugin "schema-ast" requires extension to be ".graphql"!`);
    }
};
//# sourceMappingURL=index.js.map