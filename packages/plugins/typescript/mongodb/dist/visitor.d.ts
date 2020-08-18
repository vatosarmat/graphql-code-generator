import { ParsedConfig, BaseVisitor } from '@graphql-codegen/visitor-plugin-common';
import { TypeScriptMongoPluginConfig } from './config';
import { GraphQLSchema, ObjectTypeDefinitionNode, InterfaceTypeDefinitionNode, UnionTypeDefinitionNode } from 'graphql';
export interface TypeScriptMongoPluginParsedConfig extends ParsedConfig {
  dbTypeSuffix: string;
  dbInterfaceSuffix: string;
  objectIdType: string;
  objectIdImport: string;
  idFieldName: string;
  enumsAsString: boolean;
  avoidOptionals: boolean;
}
export declare class TsMongoVisitor extends BaseVisitor<
  TypeScriptMongoPluginConfig,
  TypeScriptMongoPluginParsedConfig
> {
  private _schema;
  private _variablesTransformer;
  constructor(_schema: GraphQLSchema, pluginConfig: TypeScriptMongoPluginConfig);
  get objectIdImport(): string;
  private _resolveDirectiveValue;
  private _getDirectiveArgValue;
  private _getDirectiveFromAstNode;
  private _buildInterfaces;
  private _handleIdField;
  private _handleLinkField;
  private _handleColumnField;
  private _handleEmbeddedField;
  private _buildFieldsTree;
  private _addAdditionalFields;
  InterfaceTypeDefinition(node: InterfaceTypeDefinitionNode): string;
  UnionTypeDefinition(node: UnionTypeDefinitionNode): string;
  ObjectTypeDefinition(node: ObjectTypeDefinitionNode): string;
}
