'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

const graphql = require('graphql');
const autoBind = _interopDefault(require('auto-bind'));
const visitorPluginCommon = require('@graphql-codegen/visitor-plugin-common');

class TypeScriptDocumentNodesVisitor extends visitorPluginCommon.ClientSideBaseVisitor {
    constructor(schema, fragments, rawConfig, documents) {
        const additionalConfig = {
            documentVariablePrefix: visitorPluginCommon.getConfigValue(rawConfig.namePrefix, ''),
            documentVariableSuffix: visitorPluginCommon.getConfigValue(rawConfig.nameSuffix, ''),
            fragmentVariablePrefix: visitorPluginCommon.getConfigValue(rawConfig.fragmentPrefix, ''),
            fragmentVariableSuffix: visitorPluginCommon.getConfigValue(rawConfig.fragmentSuffix, ''),
        };
        super(schema, fragments, rawConfig, additionalConfig, documents);
        autoBind(this);
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
    if (!outputFile.endsWith('.ts')) {
        throw new Error(`Plugin "typescript-document-nodes" requires extension to be ".ts"!`);
    }
};

exports.plugin = plugin;
exports.validate = validate;
//# sourceMappingURL=index.cjs.js.map
