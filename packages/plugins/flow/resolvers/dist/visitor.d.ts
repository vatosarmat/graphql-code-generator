import {
  ListTypeNode,
  NamedTypeNode,
  NonNullTypeNode,
  GraphQLSchema,
  ScalarTypeDefinitionNode,
  InputValueDefinitionNode,
  EnumTypeDefinitionNode,
} from 'graphql';
import {
  RawResolversConfig,
  ParsedResolversConfig,
  BaseResolversVisitor,
  DeclarationKind,
} from '@graphql-codegen/visitor-plugin-common';
export declare const ENUM_RESOLVERS_SIGNATURE =
  'export type EnumResolverSignature<T, AllowedValues = any> = $ObjMap<T, () => AllowedValues>;';
export interface ParsedFlorResolversConfig extends ParsedResolversConfig {}
export declare class FlowResolversVisitor extends BaseResolversVisitor<RawResolversConfig, ParsedFlorResolversConfig> {
  constructor(pluginConfig: RawResolversConfig, schema: GraphQLSchema);
  protected _getScalar(name: string): string;
  protected applyRequireFields(argsType: string, fields: InputValueDefinitionNode[]): string;
  protected applyOptionalFields(argsType: string, _fields: readonly InputValueDefinitionNode[]): string;
  protected buildMapperImport(
    source: string,
    types: {
      identifier: string;
      asDefault?: boolean;
    }[]
  ): string;
  protected formatRootResolver(schemaTypeName: string, resolverType: string, declarationKind: DeclarationKind): string;
  protected transformParentGenericType(parentType: string): string;
  ListType(node: ListTypeNode): string;
  NamedType(node: NamedTypeNode): string;
  NonNullType(node: NonNullTypeNode): string;
  protected applyMaybe(str: string): string;
  protected clearMaybe(str: string): string;
  protected getTypeToUse(name: string): string;
  protected getParentTypeToUse(name: string): string;
  protected replaceFieldsInType(
    typeName: string,
    relevantFields: {
      fieldName: string;
      replaceWithType: string;
    }[]
  ): string;
  ScalarTypeDefinition(node: ScalarTypeDefinitionNode): string;
  protected getPunctuation(declarationKind: DeclarationKind): string;
  protected buildEnumResolverContentBlock(node: EnumTypeDefinitionNode, mappedEnumType: string): string;
  protected buildEnumResolversExplicitMappedValues(
    node: EnumTypeDefinitionNode,
    valuesMapping: {
      [valueName: string]: string | number;
    }
  ): string;
}
