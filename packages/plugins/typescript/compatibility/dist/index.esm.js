import { Kind, isUnionType, isInterfaceType, isObjectType, isListType, isNonNullType, concatAST, visit } from 'graphql';
import { BaseVisitor, getConfigValue, buildScalars, indent, DeclarationBlock } from '@graphql-codegen/visitor-plugin-common';
import { getBaseType } from '@graphql-codegen/plugin-helpers';
import { pascalCase } from 'pascal-case';

const handleTypeNameDuplicates = (result, name, prefix = '') => {
    let typeToUse = name;
    while (result[prefix + typeToUse]) {
        typeToUse = `_${typeToUse}`;
    }
    return prefix + typeToUse;
};
function transformNestedAst(type, base, applyNonNullable) {
    if (isListType(type)) {
        return applyNonNullable
            ? `NonNullable<${transformNestedAst(type.ofType, base, applyNonNullable)}[number]>`
            : `${transformNestedAst(type.ofType, base, applyNonNullable)}[number]`;
    }
    else if (isNonNullType(type)) {
        return transformNestedAst(type.ofType, base, applyNonNullable);
    }
    else {
        return applyNonNullable ? `(NonNullable<${base}>)` : base;
    }
}
function selectionSetToTypes(typesPrefix, baseVisitor, schema, parentTypeName, stack, fieldName, selectionSet, preResolveTypes, result = {}) {
    const parentType = schema.getType(parentTypeName);
    const typeName = baseVisitor.convertName(fieldName);
    if (selectionSet && selectionSet.selections && selectionSet.selections.length) {
        const typeToUse = handleTypeNameDuplicates(result, typeName, typesPrefix);
        result[typeToUse] = { export: 'type', name: stack };
        for (const selection of selectionSet.selections) {
            switch (selection.kind) {
                case Kind.FIELD: {
                    if (isObjectType(parentType) || isInterfaceType(parentType)) {
                        const selectionName = selection.alias && selection.alias.value ? selection.alias.value : selection.name.value;
                        if (!selectionName.startsWith('__')) {
                            const field = parentType.getFields()[selection.name.value];
                            const baseType = getBaseType(field.type);
                            const typeRef = `${stack}['${selectionName}']`;
                            const newStack = transformNestedAst(field.type, typeRef, baseVisitor.config.strict || baseVisitor.config.preResolveTypes);
                            selectionSetToTypes(typesPrefix, baseVisitor, schema, baseType.name, newStack, selectionName, selection.selectionSet, preResolveTypes, result);
                        }
                    }
                    break;
                }
                case Kind.INLINE_FRAGMENT: {
                    const typeCondition = selection.typeCondition.name.value;
                    const fragmentName = baseVisitor.convertName(typeCondition, { suffix: 'InlineFragment' });
                    let inlineFragmentValue;
                    if (isUnionType(parentType) || isInterfaceType(parentType)) {
                        inlineFragmentValue = `DiscriminateUnion<${stack}, { __typename${baseVisitor.config.nonOptionalTypename ? '' : '?'}: '${typeCondition}' }>`;
                    }
                    else {
                        let encounteredNestedInlineFragment = false;
                        const subSelections = selection.selectionSet.selections
                            .map(subSelection => {
                            switch (subSelection.kind) {
                                case Kind.FIELD:
                                    return `'${subSelection.name.value}'`;
                                case Kind.FRAGMENT_SPREAD:
                                    return `keyof ${baseVisitor.convertName(subSelection.name.value, { suffix: 'Fragment' })}`;
                                case Kind.INLINE_FRAGMENT:
                                    encounteredNestedInlineFragment = true;
                                    return null;
                            }
                        })
                            .filter(a => a);
                        if (encounteredNestedInlineFragment) {
                            throw new Error('Nested inline fragments are not supported the `typescript-compatibility` plugin');
                        }
                        else if (subSelections.length) {
                            inlineFragmentValue = `{ __typename: '${typeCondition}' } & Pick<${stack}, ${subSelections.join(' | ')}>`;
                        }
                    }
                    if (inlineFragmentValue) {
                        selectionSetToTypes(typesPrefix, baseVisitor, schema, typeCondition, `(${inlineFragmentValue})`, fragmentName, selection.selectionSet, preResolveTypes, result);
                    }
                    break;
                }
            }
        }
    }
    return result;
}

