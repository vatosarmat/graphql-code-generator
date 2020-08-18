import { Kind, isEnumType, parse, visit } from 'graphql';
import { printSchemaWithDirectives } from '@graphql-tools/utils';
import { extname } from 'path';
import gql from 'graphql-tag';
import { indent, BaseVisitor, getConfigValue, buildScalars, DEFAULT_SCALARS, getBaseTypeNode, DeclarationBlock } from '@graphql-codegen/visitor-plugin-common';
import { set } from 'lodash';
import { TypeScriptOperationVariablesToObject } from '@graphql-codegen/typescript';
import autoBind from 'auto-bind';

class FieldsTree {
    constructor() {
        this._fields = {};
    }
    addField(path, type) {
        if (type === undefined) {
            throw new Error('Did not expect type to be undefined');
        }
        set(this._fields, path, type);
    }
    _getInnerField(root, level = 1) {
        if (typeof root === 'string') {
            return root;
        }
        const fields = Object.keys(root).map(fieldName => {
            const fieldValue = root[fieldName];
            return indent(`${fieldName}: ${this._getInnerField(fieldValue, level + 1)},`, level);
        });
        return level === 1
            ? fields.join('\n')
            : `{
${fields.join('\n')}
${indent('}', level - 1)}`;
    }
    get string() {
        return this._getInnerField(this._fields);
    }
}

var Directives;
(function (Directives) {
    Directives["ID"] = "id";
    Directives["ENTITY"] = "entity";
    Directives["ABSTRACT_ENTITY"] = "abstractEntity";
    Directives["UNION"] = "union";
    Directives["LINK"] = "link";
    Directives["COLUMN"] = "column";
    Directives["EMBEDDED"] = "embedded";
    Directives["MAP"] = "map";
})(Directives || (Directives = {}));

