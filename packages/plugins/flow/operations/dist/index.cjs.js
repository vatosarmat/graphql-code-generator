'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

const graphql = require('graphql');
const visitorPluginCommon = require('@graphql-codegen/visitor-plugin-common');
const flow = require('@graphql-codegen/flow');
const autoBind = _interopDefault(require('auto-bind'));

class FlowWithPickSelectionSetProcessor extends visitorPluginCommon.BaseSelectionSetProcessor {
    transformAliasesPrimitiveFields(schemaType, fields) {
        if (fields.length === 0) {
            return [];
        }
        const useFlowExactObject = this.config.useFlowExactObjects;
        const useFlowReadOnlyTypes = this.config.useFlowReadOnlyTypes;
        const parentName = (this.config.namespacedImportName ? `${this.config.namespacedImportName}.` : '') +
            this.config.convertName(schemaType.name, {
                useTypesPrefix: true,
            });
        return [
            `{${useFlowExactObject ? '|' : ''} ${fields
                .map(aliasedField => `${useFlowReadOnlyTypes ? '+' : ''}${aliasedField.alias}: $ElementType<${parentName}, '${aliasedField.fieldName}'>`)
                .join(', ')} ${useFlowExactObject ? '|' : ''}}`,
        ];
    }
    buildFieldsIntoObject(allObjectsMerged) {
        return `...{ ${allObjectsMerged.join(', ')} }`;
    }
    buildSelectionSetFromStrings(pieces) {
        if (pieces.length === 0) {
            return null;
        }
        else if (pieces.length === 1) {
            return pieces[0];
        }
        else {
            return `({\n  ${pieces.map(t => visitorPluginCommon.indent(`...${t}`)).join(`,\n`)}\n})`;
        }
    }
    transformLinkFields(fields) {
        if (fields.length === 0) {
            return [];
        }
        const useFlowExactObject = this.config.useFlowExactObjects;
        const useFlowReadOnlyTypes = this.config.useFlowReadOnlyTypes;
        return [
            `{${useFlowExactObject ? '|' : ''} ${fields
                .map(field => `${useFlowReadOnlyTypes ? '+' : ''}${field.alias || field.name}: ${field.selectionSet}`)
                .join(', ')} ${useFlowExactObject ? '|' : ''}}`,
        ];
    }
    transformPrimitiveFields(schemaType, fields) {
        if (fields.length === 0) {
            return [];
        }
        const useFlowExactObject = this.config.useFlowExactObjects;
        const useFlowReadOnlyTypes = this.config.useFlowReadOnlyTypes;
        const formatNamedField = this.config.formatNamedField;
        const parentName = (this.config.namespacedImportName ? `${this.config.namespacedImportName}.` : '') +
            this.config.convertName(schemaType.name, {
                useTypesPrefix: true,
            });
        const fieldObj = schemaType.getFields();
        return [
            `$Pick<${parentName}, {${useFlowExactObject ? '|' : ''} ${fields
                .map(fieldName => `${useFlowReadOnlyTypes ? '+' : ''}${formatNamedField(fieldName, fieldObj[fieldName].type)}: *`)
                .join(', ')} ${useFlowExactObject ? '|' : ''}}>`,
        ];
    }
    transformTypenameField(type, name) {
        return [`{ ${name}: ${type} }`];
    }
}

class FlowDocumentsVisitor extends visitorPluginCommon.BaseDocumentsVisitor {
    constructor(schema, config, allFragments) {
        super(config, {
            useFlowExactObjects: visitorPluginCommon.getConfigValue(config.useFlowExactObjects, true),
            useFlowReadOnlyTypes: visitorPluginCommon.getConfigValue(config.useFlowReadOnlyTypes, false),
        }, schema);
        autoBind(this);
        const wrapArray = (type) => `Array<${type}>`;
        const wrapOptional = (type) => `?${type}`;
        const formatNamedField = (name, type) => {
            const optional = !!type && !graphql.isNonNullType(type);
            return `${name}${optional ? '?' : ''}`;
        };
        const processorConfig = {
            namespacedImportName: this.config.namespacedImportName,
            convertName: this.convertName.bind(this),
            enumPrefix: this.config.enumPrefix,
            scalars: this.scalars,
            formatNamedField,
            wrapTypeWithModifiers(baseType, type) {
                return visitorPluginCommon.wrapTypeWithModifiers(baseType, type, { wrapOptional, wrapArray });
            },
        };
        const processor = config.preResolveTypes
            ? new visitorPluginCommon.PreResolveTypesProcessor(processorConfig)
            : new FlowWithPickSelectionSetProcessor({
                ...processorConfig,
                useFlowExactObjects: this.config.useFlowExactObjects,
                useFlowReadOnlyTypes: this.config.useFlowReadOnlyTypes,
            });
        const enumsNames = Object.keys(schema.getTypeMap()).filter(typeName => graphql.isEnumType(schema.getType(typeName)));
        this.setSelectionSetHandler(new visitorPluginCommon.SelectionSetToObject(processor, this.scalars, this.schema, this.convertName.bind(this), this.getFragmentSuffix.bind(this), allFragments, this.config));
        this.setVariablesTransformer(new flow.FlowOperationVariablesToObject(this.scalars, this.convertName.bind(this), this.config.namespacedImportName, enumsNames, this.config.enumPrefix));
    }
    getPunctuation(declarationKind) {
        return declarationKind === 'type' ? ',' : ';';
    }
}

const plugin = (schema, rawDocuments, config) => {
    const documents = config.flattenGeneratedTypes
        ? visitorPluginCommon.optimizeOperations(schema, rawDocuments, { includeFragments: true })
        : rawDocuments;
    const prefix = config.preResolveTypes
        ? ''
        : `type $Pick<Origin: Object, Keys: Object> = $ObjMapi<Keys, <Key>(k: Key) => $ElementType<Origin, Key>>;\n`;
    const allAst = graphql.concatAST(documents.map(v => v.document));
    const includedFragments = allAst.definitions.filter(d => d.kind === graphql.Kind.FRAGMENT_DEFINITION);
    const allFragments = [
        ...includedFragments.map(fragmentDef => ({
            node: fragmentDef,
            name: fragmentDef.name.value,
            onType: fragmentDef.typeCondition.name.value,
            isExternal: false,
        })),
        ...(config.externalFragments || []),
    ];
    const visitorResult = graphql.visit(allAst, {
        leave: new FlowDocumentsVisitor(schema, config, allFragments),
    });
    return {
        prepend: ['// @flow \n'],
        content: [prefix, ...visitorResult.definitions].join('\n'),
    };
};

exports.plugin = plugin;
//# sourceMappingURL=index.cjs.js.map
