import autoBind from 'auto-bind';
import { ClientSideBaseVisitor, DocumentMode, } from '@graphql-codegen/visitor-plugin-common';
export class TypeScriptDocumentNodesVisitor extends ClientSideBaseVisitor {
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
//# sourceMappingURL=visitor.js.map