function resolveObjectId(pointer) {
    if (!pointer) {
        return { identifier: 'ObjectID', module: 'mongodb' };
    }
    if (pointer.includes('#')) {
        const [path, module] = pointer.split('#');
        return { identifier: path, module };
    }
    return {
        identifier: pointer,
        module: null,
    };
}
class TsMongoVisitor extends BaseVisitor {
    constructor(_schema, pluginConfig) {
        super(pluginConfig, {
            dbTypeSuffix: pluginConfig.dbTypeSuffix || 'DbObject',
            dbInterfaceSuffix: pluginConfig.dbInterfaceSuffix || 'DbInterface',
            objectIdType: resolveObjectId(pluginConfig.objectIdType).identifier,
            objectIdImport: resolveObjectId(pluginConfig.objectIdType).module,
            idFieldName: pluginConfig.idFieldName || '_id',
            enumsAsString: getConfigValue(pluginConfig.enumsAsString, true),
            avoidOptionals: getConfigValue(pluginConfig.avoidOptionals, false),
            scalars: buildScalars(_schema, pluginConfig.scalars, DEFAULT_SCALARS),
        });
        this._schema = _schema;
        autoBind(this);
        this._variablesTransformer = new TypeScriptOperationVariablesToObject(this.scalars, this.convertName, false, false);
    }
    get objectIdImport() {
        if (this.config.objectIdImport === null) {
            return null;
        }
        return `import { ${this.config.objectIdType} } from '${this.config.objectIdImport}';`;
    }
    _resolveDirectiveValue(valueNode) {
        switch (valueNode.kind) {
            case Kind.INT:
            case Kind.STRING:
            case Kind.FLOAT:
            case Kind.BOOLEAN:
            case Kind.ENUM:
                return valueNode.value;
            case Kind.LIST:
                return valueNode.values.map(v => this._resolveDirectiveValue(v));
            case Kind.NULL:
                return null;
            case Kind.OBJECT:
                return valueNode.fields.reduce((prev, f) => {
                    return {
                        ...prev,
                        [f.name.value]: this._resolveDirectiveValue(f.value),
                    };
                }, {});
            default:
                return undefined;
        }
    }
    _getDirectiveArgValue(node, argName) {
        if (!node || !node.arguments || node.arguments.length === 0) {
            return undefined;
        }
        const foundArgument = node.arguments.find(a => a.name.value === argName);
        if (!foundArgument) {
            return undefined;
        }
        return this._resolveDirectiveValue(foundArgument.value);
    }
    _getDirectiveFromAstNode(node, directiveName) {
        if (!node || !node.directives || node.directives.length === 0) {
            return null;
        }
        const foundDirective = node.directives.find(d => d.name === directiveName || (d.name.value && d.name.value === directiveName));
        if (!foundDirective) {
            return null;
        }
        return foundDirective;
    }
    _buildInterfaces(interfaces) {
        return (interfaces || [])
            .map(namedType => {
            const schemaType = this._schema.getType(namedType.name.value);
            const abstractEntityDirective = this._getDirectiveFromAstNode(schemaType.astNode, Directives.ABSTRACT_ENTITY);
            if (!abstractEntityDirective) {
                return null;
            }
            return this.convertName(namedType.name.value, { suffix: this.config.dbInterfaceSuffix });
        })
            .filter(a => a);
    }
    _handleIdField(fieldNode, tree, addOptionalSign) {
        tree.addField(`${this.config.idFieldName}${addOptionalSign ? '?' : ''}`, this._variablesTransformer.wrapAstTypeWithModifiers(this.config.objectIdType, fieldNode.type));
    }
    _handleLinkField(fieldNode, tree, linkDirective, mapPath, addOptionalSign) {
        const overrideType = this._getDirectiveArgValue(linkDirective, 'overrideType');
        const coreType = overrideType || getBaseTypeNode(fieldNode.type);
        const type = this.convertName(coreType, { suffix: this.config.dbTypeSuffix });
        tree.addField(`${mapPath || fieldNode.name.value}${addOptionalSign ? '?' : ''}`, this._variablesTransformer.wrapAstTypeWithModifiers(`${type}['${this.config.idFieldName}']`, fieldNode.type));
    }
    _handleColumnField(fieldNode, tree, columnDirective, mapPath, addOptionalSign) {
        const overrideType = this._getDirectiveArgValue(columnDirective, 'overrideType');
        const coreType = getBaseTypeNode(fieldNode.type);
        let type = null;
        if (this.scalars[coreType.name.value]) {
            type = this.scalars[coreType.name.value];
        }
        else {
            const schemaType = this._schema.getType(coreType.name.value);
            if (isEnumType(schemaType) && this.config.enumsAsString) {
                type = this.scalars.String;
            }
            else {
                type = coreType.name.value;
            }
        }
        tree.addField(`${mapPath || fieldNode.name.value}${addOptionalSign ? '?' : ''}`, overrideType || this._variablesTransformer.wrapAstTypeWithModifiers(type, fieldNode.type));
    }
    _handleEmbeddedField(fieldNode, tree, mapPath, addOptionalSign) {
        const coreType = getBaseTypeNode(fieldNode.type);
        const type = this.convertName(coreType, { suffix: this.config.dbTypeSuffix });
        tree.addField(`${mapPath || fieldNode.name.value}${addOptionalSign ? '?' : ''}`, this._variablesTransformer.wrapAstTypeWithModifiers(type, fieldNode.type));
    }
    _buildFieldsTree(fields) {
        const tree = new FieldsTree();
        fields.forEach(field => {
            const idDirective = this._getDirectiveFromAstNode(field, Directives.ID);
            const linkDirective = this._getDirectiveFromAstNode(field, Directives.LINK);
            const columnDirective = this._getDirectiveFromAstNode(field, Directives.COLUMN);
            const embeddedDirective = this._getDirectiveFromAstNode(field, Directives.EMBEDDED);
            const mapDirective = this._getDirectiveFromAstNode(field, Directives.MAP);
            const mapPath = this._getDirectiveArgValue(mapDirective, 'path');
            const addOptionalSign = !this.config.avoidOptionals && field.type.kind !== Kind.NON_NULL_TYPE;
            if (idDirective) {
                this._handleIdField(field, tree, addOptionalSign);
            }
            else if (linkDirective) {
                this._handleLinkField(field, tree, linkDirective, mapPath, addOptionalSign);
            }
            else if (columnDirective) {
                this._handleColumnField(field, tree, columnDirective, mapPath, addOptionalSign);
            }
            else if (embeddedDirective) {
                this._handleEmbeddedField(field, tree, mapPath, addOptionalSign);
            }
        });
        return tree;
    }
    _addAdditionalFields(tree, additioalFields) {
        if (!additioalFields || additioalFields.length === 0) {
            return;
        }
        for (const field of additioalFields) {
            tree.addField(field.path, field.type);
        }
    }
    InterfaceTypeDefinition(node) {
        const abstractEntityDirective = this._getDirectiveFromAstNode(node, Directives.ABSTRACT_ENTITY);
        if (abstractEntityDirective === null) {
            return null;
        }
        const discriminatorField = this._getDirectiveArgValue(abstractEntityDirective, 'discriminatorField');
        const additionalFields = this._getDirectiveArgValue(abstractEntityDirective, 'additionalFields');
        const fields = this._buildFieldsTree(node.fields);
        fields.addField(discriminatorField, this.scalars.String);
        this._addAdditionalFields(fields, additionalFields);
        return new DeclarationBlock(this._declarationBlockConfig)
            .export()
            .asKind('type')
            .withName(this.convertName(node, { suffix: this.config.dbInterfaceSuffix }))
            .withBlock(fields.string).string;
    }
    UnionTypeDefinition(node) {
        const unionDirective = this._getDirectiveFromAstNode(node, Directives.UNION);
        if (unionDirective === null) {
            return null;
        }
        const discriminatorField = this._getDirectiveArgValue(unionDirective, 'discriminatorField');
        const possibleTypes = node.types
            .map(namedType => {
            const schemaType = this._schema.getType(namedType.name.value);
            const entityDirective = this._getDirectiveFromAstNode(schemaType.astNode, Directives.ENTITY);
            const abstractEntityDirective = this._getDirectiveFromAstNode(schemaType.astNode, Directives.ABSTRACT_ENTITY);
            if (entityDirective) {
                return this.convertName(namedType, { suffix: this.config.dbTypeSuffix });
            }
            else if (abstractEntityDirective) {
                return this.convertName(namedType, { suffix: this.config.dbInterfaceSuffix });
            }
            return null;
        })
            .filter(a => a);
        if (possibleTypes.length === 0) {
            return null;
        }
        const additionalFields = this._getDirectiveArgValue(unionDirective, 'additionalFields');
        const fields = new FieldsTree();
        fields.addField(discriminatorField, this.scalars.String);
        this._addAdditionalFields(fields, additionalFields);
        return new DeclarationBlock(this._declarationBlockConfig)
            .export()
            .asKind('type')
            .withName(this.convertName(node, { suffix: this.config.dbTypeSuffix }))
            .withContent(`(${possibleTypes.join(' | ')}) & `)
            .withBlock(fields.string).string;
    }
    ObjectTypeDefinition(node) {
        const entityDirective = this._getDirectiveFromAstNode(node, Directives.ENTITY);
        if (entityDirective === null) {
            return null;
        }
        const implementingInterfaces = this._buildInterfaces(node.interfaces);
        const fields = this._buildFieldsTree(node.fields);
        const additionalFields = this._getDirectiveArgValue(entityDirective, 'additionalFields');
        this._addAdditionalFields(fields, additionalFields);
        return new DeclarationBlock(this._declarationBlockConfig)
            .export()
            .asKind('type')
            .withName(this.convertName(node, { suffix: this.config.dbTypeSuffix }))
            .withContent(implementingInterfaces.length ? implementingInterfaces.join(' & ') + ' & ' : '')
            .withBlock(fields.string).string;
    }
}

