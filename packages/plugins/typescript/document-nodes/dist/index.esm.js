import { concatAST, Kind, visit } from 'graphql';
import autoBind from 'auto-bind';
import { ClientSideBaseVisitor, getConfigValue } from '@graphql-codegen/visitor-plugin-common';

class TypeScriptDocumentNodesVisitor extends ClientSideBaseVisitor {
    constructor(schema, fragments, rawConfig, documents) {
        const additionalConfig = {
            documentVariablePrefix: getConfigValue(rawConfig.namePrefix, ''),
            documentVariableSuffix: getConfigValue(rawConfig.nameSuffix, ''),
            fragmentVariablePrefix: getConfigValue(rawConfig.fragmentPrefix, ''),
            fragmentVariableSuffix: getConfigValue(rawConfig.fragmentSuffix, ''),
        };
        super(schema, fragments, rawConfig, additionalConfig, documents);
        autoBind(this);
    }
}

const plugin = (schema, documents, config) => {
    const allAst = concatAST(documents.map(v => v.document));
    const allFragments = [
        ...allAst.definitions.filter(d => d.kind === Kind.FRAGMENT_DEFINITION).map(fragmentDef => ({
            node: fragmentDef,
            name: fragmentDef.name.value,
            onType: fragmentDef.typeCondition.name.value,
            isExternal: false,
        })),
        ...(config.externalFragments || []),
    ];
    const visitor = new TypeScriptDocumentNodesVisitor(schema, allFragments, config, documents);
    const visitorResult = visit(allAst, { leave: visitor });
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

export { plugin, validate };
//# sourceMappingURL=index.esm.js.map
