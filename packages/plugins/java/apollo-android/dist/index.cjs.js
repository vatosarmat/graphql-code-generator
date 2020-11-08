'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

const graphql = require('graphql');
const visitorPluginCommon = require('@graphql-codegen/visitor-plugin-common');
const javaCommon = require('@graphql-codegen/java-common');
const pluginHelpers = require('@graphql-codegen/plugin-helpers');
const crypto = require('crypto');
const pluralize = require('pluralize');
const camelCase = require('camel-case');
const pascalCase = require('pascal-case');
const path = require('path');

const Imports = {
    // Primitives
    String: 'java.lang.String',
    Boolean: 'java.lang.Boolean',
    Integer: 'java.lang.Integer',
    Object: 'java.lang.Object',
    Float: 'java.lang.Float',
    Long: 'java.lang.Long',
    // Java Base
    Class: 'java.lang.Class',
    Arrays: 'java.util.Arrays',
    List: 'java.util.List',
    IOException: 'java.io.IOException',
    Collections: 'java.util.Collections',
    LinkedHashMap: 'java.util.LinkedHashMap',
    Map: 'java.util.Map',
    // Annotations
    Nonnull: 'javax.annotation.Nonnull',
    Nullable: 'javax.annotation.Nullable',
    Override: 'java.lang.Override',
    Generated: 'javax.annotation.Generated',
    // Apollo Android
    ScalarType: 'com.apollographql.apollo.api.ScalarType',
    GraphqlFragment: 'com.apollographql.apollo.api.GraphqlFragment',
    Operation: 'com.apollographql.apollo.api.Operation',
    OperationName: 'com.apollographql.apollo.api.OperationName',
    Mutation: 'com.apollographql.apollo.api.Mutation',
    Query: 'com.apollographql.apollo.api.Query',
    Subscription: 'com.apollographql.apollo.api.Subscription',
    ResponseField: 'com.apollographql.apollo.api.ResponseField',
    ResponseFieldMapper: 'com.apollographql.apollo.api.ResponseFieldMapper',
    ResponseFieldMarshaller: 'com.apollographql.apollo.api.ResponseFieldMarshaller',
    ResponseReader: 'com.apollographql.apollo.api.ResponseReader',
    ResponseWriter: 'com.apollographql.apollo.api.ResponseWriter',
    FragmentResponseFieldMapper: 'com.apollographql.apollo.api.FragmentResponseFieldMapper',
    UnmodifiableMapBuilder: 'com.apollographql.apollo.api.internal.UnmodifiableMapBuilder',
    Utils: 'com.apollographql.apollo.api.internal.Utils',
    InputType: 'com.apollographql.apollo.api.InputType',
    Input: 'com.apollographql.apollo.api.Input',
    InputFieldMarshaller: 'com.apollographql.apollo.api.InputFieldMarshaller',
    InputFieldWriter: 'com.apollographql.apollo.api.InputFieldWriter',
};

const SCALAR_TO_WRITER_METHOD = {
    ID: 'writeString',
    String: 'writeString',
    Int: 'writeInt',
    Boolean: 'writeBoolean',
    Float: 'writeDouble',
};
function isTypeNode(type) {
    return type && !!type.kind;
}
class BaseJavaVisitor extends visitorPluginCommon.BaseVisitor {
    constructor(_schema, rawConfig, additionalConfig) {
        super(rawConfig, {
            ...additionalConfig,
            scalars: visitorPluginCommon.buildScalars(_schema, { ID: 'String' }, javaCommon.JAVA_SCALARS),
        });
        this._schema = _schema;
        this._imports = new Set();
    }
    getPackage() {
        return '';
    }
    additionalContent() {
        return '';
    }
    getImports() {
        return Array.from(this._imports).map(imp => `import ${imp};`);
    }
    getImplementingTypes(node) {
        const allTypesMap = this._schema.getTypeMap();
        const implementingTypes = [];
        for (const graphqlType of Object.values(allTypesMap)) {
            if (graphqlType instanceof graphql.GraphQLObjectType) {
                const allInterfaces = graphqlType.getInterfaces();
                if (allInterfaces.find(int => int.name === node.name)) {
                    implementingTypes.push(graphqlType.name);
                }
            }
        }
        return implementingTypes;
    }
    transformType(type) {
        let schemaType;
        let isNonNull;
        if (isTypeNode(type)) {
            const baseTypeNode = visitorPluginCommon.getBaseTypeNode(type);
            schemaType = this._schema.getType(baseTypeNode.name.value);
            isNonNull = type.kind === graphql.Kind.NON_NULL_TYPE;
        }
        else {
            schemaType = this._schema.getType(pluginHelpers.getBaseType(type).name);
            isNonNull = graphql.isNonNullType(type);
        }
        const javaType = this.getJavaClass(schemaType);
        const annotation = isNonNull ? 'Nonnull' : 'Nullable';
        const typeToUse = isTypeNode(type)
            ? this.getListTypeNodeWrapped(javaType, type)
            : this.getListTypeWrapped(javaType, type);
        return {
            baseType: schemaType.name,
            javaType,
            isNonNull,
            annotation,
            typeToUse,
        };
    }
    // Replaces a GraphQL type with a Java class
    getJavaClass(schemaType) {
        let typeToUse = schemaType.name;
        if (graphql.isScalarType(schemaType)) {
            const scalar = this.scalars[schemaType.name] || 'Object';
            if (Imports[scalar]) {
                this._imports.add(Imports[scalar]);
            }
            typeToUse = scalar;
        }
        else if (graphql.isInputObjectType(schemaType)) {
            // Make sure to import it if it's in use
            this._imports.add(`${this.config.typePackage}.${schemaType.name}`);
        }
        return typeToUse;
    }
    getListTypeWrapped(toWrap, type) {
        if (graphql.isNonNullType(type)) {
            return this.getListTypeWrapped(toWrap, type.ofType);
        }
        if (graphql.isListType(type)) {
            const child = this.getListTypeWrapped(toWrap, type.ofType);
            this._imports.add(Imports.List);
            return `List<${child}>`;
        }
        return toWrap;
    }
    getListTypeNodeWrapped(toWrap, type) {
        if (type.kind === graphql.Kind.NON_NULL_TYPE) {
            return this.getListTypeNodeWrapped(toWrap, type.type);
        }
        if (type.kind === graphql.Kind.LIST_TYPE) {
            const child = this.getListTypeNodeWrapped(toWrap, type.type);
            this._imports.add(Imports.List);
            return `List<${child}>`;
        }
        return toWrap;
    }
}

