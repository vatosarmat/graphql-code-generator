'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

const graphql = require('graphql');
const visitorPluginCommon = require('@graphql-codegen/visitor-plugin-common');
const autoBind = _interopDefault(require('auto-bind'));

class FlowOperationVariablesToObject extends visitorPluginCommon.OperationVariablesToObject {
    clearOptional(str) {
        if (str.startsWith('?')) {
            return str.replace(/^\?(.*?)$/i, '$1');
        }
        return str;
    }
    getScalar(name) {
        const prefix = this._namespacedImportName ? `${this._namespacedImportName}.` : '';
        return `$ElementType<${prefix}Scalars, '${name}'>`;
    }
    wrapAstTypeWithModifiers(baseType, typeNode) {
        if (typeNode.kind === graphql.Kind.NON_NULL_TYPE) {
            const type = this.wrapAstTypeWithModifiers(baseType, typeNode.type);
            return this.clearOptional(type);
        }
        else if (typeNode.kind === graphql.Kind.LIST_TYPE) {
            const innerType = this.wrapAstTypeWithModifiers(baseType, typeNode.type);
            return `?Array<${innerType}>`;
        }
        else {
            return `?${baseType}`;
        }
    }
    formatFieldString(fieldName, isNonNullType, hasDefaultValue) {
        if (hasDefaultValue || isNonNullType) {
            return fieldName;
        }
        else {
            return `${fieldName}?`;
        }
    }
    formatTypeString(fieldType, isNonNullType, hasDefaultValue) {
        if (hasDefaultValue && !isNonNullType) {
            return this.clearOptional(fieldType);
        }
        return fieldType;
    }
}

