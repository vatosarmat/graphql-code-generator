import { parse, GraphQLObjectType, isObjectType, printType, Kind, visit, } from 'graphql';
import { merge } from 'lodash';
import { getBaseType } from './utils';
/**
 * Federation Spec
 */
export const federationSpec = parse(/* GraphQL */ `
  scalar _FieldSet

  directive @external on FIELD_DEFINITION
  directive @requires(fields: _FieldSet!) on FIELD_DEFINITION
  directive @provides(fields: _FieldSet!) on FIELD_DEFINITION
  directive @key(fields: _FieldSet!) on OBJECT | INTERFACE
`);
/**
 * Adds `__resolveReference` in each ObjectType involved in Federation.
 * @param schema
 */
export function addFederationReferencesToSchema(schema) {
    const typeMap = schema.getTypeMap();
    for (const typeName in typeMap) {
        const type = schema.getType(typeName);
        if (isObjectType(type) && isFederationObjectType(type)) {
            const typeConfig = type.toConfig();
            typeConfig.fields = {
                [resolveReferenceFieldName]: {
                    type,
                },
                ...typeConfig.fields,
            };
            const newType = new GraphQLObjectType(typeConfig);
            newType.astNode = newType.astNode || parse(printType(newType)).definitions[0];
            newType.astNode.fields.unshift({
                kind: Kind.FIELD_DEFINITION,
                name: {
                    kind: Kind.NAME,
                    value: resolveReferenceFieldName,
                },
                type: {
                    kind: Kind.NAMED_TYPE,
                    name: {
                        kind: Kind.NAME,
                        value: typeName,
                    },
                },
            });
            typeMap[typeName] = newType;
        }
    }
    return schema;
}
/**
 * Removes Federation Spec from GraphQL Schema
 * @param schema
 * @param config
 */
