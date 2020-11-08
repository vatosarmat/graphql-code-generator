import { concatAST, Kind, visit } from 'graphql';
import { ClientSideBaseVisitor, getConfigValue, DocumentMode } from '@graphql-codegen/visitor-plugin-common';
import autoBind from 'auto-bind';
import { pascalCase } from 'pascal-case';
import { extname } from 'path';

function insertIf(condition, ...elements) {
    return condition ? elements : [];
}
class VueApolloVisitor extends ClientSideBaseVisitor {
    constructor(schema, fragments, rawConfig, documents) {
        super(schema, fragments, rawConfig, {
            withCompositionFunctions: getConfigValue(rawConfig.withCompositionFunctions, true),
            vueApolloComposableImportFrom: getConfigValue(rawConfig.vueApolloComposableImportFrom, '@vue/apollo-composable'),
            vueCompositionApiImportFrom: getConfigValue(rawConfig.vueCompositionApiImportFrom, '@vue/composition-api'),
            addDocBlocks: getConfigValue(rawConfig.addDocBlocks, true),
        });
        this.imports = new Set();
        this.externalImportPrefix = this.config.importOperationTypesFrom ? `${this.config.importOperationTypesFrom}.` : '';
        this._documents = documents;
        autoBind(this);
    }
    get vueApolloComposableImport() {
        return `import * as VueApolloComposable from '${this.config.vueApolloComposableImportFrom}';`;
    }
    get vueCompositionApiImport() {
        if (this.config.useTypeImports) {
            return `import type * as VueCompositionApi from '${this.config.vueCompositionApiImportFrom}';`;
        }
        return `import * as VueCompositionApi from '${this.config.vueCompositionApiImportFrom}';`;
    }
    get reactiveFunctionType() {
        return 'export type ReactiveFunction<TParam> = () => TParam;';
    }
    getDocumentNodeVariable(node, documentVariableName) {
        return this.config.documentMode === DocumentMode.external ? `Operations.${node.name.value}` : documentVariableName;
    }
    getImports() {
        const baseImports = super.getImports();
        const hasOperations = this._collectedOperations.length > 0;
        if (!hasOperations) {
            return baseImports;
        }
        return [...baseImports, ...Array.from(this.imports)];
    }
    buildCompositionFunctionsJSDoc(node, operationName, operationType) {
        var _a, _b;
        const operationHasVariables = ((_a = node.variableDefinitions) === null || _a === void 0 ? void 0 : _a.length) > 0;
        const exampleVariablesString = (_b = node.variableDefinitions) === null || _b === void 0 ? void 0 : _b.reduce((accumulator, currentDefinition) => {
            const name = currentDefinition.variable.name.value;
            return `${accumulator}\n *   ${operationType === 'Mutation' ? '  ' : ''}${name}: // value for '${name}'`;
        }, '');
        const exampleArguments = operationHasVariables
            ? operationType === 'Mutation'
                ? `{
 *   variables: {${exampleVariablesString}
 *   },
 * }`
                : `{${exampleVariablesString}
 * }`
            : '';
        const queryDescription = `
 * To run a query within a Vue component, call \`use${operationName}\` and pass it any options that fit your needs.
 * When your component renders, \`use${operationName}\` returns an object from Apollo Client that contains result, loading and error properties
 * you can use to render your UI.`;
        const queryExample = `
 * const { result, loading, error } = use${operationName}(${exampleArguments});`;
        const mutationDescription = `
 * To run a mutation, you first call \`use${operationName}\` within a Vue component and pass it any options that fit your needs.
 * When your component renders, \`use${operationName}\` returns an object that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - Several other properties: https://v4.apollo.vuejs.org/api/use-mutation.html#return`;
        const mutationExample = `
 * const { mutate, loading, error, onDone } = use${operationName}(${exampleArguments});`;
        return `
/**
 * __use${operationName}__
 *${operationType === 'Mutation' ? mutationDescription : queryDescription}
 *${operationHasVariables && operationType !== 'Mutation'
            ? `
 * @param variables that will be passed into the ${operationType.toLowerCase()}`
            : ''}
 * @param options that will be passed into the ${operationType.toLowerCase()}, supported options are listed on: https://v4.apollo.vuejs.org/guide-composable/${operationType === 'Mutation' ? 'mutation' : operationType === 'Subscription' ? 'subscription' : 'query'}.html#options;
 *
 * @example${operationType === 'Mutation' ? mutationExample : queryExample}
 */`;
    }
    getCompositionFunctionSuffix(name, operationType) {
        if (!this.config.dedupeOperationSuffix) {
            return this.config.omitOperationSuffix ? '' : pascalCase(operationType);
        }
        if (name.includes('Query') || name.includes('Mutation') || name.includes('Subscription')) {
            return '';
        }
        return pascalCase(operationType);
    }
    buildOperation(node, documentVariableName, operationType, operationResultType, operationVariablesTypes) {
        var _a, _b, _c;
        operationResultType = this.externalImportPrefix + operationResultType;
        operationVariablesTypes = this.externalImportPrefix + operationVariablesTypes;
        if (!this.config.withCompositionFunctions) {
            // todo - throw human readable error
            return '';
        }
        if (!((_a = node.name) === null || _a === void 0 ? void 0 : _a.value)) {
            // todo - throw human readable error
            return '';
        }
        const suffix = this.getCompositionFunctionSuffix(node.name.value, operationType);
        const operationName = this.convertName(node.name.value, {
            suffix,
            useTypesPrefix: false,
        });
        const operationHasVariables = ((_b = node.variableDefinitions) === null || _b === void 0 ? void 0 : _b.length) > 0;
        const operationHasNonNullableVariable = !!((_c = node.variableDefinitions) === null || _c === void 0 ? void 0 : _c.some(({ type }) => type.kind === 'NonNullType'));
        this.imports.add(this.vueApolloComposableImport);
        this.imports.add(this.vueCompositionApiImport);
        // hacky: technically not an import, but a typescript type that is required in the generated code
        this.imports.add(this.reactiveFunctionType);
        const documentNodeVariable = this.getDocumentNodeVariable(node, documentVariableName); // i.e. TestDocument
        const compositionFunctionResultType = this.buildCompositionFunctionReturnType({
            operationName,
            operationType,
            operationResultType,
            operationVariablesTypes,
        });
        const compositionFunction = this.buildCompositionFunction({
            operationName,
            operationType,
            operationResultType,
            operationVariablesTypes,
            operationHasNonNullableVariable,
            operationHasVariables,
            documentNodeVariable,
        });
        return [
            ...insertIf(this.config.addDocBlocks, [this.buildCompositionFunctionsJSDoc(node, operationName, operationType)]),
            compositionFunction,
            compositionFunctionResultType,
        ].join('\n');
    }
    buildCompositionFunction({ operationName, operationType, operationResultType, operationVariablesTypes, operationHasNonNullableVariable, operationHasVariables, documentNodeVariable, }) {
        const variables = operationHasVariables
            ? `variables${operationHasNonNullableVariable ? '' : '?'}: ${operationVariablesTypes} | VueCompositionApi.Ref<${operationVariablesTypes}> | ReactiveFunction<${operationVariablesTypes}>, `
            : '';
        switch (operationType) {
            case 'Query': {
                return `export function use${operationName}(${variables}options: VueApolloComposable.UseQueryOptions<${operationResultType}, ${operationVariablesTypes}> | VueCompositionApi.Ref<VueApolloComposable.UseQueryOptions<${operationResultType}, ${operationVariablesTypes}>> | ReactiveFunction<VueApolloComposable.UseQueryOptions<${operationResultType}, ${operationVariablesTypes}>> = {}) {
  return VueApolloComposable.useQuery<${operationResultType}, ${operationVariablesTypes}>(${documentNodeVariable}, ${operationHasVariables ? 'variables' : '{}'}, options);
}`;
            }
            case 'Mutation': {
                return `export function use${operationName}(options: VueApolloComposable.UseMutationOptions<${operationResultType}, ${operationVariablesTypes}> | ReactiveFunction<VueApolloComposable.UseMutationOptions<${operationResultType}, ${operationVariablesTypes}>>${operationHasNonNullableVariable ? '' : ' = {}'}) {
  return VueApolloComposable.useMutation<${operationResultType}, ${operationVariablesTypes}>(${documentNodeVariable}, options);
}`;
            }
            case 'Subscription': {
                return `export function use${operationName}(${variables}options: VueApolloComposable.UseSubscriptionOptions<${operationResultType}, ${operationVariablesTypes}> | VueCompositionApi.Ref<VueApolloComposable.UseSubscriptionOptions<${operationResultType}, ${operationVariablesTypes}>> | ReactiveFunction<VueApolloComposable.UseSubscriptionOptions<${operationResultType}, ${operationVariablesTypes}>> = {}) {
  return VueApolloComposable.useSubscription<${operationResultType}, ${operationVariablesTypes}>(${documentNodeVariable}, ${operationHasVariables ? 'variables' : '{}'}, options);
}`;
            }
        }
    }
    buildCompositionFunctionReturnType({ operationName, operationType, operationResultType, operationVariablesTypes, }) {
        return `export type ${operationName}CompositionFunctionResult = VueApolloComposable.Use${operationType}Return<${operationResultType}, ${operationVariablesTypes}>;`;
    }
}

const plugin = (schema, documents, config) => {
    const allAst = concatAST(documents.map(s => s.document));
    const allFragments = [
        ...allAst.definitions.filter(d => d.kind === Kind.FRAGMENT_DEFINITION).map(fragmentDef => ({
            node: fragmentDef,
            name: fragmentDef.name.value,
            onType: fragmentDef.typeCondition.name.value,
            isExternal: false,
        })),
        ...(config.externalFragments || []),
    ];
    const visitor = new VueApolloVisitor(schema, allFragments, config, documents);
    const visitorResult = visit(allAst, { leave: visitor });
    return {
        prepend: visitor.getImports(),
        content: [
            visitor.fragments,
            ...visitorResult.definitions.filter((definition) => typeof definition === 'string'),
        ].join('\n'),
    };
};
const validate = async (_schema, _documents, _config, outputFile) => {
    if (extname(outputFile) !== '.ts' && extname(outputFile) !== '.tsx') {
        throw new Error(`Plugin "vue-apollo" requires extension to be ".ts" or ".tsx"!`);
    }
};

export { VueApolloVisitor, plugin, validate };
//# sourceMappingURL=index.esm.js.map
