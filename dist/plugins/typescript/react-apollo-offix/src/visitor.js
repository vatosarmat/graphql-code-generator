import { ClientSideBaseVisitor, DocumentMode, } from '@graphql-codegen/visitor-plugin-common';
import autoBind from 'auto-bind';
import { pascalCase } from 'pascal-case';
export class ReactApolloVisitor extends ClientSideBaseVisitor {
    constructor(schema, fragments, rawConfig, documents) {
        super(schema, fragments, rawConfig, {});
        this.imports = new Set();
        this._externalImportPrefix = this.config.importOperationTypesFrom ? `${this.config.importOperationTypesFrom}.` : '';
        this._documents = documents;
        autoBind(this);
    }
    getOffixReactHooksImport() {
        return `import * as OffixReactHooks from "react-offix-hooks";`;
    }
    getDocumentNodeVariable(node, documentVariableName) {
        return this.config.documentMode === DocumentMode.external ? `Operations.${node.name.value}` : documentVariableName;
    }
    getImports() {
        const baseImports = super.getImports({ excludeFragments: true });
        const hasOperations = this._collectedOperations.length > 0;
        if (!hasOperations) {
            return baseImports;
        }
        return [...baseImports, ...Array.from(this.imports)];
    }
    _buildHooks(node, operationType, documentVariableName, operationResultType, operationVariablesTypes) {
        const operationName = this.convertName(node.name.value, {
            useTypesPrefix: false,
        });
        this.imports.add(this.getOffixReactHooksImport());
        const hookFns = [];
        if (operationType === 'Mutation') {
            hookFns.push(`export function useOffline${operationName}(baseOptions?: OffixReactHooks.${operationType}HookOptions<${operationResultType}, ${operationVariablesTypes}>) {
    return OffixReactHooks.useOfflineMutation<${operationResultType}, ${operationVariablesTypes}>(${this.getDocumentNodeVariable(node, documentVariableName)}, baseOptions);
}`);
        }
        return [...hookFns].join('\n');
    }
    buildOperation(node, documentVariableName, operationType, operationResultType, operationVariablesTypes) {
        operationResultType = this._externalImportPrefix + operationResultType;
        operationVariablesTypes = this._externalImportPrefix + operationVariablesTypes;
        const hooks = this._buildHooks(node, operationType, documentVariableName, operationResultType, operationVariablesTypes);
        return [hooks].filter(a => a).join('\n');
    }
    OperationDefinition(node) {
        if (!node.name || !node.name.value) {
            return null;
        }
        this._collectedOperations.push(node);
        const documentVariableName = this.convertName(node, {
            suffix: this.config.documentVariableSuffix,
            prefix: this.config.documentVariablePrefix,
            useTypesPrefix: false,
        });
        const operationType = pascalCase(node.operation);
        const operationTypeSuffix = this.getOperationSuffix(node, operationType);
        const operationResultType = this.convertName(node, {
            suffix: operationTypeSuffix + this._parsedConfig.operationResultSuffix,
        });
        const operationVariablesTypes = this.convertName(node, {
            suffix: operationTypeSuffix + 'Variables',
        });
        const additional = this.buildOperation(node, documentVariableName, operationType, operationResultType, operationVariablesTypes);
        return [additional].filter(a => a).join('\n');
    }
}
//# sourceMappingURL=visitor.js.map