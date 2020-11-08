'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

const graphql = require('graphql');
const visitorPluginCommon = require('@graphql-codegen/visitor-plugin-common');
const javaCommon = require('@graphql-codegen/java-common');
const path = require('path');

const KOTLIN_SCALARS = {
    ID: 'Any',
    String: 'String',
    Boolean: 'Boolean',
    Int: 'Int',
    Float: 'Float',
};
class KotlinResolversVisitor extends visitorPluginCommon.BaseVisitor {
    constructor(rawConfig, _schema, defaultPackageName) {
        super(rawConfig, {
            enumValues: rawConfig.enumValues || {},
            listType: rawConfig.listType || 'Iterable',
            withTypes: rawConfig.withTypes || false,
            package: rawConfig.package || defaultPackageName,
            scalars: visitorPluginCommon.buildScalars(_schema, rawConfig.scalars, KOTLIN_SCALARS),
        });
        this._schema = _schema;
    }
    getPackageName() {
        return `package ${this.config.package}\n`;
    }
    getEnumValue(enumName, enumOption) {
        if (this.config.enumValues[enumName] &&
            typeof this.config.enumValues[enumName] === 'object' &&
            this.config.enumValues[enumName][enumOption]) {
            return this.config.enumValues[enumName][enumOption];
        }
        return enumOption;
    }
    EnumValueDefinition(node) {
        return (enumName) => {
            return visitorPluginCommon.indent(`${this.convertName(node, { useTypesPrefix: false, transformUnderscore: true })}("${this.getEnumValue(enumName, node.name.value)}")`);
        };
    }
    EnumTypeDefinition(node) {
        const comment = visitorPluginCommon.transformComment(node.description, 0);
        const enumName = this.convertName(node.name);
        const enumValues = visitorPluginCommon.indentMultiline(node.values.map(enumValue => enumValue(node.name.value)).join(',\n') + ';', 2);
        return `${comment}enum class ${enumName}(val label: String) {
${enumValues}
        
  companion object {
    @JvmStatic
    fun valueOfLabel(label: String): ${enumName}? {
      return values().find { it.label == label }
    }
  }
}`;
    }
    resolveInputFieldType(typeNode) {
        const innerType = visitorPluginCommon.getBaseTypeNode(typeNode);
        const schemaType = this._schema.getType(innerType.name.value);
        const isArray = typeNode.kind === graphql.Kind.LIST_TYPE ||
            (typeNode.kind === graphql.Kind.NON_NULL_TYPE && typeNode.type.kind === graphql.Kind.LIST_TYPE);
        let result = null;
        const nullable = typeNode.kind !== graphql.Kind.NON_NULL_TYPE;
        if (graphql.isScalarType(schemaType)) {
            if (this.config.scalars[schemaType.name]) {
                result = {
                    baseType: this.scalars[schemaType.name],
                    typeName: this.scalars[schemaType.name],
                    isScalar: true,
                    isArray,
                    nullable: nullable,
                };
            }
            else {
                result = { isArray, baseType: 'Any', typeName: 'Any', isScalar: true, nullable: nullable };
            }
        }
        else if (graphql.isInputObjectType(schemaType)) {
            const convertedName = this.convertName(schemaType.name);
            const typeName = convertedName.endsWith('Input') ? convertedName : `${convertedName}Input`;
            result = {
                baseType: typeName,
                typeName: typeName,
                isScalar: false,
                isArray,
                nullable: nullable,
            };
        }
        else if (graphql.isEnumType(schemaType) || graphql.isObjectType(schemaType)) {
            result = {
                isArray,
                baseType: this.convertName(schemaType.name),
                typeName: this.convertName(schemaType.name),
                isScalar: true,
                nullable: nullable,
            };
        }
        else {
            result = { isArray, baseType: 'Any', typeName: 'Any', isScalar: true, nullable: nullable };
        }
        if (result) {
            result.typeName = javaCommon.wrapTypeWithModifiers(result.typeName, typeNode, this.config.listType);
        }
        return result;
    }
    buildInputTransfomer(name, inputValueArray) {
        const classMembers = inputValueArray
            .map(arg => {
            const typeToUse = this.resolveInputFieldType(arg.type);
            const initialValue = this.initialValue(typeToUse.typeName, arg.defaultValue);
            const initial = initialValue ? ` = ${initialValue}` : typeToUse.nullable ? ' = null' : '';
            return visitorPluginCommon.indent(`val ${arg.name.value}: ${typeToUse.typeName}${typeToUse.nullable ? '?' : ''}${initial}`, 2);
        })
            .join(',\n');
        let suppress = '';
        const ctorSet = inputValueArray
            .map(arg => {
            const typeToUse = this.resolveInputFieldType(arg.type);
            const initialValue = this.initialValue(typeToUse.typeName, arg.defaultValue);
            const fallback = initialValue ? ` ?: ${initialValue}` : '';
            if (typeToUse.isArray && !typeToUse.isScalar) {
                suppress = '@Suppress("UNCHECKED_CAST")\n  ';
                return visitorPluginCommon.indent(`args["${arg.name.value}"]${typeToUse.nullable || fallback ? '?' : '!!'}.let { ${arg.name.value} -> (${arg.name.value} as List<Map<String, Any>>).map { ${typeToUse.baseType}(it) } }${fallback}`, 3);
            }
            else if (typeToUse.isScalar) {
                return visitorPluginCommon.indent(`args["${arg.name.value}"] as ${typeToUse.typeName}${typeToUse.nullable || fallback ? '?' : ''}${fallback}`, 3);
            }
            else if (typeToUse.nullable || fallback) {
                suppress = '@Suppress("UNCHECKED_CAST")\n  ';
                return visitorPluginCommon.indent(`args["${arg.name.value}"]?.let { ${typeToUse.typeName}(it as Map<String, Any>) }${fallback}`, 3);
            }
            else {
                suppress = '@Suppress("UNCHECKED_CAST")\n  ';
                return visitorPluginCommon.indent(`${typeToUse.typeName}(args["${arg.name.value}"] as Map<String, Any>)`, 3);
            }
        })
            .join(',\n');
        // language=kotlin
        return `data class ${name}(
${classMembers}
) {
  ${suppress}constructor(args: Map<String, Any>) : this(
${ctorSet}
  )
}`;
    }
    buildTypeTransfomer(name, typeValueArray) {
        const classMembers = typeValueArray
            .map(arg => {
            if (!arg.type) {
                return '';
            }
            const typeToUse = this.resolveInputFieldType(arg.type);
            return visitorPluginCommon.indent(`val ${arg.name.value}: ${typeToUse.typeName}${typeToUse.nullable ? '?' : ''}`, 2);
        })
            .join(',\n');
        // language=kotlin
        return `data class ${name}(
${classMembers}
)`;
    }
    initialValue(typeName, defaultValue) {
        if (defaultValue) {
            if (defaultValue.kind === 'IntValue' ||
                defaultValue.kind === 'FloatValue' ||
                defaultValue.kind === 'BooleanValue') {
                return `${defaultValue.value}`;
            }
            else if (defaultValue.kind === 'StringValue') {
                return `"""${defaultValue.value}""".trimIndent()`;
            }
            else if (defaultValue.kind === 'EnumValue') {
                return `${typeName}.${defaultValue.value}`;
            }
            else if (defaultValue.kind === 'ListValue') {
                const list = defaultValue.values
                    .map(value => {
                    return this.initialValue(typeName, value);
                })
                    .join(', ');
                return `listOf(${list})`;
            }
            // Variable
            // ObjectValue
            // ObjectField
        }
        return undefined;
    }
    FieldDefinition(node) {
        if (node.arguments.length > 0) {
            const inputTransformer = (typeName) => {
                const transformerName = `${this.convertName(typeName, { useTypesPrefix: true })}${this.convertName(node.name.value, { useTypesPrefix: false })}Args`;
                return this.buildInputTransfomer(transformerName, node.arguments);
            };
            return { node, inputTransformer };
        }
        return { node };
    }
    InputObjectTypeDefinition(node) {
        const convertedName = this.convertName(node);
        const name = convertedName.endsWith('Input') ? convertedName : `${convertedName}Input`;
        return this.buildInputTransfomer(name, node.fields);
    }
    ObjectTypeDefinition(node) {
        const name = this.convertName(node);
        const fields = node.fields;
        const fieldNodes = [];
        const argsTypes = [];
        fields.forEach(({ node, inputTransformer }) => {
            if (node) {
                fieldNodes.push(node);
            }
            if (inputTransformer) {
                argsTypes.push(inputTransformer);
            }
        });
        let types = argsTypes.map(f => f(node.name.value)).filter(r => r);
        if (this.config.withTypes) {
            types = types.concat([this.buildTypeTransfomer(name, fieldNodes)]);
        }
        return types.join('\n');
    }
}

const plugin = async (schema, documents, config, { outputFile }) => {
    const relevantPath = path.dirname(path.normalize(outputFile));
    const defaultPackageName = javaCommon.buildPackageNameFromPath(relevantPath);
    const visitor = new KotlinResolversVisitor(config, schema, defaultPackageName);
    const printedSchema = graphql.printSchema(schema);
    const astNode = graphql.parse(printedSchema);
    const visitorResult = graphql.visit(astNode, { leave: visitor });
    const packageName = visitor.getPackageName();
    const blockContent = visitorResult.definitions.filter(d => typeof d === 'string').join('\n\n');
    return [packageName, blockContent].join('\n');
};

exports.plugin = plugin;
//# sourceMappingURL=index.cjs.js.map
