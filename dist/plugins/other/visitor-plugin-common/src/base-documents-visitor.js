import autoBind from 'auto-bind';
import { DEFAULT_SCALARS } from './scalars';
import { DeclarationBlock, buildScalars, getConfigValue } from './utils';
import { OperationVariablesToObject } from './variables-to-object';
import { BaseVisitor } from './base-visitor';
import { pascalCase } from 'pascal-case';
function getRootType(operation, schema) {
    switch (operation) {
        case 'query':
            return schema.getQueryType();
        case 'mutation':
            return schema.getMutationType();
        case 'subscription':
            return schema.getSubscriptionType();
    }
}
export class BaseDocumentsVisitor extends BaseVisitor {
    constructor(rawConfig, additionalConfig, _schema, defaultScalars = DEFAULT_SCALARS) {
        super(rawConfig, {
            exportFragmentSpreadSubTypes: getConfigValue(rawConfig.exportFragmentSpreadSubTypes, false),
            enumPrefix: getConfigValue(rawConfig.enumPrefix, true),
            preResolveTypes: getConfigValue(rawConfig.preResolveTypes, false),
            dedupeOperationSuffix: getConfigValue(rawConfig.dedupeOperationSuffix, false),
            omitOperationSuffix: getConfigValue(rawConfig.omitOperationSuffix, false),
            skipTypeNameForRoot: getConfigValue(rawConfig.skipTypeNameForRoot, false),
            namespacedImportName: getConfigValue(rawConfig.namespacedImportName, null),
            addTypename: !rawConfig.skipTypename,
            globalNamespace: !!rawConfig.globalNamespace,
            operationResultSuffix: getConfigValue(rawConfig.operationResultSuffix, ''),
            scalars: buildScalars(_schema, rawConfig.scalars, defaultScalars),
            ...(additionalConfig || {}),
        });
        this._schema = _schema;
        this._unnamedCounter = 1;
        this._globalDeclarations = new Set();
        autoBind(this);
        this._variablesTransfomer = new OperationVariablesToObject(this.scalars, this.convertName, this.config.namespacedImportName);
    }
    getGlobalDeclarations(noExport = false) {
        return Array.from(this._globalDeclarations).map(t => (noExport ? t : `export ${t}`));
    }
    setSelectionSetHandler(handler) {
        this._selectionSetToObject = handler;
    }
    setDeclarationBlockConfig(config) {
        this._declarationBlockConfig = config;
    }
    setVariablesTransformer(variablesTransfomer) {
        this._variablesTransfomer = variablesTransfomer;
    }
    get schema() {
        return this._schema;
    }
    get addTypename() {
        return this._parsedConfig.addTypename;
    }
    handleAnonymousOperation(node) {
        const name = node.name && node.name.value;
        if (name) {
            return this.convertName(name, {
                useTypesPrefix: false,
                useTypesSuffix: false,
            });
        }
        return this.convertName(this._unnamedCounter++ + '', {
            prefix: 'Unnamed_',
            suffix: '_',
            useTypesPrefix: false,
            useTypesSuffix: false,
        });
    }
    FragmentDefinition(node) {
        const fragmentRootType = this._schema.getType(node.typeCondition.name.value);
        const selectionSet = this._selectionSetToObject.createNext(fragmentRootType, node.selectionSet);
        const fragmentSuffix = this.getFragmentSuffix(node);
        return selectionSet.transformFragmentSelectionSetToTypes(node.name.value, fragmentSuffix, this._declarationBlockConfig);
    }
    applyVariablesWrapper(variablesBlock) {
        return variablesBlock;
    }
    OperationDefinition(node) {
        const name = this.handleAnonymousOperation(node);
        const operationRootType = getRootType(node.operation, this._schema);
        if (!operationRootType) {
            throw new Error(`Unable to find root schema type for operation type "${node.operation}"!`);
        }
        const selectionSet = this._selectionSetToObject.createNext(operationRootType, node.selectionSet);
        const visitedOperationVariables = this._variablesTransfomer.transform(node.variableDefinitions);
        const operationType = pascalCase(node.operation);
        const operationTypeSuffix = this.getOperationSuffix(name, operationType);
        const operationResult = new DeclarationBlock(this._declarationBlockConfig)
            .export()
            .asKind('type')
            .withName(this.convertName(name, {
            suffix: operationTypeSuffix + this._parsedConfig.operationResultSuffix,
        }))
            .withContent(selectionSet.transformSelectionSet()).string;
        const operationVariables = new DeclarationBlock({
            ...this._declarationBlockConfig,
            blockTransformer: t => this.applyVariablesWrapper(t),
        })
            .export()
            .asKind('type')
            .withName(this.convertName(name, {
            suffix: operationTypeSuffix + 'Variables',
        }))
            .withBlock(visitedOperationVariables).string;
        return [operationVariables, operationResult].filter(r => r).join('\n\n');
    }
}
//# sourceMappingURL=base-documents-visitor.js.map