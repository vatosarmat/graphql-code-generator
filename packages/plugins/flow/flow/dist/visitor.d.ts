import {
  NonNullTypeNode,
  ListTypeNode,
  ObjectTypeDefinitionNode,
  FieldDefinitionNode,
  EnumTypeDefinitionNode,
  NamedTypeNode,
  GraphQLSchema,
  InputValueDefinitionNode,
} from 'graphql';
import {
  BaseTypesVisitor,
  DeclarationBlock,
  ParsedTypesConfig,
  DeclarationKind,
} from '@graphql-codegen/visitor-plugin-common';
import { FlowPluginConfig } from './config';
export interface FlowPluginParsedConfig extends ParsedTypesConfig {
  useFlowExactObjects: boolean;
  useFlowReadOnlyTypes: boolean;
}
export declare class FlowVisitor extends BaseTypesVisitor<FlowPluginConfig, FlowPluginParsedConfig> {
  constructor(schema: GraphQLSchema, pluginConfig: FlowPluginConfig);
  protected _getScalar(name: string): string;
  InputValueDefinition(node: InputValueDefinitionNode, key?: number | string, parent?: any): string;
  NamedType(node: NamedTypeNode, key: any, parent: any, path: any, ancestors: any): string;
  ListType(node: ListTypeNode): string;
  NonNullType(node: NonNullTypeNode): string;
  FieldDefinition(node: FieldDefinitionNode): string;
  ObjectTypeDefinition(node: ObjectTypeDefinitionNode, key: number | string, parent: any): string;
  protected _buildTypeImport(identifier: string, source: string): string;
  protected mergeInterfaces(interfaces: string[], hasOtherFields: boolean): string;
  appendInterfacesAndFieldsToBlock(block: DeclarationBlock, interfaces: string[], fields: string[]): void;
  protected mergeAllFields(allFields: string[], hasInterfaces: boolean): string;
  handleEnumValueMapper(
    typeIdentifier: string,
    importIdentifier: string | null,
    sourceIdentifier: string | null,
    sourceFile: string | null
  ): string[];
  EnumTypeDefinition(node: EnumTypeDefinitionNode): string;
  protected getPunctuation(declarationKind: DeclarationKind): string;
}
