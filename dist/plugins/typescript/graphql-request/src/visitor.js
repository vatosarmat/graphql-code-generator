import { ClientSideBaseVisitor, DocumentMode, getConfigValue, indentMultiline, } from '@graphql-codegen/visitor-plugin-common';
import autoBind from 'auto-bind';
import { Kind } from 'graphql';
const additionalExportedTypes = `
export type SdkFunctionWrapper = <T>(action: () => Promise<T>) => Promise<T>;
`;
export class GraphQLRequestVisitor extends ClientSideBaseVisitor {
    constructor(schema, fragments, rawConfig) {
        super(schema, fragments, rawConfig, {
            rawRequest: getConfigValue(rawConfig.rawRequest, false),
        });
        this._operationsToInclude = [];
        autoBind(this);
        const typeImport = this.config.useTypeImports ? 'import type' : 'import';
        this._additionalImports.push(`${typeImport} { GraphQLClient } from 'graphql-request';`);
        if (this.config.documentMode !== DocumentMode.string) {
            this._additionalImports.push(`import { print } from 'graphql';`);
        }
        if (this.config.rawRequest) {
            this._additionalImports.push(`${typeImport} { GraphQLError } from 'graphql-request/dist/types';`);
            this._additionalImports.push(`${typeImport} { Headers } from 'graphql-request/dist/types.dom';`);
        }
    }
    buildOperation(node, documentVariableName, operationType, operationResultType, operationVariablesTypes) {
        this._operationsToInclude.push({
            node,
            documentVariableName,
            operationType,
            operationResultType,
            operationVariablesTypes,
        });
        return null;
    }
    getDocumentNodeVariable(documentVariableName) {
        return this.config.documentMode === DocumentMode.external
            ? `Operations.${documentVariableName}`
            : documentVariableName;
    }
    get sdkContent() {
        const allPossibleActions = this._operationsToInclude
            .map(o => {
            const optionalVariables = !o.node.variableDefinitions ||
                o.node.variableDefinitions.length === 0 ||
                o.node.variableDefinitions.every(v => v.type.kind !== Kind.NON_NULL_TYPE || v.defaultValue);
            const docVarName = this.getDocumentNodeVariable(o.documentVariableName);
            const doc = this.config.documentMode === DocumentMode.string ? docVarName : `print(${docVarName})`;
            if (this.config.rawRequest) {
                return `${o.node.name.value}(variables${optionalVariables ? '?' : ''}: ${o.operationVariablesTypes}): Promise<{ data?: ${o.operationResultType} | undefined; extensions?: any; headers: Headers; status: number; errors?: GraphQLError[] | undefined; }> {
    return withWrapper(() => client.rawRequest<${o.operationResultType}>(${doc}, variables));
}`;
            }
            else {
                return `${o.node.name.value}(variables${optionalVariables ? '?' : ''}: ${o.operationVariablesTypes}): Promise<${o.operationResultType}> {
  return withWrapper(() => client.request<${o.operationResultType}>(${doc}, variables));
}`;
            }
        })
            .map(s => indentMultiline(s, 2));
        return `${additionalExportedTypes}

const defaultWrapper: SdkFunctionWrapper = sdkFunction => sdkFunction();
export function getSdk(client: GraphQLClient, withWrapper: SdkFunctionWrapper = defaultWrapper) {
  return {
${allPossibleActions.join(',\n')}
  };
}
export type Sdk = ReturnType<typeof getSdk>;`;
    }
}
//# sourceMappingURL=visitor.js.map