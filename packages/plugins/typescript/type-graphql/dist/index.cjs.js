'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

const graphql = require('graphql');
const visitorPluginCommon = require('@graphql-codegen/visitor-plugin-common');
const autoBind = _interopDefault(require('auto-bind'));
const typescript = require('@graphql-codegen/typescript');

const MAYBE_REGEX = /^Maybe<(.*?)>$/;
const ARRAY_REGEX = /^Array<(.*?)>$/;
const SCALAR_REGEX = /^Scalars\['(.*?)'\]$/;
const GRAPHQL_TYPES = ['Query', 'Mutation', 'Subscription'];
const SCALARS = ['ID', 'String', 'Boolean', 'Int', 'Float'];
const TYPE_GRAPHQL_SCALARS = ['ID', 'Int', 'Float'];
class TypeGraphQLVisitor extends typescript.TsVisitor {
    constructor(schema, pluginConfig, additionalConfig = {}) {
        super(schema, pluginConfig, {
            avoidOptionals: pluginConfig.avoidOptionals || false,
            maybeValue: pluginConfig.maybeValue || 'T | null',
            constEnums: pluginConfig.constEnums || false,
            enumsAsTypes: pluginConfig.enumsAsTypes || false,
            immutableTypes: pluginConfig.immutableTypes || false,
            declarationKind: {
                type: 'class',
                interface: 'abstract class',
                arguments: 'class',
                input: 'class',
                scalar: 'type',
            },
            decoratorName: {
                type: 'ObjectType',
                interface: 'InterfaceType',
                arguments: 'ArgsType',
                field: 'Field',
                input: 'InputType',
                ...(pluginConfig.decoratorName || {}),
            },
            ...(additionalConfig || {}),
        });
        autoBind(this);
        const enumNames = Object.values(schema.getTypeMap())
            .map(type => (type instanceof graphql.GraphQLEnumType ? type.name : undefined))
            .filter(t => t);
        this.setArgumentsTransformer(new typescript.TypeScriptOperationVariablesToObject(this.scalars, this.convertName, this.config.avoidOptionals.object, this.config.immutableTypes, null, enumNames, this.config.enumPrefix, this.config.enumValues));
        this.setDeclarationBlockConfig({
            enumNameValueSeparator: ' =',
        });
    }
    ObjectTypeDefinition(node, key, parent) {
        const typeDecorator = this.config.decoratorName.type;
        const originalNode = parent[key];
        let declarationBlock = this.getObjectTypeDeclarationBlock(node, originalNode);
        if (!GRAPHQL_TYPES.includes(node.name)) {
            // Add type-graphql ObjectType decorator
            const interfaces = originalNode.interfaces.map(i => this.convertName(i));
            let decoratorOptions = '';
            if (interfaces.length > 1) {
                decoratorOptions = `{ implements: [${interfaces.join(', ')}] }`;
            }
            else if (interfaces.length === 1) {
                decoratorOptions = `{ implements: ${interfaces[0]} }`;
            }
            declarationBlock = declarationBlock.withDecorator(`@TypeGraphQL.${typeDecorator}(${decoratorOptions})`);
        }
        return [declarationBlock.string, this.buildArgumentsBlock(originalNode)].filter(f => f).join('\n\n');
    }
    InputObjectTypeDefinition(node) {
        const typeDecorator = this.config.decoratorName.input;
        let declarationBlock = this.getInputObjectDeclarationBlock(node);
        // Add type-graphql InputType decorator
        declarationBlock = declarationBlock.withDecorator(`@TypeGraphQL.${typeDecorator}()`);
        return declarationBlock.string;
    }
    getArgumentsObjectDeclarationBlock(node, name, field) {
        return new visitorPluginCommon.DeclarationBlock(this._declarationBlockConfig)
            .export()
            .asKind(this._parsedConfig.declarationKind.arguments)
            .withName(this.convertName(name))
            .withComment(node.description)
            .withBlock(field.arguments.map(argument => this.InputValueDefinition(argument)).join('\n'));
    }
    getArgumentsObjectTypeDefinition(node, name, field) {
        const typeDecorator = this.config.decoratorName.arguments;
        let declarationBlock = this.getArgumentsObjectDeclarationBlock(node, name, field);
        // Add type-graphql Args decorator
        declarationBlock = declarationBlock.withDecorator(`@TypeGraphQL.${typeDecorator}()`);
        return declarationBlock.string;
    }
    InterfaceTypeDefinition(node, key, parent) {
        const interfaceDecorator = this.config.decoratorName.interface;
        const originalNode = parent[key];
        const declarationBlock = this.getInterfaceTypeDeclarationBlock(node, originalNode).withDecorator(`@TypeGraphQL.${interfaceDecorator}()`);
        return [declarationBlock.string, this.buildArgumentsBlock(originalNode)].filter(f => f).join('\n\n');
    }
    buildTypeString(type) {
        if (!type.isArray && !type.isScalar && !type.isNullable) {
            type.type = `FixDecorator<${type.type}>`;
        }
        if (type.isScalar) {
            type.type = `Scalars['${type.type}']`;
        }
        if (type.isArray) {
            type.type = `Array<${type.type}>`;
        }
        if (type.isNullable) {
            type.type = `Maybe<${type.type}>`;
        }
        return type.type;
    }
    parseType(rawType) {
        const typeNode = rawType;
        if (typeNode.kind === 'NamedType') {
            return {
                type: typeNode.name.value,
                isNullable: true,
                isArray: false,
                isScalar: SCALARS.includes(typeNode.name.value),
            };
        }
        else if (typeNode.kind === 'NonNullType') {
            return {
                ...this.parseType(typeNode.type),
                isNullable: false,
            };
        }
        else if (typeNode.kind === 'ListType') {
            return {
                ...this.parseType(typeNode.type),
                isArray: true,
                isNullable: true,
            };
        }
        const isNullable = !!rawType.match(MAYBE_REGEX);
        const nonNullableType = rawType.replace(MAYBE_REGEX, '$1');
        const isArray = !!nonNullableType.match(ARRAY_REGEX);
        const singularType = nonNullableType.replace(ARRAY_REGEX, '$1');
        const isScalar = !!singularType.match(SCALAR_REGEX);
        const type = singularType.replace(SCALAR_REGEX, (match, type) => {
            if (TYPE_GRAPHQL_SCALARS.includes(type)) {
                // This is a TypeGraphQL type
                return `TypeGraphQL.${type}`;
            }
            else if (global[type]) {
                // This is a JS native type
                return type;
            }
            else if (this.scalars[type]) {
                // This is a type specified in the configuration
                return this.scalars[type];
            }
            else {
                throw new Error(`Unknown scalar type ${type}`);
            }
        });
        return { type, isNullable, isArray, isScalar };
    }
    fixDecorator(type, typeString) {
        return type.isArray || type.isNullable || type.isScalar ? typeString : `FixDecorator<${typeString}>`;
    }
    FieldDefinition(node, key, parent) {
        const fieldDecorator = this.config.decoratorName.field;
        let typeString = node.type;
        const comment = visitorPluginCommon.transformComment(node.description, 1);
        const type = this.parseType(typeString);
        const maybeType = type.type.match(MAYBE_REGEX);
        const arrayType = `[${maybeType ? this.clearOptional(type.type) : type.type}]`;
        const decorator = '\n' +
            visitorPluginCommon.indent(`@TypeGraphQL.${fieldDecorator}(type => ${type.isArray ? arrayType : type.type}${type.isNullable ? ', { nullable: true }' : ''})`) +
            '\n';
        typeString = this.fixDecorator(type, typeString);
        return (comment + decorator + visitorPluginCommon.indent(`${this.config.immutableTypes ? 'readonly ' : ''}${node.name}!: ${typeString};`));
    }
    InputValueDefinition(node, key, parent) {
        const fieldDecorator = this.config.decoratorName.field;
        const rawType = node.type;
        const comment = visitorPluginCommon.transformComment(node.description, 1);
        const type = this.parseType(rawType);
        const typeGraphQLType = type.isScalar && TYPE_GRAPHQL_SCALARS.includes(type.type) ? `TypeGraphQL.${type.type}` : type.type;
        const decorator = '\n' +
            visitorPluginCommon.indent(`@TypeGraphQL.${fieldDecorator}(type => ${type.isArray ? `[${typeGraphQLType}]` : typeGraphQLType}${type.isNullable ? ', { nullable: true }' : ''})`) +
            '\n';
        const nameString = node.name.kind ? node.name.value : node.name;
        const typeString = rawType.kind
            ? this.buildTypeString(type)
            : this.fixDecorator(type, rawType);
        return (comment + decorator + visitorPluginCommon.indent(`${this.config.immutableTypes ? 'readonly ' : ''}${nameString}!: ${typeString};`));
    }
    EnumTypeDefinition(node) {
        return (super.EnumTypeDefinition(node) +
            `TypeGraphQL.registerEnumType(${this.convertName(node)}, { name: '${this.convertName(node)}' });\n`);
    }
    clearOptional(str) {
        if (str.startsWith('Maybe')) {
            return str.replace(/Maybe<(.*?)>$/, '$1');
        }
        return str;
    }
}