class CompatibilityPluginVisitor extends BaseVisitor {
    constructor(rawConfig, _schema, options) {
        super(rawConfig, {
            reactApollo: options.reactApollo,
            noNamespaces: getConfigValue(rawConfig.noNamespaces, false),
            preResolveTypes: getConfigValue(rawConfig.preResolveTypes, false),
            strict: getConfigValue(rawConfig.strict, false),
            scalars: buildScalars(_schema, rawConfig.scalars),
        });
        this._schema = _schema;
    }
    getRootType(operationType) {
        if (operationType === 'query') {
            return this._schema.getQueryType().name;
        }
        else if (operationType === 'mutation') {
            return this._schema.getMutationType().name;
        }
        else if (operationType === 'subscription') {
            return this._schema.getSubscriptionType().name;
        }
        return null;
    }
    buildOperationBlock(node) {
        const typeName = this.getRootType(node.operation);
        const baseName = this.convertName(node.name.value, { suffix: `${pascalCase(node.operation)}` });
        const typesPrefix = this.config.noNamespaces ? this.convertName(node.name.value) : '';
        const selectionSetTypes = {
            [typesPrefix + this.convertName('Variables')]: {
                export: 'type',
                name: this.convertName(node.name.value, { suffix: `${pascalCase(node.operation)}Variables` }),
            },
        };
        selectionSetToTypes(typesPrefix, this, this._schema, typeName, baseName, node.operation, node.selectionSet, this.config.preResolveTypes, selectionSetTypes);
        return selectionSetTypes;
    }
    buildFragmentBlock(node) {
        const typeName = this._schema.getType(node.typeCondition.name.value).name;
        const baseName = this.convertName(node.name.value, { suffix: `Fragment` });
        const typesPrefix = this.config.noNamespaces ? this.convertName(node.name.value) : '';
        const selectionSetTypes = {};
        selectionSetToTypes(typesPrefix, this, this._schema, typeName, baseName, 'fragment', node.selectionSet, this.config.preResolveTypes, selectionSetTypes);
        return selectionSetTypes;
    }
    printTypes(selectionSetTypes) {
        return Object.keys(selectionSetTypes)
            .filter(typeName => typeName !== selectionSetTypes[typeName].name)
            .map(typeName => `export ${selectionSetTypes[typeName].export} ${typeName} = ${selectionSetTypes[typeName].name};`)
            .map(m => (this.config.noNamespaces ? m : indent(m)))
            .join('\n');
    }
    FragmentDefinition(node) {
        const baseName = node.name.value;
        const results = [];
        const convertedName = this.convertName(baseName);
        const selectionSetTypes = this.buildFragmentBlock(node);
        const fragmentBlock = this.printTypes(selectionSetTypes);
        if (!this.config.noNamespaces) {
            results.push(new DeclarationBlock(this._declarationBlockConfig)
                .export()
                .asKind('namespace')
                .withName(convertedName)
                .withBlock(fragmentBlock).string);
        }
        else {
            results.push(fragmentBlock);
        }
        return results.join('\n');
    }
    OperationDefinition(node) {
        const baseName = node.name.value;
        const convertedName = this.convertName(baseName);
        const results = [];
        const selectionSetTypes = this.buildOperationBlock(node);
        if (this.config.reactApollo) {
            const reactApolloConfig = this.config.reactApollo;
            let hoc = true;
            let component = true;
            let hooks = false;
            if (typeof reactApolloConfig === 'object') {
                if (reactApolloConfig.withHOC === false) {
                    hoc = false;
                }
                if (reactApolloConfig.withComponent === false) {
                    component = false;
                }
                if (reactApolloConfig.withHooks) {
                    hooks = true;
                }
            }
            const prefix = this.config.noNamespaces ? convertedName : '';
            selectionSetTypes[prefix + 'Document'] = {
                export: 'const',
                name: this.convertName(baseName, { suffix: 'Document' }),
            };
            if (hoc) {
                selectionSetTypes[prefix + 'Props'] = {
                    export: 'type',
                    name: this.convertName(baseName, { suffix: 'Props' }),
                };
                selectionSetTypes[prefix + 'HOC'] = {
                    export: 'const',
                    name: `with${convertedName}`,
                };
            }
            if (component) {
                selectionSetTypes[prefix + 'Component'] = {
                    export: 'const',
                    name: this.convertName(baseName, { suffix: 'Component' }),
                };
            }
            if (hooks) {
                selectionSetTypes['use' + prefix] = {
                    export: 'const',
                    name: 'use' + this.convertName(baseName, { suffix: pascalCase(node.operation) }),
                };
            }
        }
        const operationsBlock = this.printTypes(selectionSetTypes);
        if (!this.config.noNamespaces) {
            results.push(new DeclarationBlock(this._declarationBlockConfig)
                .export()
                .asKind('namespace')
                .withName(convertedName)
                .withBlock(operationsBlock).string);
        }
        else {
            results.push(operationsBlock);
        }
        return results.join('\n');
    }
}

const REACT_APOLLO_PLUGIN_NAME = 'typescript-react-apollo';
const plugin = async (schema, documents, config, additionalData) => {
    const allAst = concatAST(documents.map(v => v.document));
    const reactApollo = ((additionalData || {}).allPlugins || []).find(p => Object.keys(p)[0] === REACT_APOLLO_PLUGIN_NAME);
    const visitor = new CompatibilityPluginVisitor(config, schema, {
        reactApollo: reactApollo
            ? {
                ...(config || {}),
                ...reactApollo[REACT_APOLLO_PLUGIN_NAME],
            }
            : null,
    });
    const visitorResult = visit(allAst, {
        leave: visitor,
    });
    const discriminateUnion = `type DiscriminateUnion<T, U> = T extends U ? T : never;\n`;
    const result = visitorResult.definitions.filter(a => a && typeof a === 'string').join('\n');
    return result.includes('DiscriminateUnion') ? [discriminateUnion, result].join('\n') : result;
};

export { plugin };
//# sourceMappingURL=index.esm.js.map
