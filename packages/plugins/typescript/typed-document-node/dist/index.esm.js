import { concatAST, Kind, visit } from 'graphql';
import { extname } from 'path';
import { ClientSideBaseVisitor, DocumentMode } from '@graphql-codegen/visitor-plugin-common';
import autoBind from 'auto-bind';

class TypeScriptDocumentNodesVisitor extends ClientSideBaseVisitor {
    constructor(schema, fragments, rawConfig, documents) {
        super(schema, fragments, {
            documentMode: DocumentMode.documentNodeImportFragments,
            documentNodeImport: '@graphql-typed-document-node/core#TypedDocumentNode',
            ...rawConfig,
        }, {}, documents);
        autoBind(this);
        // We need to make sure it's there because in this mode, the base plugin doesn't add the import
        if (this.config.documentMode === DocumentMode.graphQLTag) {
            const documentNodeImport = this._parseImport(this.config.documentNodeImport || 'graphql#DocumentNode');
            const tagImport = this._generateImport(documentNodeImport, 'DocumentNode', true);
            this._imports.add(tagImport);
        }
    }
    getDocumentNodeSignature(resultType, variablesTypes, node) {
        if (this.config.documentMode === DocumentMode.documentNode ||
            this.config.documentMode === DocumentMode.documentNodeImportFragments ||
            this.config.documentMode === DocumentMode.graphQLTag) {
            return `: DocumentNode<${resultType}, ${variablesTypes}>`;
        }
        return super.getDocumentNodeSignature(resultType, variablesTypes, node);
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
        prepend: allAst.definitions.length === 0 ? [] : visitor.getImports(),
        content: [visitor.fragments, ...visitorResult.definitions.filter(t => typeof t === 'string')].join('\n'),
    };
};
const validate = async (schema, documents, config, outputFile) => {
    if (config && config.documentMode === DocumentMode.string) {
        throw new Error(`Plugin "typed-document-node" does not allow using 'documentMode: string' configuration!`);
    }
    if (extname(outputFile) !== '.ts' && extname(outputFile) !== '.tsx') {
        throw new Error(`Plugin "typed-document-node" requires extension to be ".ts" or ".tsx"!`);
    }
};

export { plugin, validate };
//# sourceMappingURL=index.esm.js.map