export function removeFederation(schema) {
    const queryType = schema.getQueryType();
    const queryTypeFields = queryType.getFields();
    delete queryTypeFields._entities;
    delete queryTypeFields._service;
    const typeMap = schema.getTypeMap();
    delete typeMap._Service;
    delete typeMap._Entity;
    delete typeMap._Any;
    return schema;
}
const resolveReferenceFieldName = '__resolveReference';
export class ApolloFederation {
    constructor({ enabled, schema }) {
        this.enabled = false;
        this.enabled = enabled;
        this.schema = schema;
        this.providesMap = this.createMapOfProvides();
    }
    /**
     * Excludes types definde by Federation
     * @param typeNames List of type names
     */
    filterTypeNames(typeNames) {
        return this.enabled ? typeNames.filter(t => t !== '_FieldSet') : typeNames;
    }
    /**
     * Excludes `__resolveReference` fields
     * @param fieldNames List of field names
     */
    filterFieldNames(fieldNames) {
        return this.enabled ? fieldNames.filter(t => t !== resolveReferenceFieldName) : fieldNames;
    }
    /**
     * Decides if directive should not be generated
     * @param name directive's name
     */
    skipDirective(name) {
        return this.enabled && ['external', 'requires', 'provides', 'key'].includes(name);
    }
    /**
     * Decides if scalar should not be generated
     * @param name directive's name
     */
    skipScalar(name) {
        return this.enabled && name === '_FieldSet';
    }
    /**
     * Decides if field should not be generated
     * @param data
     */
    skipField({ fieldNode, parentType }) {
        if (!this.enabled || !isObjectType(parentType) || !isFederationObjectType(parentType)) {
            return false;
        }
        return this.isExternalAndNotProvided(fieldNode, parentType);
    }
    isResolveReferenceField(fieldNode) {
        const name = typeof fieldNode.name === 'string' ? fieldNode.name : fieldNode.name.value;
        return this.enabled && name === resolveReferenceFieldName;
    }
    /**
     * Transforms ParentType signature in ObjectTypes involved in Federation
     * @param data
     */
    transformParentType({ fieldNode, parentType, parentTypeSignature, }) {
        if (this.enabled &&
            isObjectType(parentType) &&
            isFederationObjectType(parentType) &&
            (isTypeExtension(parentType) || fieldNode.name.value === resolveReferenceFieldName)) {
            const keys = getDirectivesByName('key', parentType);
            if (keys.length) {
                const outputs = [`{ __typename: '${parentType.name}' } &`];
                // Look for @requires and see what the service needs and gets
                const requires = getDirectivesByName('requires', fieldNode).map(this.extractKeyOrRequiresFieldSet);
                const requiredFields = this.translateFieldSet(merge({}, ...requires), parentTypeSignature);
                // @key() @key() - "primary keys" in Federation
                const primaryKeys = keys.map(def => {
                    const fields = this.extractKeyOrRequiresFieldSet(def);
                    return this.translateFieldSet(fields, parentTypeSignature);
                });
                const [open, close] = primaryKeys.length > 1 ? ['(', ')'] : ['', ''];
                outputs.push([open, primaryKeys.join(' | '), close].join(''));
                // include required fields
                if (requires.length) {
                    outputs.push(`& ${requiredFields}`);
                }
                return outputs.join(' ');
            }
        }
        return parentTypeSignature;
    }
    isExternalAndNotProvided(fieldNode, objectType) {
        return this.isExternal(fieldNode) && !this.hasProvides(objectType, fieldNode);
    }
    isExternal(node) {
        return getDirectivesByName('external', node).length > 0;
    }
    hasProvides(objectType, node) {
        const fields = this.providesMap[isObjectType(objectType) ? objectType.name : objectType.name.value];
        if (fields && fields.length) {
            return fields.includes(node.name.value);
        }
        return false;
    }
    translateFieldSet(fields, parentTypeRef) {
        return `GraphQLRecursivePick<${parentTypeRef}, ${JSON.stringify(fields)}>`;
    }
    extractKeyOrRequiresFieldSet(directive) {
        const arg = directive.arguments.find(arg => arg.name.value === 'fields');
        const value = arg.value.value;
        return visit(parse(`{${value}}`), {
            leave: {
                SelectionSet(node) {
                    return node.selections.reduce((accum, field) => {
                        accum[field.name] = field.selection;
                        return accum;
                    }, {});
                },
                Field(node) {
                    return {
                        name: node.name.value,
                        selection: node.selectionSet ? node.selectionSet : true,
                    };
                },
                Document(node) {
                    return node.definitions.find((def) => def.kind === 'OperationDefinition' && def.operation === 'query').selectionSet;
                },
            },
        });
    }
    extractProvidesFieldSet(directive) {
        const arg = directive.arguments.find(arg => arg.name.value === 'fields');
        const value = arg.value.value;
        if (/[{}]/gi.test(value)) {
            throw new Error('Nested fields in _FieldSet is not supported in the @provides directive');
        }
        return value.split(/\s+/g);
    }
    createMapOfProvides() {
        const providesMap = {};
        Object.keys(this.schema.getTypeMap()).forEach(typename => {
            const objectType = this.schema.getType(typename);
            if (isObjectType(objectType)) {
                Object.values(objectType.getFields()).forEach(field => {
                    const provides = getDirectivesByName('provides', field.astNode)
                        .map(this.extractProvidesFieldSet)
                        .reduce((prev, curr) => [...prev, ...curr], []);
                    const ofType = getBaseType(field.type);
                    if (!providesMap[ofType.name]) {
                        providesMap[ofType.name] = [];
                    }
                    providesMap[ofType.name].push(...provides);
                });
            }
        });
        return providesMap;
    }
}
/**
 * Checks if Object Type is involved in Federation. Based on `@key` directive
 * @param node Type
 */
function isFederationObjectType(node) {
    const definition = isObjectType(node)
        ? node.astNode || parse(printType(node)).definitions[0]
        : node;
    const name = definition.name.value;
    const directives = definition.directives;
    const isNotRoot = !['Query', 'Mutation', 'Subscription'].includes(name);
    const isNotIntrospection = !name.startsWith('__');
    const hasKeyDirective = directives.some(d => d.name.value === 'key');
    return isNotRoot && isNotIntrospection && hasKeyDirective;
}
/**
 * Extracts directives from a node based on directive's name
 * @param name directive name
 * @param node ObjectType or Field
 */
function getDirectivesByName(name, node) {
    let astNode;
    if (isObjectType(node)) {
        astNode = node.astNode;
    }
    else {
        astNode = node;
    }
    if (astNode && astNode.directives) {
        return astNode.directives.filter(d => d.name.value === name);
    }
    return [];
}
/**
 * Checks if the Object Type extends a federated type from a remote schema.
 * Based on if any of its fields contain the `@external` directive
 * @param node Type
 */
function isTypeExtension(node) {
    var _a;
    const definition = isObjectType(node)
        ? node.astNode || parse(printType(node)).definitions[0]
        : node;
    return (_a = definition.fields) === null || _a === void 0 ? void 0 : _a.some(field => getDirectivesByName('external', field).length);
}
//# sourceMappingURL=federation.js.map