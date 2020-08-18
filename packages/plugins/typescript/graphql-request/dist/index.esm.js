import { Kind, concatAST, visit } from 'graphql';
import { ClientSideBaseVisitor, getConfigValue, DocumentMode, indentMultiline } from '@graphql-codegen/visitor-plugin-common';
import autoBind from 'auto-bind';
import { extname } from 'path';

const additionalExportedTypes = `
export type SdkFunctionWrapper = <T>(action: () => Promise<T>) => Promise<T>;
`;
class GraphQLRequestVisitor extends ClientSideBaseVisitor {
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
    get sdkContent() {
        const allPossibleActions = this._operationsToInclude
            .map(o => {
            const optionalVariables = !o.node.variableDefinitions ||
                o.node.variableDefinitions.length === 0 ||
                o.node.variableDefinitions.every(v => v.type.kind !== Kind.NON_NULL_TYPE || v.defaultValue);
            const doc = this.config.documentMode === DocumentMode.string
                ? o.documentVariableName
                : `print(${o.documentVariableName})`;
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
    const visitor = new GraphQLRequestVisitor(schema, allFragments, config);
    const visitorResult = visit(allAst, { leave: visitor });
    return {
        prepend: visitor.getImports(),
        content: [
            visitor.fragments,
            ...visitorResult.definitions.filter(t => typeof t === 'string'),
            visitor.sdkContent,
        ].join('\n'),
    };
};
const validate = async (schema, documents, config, outputFile) => {
    if (extname(outputFile) !== '.ts') {
        throw new Error(`Plugin "typescript-graphql-request" requires extension to be ".ts"!`);
    }
};

export { GraphQLRequestVisitor, plugin, validate };
//# sourceMappingURL=index.esm.js.map