class InputTypeVisitor extends BaseJavaVisitor {
    constructor(_schema, rawConfig) {
        super(_schema, rawConfig, {
            typePackage: rawConfig.typePackage || 'type',
        });
    }
    getPackage() {
        return this.config.typePackage;
    }
    addInputMembers(cls, fields) {
        fields.forEach(field => {
            const type = this.transformType(field.type);
            const actualType = type.isNonNull ? type.typeToUse : `Input<${type.typeToUse}>`;
            const annotations = type.isNonNull ? [type.annotation] : [];
            this._imports.add(Imports[type.annotation]);
            cls.addClassMember(field.name.value, actualType, null, annotations, 'private', { final: true });
            cls.addClassMethod(field.name.value, actualType, `return this.${field.name.value};`, [], [type.annotation], 'public');
        });
    }
    addInputCtor(cls, className, fields) {
        const impl = fields.map(field => `this.${field.name.value} = ${field.name.value};`).join('\n');
        cls.addClassMethod(className, null, impl, fields.map(f => {
            const type = this.transformType(f.type);
            const actualType = type.isNonNull ? type.typeToUse : `Input<${type.typeToUse}>`;
            this._imports.add(Imports[type.annotation]);
            return {
                name: f.name.value,
                type: actualType,
                annotations: type.isNonNull ? [type.annotation] : [],
            };
        }), [], 'public');
    }
    getFieldWriterCall(field, listItemCall = false) {
        const baseType = visitorPluginCommon.getBaseTypeNode(field.type);
        const schemaType = this._schema.getType(baseType.name.value);
        const isNonNull = field.type.kind === graphql.Kind.NON_NULL_TYPE;
        let writerMethod = null;
        if (graphql.isScalarType(schemaType)) {
            writerMethod = SCALAR_TO_WRITER_METHOD[schemaType.name] || 'writeCustom';
        }
        else if (graphql.isInputObjectType(schemaType)) {
            return listItemCall
                ? `writeObject($item.marshaller())`
                : `writeObject("${field.name.value}", ${field.name.value}.value != null ? ${field.name.value}.value.marshaller() : null)`;
        }
        else if (graphql.isEnumType(schemaType)) {
            writerMethod = 'writeString';
        }
        return listItemCall
            ? `${writerMethod}($item)`
            : `${writerMethod}("${field.name.value}", ${field.name.value}${isNonNull ? '' : '.value'})`;
    }
    getFieldWithTypePrefix(field, wrapWith = null, applyNullable = false) {
        this._imports.add(Imports.Input);
        const typeToUse = this.getJavaClass(this._schema.getType(visitorPluginCommon.getBaseTypeNode(field.type).name.value));
        const isNonNull = field.type.kind === graphql.Kind.NON_NULL_TYPE;
        const name = field.kind === graphql.Kind.INPUT_VALUE_DEFINITION ? field.name.value : field.variable.name.value;
        if (isNonNull) {
            this._imports.add(Imports.Nonnull);
            return `@Nonnull ${typeToUse} ${name}`;
        }
        else {
            if (wrapWith) {
                return typeof wrapWith === 'function' ? `${wrapWith(typeToUse)} ${name}` : `${wrapWith}<${typeToUse}> ${name}`;
            }
            else {
                if (applyNullable) {
                    this._imports.add(Imports.Nullable);
                }
                return `${applyNullable ? '@Nullable ' : ''}${typeToUse} ${name}`;
            }
        }
    }
    buildFieldsMarshaller(field) {
        const isNonNull = field.type.kind === graphql.Kind.NON_NULL_TYPE;
        const isArray = field.type.kind === graphql.Kind.LIST_TYPE ||
            (field.type.kind === graphql.Kind.NON_NULL_TYPE && field.type.type.kind === graphql.Kind.LIST_TYPE);
        const call = this.getFieldWriterCall(field, isArray);
        const baseTypeNode = visitorPluginCommon.getBaseTypeNode(field.type);
        const listItemType = this.getJavaClass(this._schema.getType(baseTypeNode.name.value));
        let result = '';
        // TODO: Refactor
        if (isArray) {
            result = `writer.writeList("${field.name.value}", ${field.name.value}.value != null ? new InputFieldWriter.ListWriter() {
  @Override
  public void write(InputFieldWriter.ListItemWriter listItemWriter) throws IOException {
    for (${listItemType} $item : ${field.name.value}.value) {
      listItemWriter.${call};
    }
  }
} : null);`;
        }
        else {
            result = visitorPluginCommon.indent(`writer.${call};`);
        }
        if (isNonNull) {
            return result;
        }
        else {
            return visitorPluginCommon.indentMultiline(`if(${field.name.value}.defined) {
${visitorPluginCommon.indentMultiline(result)}
}`);
        }
    }
    buildMarshallerOverride(fields) {
        this._imports.add(Imports.Override);
        this._imports.add(Imports.IOException);
        this._imports.add(Imports.InputFieldWriter);
        this._imports.add(Imports.InputFieldMarshaller);
        const allMarshallers = fields.map(field => visitorPluginCommon.indentMultiline(this.buildFieldsMarshaller(field), 2));
        return visitorPluginCommon.indentMultiline(`@Override
public InputFieldMarshaller marshaller() {
  return new InputFieldMarshaller() {
    @Override
    public void marshal(InputFieldWriter writer) throws IOException {
${allMarshallers.join('\n')}
    }
  };
}`);
    }
    buildBuilderNestedClass(className, fields) {
        const builderClassName = 'Builder';
        const privateFields = fields
            .map(field => {
            const isArray = field.type.kind === graphql.Kind.LIST_TYPE ||
                (field.type.kind === graphql.Kind.NON_NULL_TYPE && field.type.type.kind === graphql.Kind.LIST_TYPE);
            const fieldType = this.getFieldWithTypePrefix(field, v => (!isArray ? `Input<${v}>` : `Input<List<${v}>>`));
            const isNonNull = field.type.kind === graphql.Kind.NON_NULL_TYPE;
            return `private ${fieldType}${isNonNull ? '' : ' = Input.absent()'};`;
        })
            .map(s => visitorPluginCommon.indent(s));
        const setters = fields
            .map(field => {
            const isArray = field.type.kind === graphql.Kind.LIST_TYPE ||
                (field.type.kind === graphql.Kind.NON_NULL_TYPE && field.type.type.kind === graphql.Kind.LIST_TYPE);
            const fieldType = this.getFieldWithTypePrefix(field, isArray ? 'List' : null);
            const isNonNull = field.type.kind === graphql.Kind.NON_NULL_TYPE;
            return `\npublic ${builderClassName} ${field.name.value}(${isNonNull ? '' : '@Nullable '}${fieldType}) {
  this.${field.name.value} = ${isNonNull ? field.name.value : `Input.fromNullable(${field.name.value})`};
  return this;
}`;
        })
            .map(s => visitorPluginCommon.indentMultiline(s));
        const nonNullFields = fields
            .filter(f => f.type.kind === graphql.Kind.NON_NULL_TYPE)
            .map(nnField => {
            this._imports.add(Imports.Utils);
            return visitorPluginCommon.indent(`Utils.checkNotNull(${nnField.name.value}, "${nnField.name.value} == null");`, 1);
        });
        const ctor = '\n' + visitorPluginCommon.indent(`${builderClassName}() {}`);
        const buildFn = visitorPluginCommon.indentMultiline(`public ${className} build() {
${nonNullFields.join('\n')}
  return new ${className}(${fields.map(f => f.name.value).join(', ')});
}`);
        const body = [...privateFields, ctor, ...setters, '', buildFn].join('\n');
        return visitorPluginCommon.indentMultiline(new javaCommon.JavaDeclarationBlock()
            .withName(builderClassName)
            .access('public')
            .final()
            .static()
            .withBlock(body)
            .asKind('class').string);
    }
    InputObjectTypeDefinition(node) {
        const className = node.name.value;
        this._imports.add(Imports.InputType);
        this._imports.add(Imports.Generated);
        const cls = new javaCommon.JavaDeclarationBlock()
            .annotate([`Generated("Apollo GraphQL")`])
            .access('public')
            .final()
            .asKind('class')
            .withName(className)
            .implements(['InputType']);
        this.addInputMembers(cls, node.fields);
        this.addInputCtor(cls, className, node.fields);
        cls.addClassMethod('builder', 'Builder', 'return new Builder();', [], [], 'public', { static: true });
        const marshallerOverride = this.buildMarshallerOverride(node.fields);
        const builderClass = this.buildBuilderNestedClass(className, node.fields);
        const classBlock = [marshallerOverride, '', builderClass].join('\n');
        cls.withBlock(classBlock);
        return cls.string;
    }
}

