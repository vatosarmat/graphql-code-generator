import { TypeScriptDocumentNodesRawPluginConfig } from '.';
import { Types } from '@graphql-codegen/plugin-helpers';
import {
  LoadedFragment,
  ClientSideBaseVisitor,
  NamingConvention,
  ClientSideBasePluginConfig,
} from '@graphql-codegen/visitor-plugin-common';
import { GraphQLSchema } from 'graphql';
export interface TypeScriptDocumentNodesPluginConfig extends ClientSideBasePluginConfig {
  namingConvention: NamingConvention;
  transformUnderscore: boolean;
}
export declare class TypeScriptDocumentNodesVisitor extends ClientSideBaseVisitor<
  TypeScriptDocumentNodesRawPluginConfig,
  TypeScriptDocumentNodesPluginConfig
> {
  constructor(
    schema: GraphQLSchema,
    fragments: LoadedFragment[],
    rawConfig: TypeScriptDocumentNodesRawPluginConfig,
    documents: Types.DocumentFile[]
  );
}
