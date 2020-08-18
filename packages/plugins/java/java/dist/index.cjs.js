'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

const graphql = require('graphql');
const visitorPluginCommon = require('@graphql-codegen/visitor-plugin-common');
const javaCommon = require('@graphql-codegen/java-common');
const path = require('path');

class JavaResolversVisitor extends visitorPluginCommon.BaseVisitor {
    constructor(rawConfig, _schema, defaultPackageName) {
        super(rawConfig, {
            enumValues: rawConfig.enumValues || {},
            listType: rawConfig.listType || 'Iterable',
            className: rawConfig.className || 'Types',
            package: rawConfig.package || defaultPackageName,
            scalars: visitorPluginCommon.buildScalars(_schema, rawConfig.scalars, javaCommon.JAVA_SCALARS, 'Object'),
        });
        this._schema = _schema;
        this._addHashMapImport = false;
        this._addMapImport = false;
        this._addListImport = false;
    }
    getImports() {
        const allImports = [];
        if (this._addHashMapImport) {
            allImports.push(`java.util.HashMap`);
        }
        if (this._addMapImport) {
            allImports.push(`java.util.Map`);
        }
        if (this._addListImport) {
            allImports.push(`java.util.List`);
            allImports.push(`java.util.stream.Collectors`);
        }
        return allImports.map(i => `import ${i};`).join('\n') + '\n';
    }
    wrapWithClass(content) {
        return new javaCommon.JavaDeclarationBlock()
            .access('public')
            .asKind('class')
            .withName(this.config.className)
            .withBlock(visitorPluginCommon.indentMultiline(content)).string;
    }
    getPackageName() {
        return `package ${this.config.package};\n`;
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
        this._addHashMapImport = true;
        this._addMapImport = true;
        const enumName = this.convertName(node.name);
        const enumValues = node.values.map(enumValue => enumValue(node.name.value)).join(',\n') + ';';
        const enumCtor = visitorPluginCommon.indentMultiline(`
public final String label;
 
${enumName}(String label) {
  this.label = label;
}`);
        const valueOf = visitorPluginCommon.indentMultiline(`
private static final Map<String, ${enumName}> BY_LABEL = new HashMap<>();
  
static {
    for (${enumName} e : values()) {
        BY_LABEL.put(e.label, e);
    }
}

public static ${enumName} valueOfLabel(String label) {
  return BY_LABEL.get(label);
}`);
        const enumBlock = [enumValues, enumCtor, valueOf].join('\n');
        return new javaCommon.JavaDeclarationBlock()
            .access('public')
            .asKind('enum')
            .withComment(node.description)
            .withName(enumName)
            .withBlock(enumBlock).string;
    }
    resolveInputFieldType(typeNode) {
        const innerType = visitorPluginCommon.getBaseTypeNode(typeNode);
        const schemaType = this._schema.getType(innerType.name.value);
        const isArray = typeNode.kind === graphql.Kind.LIST_TYPE ||
            (typeNode.kind === graphql.Kind.NON_NULL_TYPE && typeNode.type.kind === graphql.Kind.LIST_TYPE);
        let result = null;
        if (graphql.isScalarType(schemaType)) {
            if (this.scalars[schemaType.name]) {
                result = {
                    baseType: this.scalars[schemaType.name],
                    typeName: this.scalars[schemaType.name],
                    isScalar: true,
                    isEnum: false,
                    isArray,
                };
            }
            else {
                result = { isArray, baseType: 'Object', typeName: 'Object', isScalar: true, isEnum: false };
            }
        }
        else if (graphql.isInputObjectType(schemaType)) {
            const convertedName = this.convertName(schemaType.name);
            const typeName = convertedName.endsWith('Input') ? convertedName : `${convertedName}Input`;
            result = {
                baseType: typeName,
                typeName: typeName,
                isScalar: false,
                isEnum: false,
                isArray,
            };
        }
        else if (graphql.isEnumType(schemaType)) {
            result = {
                isArray,
                baseType: this.convertName(schemaType.name),
                typeName: this.convertName(schemaType.name),
                isScalar: false,
                isEnum: true,
            };
        }
        else {
            result = { isArray, baseType: 'Object', typeName: 'Object', isScalar: true, isEnum: false };
        }
        if (result) {
            result.typeName = javaCommon.wrapTypeWithModifiers(result.typeName, typeNode, this.config.listType);
        }
        return result;
    }
    buildInputTransfomer(name, inputValueArray) {
        this._addMapImport = true;
        const classMembers = inputValueArray
            .map(arg => {
            const typeToUse = this.resolveInputFieldType(arg.type);
            return visitorPluginCommon.indent(`private ${typeToUse.typeName} _${arg.name.value};`);
        })
            .join('\n');
        const ctorSet = inputValueArray
            .map(arg => {
            const typeToUse = this.resolveInputFieldType(arg.type);
            if (typeToUse.isArray && !typeToUse.isScalar) {
                this._addListImport = true;
                return visitorPluginCommon.indentMultiline(`if (args.get("${arg.name.value}") != null) {
  this._${arg.name.value} = ((List<Map<String, Object>>) args.get("${arg.name.value}")).stream().map(${typeToUse.baseType}::new).collect(Collectors.toList());
}`, 3);
            }
            else if (typeToUse.isScalar) {
                return visitorPluginCommon.indent(`this._${arg.name.value} = (${typeToUse.typeName}) args.get("${arg.name.value}");`, 3);
            }
            else if (typeToUse.isEnum) {
                return visitorPluginCommon.indentMultiline(`if (args.get("${arg.name.value}") instanceof ${typeToUse.typeName}) {
  this._${arg.name.value} = (${typeToUse.typeName}) args.get("${arg.name.value}");
} else {
  this._${arg.name.value} = ${typeToUse.typeName}.valueOfLabel((String) args.get("${arg.name.value}"));
}`, 3);
            }
            else {
                return visitorPluginCommon.indent(`this._${arg.name.value} = new ${typeToUse.typeName}((Map<String, Object>) args.get("${arg.name.value}"));`, 3);
            }
        })
            .join('\n');
        const getters = inputValueArray
            .map(arg => {
            const typeToUse = this.resolveInputFieldType(arg.type);
            return visitorPluginCommon.indent(`public ${typeToUse.typeName} get${this.convertName(arg.name.value)}() { return this._${arg.name.value}; }`);
        })
            .join('\n');
        return `public static class ${name} {
${classMembers}

  public ${name}(Map<String, Object> args) {
    if (args != null) {
${ctorSet}
    }
  }

${getters}
}`;
    }
    FieldDefinition(node) {
        return (typeName) => {
            if (node.arguments.length > 0) {
                const transformerName = `${this.convertName(typeName, { useTypesPrefix: true })}${this.convertName(node.name.value, { useTypesPrefix: false })}Args`;
                return this.buildInputTransfomer(transformerName, node.arguments);
            }
            return null;
        };
    }
    InputObjectTypeDefinition(node) {
        const convertedName = this.convertName(node);
        const name = convertedName.endsWith('Input') ? convertedName : `${convertedName}Input`;
        return this.buildInputTransfomer(name, node.fields);
    }
    ObjectTypeDefinition(node) {
        const fieldsArguments = node.fields.map(f => f(node.name.value)).filter(r => r);
        return fieldsArguments.join('\n');
    }
}

const plugin = async (schema, documents, config, { outputFile }) => {
    const relevantPath = path.dirname(path.normalize(outputFile));
    const defaultPackageName = javaCommon.buildPackageNameFromPath(relevantPath);
    const visitor = new JavaResolversVisitor(config, schema, defaultPackageName);
    const printedSchema = graphql.printSchema(schema);
    const astNode = graphql.parse(printedSchema);
    const visitorResult = graphql.visit(astNode, { leave: visitor });
    const imports = visitor.getImports();
    const packageName = visitor.getPackageName();
    const blockContent = visitorResult.definitions.filter(d => typeof d === 'string').join('\n');
    const wrappedContent = visitor.wrapWithClass(blockContent);
    return [packageName, imports, wrappedContent].join('\n');
};

exports.plugin = plugin;
//# sourceMappingURL=index.cjs.js.map