function visitFieldArguments(selection, imports) {
    if (!selection.arguments || selection.arguments.length === 0) {
        return 'null';
    }
    imports.add(Imports.UnmodifiableMapBuilder);
    imports.add(Imports.String);
    imports.add(Imports.Object);
    return graphql.visit(selection, {
        leave: {
            Field: (node) => {
                return (`new UnmodifiableMapBuilder<String, Object>(${node.arguments.length})` + node.arguments.join('') + '.build()');
            },
            Argument: (node) => {
                return `.put("${node.name.value}", ${node.value})`;
            },
            ObjectValue: (node) => {
                return `new UnmodifiableMapBuilder<String, Object>(${node.fields.length})` + node.fields.join('') + '.build()';
            },
            ObjectField: (node) => {
                return `.put("${node.name.value}", ${node.value})`;
            },
            Variable: (node) => {
                return `new UnmodifiableMapBuilder<String, Object>(2).put("kind", "Variable").put("variableName", "${node.name.value}").build()`;
            },
            StringValue: (node) => `"${node.value}"`,
            IntValue: (node) => `"${node.value}"`,
            FloatValue: (node) => `"${node.value}"`,
        },
    });
}

class OperationVisitor extends BaseJavaVisitor {
    constructor(_schema, rawConfig, _availableFragments) {
        super(_schema, rawConfig, {
            package: rawConfig.package || javaCommon.buildPackageNameFromPath(process.cwd()),
            fragmentPackage: rawConfig.fragmentPackage || 'fragment',
            typePackage: rawConfig.typePackage || 'type',
        });
        this._availableFragments = _availableFragments;
        this.visitingFragment = false;
    }
    printDocument(node) {
        return graphql.print(node)
            .replace(/\r?\n|\r/g, ' ')
            .replace(/"/g, '\\"')
            .trim();
    }
    getPackage() {
        return this.visitingFragment ? this.config.fragmentPackage : this.config.package;
    }
    addCtor(className, node, cls) {
        const variables = node.variableDefinitions || [];
        const hasVariables = variables.length > 0;
        const nonNullVariables = variables
            .filter(v => v.type.kind === graphql.Kind.NON_NULL_TYPE)
            .map(v => {
            this._imports.add(Imports.Utils);
            return `Utils.checkNotNull(${v.variable.name.value}, "${v.variable.name.value} == null");`;
        });
        const impl = [
            ...nonNullVariables,
            `this.variables = ${!hasVariables
                ? 'Operation.EMPTY_VARIABLES'
                : `new ${className}.Variables(${variables.map(v => v.variable.name.value).join(', ')})`};`,
        ].join('\n');
        cls.addClassMethod(className, null, impl, node.variableDefinitions.map(varDec => {
            const outputType = visitorPluginCommon.getBaseTypeNode(varDec.type).name.value;
            const schemaType = this._schema.getType(outputType);
            const javaClass = this.getJavaClass(schemaType);
            const typeToUse = this.getListTypeNodeWrapped(javaClass, varDec.type);
            const isNonNull = varDec.type.kind === graphql.Kind.NON_NULL_TYPE;
            return {
                name: varDec.variable.name.value,
                type: typeToUse,
                annotations: [isNonNull ? 'Nonnull' : 'Nullable'],
            };
        }), null, 'public');
    }
    getRootType(operation) {
        if (operation === 'query') {
            return this._schema.getQueryType();
        }
        else if (operation === 'mutation') {
            return this._schema.getMutationType();
        }
        else if (operation === 'subscription') {
            return this._schema.getSubscriptionType();
        }
        else {
            return null;
        }
    }
    createUniqueClassName(inUse, name, count = 0) {
        const possibleNewName = count === 0 ? name : `${name}${count}`;
        while (inUse.includes(possibleNewName)) {
            return this.createUniqueClassName(inUse, name, count + 1);
        }
        return possibleNewName;
    }
    transformSelectionSet(options, isRoot = true) {
        if (!options.result) {
            options.result = {};
        }
        if (!graphql.isObjectType(options.schemaType) && !graphql.isInterfaceType(options.schemaType)) {
            return options.result;
        }
        const className = this.createUniqueClassName(Object.keys(options.result), options.className);
        const cls = new javaCommon.JavaDeclarationBlock()
            .access('public')
            .asKind('class')
            .withName(className)
            .implements(options.implements || []);
        if (!options.nonStaticClass) {
            cls.static();
        }
        options.result[className] = cls;
        const fields = options.schemaType.getFields();
        const childFields = [...(options.additionalFields || [])];
        const childInlineFragments = [];
        const childFragmentSpread = [...(options.additionalFragments || [])];
        const selections = [...(options.selectionSet || [])];
        const responseFieldArr = [];
        for (const selection of selections) {
            if (selection.kind === graphql.Kind.FIELD) {
                this._imports.add(Imports.ResponseField);
                const field = fields[selection.name.value];
                const isObject = selection.selectionSet && selection.selectionSet.selections && selection.selectionSet.selections.length > 0;
                const isNonNull = graphql.isNonNullType(field.type);
                const fieldAnnotation = isNonNull ? 'Nonnull' : 'Nullable';
                this._imports.add(Imports[fieldAnnotation]);
                const baseType = pluginHelpers.getBaseType(field.type);
                const isList = graphql.isListType(field.type) || (graphql.isNonNullType(field.type) && graphql.isListType(field.type.ofType));
                if (isObject) {
                    let childClsName = this.convertName(field.name);
                    if (isList && pluralize.isPlural(childClsName)) {
                        childClsName = pluralize.singular(childClsName);
                    }
                    this.transformSelectionSet({
                        className: childClsName,
                        result: options.result,
                        selectionSet: selection.selectionSet.selections,
                        schemaType: baseType,
                    }, false);
                    childFields.push({
                        rawType: field.type,
                        isObject: true,
                        isList,
                        isFragment: false,
                        type: baseType,
                        isNonNull,
                        annotation: fieldAnnotation,
                        className: childClsName,
                        fieldName: field.name,
                    });
                }
                else {
                    const javaClass = this.getJavaClass(baseType);
                    childFields.push({
                        rawType: field.type,
                        isObject: false,
                        isFragment: false,
                        isList: isList,
                        type: baseType,
                        isNonNull,
                        annotation: fieldAnnotation,
                        className: javaClass,
                        fieldName: field.name,
                    });
                }
                this._imports.add(Imports.ResponseField);
                this._imports.add(Imports.Collections);
                const operationArgs = visitFieldArguments(selection, this._imports);
                const responseFieldMethod = this._resolveResponseFieldMethodForBaseType(field.type);
                responseFieldArr.push(`ResponseField.${responseFieldMethod.fn}("${selection.alias ? selection.alias.value : selection.name.value}", "${selection.name.value}", ${operationArgs}, ${!graphql.isNonNullType(field.type)},${responseFieldMethod.custom ? ` CustomType.${baseType.name},` : ''} Collections.<ResponseField.Condition>emptyList())`);
            }
            else if (selection.kind === graphql.Kind.INLINE_FRAGMENT) {
                if (graphql.isUnionType(options.schemaType) || graphql.isInterfaceType(options.schemaType)) {
                    childInlineFragments.push({
                        onType: selection.typeCondition.name.value,
                        node: selection,
                    });
                }
                else {
                    selections.push(...selection.selectionSet.selections);
                }
            }
            else if (selection.kind === graphql.Kind.FRAGMENT_SPREAD) {
                const fragment = this._availableFragments.find(f => f.name === selection.name.value);
                if (fragment) {
                    childFragmentSpread.push(fragment);
                    this._imports.add(`${this.config.fragmentPackage}.${fragment.name}`);
                }
                else {
                    throw new Error(`Fragment with name ${selection.name.value} was not loaded as document!`);
                }
            }
        }
        if (childInlineFragments.length > 0) {
            const childFieldsBase = [...childFields];
            childFields.push(...childInlineFragments.map(inlineFragment => {
                const cls = `As${inlineFragment.onType}`;
                const schemaType = this._schema.getType(inlineFragment.onType);
                this.transformSelectionSet({
                    additionalFields: childFieldsBase,
                    additionalFragments: childFragmentSpread,
                    className: cls,
                    result: options.result,
                    selectionSet: inlineFragment.node.selectionSet.selections,
                    schemaType,
                }, false);
                this._imports.add(Imports.Nullable);
                return {
                    isFragment: false,
                    rawType: schemaType,
                    isObject: true,
                    isList: false,
                    type: schemaType,
                    isNonNull: false,
                    annotation: 'Nullable',
                    className: cls,
                    fieldName: `as${inlineFragment.onType}`,
                };
            }));
            responseFieldArr.push(...childInlineFragments.map(f => {
                this._imports.add(Imports.Arrays);
                return `ResponseField.forInlineFragment("__typename", "__typename", Arrays.asList("${f.onType}"))`;
            }));
        }
        if (childFragmentSpread.length > 0) {
            responseFieldArr.push(`ResponseField.forFragment("__typename", "__typename", Arrays.asList(${childFragmentSpread
                .map(f => `"${f.onType}"`)
                .join(', ')}))`);
            this._imports.add(Imports.ResponseField);
            this._imports.add(Imports.Nonnull);
            this._imports.add(Imports.Arrays);
            const fragmentsClassName = 'Fragments';
            childFields.push({
                isObject: true,
                isList: false,
                isFragment: true,
                rawType: options.schemaType,
                type: options.schemaType,
                isNonNull: true,
                annotation: 'Nonnull',
                className: fragmentsClassName,
                fieldName: 'fragments',
            });
            const fragmentsClass = new javaCommon.JavaDeclarationBlock()
                .withName(fragmentsClassName)
                .access('public')
                .static()
                .final()
                .asKind('class');
            const fragmentMapperClass = new javaCommon.JavaDeclarationBlock()
                .withName('Mapper')
                .access('public')
                .static()
                .final()
                .implements([`FragmentResponseFieldMapper<${fragmentsClassName}>`])
                .asKind('class');
            fragmentsClass.addClassMethod(fragmentsClassName, null, childFragmentSpread
                .map(spread => {
                const varName = camelCase.camelCase(spread.name);
                this._imports.add(Imports.Utils);
                return `this.${varName} = Utils.checkNotNull(${varName}, "${varName} == null");`;
            })
                .join('\n'), childFragmentSpread.map(spread => ({
                name: camelCase.camelCase(spread.name),
                type: spread.name,
                annotations: ['Nonnull'],
            })), [], 'public');
            for (const spread of childFragmentSpread) {
                const fragmentVarName = camelCase.camelCase(spread.name);
                fragmentsClass.addClassMember(fragmentVarName, spread.name, null, ['Nonnull'], 'private', { final: true });
                fragmentsClass.addClassMethod(fragmentVarName, spread.name, `return this.${fragmentVarName};`, [], ['Nonnull'], 'public', {}, []);
                fragmentMapperClass.addClassMember(`${fragmentVarName}FieldMapper`, `${spread.name}.Mapper`, `new ${spread.name}.Mapper()`, [], 'private', { final: true });
            }
            fragmentMapperClass.addClassMethod('map', fragmentsClassName, `
${childFragmentSpread
                .map(spread => {
                const fragmentVarName = camelCase.camelCase(spread.name);
                return `${spread.name} ${fragmentVarName} = null;
if (${spread.name}.POSSIBLE_TYPES.contains(conditionalType)) {
  ${fragmentVarName} = ${fragmentVarName}FieldMapper.map(reader);
}`;
            })
                .join('\n')}

return new Fragments(${childFragmentSpread
                .map(spread => {
                const fragmentVarName = camelCase.camelCase(spread.name);
                return `Utils.checkNotNull(${fragmentVarName}, "${fragmentVarName} == null")`;
            })
                .join(', ')});
      `, [
                {
                    name: 'reader',
                    type: 'ResponseReader',
                },
                {
                    name: 'conditionalType',
                    type: 'String',
                    annotations: ['Nonnull'],
                },
            ], ['Nonnull'], 'public', {}, ['Override']);
            this._imports.add(Imports.String);
            this._imports.add(Imports.ResponseReader);
            this._imports.add(Imports.ResponseFieldMarshaller);
            this._imports.add(Imports.ResponseWriter);
            fragmentsClass.addClassMethod('marshaller', 'ResponseFieldMarshaller', `return new ResponseFieldMarshaller() {
  @Override
  public void marshal(ResponseWriter writer) {
${childFragmentSpread
                .map(spread => {
                const fragmentVarName = camelCase.camelCase(spread.name);
                return visitorPluginCommon.indentMultiline(`final ${spread.name} $${fragmentVarName} = ${fragmentVarName};\nif ($${fragmentVarName} != null) { $${fragmentVarName}.marshaller().marshal(writer); }`, 2);
            })
                .join('\n')}
  }
};
      `, [], [], 'public');
            fragmentsClass.addClassMember('$toString', 'String', null, [], 'private', { volatile: true });
            fragmentsClass.addClassMember('$hashCode', 'int', null, [], 'private', { volatile: true });
            fragmentsClass.addClassMember('$hashCodeMemoized', 'boolean', null, [], 'private', { volatile: true });
            fragmentsClass.addClassMethod('toString', 'String', `if ($toString == null) {
    $toString = "${fragmentsClassName}{"
  ${childFragmentSpread
                .map(spread => {
                const varName = camelCase.camelCase(spread.name);
                return visitorPluginCommon.indent(`+ "${varName}=" + ${varName} + ", "`, 2);
            })
                .join('\n')}
      + "}";
  }
  
  return $toString;`, [], [], 'public', {}, ['Override']);
            // Add equals
            fragmentsClass.addClassMethod('equals', 'boolean', `if (o == this) {
    return true;
  }
  if (o instanceof ${fragmentsClassName}) {
    ${fragmentsClassName} that = (${fragmentsClassName}) o;
    return ${childFragmentSpread
                .map(spread => {
                const varName = camelCase.camelCase(spread.name);
                return `this.${varName}.equals(that.${varName})`;
            })
                .join(' && ')};
  }
  
  return false;`, [{ name: 'o', type: 'Object' }], [], 'public', {}, ['Override']);
            // hashCode
            fragmentsClass.addClassMethod('hashCode', 'int', `if (!$hashCodeMemoized) {
    int h = 1;
  ${childFragmentSpread
                .map(spread => {
                const varName = camelCase.camelCase(spread.name);
                return visitorPluginCommon.indentMultiline(`h *= 1000003;\nh ^= ${varName}.hashCode();`, 1);
            })
                .join('\n')}
    $hashCode = h;
    $hashCodeMemoized = true;
  }
  
  return $hashCode;`, [], [], 'public', {}, ['Override']);
            this._imports.add(Imports.FragmentResponseFieldMapper);
            fragmentsClass.nestedClass(fragmentMapperClass);
            cls.nestedClass(fragmentsClass);
        }
        if (responseFieldArr.length > 0 && !isRoot) {
            responseFieldArr.unshift(`ResponseField.forString("__typename", "__typename", null, false, Collections.<ResponseField.Condition>emptyList())`);
        }
        if (!isRoot) {
            this._imports.add(Imports.Nonnull);
            childFields.unshift({
                isObject: false,
                isFragment: false,
                isList: false,
                type: graphql.GraphQLString,
                rawType: graphql.GraphQLString,
                isNonNull: true,
                annotation: 'Nonnull',
                className: 'String',
                fieldName: '__typename',
            });
        }
        // Add members
        childFields.forEach(c => {
            cls.addClassMember(c.fieldName, this.getListTypeWrapped(c.className, c.rawType), null, [c.annotation], 'private', { final: true });
        });
        // Add $toString, $hashCode, $hashCodeMemoized
        cls.addClassMember('$toString', 'String', null, [], 'private', { volatile: true });
        cls.addClassMember('$hashCode', 'int', null, [], 'private', { volatile: true });
        cls.addClassMember('$hashCodeMemoized', 'boolean', null, [], 'private', { volatile: true });
        // Add responseFields for all fields
        cls.addClassMember('$responseFields', 'ResponseField[]', `{\n${visitorPluginCommon.indentMultiline(responseFieldArr.join(',\n'), 2) + '\n  }'}`, [], null, { static: true, final: true });
        // Add Ctor
        this._imports.add(Imports.Utils);
        cls.addClassMethod(className, null, childFields
            .map(c => `this.${c.fieldName} = ${c.isNonNull ? `Utils.checkNotNull(${c.fieldName}, "${c.fieldName} == null")` : c.fieldName};`)
            .join('\n'), childFields.map(c => ({
            name: c.fieldName,
            type: this.getListTypeWrapped(c.className, c.rawType),
            annotations: [c.annotation],
        })), null, 'public');
        // Add getters for all members
        childFields.forEach(c => {
            cls.addClassMethod(c.fieldName, this.getListTypeWrapped(c.className, c.rawType), `return this.${c.fieldName};`, [], [c.annotation], 'public', {});
        });
        // Add .toString()
        cls.addClassMethod('toString', 'String', `if ($toString == null) {
  $toString = "${className}{"
${childFields.map(c => visitorPluginCommon.indent(`+ "${c.fieldName}=" + ${c.fieldName} + ", "`, 2)).join('\n')}
    + "}";
}

return $toString;`, [], [], 'public', {}, ['Override']);
        // Add equals
        cls.addClassMethod('equals', 'boolean', `if (o == this) {
  return true;
}
if (o instanceof ${className}) {
  ${className} that = (${className}) o;
  return ${childFields
            .map(c => c.isNonNull
            ? `this.${c.fieldName}.equals(that.${c.fieldName})`
            : `((this.${c.fieldName} == null) ? (that.${c.fieldName} == null) : this.${c.fieldName}.equals(that.${c.fieldName}))`)
            .join(' && ')};
}

return false;`, [{ name: 'o', type: 'Object' }], [], 'public', {}, ['Override']);
        // hashCode
        cls.addClassMethod('hashCode', 'int', `if (!$hashCodeMemoized) {
  int h = 1;
${childFields
            .map(f => visitorPluginCommon.indentMultiline(`h *= 1000003;\nh ^= ${!f.isNonNull ? `(${f.fieldName} == null) ? 0 : ` : ''}${f.fieldName}.hashCode();`, 1))
            .join('\n')}
  $hashCode = h;
  $hashCodeMemoized = true;
}

return $hashCode;`, [], [], 'public', {}, ['Override']);
        this._imports.add(Imports.ResponseReader);
        this._imports.add(Imports.ResponseFieldMarshaller);
        this._imports.add(Imports.ResponseWriter);
        // marshaller
        cls.addClassMethod('marshaller', 'ResponseFieldMarshaller', `return new ResponseFieldMarshaller() {
  @Override
  public void marshal(ResponseWriter writer) {
${childFields
            .map((f, index) => {
            const writerMethod = this._getWriterMethodByType(f.type);
            if (f.isList) {
                return visitorPluginCommon.indentMultiline(`writer.writeList($responseFields[${index}], ${f.fieldName}, new ResponseWriter.ListWriter() {
  @Override
  public void write(Object value, ResponseWriter.ListItemWriter listItemWriter) {
    listItemWriter.${writerMethod.name}(((${f.className}) value)${writerMethod.useMarshaller ? '.marshaller()' : ''});
  }
});`, 2);
            }
            let fValue = `${f.fieldName}${writerMethod.useMarshaller ? '.marshaller()' : ''}`;
            if (writerMethod.checkNull || !f.isNonNull) {
                fValue = `${f.fieldName} != null ? ${fValue} : null`;
            }
            return visitorPluginCommon.indent(`writer.${writerMethod.name}(${writerMethod.castTo ? `(${writerMethod.castTo}) ` : ''}$responseFields[${index}], ${fValue});`, 2);
        })
            .join('\n')}
  }
};`, [], [], 'public');
        cls.nestedClass(this.buildMapperClass(className, childFields));
        return options.result;
    }
    getReaderFn(baseType) {
        if (graphql.isScalarType(baseType)) {
            if (baseType.name === 'String') {
                return { fn: `readString` };
            }
            else if (baseType.name === 'Int') {
                return { fn: `readInt` };
            }
            else if (baseType.name === 'Float') {
                return { fn: `readDouble` };
            }
            else if (baseType.name === 'Boolean') {
                return { fn: `readBoolean` };
            }
            else {
                return { fn: `readCustomType`, custom: true };
            }
        }
        else if (graphql.isEnumType(baseType)) {
            return { fn: `readString` };
        }
        else {
            return { fn: `readObject`, object: baseType.name };
        }
    }
    buildMapperClass(parentClassName, childFields) {
        const wrapList = (childField, rawType, edgeStr) => {
            if (graphql.isNonNullType(rawType)) {
                return wrapList(childField, rawType.ofType, edgeStr);
            }
            if (graphql.isListType(rawType)) {
                const typeStr = this.getListTypeWrapped(childField.className, rawType.ofType);
                const innerContent = wrapList(childField, rawType.ofType, edgeStr);
                const inner = graphql.isListType(rawType.ofType) ? `return listItemReader.readList(${innerContent});` : innerContent;
                return `new ResponseReader.ListReader<${typeStr}>() {
  @Override
  public ${typeStr} read(ResponseReader.ListItemReader listItemReader) {
${visitorPluginCommon.indentMultiline(inner, 2)}
  }
}`;
            }
            return edgeStr;
        };
        this._imports.add(Imports.ResponseReader);
        const mapperBody = childFields.map((f, index) => {
            const varDec = `final ${this.getListTypeWrapped(f.className, f.rawType)} ${f.fieldName} =`;
            const readerFn = this.getReaderFn(f.type);
            if (f.isFragment) {
                return `${varDec} reader.readConditional($responseFields[${index}], new ResponseReader.ConditionalTypeReader<${f.className}>() {
          @Override
          public ${f.className} read(String conditionalType, ResponseReader reader) {
            return fragmentsFieldMapper.map(reader, conditionalType);
          }
        });`;
            }
            else if (f.isList) {
                const listReader = readerFn.object
                    ? `return listItemReader.${readerFn.fn}(new ResponseReader.ObjectReader<Item>() {
          @Override
          public Item read(ResponseReader reader) {
            return ${f.fieldName}FieldMapper.map(reader);
          }
        });`
                    : `return listItemReader.${readerFn.fn}();`;
                const wrappedList = wrapList(f, f.rawType, listReader);
                return `${varDec} reader.readList($responseFields[${index}], ${wrappedList});`;
            }
            else if (readerFn.object) {
                return `${varDec} reader.readObject($responseFields[${index}], new ResponseReader.ObjectReader<${f.className}>() {
          @Override
          public ${f.className} read(ResponseReader reader) {
            return ${f.fieldName}FieldMapper.map(reader);
          }
        });`;
            }
            else {
                return `${varDec} reader.${readerFn.fn}(${readerFn.custom ? '(ResponseField.CustomTypeField) ' : ''}$responseFields[${index}]);`;
            }
        });
        const mapperImpl = [
            ...mapperBody,
            `return new ${parentClassName}(${childFields.map(f => f.fieldName).join(', ')});`,
        ].join('\n');
        const cls = new javaCommon.JavaDeclarationBlock()
            .access('public')
            .static()
            .final()
            .asKind('class')
            .withName('Mapper')
            .implements([`ResponseFieldMapper<${parentClassName}>`])
            .addClassMethod('map', parentClassName, mapperImpl, [
            {
                name: 'reader',
                type: 'ResponseReader',
            },
        ], [], 'public', {}, ['Override']);
        childFields
            .filter(c => c.isObject)
            .forEach(childField => {
            cls.addClassMember(`${childField.fieldName}FieldMapper`, `${childField.className}.Mapper`, `new ${childField.className}.Mapper()`, [], 'private', { final: true });
        });
        return cls;
    }
    _resolveResponseFieldMethodForBaseType(baseType) {
        if (graphql.isListType(baseType)) {
            return { fn: `forList` };
        }
        else if (graphql.isNonNullType(baseType)) {
            return this._resolveResponseFieldMethodForBaseType(baseType.ofType);
        }
        else if (graphql.isScalarType(baseType)) {
            if (baseType.name === 'String') {
                return { fn: `forString` };
            }
            else if (baseType.name === 'Int') {
                return { fn: `forInt` };
            }
            else if (baseType.name === 'Float') {
                return { fn: `forDouble` };
            }
            else if (baseType.name === 'Boolean') {
                return { fn: `forBoolean` };
            }
            else {
                this._imports.add(`${this.config.typePackage}.CustomType`);
                return { fn: `forCustomType`, custom: true };
            }
        }
        else if (graphql.isEnumType(baseType)) {
            return { fn: `forEnum` };
        }
        else {
            return { fn: `forObject` };
        }
    }
    FragmentDefinition(node) {
        this.visitingFragment = true;
        const className = node.name.value;
        const schemaType = this._schema.getType(node.typeCondition.name.value);
        this._imports.add(Imports.Arrays);
        this._imports.add(Imports.GraphqlFragment);
        this._imports.add(Imports.List);
        this._imports.add(Imports.String);
        this._imports.add(Imports.Collections);
        this._imports.add(Imports.Override);
        this._imports.add(Imports.Generated);
        this._imports.add(Imports.ResponseFieldMapper);
        const dataClasses = this.transformSelectionSet({
            className: className,
            nonStaticClass: true,
            implements: ['GraphqlFragment'],
            selectionSet: node.selectionSet && node.selectionSet.selections ? node.selectionSet.selections : [],
            result: {},
            schemaType: schemaType,
        }, false);
        const rootCls = dataClasses[className];
        const printed = this.printDocument(node);
        rootCls.addClassMember('FRAGMENT_DEFINITION', 'String', `"${printed}"`, [], 'public', {
            static: true,
            final: true,
        });
        const possibleTypes = graphql.isObjectType(schemaType) ? [schemaType.name] : this.getImplementingTypes(schemaType);
        rootCls.addClassMember('POSSIBLE_TYPES', 'List<String>', `Collections.unmodifiableList(Arrays.asList(${possibleTypes.map(t => `"${t}"`).join(', ')}))`, [], 'public', { static: true, final: true });
        Object.keys(dataClasses)
            .filter(name => name !== className)
            .forEach(clsName => {
            rootCls.nestedClass(dataClasses[clsName]);
        });
        return rootCls.string;
    }
    OperationDefinition(node) {
        this.visitingFragment = false;
        const operationType = pascalCase.pascalCase(node.operation);
        const operationSchemaType = this.getRootType(node.operation);
        const className = node.name.value.endsWith(operationType) ? operationType : `${node.name.value}${operationType}`;
        this._imports.add(Imports[operationType]);
        this._imports.add(Imports.String);
        this._imports.add(Imports.Override);
        this._imports.add(Imports.Generated);
        this._imports.add(Imports.OperationName);
        this._imports.add(Imports.Operation);
        this._imports.add(Imports.ResponseFieldMapper);
        const cls = new javaCommon.JavaDeclarationBlock()
            .annotate([`Generated("Apollo GraphQL")`])
            .access('public')
            .final()
            .asKind('class')
            .withName(className);
        const printed = this.printDocument(node);
        cls.implements([
            `${operationType}<${className}.Data, ${className}.Data, ${node.variableDefinitions.length === 0 ? 'Operation' : className}.Variables>`,
        ]);
        cls.addClassMember('OPERATION_DEFINITION', 'String', `"${printed}"`, [], 'public', { static: true, final: true });
        cls.addClassMember('QUERY_DOCUMENT', 'String', 'OPERATION_DEFINITION', [], 'public', { static: true, final: true });
        cls.addClassMember('OPERATION_NAME', 'OperationName', `new OperationName() {
  @Override
  public String name() {
    return "${node.name.value}";
  }
}`, [], 'public', { static: true, final: true });
        cls.addClassMember('variables', `${node.variableDefinitions.length === 0 ? 'Operation' : className}.Variables`, null, [], 'private', { final: true });
        cls.addClassMethod('queryDocument', `String`, `return QUERY_DOCUMENT;`, [], [], 'public', {}, ['Override']);
        cls.addClassMethod('wrapData', `${className}.Data`, `return data;`, [
            {
                name: 'data',
                type: `${className}.Data`,
            },
        ], [], 'public', {}, ['Override']);
        cls.addClassMethod('variables', `${node.variableDefinitions.length === 0 ? 'Operation' : className}.Variables`, `return variables;`, [], [], 'public', {}, ['Override']);
        cls.addClassMethod('responseFieldMapper', `ResponseFieldMapper<${className}.Data>`, `return new Data.Mapper();`, [], [], 'public', {}, ['Override']);
        cls.addClassMethod('builder', `Builder`, `return new Builder();`, [], [], 'public', { static: true }, []);
        cls.addClassMethod('name', `OperationName`, `return OPERATION_NAME;`, [], [], 'public', {}, ['Override']);
        cls.addClassMethod('operationId', `String`, `return "${crypto.createHash('md5').update(printed).digest('hex')}";`, [], [], 'public', {}, []);
        this.addCtor(className, node, cls);
        this._imports.add(Imports.Operation);
        const dataClasses = this.transformSelectionSet({
            className: 'Data',
            implements: ['Operation.Data'],
            selectionSet: node.selectionSet && node.selectionSet.selections ? node.selectionSet.selections : [],
            result: {},
            schemaType: operationSchemaType,
        });
        Object.keys(dataClasses).forEach(className => {
            cls.nestedClass(dataClasses[className]);
        });
        cls.nestedClass(this.createBuilderClass(className, node.variableDefinitions || []));
        cls.nestedClass(this.createVariablesClass(className, node.variableDefinitions || []));
        return cls.string;
    }
    createVariablesClass(parentClassName, variables) {
        const className = 'Variables';
        const cls = new javaCommon.JavaDeclarationBlock()
            .static()
            .access('public')
            .final()
            .asKind('class')
            .extends(['Operation.Variables'])
            .withName(className);
        const ctorImpl = [];
        const ctorArgs = [];
        variables.forEach(variable => {
            ctorImpl.push(`this.${variable.variable.name.value} = ${variable.variable.name.value};`);
            ctorImpl.push(`this.valueMap.put("${variable.variable.name.value}", ${variable.variable.name.value});`);
            const baseTypeNode = visitorPluginCommon.getBaseTypeNode(variable.type);
            const schemaType = this._schema.getType(baseTypeNode.name.value);
            const javaClass = this.getJavaClass(schemaType);
            const annotation = graphql.isNonNullType(variable.type) ? 'Nullable' : 'Nonnull';
            this._imports.add(Imports[annotation]);
            ctorArgs.push({ name: variable.variable.name.value, type: javaClass, annotations: [annotation] });
            cls.addClassMember(variable.variable.name.value, javaClass, null, [annotation], 'private');
            cls.addClassMethod(variable.variable.name.value, javaClass, `return ${variable.variable.name.value};`, [], [], 'public');
        });
        this._imports.add(Imports.LinkedHashMap);
        this._imports.add(Imports.Map);
        cls.addClassMethod(className, null, ctorImpl.join('\n'), ctorArgs, [], 'public');
        cls.addClassMember('valueMap', 'Map<String, Object>', 'new LinkedHashMap<>()', [], 'private', {
            final: true,
            transient: true,
        });
        cls.addClassMethod('valueMap', 'Map<String, Object>', 'return Collections.unmodifiableMap(valueMap);', [], [], 'public', {}, ['Override']);
        const marshallerImpl = `return new InputFieldMarshaller() {
  @Override
  public void marshal(InputFieldWriter writer) throws IOException {
${variables
            .map(v => {
            const baseTypeNode = visitorPluginCommon.getBaseTypeNode(v.type);
            const schemaType = this._schema.getType(baseTypeNode.name.value);
            const writerMethod = this._getWriterMethodByType(schemaType, true);
            return visitorPluginCommon.indent(`writer.${writerMethod.name}("${v.variable.name.value}", ${writerMethod.checkNull
                ? `${v.variable.name.value} != null ? ${v.variable.name.value}${writerMethod.useMarshaller ? '.marshaller()' : ''} : null`
                : v.variable.name.value});`, 2);
        })
            .join('\n')}
  }
};`;
        this._imports.add(Imports.InputFieldMarshaller);
        this._imports.add(Imports.InputFieldWriter);
        this._imports.add(Imports.IOException);
        cls.addClassMethod('marshaller', 'InputFieldMarshaller', marshallerImpl, [], [], 'public', {}, ['Override']);
        return cls;
    }
    _getWriterMethodByType(schemaType, idAsString = false) {
        if (graphql.isScalarType(schemaType)) {
            if (SCALAR_TO_WRITER_METHOD[schemaType.name] && (idAsString || schemaType.name !== 'ID')) {
                return {
                    name: SCALAR_TO_WRITER_METHOD[schemaType.name],
                    checkNull: false,
                    useMarshaller: false,
                };
            }
            return { name: 'writeCustom', checkNull: false, useMarshaller: false, castTo: 'ResponseField.CustomTypeField' };
        }
        else if (graphql.isInputObjectType(schemaType)) {
            return { name: 'writeObject', checkNull: true, useMarshaller: true };
        }
        else if (graphql.isEnumType(schemaType)) {
            return { name: 'writeString', checkNull: false, useMarshaller: false };
        }
        else if (graphql.isObjectType(schemaType) || graphql.isInterfaceType(schemaType)) {
            return { name: 'writeObject', checkNull: true, useMarshaller: true };
        }
        return { name: 'writeString', useMarshaller: false, checkNull: false };
    }
    createBuilderClass(parentClassName, variables) {
        const builderClassName = 'Builder';
        const cls = new javaCommon.JavaDeclarationBlock()
            .static()
            .final()
            .access('public')
            .asKind('class')
            .withName(builderClassName)
            .addClassMethod(builderClassName, null, '');
        variables.forEach(variable => {
            const baseTypeNode = visitorPluginCommon.getBaseTypeNode(variable.type);
            const schemaType = this._schema.getType(baseTypeNode.name.value);
            const javaClass = this.getJavaClass(schemaType);
            const annotation = graphql.isNonNullType(variable.type) ? 'Nonnull' : 'Nullable';
            this._imports.add(Imports[annotation]);
            cls.addClassMember(variable.variable.name.value, javaClass, null, [annotation], 'private');
            cls.addClassMethod(variable.variable.name.value, builderClassName, `this.${variable.variable.name.value} = ${variable.variable.name.value};\nreturn this;`, [
                {
                    name: variable.variable.name.value,
                    type: javaClass,
                    annotations: [annotation],
                },
            ], [], 'public');
        });
        this._imports.add(Imports.Utils);
        const nonNullChecks = variables
            .filter(f => graphql.isNonNullType(f))
            .map(f => `Utils.checkNotNull(${f.variable.name.value}, "${f.variable.name.value} == null");`);
        const returnStatement = `return new ${parentClassName}(${variables.map(v => v.variable.name.value).join(', ')});`;
        cls.addClassMethod('build', parentClassName, `${[...nonNullChecks, returnStatement].join('\n')}`, [], [], 'public');
        return cls;
    }
}

var FileType;
(function (FileType) {
    FileType[FileType["INPUT_TYPE"] = 0] = "INPUT_TYPE";
    FileType[FileType["OPERATION"] = 1] = "OPERATION";
    FileType[FileType["FRAGMENT"] = 2] = "FRAGMENT";
    FileType[FileType["CUSTOM_TYPES"] = 3] = "CUSTOM_TYPES";
})(FileType || (FileType = {}));

const filteredScalars = ['String', 'Float', 'Int', 'Boolean'];
class CustomTypeClassVisitor extends BaseJavaVisitor {
    constructor(schema, rawConfig) {
        super(schema, rawConfig, {
            typePackage: rawConfig.typePackage || 'type',
        });
    }
    extract(name) {
        const lastIndex = name.lastIndexOf('.');
        if (lastIndex === -1) {
            return {
                className: name,
                importFrom: Imports[name] || null,
            };
        }
        else {
            return {
                className: name.substring(lastIndex + 1),
                importFrom: name,
            };
        }
    }
    additionalContent() {
        this._imports.add(Imports.ScalarType);
        this._imports.add(Imports.Class);
        this._imports.add(Imports.Override);
        this._imports.add(Imports.Generated);
        const allTypes = this._schema.getTypeMap();
        const enumValues = Object.keys(allTypes)
            .filter(t => graphql.isScalarType(allTypes[t]) && !filteredScalars.includes(t))
            .map(t => allTypes[t])
            .map(scalarType => {
            const uppercaseName = scalarType.name.toUpperCase();
            const javaType = this.extract(this.scalars[scalarType.name] || 'String');
            if (javaType.importFrom) {
                this._imports.add(javaType.importFrom);
            }
            return visitorPluginCommon.indentMultiline(`${uppercaseName} {
  @Override
  public String typeName() {
    return "${scalarType.name}";
  }

  @Override
  public Class javaType() {
    return ${javaType.className}.class;
  }
}`);
        })
            .join(',\n\n');
        return new javaCommon.JavaDeclarationBlock()
            .annotate([`Generated("Apollo GraphQL")`])
            .access('public')
            .asKind('enum')
            .withName('CustomType')
            .implements(['ScalarType'])
            .withBlock(enumValues).string;
    }
    getPackage() {
        return this.config.typePackage;
    }
}

const plugin = (schema, documents, config) => {
    const allAst = graphql.concatAST(documents.map(v => v.document));
    const allFragments = [
        ...allAst.definitions.filter(d => d.kind === graphql.Kind.FRAGMENT_DEFINITION).map(fragmentDef => ({
            node: fragmentDef,
            name: fragmentDef.name.value,
            onType: fragmentDef.typeCondition.name.value,
            isExternal: false,
        })),
        ...(config.externalFragments || []),
    ];
    let visitor;
    switch (config.fileType) {
        case FileType.FRAGMENT:
        case FileType.OPERATION: {
            visitor = new OperationVisitor(schema, config, allFragments);
            break;
        }
        case FileType.INPUT_TYPE: {
            visitor = new InputTypeVisitor(schema, config);
            break;
        }
        case FileType.CUSTOM_TYPES: {
            visitor = new CustomTypeClassVisitor(schema, config);
            break;
        }
    }
    if (!visitor) {
        return { content: '' };
    }
    const visitResult = graphql.visit(allAst, visitor);
    const additionalContent = visitor.additionalContent();
    const imports = visitor.getImports();
    return {
        prepend: [`package ${visitor.getPackage()};\n`, ...imports],
        content: '\n' + [...visitResult.definitions.filter(a => a && typeof a === 'string'), additionalContent].join('\n'),
    };
};

const packageNameToDirectory = (packageName) => {
    return `./${packageName.split('.').join('/')}/`;
};
const preset = {
    buildGeneratesSection: options => {
        const outDir = options.baseOutputDir;
        const inputTypesAst = [];
        graphql.visit(options.schema, {
            enter: {
                InputObjectTypeDefinition(node) {
                    inputTypesAst.push(node);
                },
            },
        });
        const inputTypesDocumentNode = { kind: graphql.Kind.DOCUMENT, definitions: inputTypesAst };
        const allAst = graphql.concatAST(options.documents.map(v => v.document));
        const operationsAst = allAst.definitions.filter(d => d.kind === graphql.Kind.OPERATION_DEFINITION);
        const fragments = allAst.definitions.filter(d => d.kind === graphql.Kind.FRAGMENT_DEFINITION);
        const externalFragments = fragments.map(frag => ({
            isExternal: true,
            importFrom: frag.name.value,
            name: frag.name.value,
            onType: frag.typeCondition.name.value,
            node: frag,
        }));
        return [
            {
                filename: path.join(outDir, packageNameToDirectory(options.config.typePackage), 'CustomType.java'),
                plugins: options.plugins,
                pluginMap: options.pluginMap,
                config: {
                    ...options.config,
                    fileType: FileType.CUSTOM_TYPES,
                },
                schema: options.schema,
                documents: [],
            },
            ...inputTypesDocumentNode.definitions.map((ast) => {
                return {
                    filename: path.join(outDir, packageNameToDirectory(options.config.typePackage), ast.name.value + '.java'),
                    plugins: options.plugins,
                    pluginMap: options.pluginMap,
                    config: {
                        ...options.config,
                        fileType: FileType.INPUT_TYPE,
                        skipDocumentsValidation: true,
                    },
                    schema: options.schema,
                    documents: [{ document: { kind: graphql.Kind.DOCUMENT, definitions: [ast] }, location: '' }],
                };
            }),
            ...operationsAst.map((ast) => {
                const fileName = ast.name.value.toLowerCase().endsWith(ast.operation)
                    ? ast.name.value
                    : `${ast.name.value}${pascalCase.pascalCase(ast.operation)}`;
                return {
                    filename: path.join(outDir, packageNameToDirectory(options.config.package), fileName + '.java'),
                    plugins: options.plugins,
                    pluginMap: options.pluginMap,
                    config: {
                        ...options.config,
                        fileType: FileType.OPERATION,
                        externalFragments,
                    },
                    schema: options.schema,
                    documents: [{ document: { kind: graphql.Kind.DOCUMENT, definitions: [ast] }, location: '' }],
                };
            }),
            ...fragments.map((ast) => {
                return {
                    filename: path.join(outDir, packageNameToDirectory(options.config.fragmentPackage), ast.name.value + '.java'),
                    plugins: options.plugins,
                    pluginMap: options.pluginMap,
                    config: {
                        ...options.config,
                        fileType: FileType.FRAGMENT,
                        externalFragments,
                    },
                    schema: options.schema,
                    documents: [{ document: { kind: graphql.Kind.DOCUMENT, definitions: [ast] }, location: '' }],
                };
            }),
        ];
    },
};

exports.plugin = plugin;
exports.preset = preset;
//# sourceMappingURL=index.cjs.js.map
