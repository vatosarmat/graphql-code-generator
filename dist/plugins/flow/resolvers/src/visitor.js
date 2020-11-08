import autoBind from 'auto-bind';
import { indent, BaseResolversVisitor, DeclarationBlock, } from '@graphql-codegen/visitor-plugin-common';
import { FlowOperationVariablesToObject } from '@graphql-codegen/flow';
import { FLOW_REQUIRE_FIELDS_TYPE } from './flow-util-types';
export const ENUM_RESOLVERS_SIGNATURE = 'export type EnumResolverSignature<T, AllowedValues = any> = $ObjMap<T, () => AllowedValues>;';
export class FlowResolversVisitor extends BaseResolversVisitor {
    constructor(pluginConfig, schema) {
        super(pluginConfig, null, schema);
        autoBind(this);
        this.setVariablesTransformer(new FlowOperationVariablesToObject(this.scalars, this.convertName, this.config.namespacedImportName));
    }
    _getScalar(name) {
        return `$ElementType<Scalars, '${name}'>`;
    }
    applyRequireFields(argsType, fields) {
        this._globalDeclarations.add(FLOW_REQUIRE_FIELDS_TYPE);
        return `$RequireFields<${argsType}, { ${fields.map(f => `${f.name.value}: *`).join(', ')} }>`;
    }
    applyOptionalFields(argsType, _fields) {
        return argsType;
    }
    buildMapperImport(source, types) {
        if (types[0] && types[0].asDefault) {
            return `import type ${types[0].identifier} from '${source}';`;
        }
        return `import { ${types.map(t => `type ${t.identifier}`).join(', ')} } from '${source}';`;
    }
    formatRootResolver(schemaTypeName, resolverType, declarationKind) {
        return `${schemaTypeName}?: ${resolverType}${resolverType.includes('<') ? '' : '<>'}${this.getPunctuation(declarationKind)}`;
    }
    transformParentGenericType(parentType) {
        return `ParentType = ${parentType}`;
    }
    ListType(node) {
        return `?${super.ListType(node)}`;
    }
    NamedType(node) {
        return `?${super.NamedType(node)}`;
    }
    NonNullType(node) {
        const baseValue = super.NonNullType(node);
        if (baseValue.startsWith('?')) {
            return baseValue.substr(1);
        }
        return baseValue;
    }
    applyMaybe(str) {
        return `?${str}`;
    }
    clearMaybe(str) {
        if (str.startsWith('?')) {
            return str.substr(1);
        }
        return str;
    }
    getTypeToUse(name) {
        const resolversType = this.convertName('ResolversTypes');
        return `$ElementType<${resolversType}, '${name}'>`;
    }
    getParentTypeToUse(name) {
        const resolversType = this.convertName('ResolversParentTypes');
        return `$ElementType<${resolversType}, '${name}'>`;
    }
    replaceFieldsInType(typeName, relevantFields) {
        return `$Diff<${typeName}, { ${relevantFields
            .map(f => `${f.fieldName}: * `)
            .join(', ')} }> & { ${relevantFields.map(f => `${f.fieldName}: ${f.replaceWithType}`).join(', ')} }`;
    }
    ScalarTypeDefinition(node) {
        const nameAsString = node.name;
        const baseName = this.getTypeToUse(nameAsString);
        this._collectedResolvers[node.name] = 'GraphQLScalarType';
        return new DeclarationBlock({
            ...this._declarationBlockConfig,
            blockTransformer(block) {
                return block;
            },
        })
            .export()
            .asKind('type')
            .withName(this.convertName(node, {
            suffix: 'ScalarConfig',
        }))
            .withBlock([indent(`...GraphQLScalarTypeConfig<${baseName}, any>`), indent(`name: '${node.name}'`)].join(', \n'))
            .string;
    }
    getPunctuation(declarationKind) {
        return declarationKind === 'type' ? ',' : ';';
    }
    buildEnumResolverContentBlock(node, mappedEnumType) {
        const valuesMap = `{| ${(node.values || [])
            .map(v => `${v.name}${this.config.avoidOptionals ? '' : '?'}: *`)
            .join(', ')} |}`;
        this._globalDeclarations.add(ENUM_RESOLVERS_SIGNATURE);
        return `EnumResolverSignature<${valuesMap}, ${mappedEnumType}>`;
    }
    buildEnumResolversExplicitMappedValues(node, valuesMapping) {
        return `{| ${(node.values || [])
            .map(v => {
            const valueName = v.name;
            const mappedValue = valuesMapping[valueName];
            return `${valueName}: ${typeof mappedValue === 'number' ? mappedValue : `'${mappedValue}'`}`;
        })
            .join(', ')} |}`;
    }
}
//# sourceMappingURL=visitor.js.map