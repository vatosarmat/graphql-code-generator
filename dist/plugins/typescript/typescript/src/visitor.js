import { transformComment, wrapWithSingleQuotes, DeclarationBlock, indent, BaseTypesVisitor, getConfigValue, normalizeAvoidOptionals, } from '@graphql-codegen/visitor-plugin-common';
import autoBind from 'auto-bind';
import { Kind, isEnumType, } from 'graphql';
import { TypeScriptOperationVariablesToObject } from './typescript-variables-to-object';
export const EXACT_SIGNATURE = `type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };`;
export class TsVisitor extends BaseTypesVisitor {
    constructor(schema, pluginConfig, additionalConfig = {}) {
        super(schema, pluginConfig, {
            noExport: getConfigValue(pluginConfig.noExport, false),
            avoidOptionals: normalizeAvoidOptionals(getConfigValue(pluginConfig.avoidOptionals, false)),
            maybeValue: getConfigValue(pluginConfig.maybeValue, 'T | null'),
            constEnums: getConfigValue(pluginConfig.constEnums, false),
            enumsAsTypes: getConfigValue(pluginConfig.enumsAsTypes, false),
            futureProofEnums: getConfigValue(pluginConfig.futureProofEnums, false),
            enumsAsConst: getConfigValue(pluginConfig.enumsAsConst, false),
            numericEnums: getConfigValue(pluginConfig.numericEnums, false),
            onlyOperationTypes: getConfigValue(pluginConfig.onlyOperationTypes, false),
            immutableTypes: getConfigValue(pluginConfig.immutableTypes, false),
            ...(additionalConfig || {}),
        });
        autoBind(this);
        const enumNames = Object.values(schema.getTypeMap())
            .filter(isEnumType)
            .map(type => type.name);
        this.setArgumentsTransformer(new TypeScriptOperationVariablesToObject(this.scalars, this.convertName, this.config.avoidOptionals.object, this.config.immutableTypes, null, enumNames, pluginConfig.enumPrefix, this.config.enumValues));
        this.setDeclarationBlockConfig({
            enumNameValueSeparator: ' =',
            ignoreExport: this.config.noExport,
        });
    }
    getWrapperDefinitions() {
        const definitions = [this.getMaybeValue(), this.getExactDefinition()];
        if (this.config.wrapFieldDefinitions) {
            definitions.push(this.getFieldWrapperValue());
        }
        return definitions;
    }
    getExactDefinition() {
        return `${this.getExportPrefix()}${EXACT_SIGNATURE}`;
    }
    getMaybeValue() {
        return `${this.getExportPrefix()}type Maybe<T> = ${this.config.maybeValue};`;
    }
    clearOptional(str) {
        if (str.startsWith('Maybe')) {
            return str.replace(/Maybe<(.*?)>$/, '$1');
        }
        return str;
    }
    getExportPrefix() {
        if (this.config.noExport) {
            return '';
        }
        return super.getExportPrefix();
    }
    NamedType(node, key, parent, path, ancestors) {
        return `Maybe<${super.NamedType(node, key, parent, path, ancestors)}>`;
    }
    ListType(node) {
        return `Maybe<${super.ListType(node)}>`;
    }
    wrapWithListType(str) {
        return `${this.config.immutableTypes ? 'ReadonlyArray' : 'Array'}<${str}>`;
    }
    NonNullType(node) {
        const baseValue = super.NonNullType(node);
        return this.clearOptional(baseValue);
    }
    FieldDefinition(node, key, parent) {
        const typeString = node.type;
        const originalFieldNode = parent[key];
        const addOptionalSign = !this.config.avoidOptionals.field && originalFieldNode.type.kind !== Kind.NON_NULL_TYPE;
        const comment = this.getFieldComment(node);
        const { type } = this.config.declarationKind;
        return (comment +
            indent(`${this.config.immutableTypes ? 'readonly ' : ''}${node.name}${addOptionalSign ? '?' : ''}: ${typeString}${this.getPunctuation(type)}`));
    }
    InputValueDefinition(node, key, parent) {
        const originalFieldNode = parent[key];
        const addOptionalSign = !this.config.avoidOptionals.inputValue &&
            (originalFieldNode.type.kind !== Kind.NON_NULL_TYPE || node.defaultValue !== undefined);
        const comment = transformComment(node.description, 1);
        const { type } = this.config.declarationKind;
        return (comment +
            indent(`${this.config.immutableTypes ? 'readonly ' : ''}${node.name}${addOptionalSign ? '?' : ''}: ${node.type}${this.getPunctuation(type)}`));
    }
    EnumTypeDefinition(node) {
        const enumName = node.name;
        // In case of mapped external enum string
        if (this.config.enumValues[enumName] && this.config.enumValues[enumName].sourceFile) {
            return `export { ${this.config.enumValues[enumName].typeIdentifier} };\n`;
        }
        const getValueFromConfig = (enumValue) => {
            if (this.config.enumValues[enumName] &&
                this.config.enumValues[enumName].mappedValues &&
                typeof this.config.enumValues[enumName].mappedValues[enumValue] !== 'undefined') {
                return this.config.enumValues[enumName].mappedValues[enumValue];
            }
            return null;
        };
        const withFutureAddedValue = [
            this.config.futureProofEnums ? [indent('| ' + wrapWithSingleQuotes('%future added value'))] : [],
        ];
        const enumTypeName = this.convertName(node, { useTypesPrefix: this.config.enumPrefix });
        if (this.config.enumsAsTypes) {
            return new DeclarationBlock(this._declarationBlockConfig)
                .export()
                .asKind('type')
                .withComment(node.description)
                .withName(enumTypeName)
                .withContent('\n' +
                node.values
                    .map(enumOption => {
                    var _a;
                    const name = enumOption.name;
                    const enumValue = (_a = getValueFromConfig(name)) !== null && _a !== void 0 ? _a : name;
                    const comment = transformComment(enumOption.description, 1);
                    return comment + indent('| ' + wrapWithSingleQuotes(enumValue));
                })
                    .concat(...withFutureAddedValue)
                    .join('\n')).string;
        }
        if (this.config.numericEnums) {
            const block = new DeclarationBlock(this._declarationBlockConfig)
                .export()
                .withComment(node.description)
                .withName(enumTypeName)
                .asKind('enum')
                .withBlock(node.values
                .map((enumOption, i) => {
                const valueFromConfig = getValueFromConfig(enumOption.name);
                const enumValue = valueFromConfig !== null && valueFromConfig !== void 0 ? valueFromConfig : i;
                const comment = transformComment(enumOption.description, 1);
                return comment + indent(enumOption.name) + ` = ${enumValue}`;
            })
                .concat(...withFutureAddedValue)
                .join(',\n')).string;
            return block;
        }
        if (this.config.enumsAsConst) {
            const typeName = `export type ${enumTypeName} = typeof ${enumTypeName}[keyof typeof ${enumTypeName}];`;
            const enumAsConst = new DeclarationBlock({
                ...this._declarationBlockConfig,
                blockTransformer: block => {
                    return block + ' as const';
                },
            })
                .export()
                .asKind('const')
                .withName(enumTypeName)
                .withComment(node.description)
                .withBlock(node.values
                .map(enumOption => {
                var _a;
                const optionName = this.convertName(enumOption, { useTypesPrefix: false, transformUnderscore: true });
                const comment = transformComment(enumOption.description, 1);
                const name = enumOption.name;
                const enumValue = (_a = getValueFromConfig(name)) !== null && _a !== void 0 ? _a : name;
                return comment + indent(`${optionName}: ${wrapWithSingleQuotes(enumValue)}`);
            })
                .join(',\n')).string;
            return [enumAsConst, typeName].join('\n');
        }
        return new DeclarationBlock(this._declarationBlockConfig)
            .export()
            .asKind(this.config.constEnums ? 'const enum' : 'enum')
            .withName(enumTypeName)
            .withComment(node.description)
            .withBlock(this.buildEnumValuesBlock(enumName, node.values)).string;
    }
    getPunctuation(_declarationKind) {
        return ';';
    }
}
//# sourceMappingURL=visitor.js.map