const plugin = (schema, documents, config) => {
    const visitor = new TsMongoVisitor(schema, config);
    const printedSchema = printSchemaWithDirectives(schema);
    const astNode = parse(printedSchema);
    const visitorResult = visit(astNode, { leave: visitor });
    const header = visitor.objectIdImport;
    return [header, ...visitorResult.definitions.filter(d => typeof d === 'string')].join('\n');
};
const DIRECTIVES = gql `
  directive @${Directives.UNION}(discriminatorField: String, additionalFields: [AdditionalEntityFields]) on UNION
  directive @${Directives.ABSTRACT_ENTITY}(discriminatorField: String!, additionalFields: [AdditionalEntityFields]) on INTERFACE
  directive @${Directives.ENTITY}(embedded: Boolean, additionalFields: [AdditionalEntityFields]) on OBJECT
  directive @${Directives.COLUMN}(overrideType: String) on FIELD_DEFINITION
  directive @${Directives.ID} on FIELD_DEFINITION
  directive @${Directives.LINK}(overrideType: String) on FIELD_DEFINITION
  directive @${Directives.EMBEDDED} on FIELD_DEFINITION
  directive @${Directives.MAP}(path: String!) on FIELD_DEFINITION
  # Inputs
  input AdditionalEntityFields {
    path: String
    type: String
  }
`;
const addToSchema = DIRECTIVES;
const validate = async (schema, documents, config, outputFile) => {
    if (extname(outputFile) !== '.ts' && extname(outputFile) !== '.tsx') {
        throw new Error(`Plugin "typescript-mongodb" requires extension to be ".ts" or ".tsx"!`);
    }
};

export { DIRECTIVES, addToSchema, plugin, validate };
//# sourceMappingURL=index.esm.js.map
