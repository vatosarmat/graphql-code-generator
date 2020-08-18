import { printSchemaWithDirectives } from '@graphql-tools/utils';
import { addFederationReferencesToSchema } from '@graphql-codegen/plugin-helpers';
import { printSchema, parse, visit } from 'graphql';
import autoBind from 'auto-bind';
import { BaseResolversVisitor, DeclarationBlock, indent } from '@graphql-codegen/visitor-plugin-common';
import { FlowOperationVariablesToObject } from '@graphql-codegen/flow';

const FLOW_REQUIRE_FIELDS_TYPE = `export type $RequireFields<Origin, Keys> = $Diff<Origin, Keys> & $ObjMapi<Keys, <Key>(k: Key) => $NonMaybeType<$ElementType<Origin, Key>>>;`;

const ENUM_RESOLVERS_SIGNATURE = 'export type EnumResolverSignature<T, AllowedValues = any> = $ObjMap<T, () => AllowedValues>;';
class FlowResolversVisitor extends BaseResolversVisitor {
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
    applyOptionalFields(argsType, fields) {
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

const plugin = (schema, documents, config) => {
    const imports = ['type GraphQLResolveInfo'];
    const showUnusedMappers = typeof config.showUnusedMappers === 'boolean' ? config.showUnusedMappers : true;
    const gqlImports = `import { ${imports.join(', ')} } from 'graphql';`;
    const transformedSchema = config.federation ? addFederationReferencesToSchema(schema) : schema;
    const printedSchema = config.federation
        ? printSchemaWithDirectives(transformedSchema)
        : printSchema(transformedSchema);
    const astNode = parse(printedSchema);
    const visitor = new FlowResolversVisitor(config, transformedSchema);
    const visitorResult = visit(astNode, { leave: visitor });
    const defsToInclude = [visitor.getResolverTypeWrapperSignature()];
    if (visitor.hasFederation()) {
        defsToInclude.push(`
    export type ReferenceResolver<TResult, TReference, TContext> = (
      reference: TReference,
      context: TContext,
      info: GraphQLResolveInfo
    ) => Promise<TResult> | TResult;
    `);
        defsToInclude.push(`export type RecursivePick<T, U> = T`);
    }
    const header = `export type Resolver<Result, Parent = {}, Context = {}, Args = {}> = (
  parent: Parent,
  args: Args,
  context: Context,
  info: GraphQLResolveInfo
) => Promise<Result> | Result;

export type SubscriptionSubscribeFn<Result, Parent, Context, Args> = (
  parent: Parent,
  args: Args,
  context: Context,
  info: GraphQLResolveInfo
) => AsyncIterator<Result> | Promise<AsyncIterator<Result>>;

export type SubscriptionResolveFn<Result, Parent, Context, Args> = (
  parent: Parent,
  args: Args,
  context: Context,
  info: GraphQLResolveInfo
) => Result | Promise<Result>;

export interface SubscriptionSubscriberObject<Result, Key: string, Parent, Context, Args> {
  subscribe: SubscriptionSubscribeFn<{ [key: Key]: Result }, Parent, Context, Args>;
  resolve?: SubscriptionResolveFn<Result, { [key: Key]: Result }, Context, Args>;
}

export interface SubscriptionResolverObject<Result, Parent, Context, Args> {
  subscribe: SubscriptionSubscribeFn<mixed, Parent, Context, Args>;
  resolve: SubscriptionResolveFn<Result, mixed, Context, Args>;
}

export type SubscriptionObject<Result, Key: string, Parent, Context, Args> =
  | SubscriptionSubscriberObject<Result, Key, Parent, Context, Args>
  | SubscriptionResolverObject<Result, Parent, Context, Args>;

export type SubscriptionResolver<Result, Key: string, Parent = {}, Context = {}, Args = {}> =
  | ((...args: Array<any>) => SubscriptionObject<Result, Key, Parent, Context, Args>)
  | SubscriptionObject<Result, Key, Parent, Context, Args>;

export type TypeResolveFn<Types, Parent = {}, Context = {}> = (
  parent: Parent,
  context: Context,
  info: GraphQLResolveInfo
) => ?Types | Promise<?Types>;

export type IsTypeOfResolverFn<T = {}> = (obj: T, info: GraphQLResolveInfo) => boolean | Promise<boolean>;

export type NextResolverFn<T> = () => Promise<T>;

export type DirectiveResolverFn<Result = {}, Parent = {}, Args = {}, Context = {}> = (
  next: NextResolverFn<Result>,
  parent: Parent,
  args: Args,
  context: Context,
  info: GraphQLResolveInfo
) => Result | Promise<Result>;

${defsToInclude.join('\n')}
`;
    const resolversTypeMapping = visitor.buildResolversTypes();
    const resolversParentTypeMapping = visitor.buildResolversParentTypes();
    const { getRootResolver, getAllDirectiveResolvers, mappersImports, unusedMappers, hasScalars } = visitor;
    if (hasScalars()) {
        imports.push('type GraphQLScalarTypeConfig');
    }
    if (showUnusedMappers && unusedMappers.length) {
        // eslint-disable-next-line no-console
        console.warn(`Unused mappers: ${unusedMappers.join(',')}`);
    }
    return {
        prepend: [gqlImports, ...mappersImports, ...visitor.globalDeclarations],
        content: [
            header,
            resolversTypeMapping,
            resolversParentTypeMapping,
            ...visitorResult.definitions.filter(d => typeof d === 'string'),
            getRootResolver(),
            getAllDirectiveResolvers(),
        ].join('\n'),
    };
};

export { plugin };
//# sourceMappingURL=index.esm.js.map
