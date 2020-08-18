import { printSchema, parse, visit, concatAST, } from 'graphql';
import { DEFAULT_SCALARS } from '@graphql-codegen/visitor-plugin-common';
const transformScalar = (scalar) => {
    if (DEFAULT_SCALARS[scalar] === undefined) {
        return scalar;
    }
    return DEFAULT_SCALARS[scalar];
};
const createDocBlock = (lines) => {
    const typedef = [
        '/**',
        ...lines
            .filter(t => t && t !== '')
            .reduce((prev, t) => [...prev, ...t.split('\n')], [])
            .map(line => ` * ${line}`),
        ' */',
    ];
    const block = typedef.join('\n');
    return block;
};
const createDescriptionBlock = (nodeWithDesc) => {
    var _a;
    if ((_a = nodeWithDesc === null || nodeWithDesc === void 0 ? void 0 : nodeWithDesc.description) === null || _a === void 0 ? void 0 : _a.value) {
        return nodeWithDesc.description.value;
    }
    return '';
};
export const plugin = (schema, documents) => {
    const parsedSchema = parse(printSchema(schema));
    const mappedDocuments = documents.map(document => document.document).filter(document => document !== undefined);
    const ast = concatAST([parsedSchema, ...mappedDocuments]);
    const schemaTypes = visit(ast, {
        Document: {
            leave(node) {
                return node.definitions;
            },
        },
        ObjectTypeDefinition: {
            leave(node) {
                const typedNode = node;
                return createDocBlock([
                    createDescriptionBlock(node),
                    `@typedef {Object} ${typedNode.name}`,
                    ...typedNode.fields,
                ]);
            },
        },
        InputObjectTypeDefinition: {
            leave(node) {
                const typedNode = node;
                return createDocBlock([
                    createDescriptionBlock(node),
                    `@typedef {Object} ${typedNode.name}`,
                    ...typedNode.fields,
                ]);
            },
        },
        InterfaceTypeDefinition: {
            leave(node) {
                const typedNode = node;
                return createDocBlock([
                    createDescriptionBlock(node),
                    `@typedef {Object} ${typedNode.name}`,
                    ...typedNode.fields,
                ]);
            },
        },
        UnionTypeDefinition: {
            leave(node) {
                if (node.types !== undefined) {
                    return createDocBlock([createDescriptionBlock(node), `@typedef {(${node.types.join('|')})} ${node.name}`]);
                }
                return node;
            },
        },
        Name: {
            leave(node) {
                return node.value;
            },
        },
        NamedType: {
            leave(node) {
                return transformScalar(node.name);
            },
        },
        NonNullType: {
            leave(node, _, parent) {
                if (parent === undefined) {
                    return node;
                }
                return node.type;
            },
        },
        Directive: {
            enter(node) {
                var _a;
                if (node.name.value !== 'deprecated') {
                    return null;
                }
                const reason = (_a = node.arguments) === null || _a === void 0 ? void 0 : _a.find(arg => arg.name.value === 'reason');
                if ((reason === null || reason === void 0 ? void 0 : reason.value.kind) !== 'StringValue') {
                    return null;
                }
                return ` - DEPRECATED: ${reason.value.value}`;
            },
        },
        FieldDefinition: {
            enter(node) {
                if (node.type.kind === 'NonNullType') {
                    return { ...node, nonNullable: true };
                }
                return node;
            },
            leave(node) {
                var _a;
                const fieldName = node.nonNullable ? node.name : `[${node.name}]`;
                const description = node.description && node.description.value ? ` - ${node.description.value}` : '';
                const directives = (_a = node === null || node === void 0 ? void 0 : node.directives) === null || _a === void 0 ? void 0 : _a.filter(d => d !== null && d !== undefined);
                return `@property {${node.type}} ${fieldName}${description}${directives}`;
            },
        },
        InputValueDefinition: {
            enter(node) {
                if (node.type.kind === 'NonNullType') {
                    return { ...node, nonNullable: true };
                }
                return node;
            },
            leave(node) {
                const fieldName = node.nonNullable ? node.name : `[${node.name}]`;
                return `@property {${node.type}} ${fieldName}${node.description && node.description.value ? ` - ${node.description.value}` : ''}`;
            },
        },
        ListType: {
            enter(node) {
                if (node.type.kind === 'NonNullType') {
                    return { ...node, nonNullItems: true };
                }
                return node;
            },
            leave(node) {
                const type = node.nonNullItems ? node.type : `(${node.type}|null|undefined)`;
                return `Array<${type}>`;
            },
        },
        ScalarTypeDefinition: {
            leave(node) {
                return createDocBlock([createDescriptionBlock(node), `@typedef {*} ${node.name}`]);
            },
        },
        EnumTypeDefinition: {
            leave(node) {
                var _a;
                const values = (_a = node === null || node === void 0 ? void 0 : node.values) === null || _a === void 0 ? void 0 : _a.map(value => `"${value.name}"`).join('|');
                /** If for some reason the enum does not contain any values we fallback to "any" or "*" */
                const valueType = values ? `(${values})` : '*';
                return createDocBlock([createDescriptionBlock(node), `@typedef {${valueType}} ${node.name}`]);
            },
        },
        OperationDefinition: {
            enter() {
                /** This plugin currently does not support operations yet. */
                return null;
            },
        },
        FragmentDefinition: {
            enter() {
                /** This plugin currently does not support fragments yet. */
                return null;
            },
        },
    });
    return schemaTypes.join('\n\n');
};
//# sourceMappingURL=index.js.map