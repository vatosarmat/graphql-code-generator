import { Imports } from './imports';
import { BaseVisitor, getBaseTypeNode, buildScalars } from '@graphql-codegen/visitor-plugin-common';
import { getBaseType } from '@graphql-codegen/plugin-helpers';
import { JAVA_SCALARS } from '@graphql-codegen/java-common';
import { isScalarType, isInputObjectType, Kind, isNonNullType, isListType, GraphQLObjectType, } from 'graphql';
export const SCALAR_TO_WRITER_METHOD = {
    ID: 'writeString',
    String: 'writeString',
    Int: 'writeInt',
    Boolean: 'writeBoolean',
    Float: 'writeDouble',
};
function isTypeNode(type) {
    return type && !!type.kind;
}
export class BaseJavaVisitor extends BaseVisitor {
    constructor(_schema, rawConfig, additionalConfig) {
        super(rawConfig, {
            ...additionalConfig,
            scalars: buildScalars(_schema, { ID: 'String' }, JAVA_SCALARS),
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
            if (graphqlType instanceof GraphQLObjectType) {
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
            const baseTypeNode = getBaseTypeNode(type);
            schemaType = this._schema.getType(baseTypeNode.name.value);
            isNonNull = type.kind === Kind.NON_NULL_TYPE;
        }
        else {
            schemaType = this._schema.getType(getBaseType(type).name);
            isNonNull = isNonNullType(type);
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
        if (isScalarType(schemaType)) {
            const scalar = this.scalars[schemaType.name] || 'Object';
            if (Imports[scalar]) {
                this._imports.add(Imports[scalar]);
            }
            typeToUse = scalar;
        }
        else if (isInputObjectType(schemaType)) {
            // Make sure to import it if it's in use
            this._imports.add(`${this.config.typePackage}.${schemaType.name}`);
        }
        return typeToUse;
    }
    getListTypeWrapped(toWrap, type) {
        if (isNonNullType(type)) {
            return this.getListTypeWrapped(toWrap, type.ofType);
        }
        if (isListType(type)) {
            const child = this.getListTypeWrapped(toWrap, type.ofType);
            this._imports.add(Imports.List);
            return `List<${child}>`;
        }
        return toWrap;
    }
    getListTypeNodeWrapped(toWrap, type) {
        if (type.kind === Kind.NON_NULL_TYPE) {
            return this.getListTypeNodeWrapped(toWrap, type.type);
        }
        if (type.kind === Kind.LIST_TYPE) {
            const child = this.getListTypeNodeWrapped(toWrap, type.type);
            this._imports.add(Imports.List);
            return `List<${child}>`;
        }
        return toWrap;
    }
}
//# sourceMappingURL=base-java-visitor.js.map