import { BaseVisitor, DeclarationBlock, indent, getConfigValue, buildScalars, } from '@graphql-codegen/visitor-plugin-common';
import { selectionSetToTypes } from './selection-set-to-types';
import { pascalCase } from 'pascal-case';
export class CompatibilityPluginVisitor extends BaseVisitor {
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
//# sourceMappingURL=visitor.js.map