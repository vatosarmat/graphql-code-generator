'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

const graphql = require('graphql');
const path = require('path');
const visitorPluginCommon = require('@graphql-codegen/visitor-plugin-common');
const autoBind = _interopDefault(require('auto-bind'));

class TypeScriptDocumentNodesVisitor extends visitorPluginCommon.ClientSideBaseVisitor {
    constructor(schema, fragments, rawConfig, documents) {
        super(schema, fragments, {
            documentMode: visitorPluginCommon.DocumentMode.documentNodeImportFragments,
            documentNodeImport: '@graphql-typed-document-node/core#TypedDocumentNode',
            ...rawConfig,
        }, {}, documents);
        autoBind(this);
        // We need to make sure it's there because in this mode, the base plugin doesn't add the import
        if (this.config.documentMode === visitorPluginCommon.DocumentMode.graphQLTag) {
            const documentNodeImport = this._parseImport(this.config.documentNodeImport || 'graphql#DocumentNode');
            const tagImport = this._generateImport(documentNodeImport, 'DocumentNode', true);
            this._imports.add(tagImport);
        }
    }
    getDocumentNodeSignature(resultType, variablesTypes, node) {
        if (this.config.documentMode === visitorPluginCommon.DocumentMode.documentNode ||
            this.config.documentMode === visitorPluginCommon.DocumentMode.documentNodeImportFragments ||
            this.config.documentMode === visitorPluginCommon.DocumentMode.graphQLTag) {
            return `: DocumentNode<${resultType}, ${variablesTypes}>`;
        }
        return super.getDocumentNodeSignature(resultType, variablesTypes, node);
    }
}

const plugin = (schema, documents, config) => {
    const allAst = graphql.concatAST(documents.map(v => v.document));
    const allFragments = [
        ...allAst.definitions.filter(d => d.kind === graphql.Kind.FRAGMENT_DEFINITION).map(fragmentDef => ({
            node: fragmentDef,
            name: fragmentDef.name.value,
            onType: fragmentDef.typeCondition.name.value,
            isExternal: false,
        })),
        ...(config.externalFragments || []),
    ];
    const visitor = new TypeScriptDocumentNodesVisitor(schema, allFragments, config, documents);
    const visitorResult = graphql.visit(allAst, { leave: visitor });
    return {
        prepend: visitor.getImports(),
        content: [visitor.fragments, ...visitorResult.definitions.filter(t => typeof t === 'string')].join('\n'),
    };
};
const validate = async (schema, documents, config, outputFile) => {
    if (config && config.documentMode === visitorPluginCommon.DocumentMode.string) {
        throw new Error(`Plugin "typed-document-node" does not allow using 'documentMode: string' configuration!`);
    }
    if (path.extname(outputFile) !== '.ts' && path.extname(outputFile) !== '.tsx') {
        throw new Error(`Plugin "typed-document-node" requires extension to be ".ts" or ".tsx"!`);
    }
};

exports.plugin = plugin;
exports.validate = validate;
//# sourceMappingURL=index.cjs.js.map