class FlowVisitor extends visitorPluginCommon.BaseTypesVisitor {
    constructor(schema, pluginConfig) {
        super(schema, pluginConfig, {
            useFlowExactObjects: visitorPluginCommon.getConfigValue(pluginConfig.useFlowExactObjects, true),
            useFlowReadOnlyTypes: visitorPluginCommon.getConfigValue(pluginConfig.useFlowReadOnlyTypes, false),
        });
        autoBind(this);
        const enumNames = Object.values(schema.getTypeMap())
            .map(type => (type instanceof graphql.GraphQLEnumType ? type.name : undefined))
            .filter(t => t);
        this.setArgumentsTransformer(new FlowOperationVariablesToObject(this.scalars, this.convertName, null, enumNames, pluginConfig.enumPrefix));
        this.setDeclarationBlockConfig({
            blockWrapper: this.config.useFlowExactObjects ? '|' : '',
        });
    }
    _getScalar(name) {
        return `$ElementType<Scalars, '${name}'>`;
    }
    InputValueDefinition(node, key, parent) {
        const originalFieldNode = parent[key];
        const addOptionalSign = originalFieldNode.type.kind !== graphql.Kind.NON_NULL_TYPE;
        const comment = visitorPluginCommon.transformComment(node.description, 1);
        return comment + visitorPluginCommon.indent(`${node.name}${addOptionalSign ? '?' : ''}: ${node.type},`);
    }
    NamedType(node, key, parent, path, ancestors) {
        return `?${super.NamedType(node, key, parent, path, ancestors)}`;
    }
    ListType(node) {
        return `?${super.ListType(node)}`;
    }
    NonNullType(node) {
        const baseValue = super.NonNullType(node);
        if (baseValue.startsWith('?')) {
            return baseValue.substr(1);
        }
        return baseValue;
    }
    FieldDefinition(node) {
        const typeString = node.type;
        const namePostfix = typeString.startsWith('?') ? '?' : '';
        const comment = visitorPluginCommon.transformComment(node.description, 1);
        return comment + visitorPluginCommon.indent(`${this.config.useFlowReadOnlyTypes ? '+' : ''}${node.name}${namePostfix}: ${typeString},`);
    }
    ObjectTypeDefinition(node, key, parent) {
        return super.ObjectTypeDefinition({
            ...node,
            interfaces: node.interfaces && node.interfaces.length > 0
                ? node.interfaces.map(name => name.replace('?', ''))
                : [],
        }, key, parent);
    }
    _buildTypeImport(identifier, source) {
        return `import { type ${identifier} } from '${source}';`;
    }
    mergeInterfaces(interfaces, hasOtherFields) {
        if (!interfaces.length) {
            return '';
        }
        return interfaces.map(i => visitorPluginCommon.indent(`...${i}`)).join(',\n') + (hasOtherFields ? ',\n  ' : '');
    }
    appendInterfacesAndFieldsToBlock(block, interfaces, fields) {
        block.withBlock(this.mergeInterfaces(interfaces, fields.length > 0) + this.mergeAllFields(fields, interfaces.length > 0));
    }
    mergeAllFields(allFields, hasInterfaces) {
        if (allFields.length === 0) {
            return '';
        }
        if (!hasInterfaces) {
            return allFields.join('\n');
        }
        return `...{${this.config.useFlowExactObjects ? '|' : ''}\n${allFields.map(s => visitorPluginCommon.indent(s)).join('\n')}\n  ${this.config.useFlowExactObjects ? '|' : ''}}`;
    }
    handleEnumValueMapper(typeIdentifier, importIdentifier, sourceIdentifier, sourceFile) {
        let identifier = sourceIdentifier;
        if (sourceIdentifier !== typeIdentifier && !sourceIdentifier.includes(' as ')) {
            identifier = `${sourceIdentifier} as ${typeIdentifier}`;
        }
        return [this._buildTypeImport(identifier, sourceFile)];
    }
    EnumTypeDefinition(node) {
        const typeName = node.name;
        if (this.config.enumValues[typeName] && this.config.enumValues[typeName].sourceFile) {
            return null;
        }
        const enumValuesName = this.convertName(node, {
            suffix: 'Values',
            useTypesPrefix: this.config.enumPrefix,
        });
        const enumValues = new visitorPluginCommon.DeclarationBlock(this._declarationBlockConfig)
            .export()
            .asKind('const')
            .withName(enumValuesName)
            .withMethodCall('Object.freeze', true)
            .withBlock(node.values
            .map(enumOption => {
            const comment = visitorPluginCommon.transformComment(enumOption.description, 1);
            const optionName = this.convertName(enumOption, { transformUnderscore: true, useTypesPrefix: false });
            let enumValue = enumOption.name;
            if (this.config.enumValues[typeName] &&
                this.config.enumValues[typeName].mappedValues &&
                typeof this.config.enumValues[typeName].mappedValues[enumValue] !== 'undefined') {
                enumValue = this.config.enumValues[typeName].mappedValues[enumValue];
            }
            return comment + visitorPluginCommon.indent(`${optionName}: ${visitorPluginCommon.wrapWithSingleQuotes(enumValue)}`);
        })
            .join(', \n')).string;
        const enumType = new visitorPluginCommon.DeclarationBlock(this._declarationBlockConfig)
            .export()
            .asKind('type')
            .withName(this.convertName(node, { useTypesPrefix: this.config.enumPrefix }))
            .withComment(node.description)
            .withContent(`$Values<typeof ${enumValuesName}>`).string;
        return [enumValues, enumType].join('\n\n');
    }
    getPunctuation(declarationKind) {
        return declarationKind === 'type' ? ',' : ';';
    }
}

const plugin = (schema, documents, config) => {
    const header = `// @flow \n\n`;
    const printedSchema = graphql.printSchema(schema);
    const astNode = graphql.parse(printedSchema);
    const visitor = new FlowVisitor(schema, config);
    const visitorResult = graphql.visit(astNode, {
        leave: visitor,
    });
    return {
        prepend: [header, ...visitor.getEnumsImports()],
        content: [visitor.scalarsDefinition, ...visitorResult.definitions].join('\n'),
    };
};

exports.FlowOperationVariablesToObject = FlowOperationVariablesToObject;
exports.FlowVisitor = FlowVisitor;
exports.plugin = plugin;
//# sourceMappingURL=index.cjs.js.map
