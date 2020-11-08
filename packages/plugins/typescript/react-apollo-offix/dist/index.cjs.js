'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

const graphql = require('graphql');
const visitorPluginCommon = require('@graphql-codegen/visitor-plugin-common');
const autoBind = _interopDefault(require('auto-bind'));
const pascalCase = require('pascal-case');
const path = require('path');

class ReactApolloVisitor extends visitorPluginCommon.ClientSideBaseVisitor {
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
        return this.config.documentMode === visitorPluginCommon.DocumentMode.external ? `Operations.${node.name.value}` : documentVariableName;
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
        var _a, _b;
        const operationName = this.convertName((_b = (_a = node.name) === null || _a === void 0 ? void 0 : _a.value) !== null && _b !== void 0 ? _b : '', {
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
        const operationType = pascalCase.pascalCase(node.operation);
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
    const visitor = new ReactApolloVisitor(schema, allFragments, config, documents);
    const visitorResult = graphql.visit(allAst, { leave: visitor });
    return {
        prepend: visitor.getImports(),
        content: [...visitorResult.definitions.filter(t => typeof t === 'string')].join('\n'),
    };
};
const validate = async (_schema, _documents, _config, outputFile) => {
    if (path.extname(outputFile) !== '.tsx' && path.extname(outputFile) !== '.ts') {
        throw new Error(`Plugin "react-apollo" requires extension to be ".tsx" or ".ts!`);
    }
};

exports.ReactApolloVisitor = ReactApolloVisitor;
exports.plugin = plugin;
exports.validate = validate;
//# sourceMappingURL=index.cjs.js.map
