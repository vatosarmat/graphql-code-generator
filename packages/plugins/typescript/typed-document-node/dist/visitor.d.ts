import { Types } from '@graphql-codegen/plugin-helpers';
import {
  LoadedFragment,
  ClientSideBaseVisitor,
  ClientSideBasePluginConfig,
  RawClientSideBasePluginConfig,
} from '@graphql-codegen/visitor-plugin-common';
import { GraphQLSchema } from 'graphql';
export declare class TypeScriptDocumentNodesVisitor extends ClientSideBaseVisitor<
  RawClientSideBasePluginConfig,
  ClientSideBasePluginConfig
> {
  constructor(
    schema: GraphQLSchema,
    fragments: LoadedFragment[],
    rawConfig: RawClientSideBasePluginConfig,
    documents: Types.DocumentFile[]
  );
  protected getDocumentNodeSignature(resultType: string, variablesTypes: string, node: any): string;
}
