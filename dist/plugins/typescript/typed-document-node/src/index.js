import { visit, concatAST, Kind } from 'graphql';
import { extname } from 'path';
import { DocumentMode } from '@graphql-codegen/visitor-plugin-common';
import { TypeScriptDocumentNodesVisitor } from './visitor';
export const plugin = (schema, documents, config) => {
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
export const validate = async (schema, documents, config, outputFile) => {
    if (config && config.documentMode === DocumentMode.string) {
        throw new Error(`Plugin "typed-document-node" does not allow using 'documentMode: string' configuration!`);
    }
    if (extname(outputFile) !== '.ts' && extname(outputFile) !== '.tsx') {
        throw new Error(`Plugin "typed-document-node" requires extension to be ".ts" or ".tsx"!`);
    }
};
//# sourceMappingURL=index.js.map