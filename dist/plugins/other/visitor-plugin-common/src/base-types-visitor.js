import { isEnumType, Kind, } from 'graphql';
import flatMap from 'array.prototype.flatmap';
import { BaseVisitor } from './base-visitor';
import { DEFAULT_SCALARS } from './scalars';
import { normalizeDeclarationKind } from './declaration-kinds';
import { transformComment, buildScalars, DeclarationBlock, indent, wrapWithSingleQuotes, getConfigValue, } from './utils';
import { OperationVariablesToObject } from './variables-to-object';
import { parseEnumValues } from './enum-values';
export class BaseTypesVisitor extends BaseVisitor {
    constructor(_schema, rawConfig, additionalConfig, defaultScalars = DEFAULT_SCALARS) {
        super(rawConfig, {
            enumPrefix: getConfigValue(rawConfig.enumPrefix, true),
            onlyOperationTypes: getConfigValue(rawConfig.onlyOperationTypes, false),
            addUnderscoreToArgsType: getConfigValue(rawConfig.addUnderscoreToArgsType, false),
            enumValues: parseEnumValues(_schema, rawConfig.enumValues),
            declarationKind: normalizeDeclarationKind(rawConfig.declarationKind),
            scalars: buildScalars(_schema, rawConfig.scalars, defaultScalars),
            fieldWrapperValue: getConfigValue(rawConfig.fieldWrapperValue, 'T'),
            wrapFieldDefinitions: getConfigValue(rawConfig.wrapFieldDefinitions, false),
            ...additionalConfig,
        });
        this._schema = _schema;
        this._argumentsTransformer = new OperationVariablesToObject(this.scalars, this.convertName);
    }
    getExportPrefix() {
        return 'export ';
    }
    getFieldWrapperValue() {
        if (this.config.fieldWrapperValue) {
            return `${this.getExportPrefix()}type FieldWrapper<T> = ${this.config.fieldWrapperValue};`;
        }
        return '';
    }
    getScalarsImports() {
        return Object.keys(this.config.scalars)
            .map(enumName => {
            const mappedValue = this.config.scalars[enumName];
            if (mappedValue.isExternal) {
                return this._buildTypeImport(mappedValue.import, mappedValue.source, mappedValue.default);
            }
            return null;
        })
            .filter(a => a);
    }
    get scalarsDefinition() {
        const allScalars = Object.keys(this.config.scalars).map(scalarName => {
            const scalarValue = this.config.scalars[scalarName].type;
            const scalarType = this._schema.getType(scalarName);
            const comment = scalarType && scalarType.astNode && scalarType.description ? transformComment(scalarType.description, 1) : '';
            const { scalar } = this._parsedConfig.declarationKind;
            return comment + indent(`${scalarName}: ${scalarValue}${this.getPunctuation(scalar)}`);
        });
        return new DeclarationBlock(this._declarationBlockConfig)
            .export()
            .asKind(this._parsedConfig.declarationKind.scalar)
            .withName('Scalars')
            .withComment('All built-in and custom scalars, mapped to their actual values')
            .withBlock(allScalars.join('\n')).string;
    }
    setDeclarationBlockConfig(config) {
        this._declarationBlockConfig = config;
    }
    setArgumentsTransformer(argumentsTransfomer) {
        this._argumentsTransformer = argumentsTransfomer;
    }
    NonNullType(node) {
        const asString = node.type;
        return asString;
    }
    getInputObjectDeclarationBlock(node) {
        return new DeclarationBlock(this._declarationBlockConfig)
            .export()
            .asKind(this._parsedConfig.declarationKind.input)
            .withName(this.convertName(node))
            .withComment(node.description)
            .withBlock(node.fields.join('\n'));
    }
    InputObjectTypeDefinition(node) {
        return this.getInputObjectDeclarationBlock(node).string;
    }
    InputValueDefinition(node) {
        const comment = transformComment(node.description, 1);
        const { input } = this._parsedConfig.declarationKind;
        return comment + indent(`${node.name}: ${node.type}${this.getPunctuation(input)}`);
    }
    Name(node) {
        return node.value;
    }
    FieldDefinition(node) {
        const typeString = node.type;
        const { type } = this._parsedConfig.declarationKind;
        const comment = this.getFieldComment(node);
        return comment + indent(`${node.name}: ${typeString}${this.getPunctuation(type)}`);
    }
    UnionTypeDefinition(node, key, parent) {
        if (this.config.onlyOperationTypes)
            return '';
        const originalNode = parent[key];
        const possibleTypes = originalNode.types
            .map(t => (this.scalars[t.name.value] ? this._getScalar(t.name.value) : this.convertName(t)))
            .join(' | ');
        return new DeclarationBlock(this._declarationBlockConfig)
            .export()
            .asKind('type')
            .withName(this.convertName(node))
            .withComment(node.description)
            .withContent(possibleTypes).string;
    }
    mergeInterfaces(interfaces, hasOtherFields) {
        return interfaces.join(' & ') + (interfaces.length && hasOtherFields ? ' & ' : '');
    }
    appendInterfacesAndFieldsToBlock(block, interfaces, fields) {
        block.withContent(this.mergeInterfaces(interfaces, fields.length > 0));
        block.withBlock(this.mergeAllFields(fields, interfaces.length > 0));
    }
    getObjectTypeDeclarationBlock(node, originalNode) {
        const optionalTypename = this.config.nonOptionalTypename ? '__typename' : '__typename?';
        const { type } = this._parsedConfig.declarationKind;
        const allFields = [
            ...(this.config.addTypename
                ? [
                    indent(`${this.config.immutableTypes ? 'readonly ' : ''}${optionalTypename}: '${node.name}'${this.getPunctuation(type)}`),
                ]
                : []),
            ...node.fields,
        ];
        const interfacesNames = originalNode.interfaces ? originalNode.interfaces.map(i => this.convertName(i)) : [];
        const declarationBlock = new DeclarationBlock(this._declarationBlockConfig)
            .export()
            .asKind(type)
            .withName(this.convertName(node))
            .withComment(node.description);
        if (type === 'interface' || type === 'class') {
            if (interfacesNames.length > 0) {
                declarationBlock.withContent('extends ' + interfacesNames.join(', ') + (allFields.length > 0 ? ' ' : ' {}'));
            }
            declarationBlock.withBlock(this.mergeAllFields(allFields, false));
        }
        else {
            this.appendInterfacesAndFieldsToBlock(declarationBlock, interfacesNames, allFields);
        }
        return declarationBlock;
    }
    getFieldComment(node) {
        let commentText = node.description;
        const deprecationDirective = node.directives.find((v) => v.name === 'deprecated');
        if (deprecationDirective) {
            const deprecationReason = this.getDeprecationReason(deprecationDirective);
            commentText = `${commentText ? `${commentText}\n` : ''}@deprecated ${deprecationReason}`;
        }
        const comment = transformComment(commentText, 1);
        return comment;
    }
    mergeAllFields(allFields, hasInterfaces) {
        return allFields.join('\n');
    }
    ObjectTypeDefinition(node, key, parent) {
        if (this.config.onlyOperationTypes)
            return '';
        const originalNode = parent[key];
        return [this.getObjectTypeDeclarationBlock(node, originalNode).string, this.buildArgumentsBlock(originalNode)]
            .filter(f => f)
            .join('\n\n');
    }
    getInterfaceTypeDeclarationBlock(node, originalNode) {
        const declarationBlock = new DeclarationBlock(this._declarationBlockConfig)
            .export()
            .asKind(this._parsedConfig.declarationKind.interface)
            .withName(this.convertName(node))
            .withComment(node.description);
        return declarationBlock.withBlock(node.fields.join('\n'));
    }
    InterfaceTypeDefinition(node, key, parent) {
        if (this.config.onlyOperationTypes)
            return '';
        const originalNode = parent[key];
        return [this.getInterfaceTypeDeclarationBlock(node, originalNode).string, this.buildArgumentsBlock(originalNode)]
            .filter(f => f)
            .join('\n\n');
    }
    ScalarTypeDefinition(node) {
        // We empty this because we handle scalars in a different way, see constructor.
        return '';
    }
    _buildTypeImport(identifier, source, asDefault = false) {
        const { useTypeImports } = this.config;
        if (asDefault) {
            if (useTypeImports) {
                return `import type { default as ${identifier} } from '${source}';`;
            }
            return `import ${identifier} from '${source}';`;
        }
        return `import${useTypeImports ? ' type' : ''} { ${identifier} } from '${source}';`;
    }
    handleEnumValueMapper(typeIdentifier, importIdentifier, sourceIdentifier, sourceFile) {
        const importStatement = this._buildTypeImport(importIdentifier || sourceIdentifier, sourceFile);
        if (importIdentifier !== sourceIdentifier || sourceIdentifier !== typeIdentifier) {
            return [importStatement, `import ${typeIdentifier} = ${sourceIdentifier};`];
        }
        return [importStatement];
    }
    getEnumsImports() {
        return flatMap(Object.keys(this.config.enumValues), enumName => {
            const mappedValue = this.config.enumValues[enumName];
            if (mappedValue.sourceFile) {
                if (mappedValue.isDefault) {
                    return [this._buildTypeImport(mappedValue.typeIdentifier, mappedValue.sourceFile, true)];
                }
                return this.handleEnumValueMapper(mappedValue.typeIdentifier, mappedValue.importIdentifier, mappedValue.sourceIdentifier, mappedValue.sourceFile);
            }
            return [];
        }).filter(a => a);
    }
    EnumTypeDefinition(node) {
        const enumName = node.name;
        // In case of mapped external enum string
        if (this.config.enumValues[enumName] && this.config.enumValues[enumName].sourceFile) {
            return null;
        }
        return new DeclarationBlock(this._declarationBlockConfig)
            .export()
            .asKind('enum')
            .withName(this.convertName(node, { useTypesPrefix: this.config.enumPrefix }))
            .withComment(node.description)
            .withBlock(this.buildEnumValuesBlock(enumName, node.values)).string;
    }
    // We are using it in order to transform "description" field
    StringValue(node) {
        return node.value;
    }
    buildEnumValuesBlock(typeName, values) {
        const schemaEnumType = this._schema
            ? this._schema.getType(typeName)
            : undefined;
        return values
            .map(enumOption => {
            const optionName = this.convertName(enumOption, { useTypesPrefix: false, transformUnderscore: true });
            const comment = transformComment(enumOption.description, 1);
            const schemaEnumValue = schemaEnumType ? schemaEnumType.getValue(enumOption.name).value : undefined;
            let enumValue = typeof schemaEnumValue !== 'undefined' ? schemaEnumValue : enumOption.name;
            if (this.config.enumValues[typeName] &&
                this.config.enumValues[typeName].mappedValues &&
                typeof this.config.enumValues[typeName].mappedValues[enumValue] !== 'undefined') {
                enumValue = this.config.enumValues[typeName].mappedValues[enumValue];
            }
            return (comment +
                indent(`${optionName}${this._declarationBlockConfig.enumNameValueSeparator} ${wrapWithSingleQuotes(enumValue, typeof schemaEnumValue !== 'undefined')}`));
        })
            .join(',\n');
    }
    DirectiveDefinition(node) {
        return '';
    }
    getArgumentsObjectDeclarationBlock(node, name, field) {
        return new DeclarationBlock(this._declarationBlockConfig)
            .export()
            .asKind(this._parsedConfig.declarationKind.arguments)
            .withName(this.convertName(name))
            .withComment(node.description)
            .withBlock(this._argumentsTransformer.transform(field.arguments));
    }
    getArgumentsObjectTypeDefinition(node, name, field) {
        return this.getArgumentsObjectDeclarationBlock(node, name, field).string;
    }
    buildArgumentsBlock(node) {
        const fieldsWithArguments = node.fields.filter(field => field.arguments && field.arguments.length > 0) || [];
        return fieldsWithArguments
            .map(field => {
            const name = node.name.value +
                (this.config.addUnderscoreToArgsType ? '_' : '') +
                this.convertName(field, {
                    useTypesPrefix: false,
                    useTypesSuffix: false,
                }) +
                'Args';
            return this.getArgumentsObjectTypeDefinition(node, name, field);
        })
            .join('\n\n');
    }
    _getScalar(name) {
        return `Scalars['${name}']`;
    }
    _getTypeForNode(node) {
        const typeAsString = node.name;
        if (this.scalars[typeAsString]) {
            return this._getScalar(typeAsString);
        }
        else if (this.config.enumValues[typeAsString]) {
            return this.config.enumValues[typeAsString].typeIdentifier;
        }
        const schemaType = this._schema.getType(node.name);
        if (schemaType && isEnumType(schemaType)) {
            return this.convertName(node, { useTypesPrefix: this.config.enumPrefix });
        }
        return this.convertName(node);
    }
    NamedType(node, key, parent, path, ancestors) {
        const currentVisitContext = this.getVisitorKindContextFromAncestors(ancestors);
        const isVisitingInputType = currentVisitContext.includes(Kind.INPUT_OBJECT_TYPE_DEFINITION);
        const typeToUse = this._getTypeForNode(node);
        if (!isVisitingInputType && this.config.fieldWrapperValue && this.config.wrapFieldDefinitions) {
            return `FieldWrapper<${typeToUse}>`;
        }
        return typeToUse;
    }
    ListType(node) {
        const asString = node.type;
        return this.wrapWithListType(asString);
    }
    SchemaDefinition() {
        return null;
    }
    getDeprecationReason(directive) {
        if (directive.name === 'deprecated') {
            const hasArguments = directive.arguments.length > 0;
            let reason = 'Field no longer supported';
            if (hasArguments) {
                reason = directive.arguments[0].value;
            }
            return reason;
        }
    }
    wrapWithListType(str) {
        return `Array<${str}>`;
    }
}
//# sourceMappingURL=base-types-visitor.js.map