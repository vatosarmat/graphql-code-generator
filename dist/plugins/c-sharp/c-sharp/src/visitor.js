import { BaseVisitor, indentMultiline, indent, buildScalars, getBaseTypeNode, } from '@graphql-codegen/visitor-plugin-common';
import { Kind, isScalarType, isInputObjectType, isEnumType, } from 'graphql';
import { C_SHARP_SCALARS, CSharpDeclarationBlock, transformComment, isValueType, getListInnerTypeNode, CSharpFieldType, csharpKeywords, wrapFieldType, getListTypeField, } from '../../common/common';
export class CSharpResolversVisitor extends BaseVisitor {
    constructor(rawConfig, _schema) {
        super(rawConfig, {
            enumValues: rawConfig.enumValues || {},
            listType: rawConfig.listType || 'List',
            namespaceName: rawConfig.namespaceName || 'GraphQLCodeGen',
            className: rawConfig.className || 'Types',
            scalars: buildScalars(_schema, rawConfig.scalars, C_SHARP_SCALARS),
        });
        this._schema = _schema;
        this.keywords = new Set(csharpKeywords);
    }
    /**
     * Checks name against list of keywords. If it is, will prefix value with @
     *
     * Note:
     * This class should first invoke the convertName from base-visitor to convert the string or node
     * value according the naming configuration, eg upper or lower case. Then resulting string checked
     * against the list or keywords.
     * However the generated C# code is not yet able to handle fields that are in a different case so
     * the invocation of convertName is omitted purposely.
     */
    convertSafeName(node) {
        const name = typeof node === 'string' ? node : node.value;
        return this.keywords.has(name) ? `@${name}` : name;
    }
    getImports() {
        const allImports = ['System', 'System.Collections.Generic', 'Newtonsoft.Json', 'GraphQL'];
        return allImports.map(i => `using ${i};`).join('\n') + '\n';
    }
    wrapWithNamespace(content) {
        return new CSharpDeclarationBlock()
            .asKind('namespace')
            .withName(this.config.namespaceName)
            .withBlock(indentMultiline(content)).string;
    }
    wrapWithClass(content) {
        return new CSharpDeclarationBlock()
            .access('public')
            .asKind('class')
            .withName(this.convertSafeName(this.config.className))
            .withBlock(indentMultiline(content)).string;
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
            const enumHeader = this.getFieldHeader(node);
            const enumOption = this.convertSafeName(node.name);
            return enumHeader + indent(this.getEnumValue(enumName, enumOption));
        };
    }
    EnumTypeDefinition(node) {
        const enumName = this.convertName(node.name);
        const enumValues = node.values.map(enumValue => enumValue(node.name.value)).join(',\n');
        const enumBlock = [enumValues].join('\n');
        return new CSharpDeclarationBlock()
            .access('public')
            .asKind('enum')
            .withComment(node.description)
            .withName(enumName)
            .withBlock(enumBlock).string;
    }
    getFieldHeader(node, fieldType) {
        var _a;
        const attributes = [];
        const commentText = transformComment((_a = node.description) === null || _a === void 0 ? void 0 : _a.value);
        const deprecationDirective = node.directives.find(v => { var _a; return ((_a = v.name) === null || _a === void 0 ? void 0 : _a.value) === 'deprecated'; });
        if (deprecationDirective) {
            const deprecationReason = this.getDeprecationReason(deprecationDirective);
            attributes.push(`[Obsolete("${deprecationReason}")]`);
        }
        if (node.kind === Kind.FIELD_DEFINITION) {
            attributes.push(`[JsonProperty("${node.name.value}")]`);
        }
        if (node.kind === Kind.INPUT_VALUE_DEFINITION && fieldType.isOuterTypeRequired) {
            attributes.push(`[JsonRequired]`);
        }
        if (commentText || attributes.length > 0) {
            const summary = commentText ? indentMultiline(commentText.trimRight()) + '\n' : '';
            const attributeLines = attributes.length > 0
                ? attributes
                    .map(attr => indent(attr))
                    .concat('')
                    .join('\n')
                : '';
            return summary + attributeLines;
        }
        return '';
    }
    getDeprecationReason(directive) {
        if (directive.name.value !== 'deprecated') {
            return '';
        }
        const hasArguments = directive.arguments.length > 0;
        let reason = 'Field no longer supported';
        if (hasArguments && directive.arguments[0].value.kind === Kind.STRING) {
            reason = directive.arguments[0].value.value;
        }
        return reason;
    }
    resolveInputFieldType(typeNode, hasDefaultValue = false) {
        const innerType = getBaseTypeNode(typeNode);
        const schemaType = this._schema.getType(innerType.name.value);
        const listType = getListTypeField(typeNode);
        const required = getListInnerTypeNode(typeNode).kind === Kind.NON_NULL_TYPE;
        let result = null;
        if (isScalarType(schemaType)) {
            if (this.scalars[schemaType.name]) {
                const baseType = this.scalars[schemaType.name];
                result = new CSharpFieldType({
                    baseType: {
                        type: baseType,
                        required,
                        valueType: isValueType(baseType),
                    },
                    listType,
                });
            }
            else {
                result = new CSharpFieldType({
                    baseType: {
                        type: 'object',
                        required,
                        valueType: false,
                    },
                    listType,
                });
            }
        }
        else if (isInputObjectType(schemaType)) {
            result = new CSharpFieldType({
                baseType: {
                    type: `${this.convertName(schemaType.name)}`,
                    required,
                    valueType: false,
                },
                listType,
            });
        }
        else if (isEnumType(schemaType)) {
            result = new CSharpFieldType({
                baseType: {
                    type: this.convertName(schemaType.name),
                    required,
                    valueType: true,
                },
                listType,
            });
        }
        else {
            result = new CSharpFieldType({
                baseType: {
                    type: `${schemaType.name}`,
                    required,
                    valueType: false,
                },
                listType,
            });
        }
        if (hasDefaultValue) {
            // Required field is optional when default value specified, see #4273
            (result.listType || result.baseType).required = false;
        }
        return result;
    }
    buildClass(name, description, inputValueArray, interfaces) {
        const classSummary = transformComment(description === null || description === void 0 ? void 0 : description.value);
        const interfaceImpl = interfaces && interfaces.length > 0 ? ` : ${interfaces.map(ntn => ntn.name.value).join(', ')}` : '';
        const classMembers = inputValueArray
            .map(arg => {
            const fieldType = this.resolveInputFieldType(arg.type);
            const fieldHeader = this.getFieldHeader(arg, fieldType);
            const fieldName = this.convertSafeName(arg.name);
            const csharpFieldType = wrapFieldType(fieldType, fieldType.listType, this.config.listType);
            return fieldHeader + indent(`public ${csharpFieldType} ${fieldName} { get; set; }`);
        })
            .join('\n\n');
        return `
#region ${name}
${classSummary}public class ${this.convertSafeName(name)}${interfaceImpl} {
  #region members
${classMembers}
  #endregion
}
#endregion`;
    }
    buildInterface(name, description, inputValueArray) {
        const classSummary = transformComment(description === null || description === void 0 ? void 0 : description.value);
        const classMembers = inputValueArray
            .map(arg => {
            const fieldType = this.resolveInputFieldType(arg.type);
            const fieldHeader = this.getFieldHeader(arg, fieldType);
            const fieldName = this.convertSafeName(arg.name);
            const csharpFieldType = wrapFieldType(fieldType, fieldType.listType, this.config.listType);
            return fieldHeader + indent(`public ${csharpFieldType} ${fieldName} { get; set; }`);
        })
            .join('\n\n');
        return `
${classSummary}public interface ${this.convertSafeName(name)} {
${classMembers}
}`;
    }
    buildInputTransformer(name, description, inputValueArray) {
        const classSummary = transformComment(description === null || description === void 0 ? void 0 : description.value);
        const classMembers = inputValueArray
            .map(arg => {
            const fieldType = this.resolveInputFieldType(arg.type, !!arg.defaultValue);
            const fieldHeader = this.getFieldHeader(arg, fieldType);
            const fieldName = this.convertSafeName(arg.name);
            const csharpFieldType = wrapFieldType(fieldType, fieldType.listType, this.config.listType);
            return fieldHeader + indent(`public ${csharpFieldType} ${fieldName} { get; set; }`);
        })
            .join('\n\n');
        return `
#region ${name}
${classSummary}public class ${this.convertSafeName(name)} {
  #region members
${classMembers}
  #endregion

  #region methods
  public dynamic GetInputObject()
  {
    IDictionary<string, object> d = new System.Dynamic.ExpandoObject();

    var properties = GetType().GetProperties(System.Reflection.BindingFlags.Instance | System.Reflection.BindingFlags.Public);
    foreach (var propertyInfo in properties)
    {
      var value = propertyInfo.GetValue(this);
      var defaultValue = propertyInfo.PropertyType.IsValueType ? Activator.CreateInstance(propertyInfo.PropertyType) : null;

      var requiredProp = propertyInfo.GetCustomAttributes(typeof(JsonRequiredAttribute), false).Length > 0;
      if (requiredProp || value != defaultValue)
      {
        d[propertyInfo.Name] = value;
      }
    }
    return d;
  }
  #endregion
}
#endregion`;
    }
    InputObjectTypeDefinition(node) {
        const name = `${this.convertName(node)}`;
        return this.buildInputTransformer(name, node.description, node.fields);
    }
    ObjectTypeDefinition(node) {
        return this.buildClass(node.name.value, node.description, node.fields, node.interfaces);
    }
    InterfaceTypeDefinition(node) {
        return this.buildInterface(node.name.value, node.description, node.fields);
    }
}
//# sourceMappingURL=visitor.js.map