const TYPE_GRAPHQL_IMPORT = `import * as TypeGraphQL from 'type-graphql';`;
const DECORATOR_FIX = `type FixDecorator<T> = T;`;
const isDefinitionInterface = (definition) => definition.includes('@TypeGraphQL.InterfaceType()');
const plugin = (schema, documents, config) => {
    const visitor = new TypeGraphQLVisitor(schema, config);
    const printedSchema = graphql.printSchema(schema);
    const astNode = graphql.parse(printedSchema);
    const maybeValue = `export type Maybe<T> = ${visitor.config.maybeValue};`;
    const visitorResult = graphql.visit(astNode, { leave: visitor });
    const introspectionDefinitions = typescript.includeIntrospectionDefinitions(schema, documents, config);
    const scalars = visitor.scalarsDefinition;
    const definitions = visitorResult.definitions;
    // Sort output by interfaces first, classes last to prevent TypeScript errors
    definitions.sort((definition1, definition2) => +isDefinitionInterface(definition2) - +isDefinitionInterface(definition1));
    return {
        prepend: [...visitor.getEnumsImports(), maybeValue, TYPE_GRAPHQL_IMPORT, DECORATOR_FIX],
        content: [scalars, ...definitions, ...introspectionDefinitions].join('\n'),
    };
};

Object.defineProperty(exports, 'TsIntrospectionVisitor', {
    enumerable: true,
    get: function () {
        return typescript.TsIntrospectionVisitor;
    }
});
exports.TypeGraphQLVisitor = TypeGraphQLVisitor;
exports.plugin = plugin;
//# sourceMappingURL=index.cjs.js.map
