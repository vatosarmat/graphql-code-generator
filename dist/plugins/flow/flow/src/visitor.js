import { Kind, GraphQLEnumType, } from 'graphql';
import { BaseTypesVisitor, DeclarationBlock, wrapWithSingleQuotes, indent, transformComment, getConfigValue, } from '@graphql-codegen/visitor-plugin-common';
import autoBind from 'auto-bind';
import { FlowOperationVariablesToObject } from './flow-variables-to-object';
export class FlowVisitor extends BaseTypesVisitor {
    constructor(schema, pluginConfig) {
        super(schema, pluginConfig, {
            useFlowExactObjects: getConfigValue(pluginConfig.useFlowExactObjects, true),
            useFlowReadOnlyTypes: getConfigValue(pluginConfig.useFlowReadOnlyTypes, false),
        });
        autoBind(this);
        const enumNames = Object.values(schema.getTypeMap())
            .map(type => (type instanceof GraphQLEnumType ? type.name : undefined))
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
        const addOptionalSign = originalFieldNode.type.kind !== Kind.NON_NULL_TYPE;
        const comment = transformComment(node.description, 1);
        return comment + indent(`${node.name}${addOptionalSign ? '?' : ''}: ${node.type},`);
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
        const comment = transformComment(node.description, 1);
        return comment + indent(`${this.config.useFlowReadOnlyTypes ? '+' : ''}${node.name}${namePostfix}: ${typeString},`);
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
        return interfaces.map(i => indent(`...${i}`)).join(',\n') + (hasOtherFields ? ',\n  ' : '');
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
        return `...{${this.config.useFlowExactObjects ? '|' : ''}\n${allFields.map(s => indent(s)).join('\n')}\n  ${this.config.useFlowExactObjects ? '|' : ''}}`;
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
        const enumValues = new DeclarationBlock(this._declarationBlockConfig)
            .export()
            .asKind('const')
            .withName(enumValuesName)
            .withMethodCall('Object.freeze', true)
            .withBlock(node.values
            .map(enumOption => {
            const comment = transformComment(enumOption.description, 1);
            const optionName = this.convertName(enumOption, { transformUnderscore: true, useTypesPrefix: false });
            let enumValue = enumOption.name;
            if (this.config.enumValues[typeName] &&
                this.config.enumValues[typeName].mappedValues &&
                typeof this.config.enumValues[typeName].mappedValues[enumValue] !== 'undefined') {
                enumValue = this.config.enumValues[typeName].mappedValues[enumValue];
            }
            return comment + indent(`${optionName}: ${wrapWithSingleQuotes(enumValue)}`);
        })
            .join(', \n')).string;
        const enumType = new DeclarationBlock(this._declarationBlockConfig)
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
//# sourceMappingURL=visitor.js.map