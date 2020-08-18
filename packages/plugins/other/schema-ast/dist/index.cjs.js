'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

const graphql = require('graphql');
const pluginHelpers = require('@graphql-codegen/plugin-helpers');
const path = require('path');
const utils = require('@graphql-tools/utils');

const plugin = async (schema, _documents, { commentDescriptions = false, includeDirectives = false, federation }) => {
    const outputSchema = federation ? pluginHelpers.removeFederation(schema) : schema;
    if (includeDirectives) {
        return utils.printSchemaWithDirectives(outputSchema);
    }
    return graphql.printSchema(outputSchema, { commentDescriptions: commentDescriptions });
};
const validate = async (_schema, _documents, _config, outputFile, allPlugins) => {
    const singlePlugin = allPlugins.length === 1;
    if (singlePlugin && path.extname(outputFile) !== '.graphql') {
        throw new Error(`Plugin "schema-ast" requires extension to be ".graphql"!`);
    }
};

exports.plugin = plugin;
exports.validate = validate;
//# sourceMappingURL=index.cjs.js.map
