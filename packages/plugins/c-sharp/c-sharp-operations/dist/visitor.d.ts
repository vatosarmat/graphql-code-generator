import {
  ClientSideBaseVisitor,
  ClientSideBasePluginConfig,
  LoadedFragment,
} from '@graphql-codegen/visitor-plugin-common';
import { OperationDefinitionNode, GraphQLSchema } from 'graphql';
import { CSharpOperationsRawPluginConfig } from './config';
import { Types } from '@graphql-codegen/plugin-helpers';
export interface CSharpOperationsPluginConfig extends ClientSideBasePluginConfig {
  namespaceName: string;
  namedClient: string;
  querySuffix: string;
  mutationSuffix: string;
  subscriptionSuffix: string;
}
export declare class CSharpOperationsVisitor extends ClientSideBaseVisitor<
  CSharpOperationsRawPluginConfig,
  CSharpOperationsPluginConfig
> {
  private _operationsToInclude;
  constructor(
    schema: GraphQLSchema,
    fragments: LoadedFragment[],
    rawConfig: CSharpOperationsRawPluginConfig,
    documents?: Types.DocumentFile[]
  );
  private overruleConfigSettings;
  private _operationHasDirective;
  private _extractDirective;
  private _namedClient;
  private _extractNamedClient;
  protected _gql(node: OperationDefinitionNode): string;
  private _getDocumentNodeVariable;
  private _gqlInputSignature;
  private _operationSuffix;
  OperationDefinition(node: OperationDefinitionNode): string;
}
